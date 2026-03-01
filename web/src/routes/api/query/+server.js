import { json } from '@sveltejs/kit';
import { sendRequest } from '$lib/server/agent.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const host = url.searchParams.get('host');
		const port = Number(url.searchParams.get('port') || 25565);
		const mode = url.searchParams.get('mode') || 'basic';
		const bypassCache = url.searchParams.get('bypassCache') === 'true';

		if (!host) {
			return json({ success: false, error: 'host is required' }, { status: 400 });
		}

		const result = await sendRequest('query', null, { host, port, mode, bypassCache });
		return json(result);
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
