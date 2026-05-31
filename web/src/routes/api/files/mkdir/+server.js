import { json } from '@sveltejs/kit';
import { createDirectory } from '$lib/server/services/files.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (locals.user?.role !== 'admin') {
		return json({ success: false, error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { path } = await request.json();

		if (!path || typeof path !== 'string') {
			return json({ success: false, error: 'path is required' }, { status: 400 });
		}

		await createDirectory(path);
		return json({ success: true });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
