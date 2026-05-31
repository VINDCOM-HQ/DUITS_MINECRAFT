import { json } from '@sveltejs/kit';
import { disconnect } from '$lib/server/services/minecraft.js';

/** @type {import('./$types').RequestHandler} */
export async function POST() {
	try {
		disconnect();
		return json({ success: true });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
