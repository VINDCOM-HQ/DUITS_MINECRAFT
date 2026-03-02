import mysql from 'mysql2/promise';

const DB_HOST = process.env.WEB_PORTAL_DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.WEB_PORTAL_DB_PORT || '3306', 10);
const DB_USER = process.env.WEB_PORTAL_DB_USER || 'netherdeck';
const DB_PASSWORD = process.env.WEB_PORTAL_DB_PASSWORD || '';
const DB_NAME = process.env.WEB_PORTAL_DB_NAME || 'netherdeck';
const GAME_DB_NAME = process.env.WEB_PORTAL_GAME_DB_NAME || process.env.MYSQL_DATABASE || 'minecraft';

let pool = null;
let databasesEnsured = false;

/**
 * Connect to MySQL WITHOUT a database, create portal and game databases
 * if they don't exist, then disconnect. Safe to call multiple times —
 * only runs once per process.
 */
export async function ensureDatabases() {
	if (databasesEnsured) {
		return;
	}

	const conn = await mysql.createConnection({
		host: DB_HOST,
		port: DB_PORT,
		user: DB_USER,
		password: DB_PASSWORD
	});

	try {
		await conn.query(
			`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
		);
		await conn.query(
			`CREATE DATABASE IF NOT EXISTS \`${GAME_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
		);
		databasesEnsured = true;
	} finally {
		await conn.end();
	}
}

/**
 * Get the portal database connection pool (lazy singleton).
 * @returns {import('mysql2/promise').Pool}
 */
export function getPool() {
	if (pool) {
		return pool;
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
 * Execute a query against the portal database.
 * @param {string} sql
 * @param {any[]} params
 * @returns {Promise<[any[], any]>}
 */
export async function query(sql, params = []) {
	const p = getPool();
	return p.execute(sql, params);
}

/**
 * Gracefully close the pool.
 */
export async function closePool() {
	if (pool) {
		await pool.end();
		pool = null;
	}
}
