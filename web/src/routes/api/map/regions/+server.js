import { json } from '@sveltejs/kit';
import { fetchFromMapServer } from '$lib/server/services/map.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const world = url.searchParams.get('world') || '';

		const params = new URLSearchParams();
		if (world) params.set('world', world);

		const response = await fetchFromMapServer(`/live/regions?${params}`);
		if (!response.ok) {
			return json({ success: false, error: 'Map server error' }, { status: response.status });
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 502 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const body = await request.json();

		const response = await fetchFromMapServer('/live/regions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const err = await response.json().catch(() => ({ error: 'Map server error' }));
			return json({ success: false, ...err }, { status: response.status });
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 502 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ url }) {
	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ success: false, error: 'Missing region id' }, { status: 400 });
		}

		const response = await fetchFromMapServer(`/live/regions?id=${id}`, { method: 'DELETE' });
		if (!response.ok) {
			return json({ success: false, error: 'Map server error' }, { status: response.status });
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 502 });
	}
}
