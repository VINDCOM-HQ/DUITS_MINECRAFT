import { json } from '@sveltejs/kit';
import { fetchFromMapServer } from '$lib/server/services/map.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	try {
		const tilePath = params.path || '';
		const response = await fetchFromMapServer(`/tiles/${tilePath}`);

		if (!response.ok) {
			return json({ success: false, error: 'Tile not found' }, { status: response.status });
		}

		const contentType = response.headers.get('content-type') || 'application/octet-stream';
		const body = await response.arrayBuffer();

		return new Response(body, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=60'
			}
		});
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 502 });
	}
}
