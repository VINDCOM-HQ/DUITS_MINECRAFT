import { json } from '@sveltejs/kit';
import { sendRequest } from '$lib/server/agent.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { clientId, sql, params } = await request.json();

		if (!clientId || !sql) {
			return json({ success: false, error: 'clientId and sql are required' }, { status: 400 });
		}

		const result = await sendRequest('command', 'mysql', { clientId, sql, params });
		return json(result);
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
