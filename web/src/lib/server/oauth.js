import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * OIDC Relying Party. Identity is established by cryptographically verifying the
 * signed id_token (JWKS signature + iss/aud/exp/nonce) — NOT by trusting the
 * userinfo response. State + nonce + PKCE bind the flow to one browser session.
 */

const OAUTH_ISSUER = (process.env.WEB_PORTAL_OAUTH_ISSUER_URL || '').replace(/\/$/, '');
const OAUTH_CLIENT_ID = process.env.WEB_PORTAL_OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.WEB_PORTAL_OAUTH_CLIENT_SECRET || '';
const OAUTH_SCOPES = process.env.WEB_PORTAL_OAUTH_SCOPES || 'openid profile email';
const OAUTH_CALLBACK_URL = process.env.WEB_PORTAL_OAUTH_CALLBACK_URL || '';
const HTTP_TIMEOUT_MS = 8000;

let discoveryCache = null;
let discoveryExpiry = 0;
let jwks = null;

/**
 * Check whether OAuth/OIDC is enabled and fully configured.
 */
export function isOAuthEnabled() {
	return (
		process.env.WEB_PORTAL_OAUTH_ENABLED === 'true' &&
		OAUTH_ISSUER.length > 0 &&
		OAUTH_CLIENT_ID.length > 0 &&
		OAUTH_CLIENT_SECRET.length > 0 &&
		OAUTH_CALLBACK_URL.length > 0
	);
}

/**
 * Fetch + cache the OIDC discovery document. Enforces https and that the
 * advertised issuer exactly matches our configured issuer (mix-up defense).
 */
async function discover() {
	if (discoveryCache && Date.now() < discoveryExpiry) {
		return discoveryCache;
	}

	if (!/^https:\/\//i.test(OAUTH_ISSUER)) {
		throw new Error('OAuth issuer must be an https URL');
	}

	const url = OAUTH_ISSUER + '/.well-known/openid-configuration';
	const res = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
	if (!res.ok) {
		throw new Error(`OIDC discovery failed: ${res.status}`);
	}

	const cfg = await res.json();
	if (cfg.issuer !== OAUTH_ISSUER) {
		throw new Error('OIDC discovery issuer mismatch');
	}
	if (!cfg.jwks_uri || !/^https:\/\//i.test(cfg.jwks_uri)) {
		throw new Error('OIDC discovery has no https jwks_uri');
	}

	discoveryCache = cfg;
	discoveryExpiry = Date.now() + 60 * 60 * 1000;
	return cfg;
}

function getJwks(jwksUri) {
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(jwksUri));
	}
	return jwks;
}

/**
 * Generate the per-login transient values: CSRF state, OIDC nonce, and a PKCE
 * verifier/challenge (S256). state + nonce + verifier are stored server-side
 * (httpOnly cookie); only the challenge goes to the IdP.
 */
export function generateLoginParams() {
	const state = crypto.randomBytes(32).toString('base64url');
	const nonce = crypto.randomBytes(32).toString('base64url');
	const codeVerifier = crypto.randomBytes(32).toString('base64url');
	const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
	return { state, nonce, codeVerifier, codeChallenge };
}

/**
 * Build the authorization URL to redirect the user to.
 * @param {{ state: string, nonce: string, codeChallenge: string }} params
 * @returns {Promise<string>}
 */
export async function getAuthorizationUrl({ state, nonce, codeChallenge }) {
	const config = await discover();
	const authEndpoint = config.authorization_endpoint;
	if (!authEndpoint) {
		throw new Error('OIDC provider has no authorization_endpoint');
	}

	const params = new URLSearchParams({
		response_type: 'code',
		client_id: OAUTH_CLIENT_ID,
		redirect_uri: OAUTH_CALLBACK_URL,
		scope: OAUTH_SCOPES,
		state,
		nonce,
		code_challenge: codeChallenge,
		code_challenge_method: 'S256'
	});

	return `${authEndpoint}?${params.toString()}`;
}

/**
 * Exchange an authorization code (+ PKCE verifier) for tokens.
 * @param {string} code
 * @param {string} codeVerifier
 */
async function exchangeCode(code, codeVerifier) {
	const config = await discover();
	const tokenEndpoint = config.token_endpoint;
	if (!tokenEndpoint) {
		throw new Error('OIDC provider has no token_endpoint');
	}

	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: OAUTH_CALLBACK_URL,
		client_id: OAUTH_CLIENT_ID,
		client_secret: OAUTH_CLIENT_SECRET,
		code_verifier: codeVerifier
	});

	const res = await fetch(tokenEndpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
		signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
	});

	if (!res.ok) {
		// Drain without surfacing the IdP body to the client/logs.
		await res.text().catch(() => {});
		throw new Error(`Token exchange failed: ${res.status}`);
	}

	return res.json();
}

/**
 * Complete the OIDC callback: exchange the code, then VERIFY the id_token
 * (signature against JWKS, iss/aud/exp, and nonce). Identity is derived from the
 * verified token claims.
 * @param {string} code
 * @param {{ nonce: string, codeVerifier: string }} ctx
 * @returns {Promise<{ sub: string, displayName: string, email?: string, emailVerified: boolean }>}
 */
export async function handleCallback(code, { nonce, codeVerifier }) {
	const config = await discover();
	const tokens = await exchangeCode(code, codeVerifier);

	if (!tokens.id_token) {
		throw new Error('OIDC provider did not return an id_token');
	}

	// jose verifies the signature against the IdP JWKS, rejects alg:none, and
	// enforces exp/nbf; we additionally pin issuer + audience.
	const { payload } = await jwtVerify(tokens.id_token, getJwks(config.jwks_uri), {
		issuer: OAUTH_ISSUER,
		audience: OAUTH_CLIENT_ID,
		clockTolerance: 60
	});

	if (!nonce || payload.nonce !== nonce) {
		throw new Error('OIDC nonce mismatch');
	}
	if (!payload.sub) {
		throw new Error('id_token has no subject identifier');
	}

	const displayName =
		payload.preferred_username ||
		payload.name ||
		payload.email ||
		payload.sub;

	return {
		sub: String(payload.sub),
		displayName: String(displayName),
		email: payload.email ? String(payload.email) : undefined,
		emailVerified: payload.email_verified === true
	};
}
