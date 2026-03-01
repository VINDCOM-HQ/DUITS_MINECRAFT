import { json } from '@sveltejs/kit';
import { sendRequest } from '$lib/server/agent.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { clientId, command } = await request.json();

		if (!clientId || !command) {
			return json({ success: false, error: 'clientId and command are required' }, { status: 400 });
		}

		const result = await sendRequest('command', 'rcon', { clientId, command });
		return json(result);
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
