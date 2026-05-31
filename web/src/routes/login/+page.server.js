import { fail, redirect } from '@sveltejs/kit';
import {
	validateCredentials,
	createSession,
	destroySession,
	checkRateLimit,
	recordLoginAttempt
} from '$lib/server/auth.js';

/**
 * Extract client IP from request headers (respects reverse proxies).
 * @param {Request} request
 * @returns {string}
 */
function getClientIp(request) {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	return request.headers.get('x-real-ip') || '127.0.0.1';
}

/** @type {import('./$types').PageServerLoad} */
export async function load() {
	const oauthEnabled = process.env.WEB_PORTAL_OAUTH_ENABLED === 'true';
	const samlEnabled = process.env.WEB_PORTAL_SAML_ENABLED === 'true';

	return {
		authMethods: {
			oauth: oauthEnabled,
			saml: samlEnabled
		}
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username');
		const password = data.get('password');

		if (!username || typeof username !== 'string' || username.trim().length === 0) {
			return fail(400, { error: 'Username is required' });
		}

		if (!password || typeof password !== 'string' || password.length === 0) {
			return fail(400, { error: 'Password is required' });
		}

		const trimmedUsername = username.trim();
		const clientIp = getClientIp(request);
		const userAgent = request.headers.get('user-agent') || '';

		// OWASP: Check rate limit before attempting authentication
		// Graceful degradation if login_attempts table doesn't exist yet
		let rateLimit = { locked: false, remaining: 5, retryAfterSeconds: 0 };
		try {
			rateLimit = await checkRateLimit(clientIp);
		} catch {
			// Table may not exist yet — proceed without rate limiting
		}

		if (rateLimit.locked) {
			try { await recordLoginAttempt(trimmedUsername, clientIp, userAgent, 'account_locked'); } catch { /* table missing */ }
			return fail(429, {
				error: `Too many failed attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutes.`
			});
		}

		const user = await validateCredentials(trimmedUsername, password);

		if (!user) {
			// OWASP: Record failed attempt with generic reason (don't reveal if user exists)
			try { await recordLoginAttempt(trimmedUsername, clientIp, userAgent, 'invalid_credentials'); } catch { /* table missing */ }

			// Include remaining attempts hint (OWASP allows this for UX)
			const remaining = rateLimit.remaining - 1;
			if (remaining <= 2 && remaining > 0) {
				return fail(401, {
					error: `Invalid username or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
				});
			}
			return fail(401, { error: 'Invalid username or password' });
		}

		const token = await createSession(user.id);
		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.WEB_PORTAL_SECURE_COOKIES !== 'false',
			maxAge: 60 * 60 * 24
		});

		throw redirect(303, '/');
	},

	logout: async ({ cookies }) => {
		const token = cookies.get('session');
		await destroySession(token);
		cookies.delete('session', { path: '/' });
		throw redirect(303, '/login');
	}
};
