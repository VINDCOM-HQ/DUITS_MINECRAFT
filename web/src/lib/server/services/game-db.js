import mysql from 'mysql2/promise';

/**
 * Game database pool.
 * Uses the same MySQL instance as the portal DB (shared host/port/user/password),
 * just a different database name.
 */
const DB_HOST = process.env.WEB_PORTAL_DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.WEB_PORTAL_DB_PORT || '3306', 10);
const DB_USER = process.env.WEB_PORTAL_DB_USER || 'netherdeck';
const DB_PASSWORD = process.env.WEB_PORTAL_DB_PASSWORD || '';
const DB_NAME = process.env.WEB_PORTAL_GAME_DB_NAME || process.env.MYSQL_DATABASE || 'minecraft';

let pool = null;

/**
 * Check whether the game database name is configured.
 * @returns {boolean}
 */
export function isConfigured() {
	return Boolean(DB_NAME && DB_USER && DB_PASSWORD);
}

/**
 * Get the game database connection pool (lazy singleton).
 * @returns {import('mysql2/promise').Pool}
 */
export function getGamePool() {
	if (pool) {
		return pool;
	}

	if (!isConfigured()) {
		throw new Error('Game database is not configured: missing credentials');
	}

	pool = mysql.createPool({
		host: DB_HOST,
		port: DB_PORT,
		user: DB_USER,
		password: DB_PASSWORD,
		database: DB_NAME,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0,
		enableKeepAlive: true,
		keepAliveInitialDelay: 30000
	});

	return pool;
}

/**
 * Execute a query against the game database.
 * @param {string} sql
 * @param {any[]} params
 * @returns {Promise<[any[], any]>}
 */
export async function gameQuery(sql, params = []) {
	const p = getGamePool();
	return p.execute(sql, params);
}

/**
 * Gracefully close the game database pool.
 */
export async function closeGamePool() {
	if (pool) {
		await pool.end();
		pool = null;
	}
}
