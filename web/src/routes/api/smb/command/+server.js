import { json } from '@sveltejs/kit';
import { sendRequest } from '$lib/server/agent.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { clientId, operation, path, data, encoding } = await request.json();

		if (!clientId || !operation) {
			return json({ success: false, error: 'clientId and operation are required' }, { status: 400 });
		}

		const params = { clientId, operation, path };
		if (data !== undefined) params.data = data;
		if (encoding) params.encoding = encoding;

		const result = await sendRequest('command', 'smb', params);
		return json(result);
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
