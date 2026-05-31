import { redirect } from '@sveltejs/kit';
import { isSamlEnabled, getLoginUrl } from '$lib/server/saml.js';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	if (!isSamlEnabled()) {
		throw redirect(303, '/login');
	}

	try {
		const loginUrl = await getLoginUrl();
		throw redirect(302, loginUrl);
	} catch (err) {
		if (err.status === 302) {
			throw err;
		}
		console.error('[saml] login init failed:', err.message);
		throw redirect(303, '/login?error=saml_failed');
	}
}
