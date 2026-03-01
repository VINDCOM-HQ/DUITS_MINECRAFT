import { fail, redirect } from '@sveltejs/kit';
import { validateApiKey } from '$lib/server/agent.js';
import { createSession, destroySession } from '../../hooks.server.js';

/** @type {import('./$types').Actions} */
export const actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const apiKey = data.get('apiKey');

		if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
			return fail(400, { error: 'API key is required' });
		}

		const valid = await validateApiKey(apiKey.trim());

		if (!valid) {
			return fail(401, { error: 'Invalid API key or agent unreachable' });
		}

		const token = createSession();
		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: false,
			maxAge: 60 * 60 * 24
		});

		throw redirect(303, '/');
	},

	logout: async ({ cookies }) => {
		const token = cookies.get('session');
		destroySession(token);
		cookies.delete('session', { path: '/' });
		throw redirect(303, '/login');
	}
};
