import { json } from '@sveltejs/kit';
import QueryClient from '$lib/server/services/query.js';

const QUERY_HOST = process.env.WEB_PORTAL_RCON_HOST || 'localhost';
const QUERY_PORT = parseInt(process.env.WEB_PORTAL_QUERY_PORT || '25565', 10);

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const mode = url.searchParams.get('mode') || 'basic';

		const client = new QueryClient(QUERY_HOST, QUERY_PORT);
		const result = mode === 'full' ? await client.queryFull() : await client.queryBasic();

		return json({ success: true, ...result });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
