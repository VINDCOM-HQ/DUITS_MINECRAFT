import { json } from '@sveltejs/kit';
import { listDirectory } from '$lib/server/services/files.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const path = url.searchParams.get('path') || '';
		const entries = await listDirectory(path);
		return json({ success: true, entries });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
