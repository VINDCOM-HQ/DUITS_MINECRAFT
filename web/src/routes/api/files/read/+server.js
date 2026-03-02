import { json } from '@sveltejs/kit';
import { readFile } from '$lib/server/services/files.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const path = url.searchParams.get('path');

		if (!path) {
			return json({ success: false, error: 'path is required' }, { status: 400 });
		}

		const result = await readFile(path);
		return json({ success: true, ...result });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
