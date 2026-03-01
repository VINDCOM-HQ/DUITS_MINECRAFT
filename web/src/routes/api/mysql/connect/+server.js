import { json } from '@sveltejs/kit';
import { sendRequest } from '$lib/server/agent.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { host, port, user, password, database, ssl } = await request.json();

		if (!host || !user || !database) {
			return json({ success: false, error: 'host, user, and database are required' }, { status: 400 });
		}

		const result = await sendRequest('connect', 'mysql', {
			host,
			port: Number(port || 3306),
			user,
			password,
			database,
			ssl
		});
		return json(result);
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
