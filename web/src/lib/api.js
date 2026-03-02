/**
 * Client-side API helper for making requests to the SvelteKit server endpoints.
 * All services auto-connect using server-side environment variables.
 * No manual host/port/password configuration needed.
 */

async function request(method, url, body) {
	const opts = {
		method,
		headers: { 'Content-Type': 'application/json' }
	};

	if (body && method !== 'GET') {
		opts.body = JSON.stringify(body);
	}

	const res = await fetch(url, opts);
	const data = await res.json();

	if (!res.ok || data.success === false) {
		throw new Error(data.error || `Request failed: ${res.status}`);
	}

	return data;
}

// RCON (auto-connects using env vars)
export function rconConnect() {
	return request('POST', '/api/rcon/connect');
}

export function rconCommand(command) {
	return request('POST', '/api/rcon/command', { command });
}

export function rconDisconnect() {
	return request('POST', '/api/rcon/disconnect');
}

export function rconStatus() {
	return request('GET', '/api/rcon/status');
}

// Query (server uses env vars for host/port)
export function queryServer(mode = 'basic', bypassCache = false) {
	const params = new URLSearchParams({ mode, bypassCache });
	return request('GET', `/api/query?${params}`);
}

// Files (direct filesystem via MC_DIR env var)
export function filesList(path = '') {
	const params = new URLSearchParams({ path });
	return request('GET', `/api/files/list?${params}`);
}

export function filesRead(path) {
	const params = new URLSearchParams({ path });
	return request('GET', `/api/files/read?${params}`);
}

export function filesWrite(path, content, isBase64 = false) {
	return request('POST', '/api/files/write', { path, content, isBase64 });
}

export function filesDelete(path) {
	return request('POST', '/api/files/delete', { path });
}

export function filesMkdir(path) {
	return request('POST', '/api/files/mkdir', { path });
}

export function filesUpload(path, content, isBase64 = true) {
	return request('POST', '/api/files/upload', { path, content, isBase64 });
}

export function filesInfo(path) {
	const params = new URLSearchParams({ path });
	return request('GET', `/api/files/info?${params}`);
}

// MySQL / Game Database (auto-connects using env vars)
export function mysqlConnect() {
	return request('POST', '/api/mysql/connect');
}

export function mysqlQuery(sql, params) {
	return request('POST', '/api/mysql/query', { sql, params });
}

export function mysqlDisconnect() {
	return request('POST', '/api/mysql/disconnect');
}

// Server control (supervisorctl)
export function serverControl(action) {
	return request('POST', '/api/server/control', { action });
}

export function serverStatus() {
	return request('GET', '/api/server/status');
}

// System status
export function getStatus() {
	return request('GET', '/api/status');
}

// Security / Login Attempts (admin only)
export function loginAttemptsSummary() {
	return request('GET', '/api/auth/login-attempts?mode=summary');
}

export function loginAttemptsFull(limit = 50, offset = 0) {
	const params = new URLSearchParams({ mode: 'full', limit: String(limit), offset: String(offset) });
	return request('GET', `/api/auth/login-attempts?${params}`);
}

// World Map
export function mapMetadata() {
	return request('GET', '/api/map/metadata');
}

export function mapPlayers() {
	return request('GET', '/api/map/players');
}

/**
 * Build the URL for a map tile.
 * @param {string} worldId - World identifier (e.g. "minecraft_overworld")
 * @param {number} zoom - Zoom level
 * @param {number} x - Tile X coordinate
 * @param {number} z - Tile Z coordinate
 * @param {string} [ext='png'] - File extension
 * @returns {string} Tile URL
 */
export function mapTileUrl(worldId, zoom, x, z, ext = 'png') {
	return `/api/map/tiles/${worldId}/${zoom}/${x}_${z}.${ext}`;
}
