import { json } from '@sveltejs/kit';
import { sendRequest } from '$lib/server/agent.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { host, port, password } = await request.json();

		if (!host || !port || !password) {
			return json({ success: false, error: 'Host, port, and password are required' }, { status: 400 });
		}

		const result = await sendRequest('connect', 'rcon', { host, port: Number(port), password });
		return json(result);
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
