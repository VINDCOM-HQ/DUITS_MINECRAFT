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
	const error = url.searchParams.get('error');

	if (error) {
		const desc = url.searchParams.get('error_description') || error;
		throw redirect(303, `/login?error=${encodeURIComponent(desc)}`);
	}

	if (!code || !state) {
		throw redirect(303, '/login?error=Missing+code+or+state');
	}

	// Verify CSRF state
	const savedState = cookies.get('oauth_state');
	cookies.delete('oauth_state', { path: '/' });

	if (!savedState || savedState !== state) {
		throw redirect(303, '/login?error=Invalid+state+parameter');
	}

	try {
		const { sub, displayName } = await handleCallback(code);
		const user = await findOrCreateExternalUser('oauth', sub, displayName);
		const token = await createSession(user.id);

		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.WEB_PORTAL_SECURE_COOKIES !== 'false',
			maxAge: 60 * 60 * 24
		});

		throw redirect(303, '/');
	} catch (err) {
		if (err.status === 303) {
			throw err;
		}
		throw redirect(303, `/login?error=${encodeURIComponent(err.message)}`);
	}
}
