import { json } from '@sveltejs/kit';
import { getConnectionInfo } from '$lib/server/services/minecraft.js';
import { getServerStatus } from '$lib/server/services/supervisor.js';
import { isConfigured as isGameDbConfigured } from '$lib/server/services/game-db.js';

// MySQL connection info — shared server for both portal and game databases
const MYSQL_HOST = process.env.WEB_PORTAL_DB_HOST || 'localhost';
const MYSQL_PORT = parseInt(process.env.WEB_PORTAL_DB_PORT || '3306', 10);
const PORTAL_DB = process.env.WEB_PORTAL_DB_NAME || 'netherdeck';
const GAME_DB = process.env.WEB_PORTAL_GAME_DB_NAME || process.env.MYSQL_DATABASE || 'minecraft';
import QueryClient from '$lib/server/services/query.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const MC_DIR = process.env.WEB_PORTAL_MC_DIR || '/minecraft';
const QUERY_HOST = process.env.WEB_PORTAL_RCON_HOST || 'localhost';
const QUERY_PORT = parseInt(process.env.WEB_PORTAL_QUERY_PORT || '25565', 10);

// RCON env vars (resolved by minecraft.js, but we read them here for config display)
const RCON_HOST = process.env.WEB_PORTAL_RCON_HOST || 'localhost';
const RCON_PORT = parseInt(process.env.WEB_PORTAL_RCON_PORT || process.env.MC_RCON_PORT || '25575', 10);
const RCON_PASSWORD_SET = !!(process.env.WEB_PORTAL_RCON_PASSWORD || process.env.MC_RCON_PASSWORD);

const CACHE_TTL = 5000;
let gameCache = { data: null, timestamp: 0 };

// ---------------------------------------------------------------------------
// Filesystem reads (static config — always available, no protocol needed)
// ---------------------------------------------------------------------------

/**
 * Parse server.properties into a key-value object.
 */
async function readServerProperties() {
	try {
		const content = await fs.readFile(path.join(MC_DIR, 'server.properties'), 'utf-8');
		const props = {};
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eqIdx = trimmed.indexOf('=');
			if (eqIdx === -1) continue;
			props[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
		}
		return props;
	} catch {
		return {};
	}
}

/**
 * List plugin .jar files from the plugins directory.
 */
async function listPlugins() {
	try {
		const entries = await fs.readdir(path.join(MC_DIR, 'plugins'));
		return entries
			.filter((f) => f.endsWith('.jar'))
			.map((f) => f.replace(/\.jar$/, ''));
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------
// Query protocol (live server metadata — player list, version, software)
// ---------------------------------------------------------------------------

/**
 * Query the Minecraft server via UDP Query protocol.
 * This is the correct protocol for reading live server metadata.
 * Requires enable-query=true in server.properties.
 */
async function queryServer() {
	try {
		const client = new QueryClient(QUERY_HOST, QUERY_PORT);
		const result = await client.queryFull();
		const info = result.info || result;
		return {
			available: true,
			version: info.version || '',
			software: info.software || '',
			motd: info.motd || '',
			gameType: info.gameType || '',
			map: info.map || '',
			players: {
				online: info.players?.online ?? 0,
				max: info.players?.max ?? 0,
				list: info.players?.list || []
			},
			queryPlugins: info.plugins || []
		};
	} catch {
		return {
			available: false,
			version: '',
			software: '',
			motd: '',
			gameType: '',
			map: '',
			players: { online: 0, max: 0, list: [] },
			queryPlugins: []
		};
	}
}

// ---------------------------------------------------------------------------
// Combined game data (filesystem + query, cached)
// ---------------------------------------------------------------------------

async function getGameData(serverRunning) {
	const now = Date.now();
	if (gameCache.data && (now - gameCache.timestamp) < CACHE_TTL) {
		return gameCache.data;
	}

	const emptyQuery = {
		available: false, version: '', software: '', motd: '', gameType: '',
		players: { online: 0, max: 0, list: [] }, queryPlugins: []
	};

	const [props, plugins, query] = await Promise.all([
		readServerProperties(),
		listPlugins(),
		serverRunning ? queryServer() : Promise.resolve(emptyQuery)
	]);

	const data = {
		// Filesystem: static server config
		motd: props['motd'] || '',
		map: props['level-name'] || '',
		gameMode: props['gamemode'] || '',
		difficulty: props['difficulty'] || '',
		maxPlayers: parseInt(props['max-players'] || '0', 10),
		serverPort: parseInt(props['server-port'] || '25565', 10),
		onlineMode: props['online-mode'] === 'true',
		pvp: props['pvp'] === 'true',
		viewDistance: parseInt(props['view-distance'] || '10', 10),
		enableQuery: props['enable-query'] === 'true',
		plugins,

		// Query protocol: live server metadata
		query: {
			available: query.available,
			version: query.version,
			software: query.software,
			motd: query.motd,
			gameType: query.gameType,
			map: query.map || '',
			players: query.players,
			queryPlugins: query.queryPlugins
		}
	};

	gameCache = { data, timestamp: now };
	return data;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	try {
		let serverProcess = { status: 'unknown', pid: null, uptime: null };
		try {
			serverProcess = await getServerStatus();
		} catch {
			// supervisorctl may not be available outside Docker
		}

		const rcon = getConnectionInfo();
		const cpuInfo = os.cpus();
		const serverRunning = serverProcess.status === 'running';

		const game = await getGameData(serverRunning);

		const loadAvg = os.loadavg();

		return json({
			success: true,
			hostname: os.hostname(),
			platform: os.platform(),
			arch: os.arch(),
			systemUptime: os.uptime(),
			systemMemory: {
				total: os.totalmem(),
				free: os.freemem()
			},
			cpus: {
				count: cpuInfo.length,
				model: cpuInfo[0]?.model || 'Unknown',
				load: {
					avg1: loadAvg[0],
					avg5: loadAvg[1],
					avg15: loadAvg[2]
				}
			},
			server: serverProcess,
			rcon: { connected: rcon.connected, host: rcon.host, port: rcon.port },
			mysql: {
				connected: true, // app running = MySQL is up (portal DB required for boot)
				host: MYSQL_HOST,
				port: MYSQL_PORT,
				portalDb: PORTAL_DB,
				gameDb: GAME_DB,
				gameDbConfigured: isGameDbConfigured()
			},
			game,
			config: {
				rcon: {
					host: RCON_HOST,
					port: RCON_PORT,
					passwordSet: RCON_PASSWORD_SET
				},
				mysql: {
					host: MYSQL_HOST,
					port: MYSQL_PORT,
					user: process.env.WEB_PORTAL_DB_USER || 'netherdeck',
					passwordSet: !!process.env.WEB_PORTAL_DB_PASSWORD,
					portalDb: PORTAL_DB,
					gameDb: GAME_DB,
					gameDbConfigured: isGameDbConfigured()
				},
				query: {
					host: QUERY_HOST,
					port: QUERY_PORT
				},
				filesystem: {
					mcDir: MC_DIR
				},
				auth: {
					oauthEnabled: process.env.WEB_PORTAL_OAUTH_ENABLED === 'true',
					samlEnabled: process.env.WEB_PORTAL_SAML_ENABLED === 'true',
					adminUserSet: !!process.env.WEB_PORTAL_ADMIN_USER,
					sessionSecretSet: !!process.env.WEB_PORTAL_SESSION_SECRET
				}
			}
		});
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
