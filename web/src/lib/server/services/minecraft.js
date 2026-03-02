import RconClient from './rcon.js';

const RCON_HOST = process.env.WEB_PORTAL_RCON_HOST || 'localhost';
const RCON_PORT = parseInt(process.env.WEB_PORTAL_RCON_PORT || process.env.MC_RCON_PORT || '25575', 10);
const RCON_PASSWORD = process.env.WEB_PORTAL_RCON_PASSWORD || process.env.MC_RCON_PASSWORD || '';

let client = null;

/**
 * Get the shared RCON client, creating it if needed.
 * Does NOT auto-connect — call connect() explicitly.
 * @returns {RconClient}
 */
function getClient() {
	if (!client) {
		client = new RconClient(RCON_HOST, RCON_PORT, RCON_PASSWORD);
	}
	return client;
}

/**
 * Connect to the Minecraft RCON server.
 * @param {string} [host] - Override host (defaults to env var)
 * @param {number} [port] - Override port (defaults to env var)
 * @param {string} [password] - Override password (defaults to env var)
 */
export async function connect(host, port, password) {
	if (client) {
		client.disconnect();
		client = null;
	}

	client = new RconClient(
		host || RCON_HOST,
		port || RCON_PORT,
		password || RCON_PASSWORD
	);

	await client.connect();
}

/**
 * Send an RCON command to the Minecraft server.
 * Auto-reconnects if the connection was lost.
 * @param {string} cmd
 * @returns {Promise<string>}
 */
export async function command(cmd) {
	const c = getClient();

	if (!c.isConnected()) {
		await c.connect();
	}

	return c.command(cmd);
}

/**
 * Disconnect from RCON.
 */
export function disconnect() {
	if (client) {
		client.disconnect();
		client = null;
	}
}

/**
 * Check if RCON is currently connected.
 * @returns {boolean}
 */
export function isConnected() {
	return client?.isConnected() ?? false;
}

/**
 * Get connection info for status display.
 * @returns {{ connected: boolean, host: string, port: number }}
 */
export function getConnectionInfo() {
	return {
		connected: isConnected(),
		host: client?.host || RCON_HOST,
		port: client?.port || RCON_PORT
	};
}
