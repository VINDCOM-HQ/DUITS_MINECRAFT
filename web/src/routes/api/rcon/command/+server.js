import { json } from '@sveltejs/kit';
import { command } from '$lib/server/services/minecraft.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const body = await request.json();
		const cmd = body.command;

		if (!cmd || typeof cmd !== 'string') {
			return json({ success: false, error: 'command is required' }, { status: 400 });
		}

		const response = await command(cmd);
		return json({ success: true, response });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
