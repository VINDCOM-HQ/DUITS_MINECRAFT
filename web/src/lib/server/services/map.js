/**
 * Map service — HTTP client to the NetherDeck Java map server.
 * Proxies tile requests from the authenticated SvelteKit portal
 * to the localhost-only Java HTTP server.
 */

const MAP_HOST = process.env.WEB_PORTAL_MAP_HOST || '127.0.0.1';
const MAP_PORT = parseInt(process.env.WEB_PORTAL_MAP_PORT || '8100', 10);

function baseUrl() {
	return `http://${MAP_HOST}:${MAP_PORT}`;
}

/**
 * Fetch raw data from the Java map HTTP server.
 * @param {string} path - URL path (e.g. "/tiles/overworld/0/0.png")
 * @param {RequestInit} [options] - optional fetch options (method, body, headers)
 * @returns {Promise<Response>}
 */
export async function fetchFromMapServer(path, options = {}) {
	const url = `${baseUrl()}${path}`;
	const response = await fetch(url, {
		headers: { 'Accept': '*/*', ...options.headers },
		...options
	});
	return response;
}

/**
 * Fetch JSON from the Java map HTTP server.
 * @param {string} path - URL path (e.g. "/metadata")
 * @returns {Promise<object>}
 */
export async function fetchJson(path) {
	const response = await fetchFromMapServer(path);
	if (!response.ok) {
		throw new Error(`Map server returned ${response.status}: ${response.statusText}`);
	}
	return response.json();
}

/**
 * Get world metadata (spawn, dimensions, render bounds).
 */
export async function getMetadata() {
	return fetchJson('/metadata');
}

/**
 * Get live player positions.
 */
export async function getPlayers() {
	return fetchJson('/players');
}

/**
 * Check if the map server is reachable.
 */
export async function isAvailable() {
	try {
		const response = await fetchFromMapServer('/health');
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Get map connection info for status display.
 */
export function getConnectionInfo() {
	return {
		host: MAP_HOST,
		port: MAP_PORT
	};
}

/**
 * Get player trail points.
 * @param {string} [world]
 * @param {string} [uuid]
 * @param {number} [hours]
 */
export async function getTrails(world, uuid, hours = 24) {
	const params = new URLSearchParams();
	if (world) params.set('world', world);
	if (uuid) params.set('uuid', uuid);
	params.set('hours', String(hours));
	return fetchJson(`/live/trails?${params}`);
}

/**
 * Get death and respawn markers.
 * @param {string} [world]
 */
export async function getMarkers(world) {
	const params = new URLSearchParams();
	if (world) params.set('world', world);
	return fetchJson(`/live/markers?${params}`);
}

/**
 * Get land claim regions.
 * @param {string} [world]
 */
export async function getRegions(world) {
	const params = new URLSearchParams();
	if (world) params.set('world', world);
	return fetchJson(`/live/regions?${params}`);
}

/**
 * Get entity heatmap snapshot.
 * @param {string} [world]
 */
export async function getHeatmap(world) {
	const params = new URLSearchParams();
	if (world) params.set('world', world);
	return fetchJson(`/live/heatmap?${params}`);
}
