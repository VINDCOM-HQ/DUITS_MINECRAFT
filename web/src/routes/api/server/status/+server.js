import { json } from '@sveltejs/kit';
import { getServerStatus } from '$lib/server/services/supervisor.js';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	try {
		const status = await getServerStatus();
		return json({ success: true, ...status });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
