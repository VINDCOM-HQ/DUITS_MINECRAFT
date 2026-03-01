import { json } from '@sveltejs/kit';
import { sendRequest } from '$lib/server/agent.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { clientId } = await request.json();

		if (!clientId) {
			return json({ success: false, error: 'clientId is required' }, { status: 400 });
		}

		const result = await sendRequest('disconnect', 'mysql', { clientId });
		return json(result);
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
