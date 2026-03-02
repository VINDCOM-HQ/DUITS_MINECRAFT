import { json } from '@sveltejs/kit';
import { connect, getConnectionInfo } from '$lib/server/services/minecraft.js';

/** @type {import('./$types').RequestHandler} */
export async function POST() {
	try {
		await connect();
		const info = getConnectionInfo();

		return json({ success: true, ...info });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
