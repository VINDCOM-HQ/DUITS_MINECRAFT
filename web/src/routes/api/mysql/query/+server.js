import { json } from '@sveltejs/kit';
import { gameQuery, isConfigured } from '$lib/server/services/game-db.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (locals.user?.role !== 'admin') {
		return json({ success: false, error: 'Forbidden' }, { status: 403 });
	}

	try {
		if (!isConfigured()) {
			return json({ success: false, error: 'Game database not configured' }, { status: 400 });
		}

		const { sql, params } = await request.json();

		if (!sql || typeof sql !== 'string') {
			return json({ success: false, error: 'sql is required' }, { status: 400 });
		}

		const [rows, fields] = await gameQuery(sql, params || []);

		return json({
			success: true,
			rows,
			fields: fields?.map((f) => ({ name: f.name, type: f.type }))
		});
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
