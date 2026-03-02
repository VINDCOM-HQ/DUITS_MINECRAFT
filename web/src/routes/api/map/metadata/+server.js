import { json } from '@sveltejs/kit';
import { getMetadata } from '$lib/server/services/map.js';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	try {
		const metadata = await getMetadata();
		return json({ success: true, ...metadata });
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 502 });
	}
}
