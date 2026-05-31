import { json } from '@sveltejs/kit';
import { closeGamePool } from '$lib/server/services/game-db.js';

/** @type {import('./$types').RequestHandler} */
export async function POST() {
	try {
		await closeGamePool();
		return json({ success: true });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
