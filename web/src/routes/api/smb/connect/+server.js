import { json } from '@sveltejs/kit';
import { sendRequest } from '$lib/server/agent.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { host, share, username, password, domain } = await request.json();

		if (!host || !share) {
			return json({ success: false, error: 'host and share are required' }, { status: 400 });
		}

		const result = await sendRequest('connect', 'smb', { host, share, username, password, domain });
		return json(result);
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
