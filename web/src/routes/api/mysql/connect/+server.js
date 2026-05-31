import { json } from '@sveltejs/kit';
import { isConfigured, getGamePool } from '$lib/server/services/game-db.js';

/** @type {import('./$types').RequestHandler} */
export async function POST() {
	try {
		if (!isConfigured()) {
			return json({ success: false, error: 'Game database not configured — check environment variables' }, { status: 400 });
		}

		// Verify pool is reachable
		const pool = getGamePool();
		const [rows] = await pool.execute('SELECT 1');

		return json({ success: true, connected: true });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
