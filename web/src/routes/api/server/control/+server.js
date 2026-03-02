import { json } from '@sveltejs/kit';
import { controlServer } from '$lib/server/services/supervisor.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (locals.user?.role !== 'admin') {
		return json({ success: false, error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { action } = await request.json();

		if (!action || typeof action !== 'string') {
			return json({ success: false, error: 'action is required' }, { status: 400 });
		}

		const result = await controlServer(action);
		return json({ success: true, ...result });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
