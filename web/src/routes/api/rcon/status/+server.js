import { json } from '@sveltejs/kit';
import { isConnected, getConnectionInfo } from '$lib/server/services/minecraft.js';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	return json({
		success: true,
		connected: isConnected(),
		...getConnectionInfo()
	});
}
