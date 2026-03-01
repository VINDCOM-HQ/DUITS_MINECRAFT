import { io } from 'socket.io-client';

const AGENT_HOST = process.env.AGENT_HOST || 'localhost';
const AGENT_PORT = process.env.AGENT_PORT || '3500';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

let socket = null;
let connected = false;

function getSocket() {
	if (socket && connected) {
		return socket;
	}

	if (socket) {
		socket.disconnect();
	}

	const url = `http://${AGENT_HOST}:${AGENT_PORT}`;

	socket = io(url, {
		auth: { apiKey: AGENT_API_KEY },
		reconnection: true,
		reconnectionDelay: 1000,
		reconnectionAttempts: Infinity,
		timeout: 10000
	});

	socket.on('connect', () => {
		connected = true;
	});

	socket.on('disconnect', () => {
		connected = false;
	});

	socket.on('connect_error', (err) => {
		connected = false;
	});

	return socket;
}

/**
 * Send a request to the agent relay via Socket.IO.
 * @param {string} action - The action to perform
 * @param {string|null} type - The service type (rcon, smb, mysql, or null)
 * @param {object} params - The request parameters
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<object>} The agent response
 */
export function sendRequest(action, type, params = {}, timeout = 30000) {
	return new Promise((resolve, reject) => {
		const sock = getSocket();

		if (!sock.connected) {
			sock.once('connect', () => {
				emitRequest(sock, action, type, params, timeout, resolve, reject);
			});

			setTimeout(() => {
				reject(new Error('Agent connection timeout'));
			}, timeout);

			return;
		}

		emitRequest(sock, action, type, params, timeout, resolve, reject);
	});
}

function emitRequest(sock, action, type, params, timeout, resolve, reject) {
	const timer = setTimeout(() => {
		reject(new Error(`Agent request timeout: ${action}`));
	}, timeout);

	const request = { action, params };
	if (type) {
		request.type = type;
	}

	sock.emit('request', request, (response) => {
		clearTimeout(timer);
		if (response && response.success === false) {
			reject(new Error(response.error || `Agent request failed: ${action}`));
		} else {
			resolve(response);
		}
	});
}

/**
 * Validate an API key by attempting a status request.
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<boolean>}
 */
export function validateApiKey(apiKey) {
	return new Promise((resolve) => {
		const url = `http://${AGENT_HOST}:${AGENT_PORT}`;

		const testSocket = io(url, {
			auth: { apiKey },
			reconnection: false,
			timeout: 5000
		});

		testSocket.on('connect', () => {
			testSocket.emit('request', { action: 'status' }, (response) => {
				testSocket.disconnect();
				resolve(response && response.success !== false);
			});
		});

		testSocket.on('connect_error', () => {
			testSocket.disconnect();
			resolve(false);
		});

		setTimeout(() => {
			testSocket.disconnect();
			resolve(false);
		}, 5000);
	});
}

/**
 * Check if the agent is reachable.
 * @returns {boolean}
 */
export function isAgentConnected() {
	return connected;
}
