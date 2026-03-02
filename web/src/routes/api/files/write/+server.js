import { json } from '@sveltejs/kit';
import { writeFile } from '$lib/server/services/files.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (locals.user?.role !== 'admin') {
		return json({ success: false, error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { path, content, isBase64 } = await request.json();

		if (!path || typeof path !== 'string') {
			return json({ success: false, error: 'path is required' }, { status: 400 });
		}

		if (content === undefined || content === null) {
			return json({ success: false, error: 'content is required' }, { status: 400 });
		}

		await writeFile(path, content, isBase64 || false);
		return json({ success: true });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
