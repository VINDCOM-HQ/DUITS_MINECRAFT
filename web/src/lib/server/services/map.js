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
 * @returns {Promise<Response>}
 */
export async function fetchFromMapServer(path) {
	const url = `${baseUrl()}${path}`;
	const response = await fetch(url, {
		headers: { 'Accept': '*/*' }
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
