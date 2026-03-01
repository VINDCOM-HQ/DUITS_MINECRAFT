/**
 * Client-side API helper for making requests to the SvelteKit server endpoints.
 * These endpoints proxy to the agent relay server.
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

// RCON
export function rconConnect(host, port, password) {
	return request('POST', '/api/rcon/connect', { host, port, password });
}

export function rconCommand(clientId, command) {
	return request('POST', '/api/rcon/command', { clientId, command });
}

export function rconDisconnect(clientId) {
	return request('POST', '/api/rcon/disconnect', { clientId });
}

// Query
export function queryServer(host, port, mode = 'basic', bypassCache = false) {
	const params = new URLSearchParams({ host, port, mode, bypassCache });
	return request('GET', `/api/query?${params}`);
}

// SMB
export function smbConnect(host, share, username, password, domain) {
	return request('POST', '/api/smb/connect', { host, share, username, password, domain });
}

export function smbCommand(clientId, operation, path, data, encoding) {
	return request('POST', '/api/smb/command', { clientId, operation, path, data, encoding });
}

export function smbDisconnect(clientId) {
	return request('POST', '/api/smb/disconnect', { clientId });
}

// MySQL
export function mysqlConnect(host, port, user, password, database, ssl) {
	return request('POST', '/api/mysql/connect', { host, port, user, password, database, ssl });
}

export function mysqlQuery(clientId, sql, params) {
	return request('POST', '/api/mysql/query', { clientId, sql, params });
}

export function mysqlDisconnect(clientId) {
	return request('POST', '/api/mysql/disconnect', { clientId });
}

// Status
export function getStatus() {
	return request('GET', '/api/status');
}
