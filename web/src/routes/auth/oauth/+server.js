import { redirect } from '@sveltejs/kit';
import { isOAuthEnabled, getAuthorizationUrl, generateLoginParams } from '$lib/server/oauth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies }) {
	if (!isOAuthEnabled()) {
		throw redirect(303, '/login');
	}

	const { state, nonce, codeVerifier, codeChallenge } = generateLoginParams();
	const tx = Buffer.from(JSON.stringify({ state, nonce, codeVerifier })).toString('base64url');

	cookies.set('oauth_tx', tx, {
		path: '/',
		httpOnly: true,
		// Lax (not Strict): the IdP redirect back to the callback is a cross-site
		// top-level GET, on which a Strict cookie would not be sent. The state
		// value (validated on callback) is the CSRF defense.
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production' || process.env.WEB_PORTAL_SECURE_COOKIES !== 'false',
		maxAge: 600
	});

	const authUrl = await getAuthorizationUrl({ state, nonce, codeChallenge });
	throw redirect(302, authUrl);
}
