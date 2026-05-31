import { json } from '@sveltejs/kit';
import { getFileInfo } from '$lib/server/services/files.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const path = url.searchParams.get('path');

		if (!path) {
			return json({ success: false, error: 'path is required' }, { status: 400 });
		}

		const info = await getFileInfo(path);
		return json({ success: true, ...info });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
