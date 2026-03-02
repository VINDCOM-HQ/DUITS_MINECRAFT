import { redirect } from '@sveltejs/kit';
import { isSamlEnabled, validateAssertion } from '$lib/server/saml.js';
import { findOrCreateExternalUser, createSession } from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {
	if (!isSamlEnabled()) {
		throw redirect(303, '/login');
	}

	try {
		const formData = await request.formData();
		const samlResponse = formData.get('SAMLResponse');

		if (!samlResponse || typeof samlResponse !== 'string') {
			throw redirect(303, '/login?error=Missing+SAMLResponse');
		}

		const { nameId, displayName } = await validateAssertion(samlResponse);
		const user = await findOrCreateExternalUser('saml', nameId, displayName);
		const token = await createSession(user.id);

		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
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
