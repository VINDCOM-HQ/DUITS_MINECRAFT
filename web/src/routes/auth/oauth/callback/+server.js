import { redirect } from '@sveltejs/kit';
import { isOAuthEnabled, handleCallback } from '$lib/server/oauth.js';
import { findOrCreateExternalUser, createSession } from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, cookies }) {
	if (!isOAuthEnabled()) {
		throw redirect(303, '/login');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const oauthError = url.searchParams.get('error');

	if (oauthError) {
		console.error('[oauth] IdP returned error:', oauthError, url.searchParams.get('error_description') || '');
		throw redirect(303, '/login?error=oauth_failed');
	}
	if (!code || !state) {
		throw redirect(303, '/login?error=oauth_failed');
	}

	// CSRF: validate state against the transaction cookie (single-use).
	const txRaw = cookies.get('oauth_tx');
	cookies.delete('oauth_tx', { path: '/' });

	let tx = null;
	if (txRaw) {
		try { tx = JSON.parse(Buffer.from(txRaw, 'base64url').toString('utf8')); } catch { tx = null; }
	}
	if (!tx || !tx.state || tx.state !== state) {
		throw redirect(303, '/login?error=oauth_failed');
	}

	try {
		const { sub, displayName } = await handleCallback(code, {
			nonce: tx.nonce,
			codeVerifier: tx.codeVerifier
		});

		const user = await findOrCreateExternalUser('oauth', sub, displayName);
		const token = await createSession(user.id);

		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production' || process.env.WEB_PORTAL_SECURE_COOKIES !== 'false',
			maxAge: 60 * 60 * 24
		});

		throw redirect(303, '/');
	} catch (err) {
		if (err.status === 303) {
			throw err;
		}
		// Generic error to the user; details only server-side.
		console.error('[oauth] callback failed:', err.message);
		throw redirect(303, '/login?error=oauth_failed');
	}
}
