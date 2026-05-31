import { json } from '@sveltejs/kit';
import { getPlayers } from '$lib/server/services/map.js';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	try {
		const data = await getPlayers();
		return json({ success: true, ...data });
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 502 });
	}
}
