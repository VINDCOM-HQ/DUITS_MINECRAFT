import { redirect } from '@sveltejs/kit';
import { isOAuthEnabled, getAuthorizationUrl, generateState } from '$lib/server/oauth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies }) {
	if (!isOAuthEnabled()) {
		throw redirect(303, '/login');
	}

	const state = generateState();

	cookies.set('oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 600 // 10 minutes
	});

	const authUrl = await getAuthorizationUrl(state);
	throw redirect(302, authUrl);
}
