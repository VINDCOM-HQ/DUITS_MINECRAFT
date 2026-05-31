import crypto from 'node:crypto';

/**
 * Lightweight OIDC Relying Party using native fetch.
 * Supports any standard OpenID Connect provider via discovery.
 */

const OAUTH_ISSUER = process.env.WEB_PORTAL_OAUTH_ISSUER_URL || '';
const OAUTH_CLIENT_ID = process.env.WEB_PORTAL_OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.WEB_PORTAL_OAUTH_CLIENT_SECRET || '';
const OAUTH_SCOPES = process.env.WEB_PORTAL_OAUTH_SCOPES || 'openid profile email';
const OAUTH_CALLBACK_URL = process.env.WEB_PORTAL_OAUTH_CALLBACK_URL || '';

let discoveryCache = null;
let discoveryExpiry = 0;

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
 * Fetch the OIDC discovery document from the issuer.
 * Caches for 1 hour.
 */
async function discover() {
	if (discoveryCache && Date.now() < discoveryExpiry) {
		return discoveryCache;
	}

	const url = OAUTH_ISSUER.replace(/\/$/, '') + '/.well-known/openid-configuration';
	const res = await fetch(url);

	if (!res.ok) {
		throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`);
	}

	discoveryCache = await res.json();
	discoveryExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
	return discoveryCache;
}

/**
 * Generate a cryptographic state parameter for CSRF protection.
 * @returns {string}
 */
export function generateState() {
	return crypto.randomBytes(32).toString('hex');
}

/**
 * Build the authorization URL to redirect the user to.
 * @param {string} state - CSRF state parameter
 * @returns {Promise<string>}
 */
export async function getAuthorizationUrl(state) {
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
		state
	});

	return `${authEndpoint}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens.
 * @param {string} code
 * @returns {Promise<{access_token: string, id_token: string}>}
 */
async function exchangeCode(code) {
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
		client_secret: OAUTH_CLIENT_SECRET
	});

	const res = await fetch(tokenEndpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString()
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Token exchange failed: ${res.status} ${text}`);
	}

	return res.json();
}

/**
 * Fetch the user info from the OIDC provider.
 * @param {string} accessToken
 * @returns {Promise<{sub: string, name?: string, preferred_username?: string, email?: string}>}
 */
async function fetchUserInfo(accessToken) {
	const config = await discover();
	const userinfoEndpoint = config.userinfo_endpoint;

	if (!userinfoEndpoint) {
		throw new Error('OIDC provider has no userinfo_endpoint');
	}

	const res = await fetch(userinfoEndpoint, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	if (!res.ok) {
		throw new Error(`Userinfo request failed: ${res.status}`);
	}

	return res.json();
}

/**
 * Handle the full OIDC callback flow: exchange code, fetch userinfo.
 * @param {string} code - Authorization code from the provider
 * @returns {Promise<{sub: string, displayName: string}>}
 */
export async function handleCallback(code) {
	const tokens = await exchangeCode(code);
	const userInfo = await fetchUserInfo(tokens.access_token);

	if (!userInfo.sub) {
		throw new Error('OIDC provider did not return a subject identifier');
	}

	const displayName =
		userInfo.preferred_username ||
		userInfo.name ||
		userInfo.email ||
		userInfo.sub;

	return {
		sub: userInfo.sub,
		displayName
	};
}
