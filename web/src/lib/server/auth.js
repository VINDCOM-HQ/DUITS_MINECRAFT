import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query } from './db.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_SECRET = process.env.WEB_PORTAL_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// OWASP rate limiting: max 5 failed attempts per IP in a 15-minute window
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

/**
 * Validate a username/password against the users table.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{id: number, username: string, role: string} | null>}
 */
export async function validateCredentials(username, password) {
	const [rows] = await query(
		'SELECT id, username, password, role FROM users WHERE username = ? AND auth_source = ?',
		[username, 'local']
	);

	if (rows.length === 0) {
		return null;
	}

	const user = rows[0];

	if (!user.password) {
		return null;
	}

	const valid = await bcrypt.compare(password, user.password);
	if (!valid) {
		return null;
	}

	return { id: user.id, username: user.username, role: user.role };
}

/**
 * Find or create a user from an OAuth/SAML identity.
 * @param {'oauth' | 'saml'} source
 * @param {string} externalId - oauth_sub or saml_name_id
 * @param {string} displayName - fallback username
 * @returns {Promise<{id: number, username: string, role: string}>}
 */
export async function findOrCreateExternalUser(source, externalId, displayName) {
	const VALID_ID_COLUMNS = { oauth: 'oauth_sub', saml: 'saml_name_id' };
	const idColumn = VALID_ID_COLUMNS[source];
	if (!idColumn) {
		throw new Error(`Unknown auth source: ${source}`);
	}

	const [existing] = await query(
		`SELECT id, username, role FROM users WHERE auth_source = ? AND ${idColumn} = ?`,
		[source, externalId]
	);

	if (existing.length > 0) {
		return existing[0];
	}

	// Ensure unique username — truncate to prevent oversized values
	let username = (displayName || externalId).slice(0, 200);
	const [conflicts] = await query('SELECT id FROM users WHERE username = ?', [username]);
	if (conflicts.length > 0) {
		username = `${username.slice(0, 193)}_${crypto.randomBytes(3).toString('hex')}`;
	}

	const [result] = await query(
		`INSERT INTO users (username, role, auth_source, ${idColumn}) VALUES (?, ?, ?, ?)`,
		[username, 'user', source, externalId]
	);

	return { id: result.insertId, username, role: 'user' };
}

/**
 * Create a new session for a user.
 * Returns a signed session token to set as a cookie.
 * @param {number} userId
 * @returns {Promise<string>}
 */
export async function createSession(userId) {
	const sessionId = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

	await query(
		'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
		[sessionId, userId, expiresAt]
	);

	return signToken(sessionId);
}

/**
 * Verify a session token and return the associated user.
 * @param {string} token
 * @returns {Promise<{id: number, username: string, role: string} | null>}
 */
export async function verifySession(token) {
	if (!token || !token.includes('.')) {
		return null;
	}

	const sessionId = verifyTokenSignature(token);
	if (!sessionId) {
		return null;
	}

	const [rows] = await query(
		`SELECT u.id, u.username, u.role
		 FROM sessions s
		 JOIN users u ON s.user_id = u.id
		 WHERE s.id = ? AND s.expires_at > NOW()`,
		[sessionId]
	);

	if (rows.length === 0) {
		return null;
	}

	return rows[0];
}

/**
 * Destroy a session by its token.
 * @param {string} token
 */
export async function destroySession(token) {
	if (!token || !token.includes('.')) {
		return;
	}

	const sessionId = verifyTokenSignature(token);
	if (!sessionId) {
		return;
	}

	await query('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

/**
 * Check if an IP address is currently rate-limited due to too many failed login attempts.
 * @param {string} ipAddress
 * @returns {Promise<{locked: boolean, remaining: number, retryAfterSeconds: number}>}
 */
export async function checkRateLimit(ipAddress) {
	const [rows] = await query(
		`SELECT COUNT(*) AS attempts FROM login_attempts
		 WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
		[ipAddress, LOCKOUT_WINDOW_MINUTES]
	);

	const attempts = rows[0]?.attempts || 0;
	const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - attempts);

	if (attempts >= MAX_FAILED_ATTEMPTS) {
		// Find when the oldest attempt in the window expires
		const [oldest] = await query(
			`SELECT created_at FROM login_attempts
			 WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
			 ORDER BY created_at ASC LIMIT 1`,
			[ipAddress, LOCKOUT_WINDOW_MINUTES]
		);

		const retryAfterSeconds = oldest.length > 0
			? Math.max(0, Math.ceil((new Date(oldest[0].created_at).getTime() + LOCKOUT_WINDOW_MINUTES * 60 * 1000 - Date.now()) / 1000))
			: LOCKOUT_WINDOW_MINUTES * 60;

		return { locked: true, remaining: 0, retryAfterSeconds };
	}

	return { locked: false, remaining, retryAfterSeconds: 0 };
}

/**
 * Record a failed login attempt.
 * @param {string} username - The username that was attempted (may not exist)
 * @param {string} ipAddress
 * @param {string} userAgent
 * @param {'invalid_credentials' | 'account_locked'} reason
 */
export async function recordLoginAttempt(username, ipAddress, userAgent, reason) {
	await query(
		`INSERT INTO login_attempts (username, ip_address, user_agent, reason) VALUES (?, ?, ?, ?)`,
		[username.slice(0, 255), ipAddress.slice(0, 45), (userAgent || '').slice(0, 512), reason]
	);
}

/**
 * Get recent failed login attempts for admin display.
 * @param {{ limit?: number, offset?: number }} options
 * @returns {Promise<{ attempts: Array, total: number }>}
 */
export async function getLoginAttempts({ limit = 50, offset = 0 } = {}) {
	const safeLimit = Math.min(Math.max(1, limit), 100);
	const safeOffset = Math.max(0, offset);

	const [[countRow], [rows]] = await Promise.all([
		query('SELECT COUNT(*) AS total FROM login_attempts'),
		query(
			`SELECT id, username, ip_address, user_agent, reason, created_at
			 FROM login_attempts
			 ORDER BY created_at DESC
			 LIMIT ? OFFSET ?`,
			[safeLimit, safeOffset]
		)
	]);

	return {
		attempts: rows,
		total: countRow[0]?.total || 0
	};
}

/**
 * Get summary stats for failed login attempts (last 24h).
 * @returns {Promise<{ total24h: number, uniqueIps24h: number, uniqueUsernames24h: number, recentAttempts: Array }>}
 */
export async function getLoginAttemptsSummary() {
	const [[stats], [recent]] = await Promise.all([
		query(
			`SELECT
				COUNT(*) AS total,
				COUNT(DISTINCT ip_address) AS unique_ips,
				COUNT(DISTINCT username) AS unique_usernames
			 FROM login_attempts
			 WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
		),
		query(
			`SELECT username, ip_address, reason, created_at
			 FROM login_attempts
			 ORDER BY created_at DESC
			 LIMIT 5`
		)
	]);

	return {
		total24h: stats[0]?.total || 0,
		uniqueIps24h: stats[0]?.unique_ips || 0,
		uniqueUsernames24h: stats[0]?.unique_usernames || 0,
		recentAttempts: recent
	};
}

function signToken(sessionId) {
	const hmac = crypto.createHmac('sha256', SESSION_SECRET);
	hmac.update(sessionId);
	return `${sessionId}.${hmac.digest('hex')}`;
}

function verifyTokenSignature(token) {
	const dotIndex = token.indexOf('.');
	if (dotIndex === -1) {
		return null;
	}

	const sessionId = token.slice(0, dotIndex);
	const sig = token.slice(dotIndex + 1);

	const hmac = crypto.createHmac('sha256', SESSION_SECRET);
	hmac.update(sessionId);
	const expected = hmac.digest('hex');

	try {
		if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
			return null;
		}
	} catch {
		return null;
	}

	return sessionId;
}
