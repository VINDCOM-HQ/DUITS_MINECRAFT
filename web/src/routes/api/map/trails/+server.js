import { json } from '@sveltejs/kit';
import { fetchFromMapServer } from '$lib/server/services/map.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const world = url.searchParams.get('world') || '';
		const uuid = url.searchParams.get('uuid') || '';
		const hours = url.searchParams.get('hours') || '24';

		const params = new URLSearchParams();
		if (world) params.set('world', world);
		if (uuid) params.set('uuid', uuid);
		params.set('hours', hours);

		const response = await fetchFromMapServer(`/live/trails?${params}`);
		if (!response.ok) {
			return json({ success: false, error: 'Map server error' }, { status: response.status });
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 502 });
	}
}
