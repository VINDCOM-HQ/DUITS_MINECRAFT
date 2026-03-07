import { query, ensureDatabases } from './db.js';
import bcrypt from 'bcryptjs';

const SCHEMA_VERSION = 3;

const MIGRATIONS = [
	{
		version: 1,
		description: 'Initial schema — users and sessions',
		up: `
			CREATE TABLE IF NOT EXISTS users (
				id          INT AUTO_INCREMENT PRIMARY KEY,
				username    VARCHAR(255) NOT NULL UNIQUE,
				password    VARCHAR(255),
				role        ENUM('admin','user') NOT NULL DEFAULT 'user',
				auth_source ENUM('local','oauth','saml') NOT NULL DEFAULT 'local',
				oauth_sub   VARCHAR(255),
				saml_name_id VARCHAR(255),
				created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				UNIQUE KEY idx_oauth (auth_source, oauth_sub),
				UNIQUE KEY idx_saml (auth_source, saml_name_id)
			);

			CREATE TABLE IF NOT EXISTS sessions (
				id         VARCHAR(36) PRIMARY KEY,
				user_id    INT NOT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				expires_at TIMESTAMP NOT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				KEY idx_expires (expires_at)
			);

			CREATE TABLE IF NOT EXISTS schema_version (
				version INT NOT NULL PRIMARY KEY,
				applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);
		`
	},
	{
		version: 2,
		description: 'Login attempts audit log',
		up: `
			CREATE TABLE IF NOT EXISTS login_attempts (
				id            INT AUTO_INCREMENT PRIMARY KEY,
				username      VARCHAR(255) NOT NULL,
				ip_address    VARCHAR(45) NOT NULL,
				user_agent    VARCHAR(512) DEFAULT '',
				reason        ENUM('invalid_credentials','account_locked') NOT NULL,
				created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				KEY idx_ip_created (ip_address, created_at),
				KEY idx_username_created (username, created_at),
				KEY idx_created (created_at)
			);
		`
	},
	{
		version: 3,
		description: 'BlueMap extended features — player trails, death markers, respawn points, land claim regions',
		up: `
			CREATE TABLE IF NOT EXISTS map_player_trails (
				id          BIGINT AUTO_INCREMENT PRIMARY KEY,
				player_uuid VARCHAR(36) NOT NULL,
				world       VARCHAR(64) NOT NULL,
				x           DOUBLE NOT NULL,
				y           DOUBLE NOT NULL,
				z           DOUBLE NOT NULL,
				recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				INDEX idx_trail (player_uuid, world, recorded_at)
			);

			CREATE TABLE IF NOT EXISTS map_death_markers (
				id          BIGINT AUTO_INCREMENT PRIMARY KEY,
				player_uuid VARCHAR(36),
				player_name VARCHAR(64),
				world       VARCHAR(64),
				x           DOUBLE,
				y           DOUBLE,
				z           DOUBLE,
				cause       VARCHAR(256),
				died_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS map_respawn_points (
				player_uuid VARCHAR(36) PRIMARY KEY,
				player_name VARCHAR(64),
				world       VARCHAR(64),
				x           DOUBLE,
				y           DOUBLE,
				z           DOUBLE,
				set_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS map_regions (
				id         INT AUTO_INCREMENT PRIMARY KEY,
				name       VARCHAR(128),
				world      VARCHAR(64),
				min_x      INT,
				min_z      INT,
				max_x      INT,
				max_z      INT,
				color      VARCHAR(16) DEFAULT '#3388ff',
				owner      VARCHAR(64),
				type       VARCHAR(32),
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);
		`
	}
];

let migratedVersion = 0;

/**
 * Run pending migrations and seed the break-glass admin user.
 * Safe to call multiple times — skips if already at the latest version.
 * Re-checks when SCHEMA_VERSION changes (e.g. code hot-reload adds a new migration).
 */
export async function runMigrations() {
	if (migratedVersion >= SCHEMA_VERSION) {
		return;
	}

	try {
		await ensureDatabases();
		await ensureSchemaVersionTable();
		const currentVersion = await getCurrentVersion();

		for (const migration of MIGRATIONS) {
			if (migration.version > currentVersion) {
				const statements = migration.up
					.split(';')
					.map((s) => s.trim())
					.filter((s) => s.length > 0);

				for (const stmt of statements) {
					await query(stmt);
				}

				await query('INSERT INTO schema_version (version) VALUES (?)', [migration.version]);
			}
		}

		await seedAdminUser();
		await cleanExpiredSessions();

		migratedVersion = SCHEMA_VERSION;
	} catch (err) {
		console.error('[migrate] Migration failed:', err.message);
		throw err;
	}
}

async function ensureSchemaVersionTable() {
	await query(`
		CREATE TABLE IF NOT EXISTS schema_version (
			version INT NOT NULL PRIMARY KEY,
			applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`);
}

async function getCurrentVersion() {
	const [rows] = await query('SELECT MAX(version) AS v FROM schema_version');
	return rows[0]?.v || 0;
}

/**
 * Seed the break-glass admin user from environment variables.
 * Only creates the user if it doesn't already exist.
 */
async function seedAdminUser() {
	const adminUser = process.env.WEB_PORTAL_ADMIN_USER;
	const adminPassword = process.env.WEB_PORTAL_ADMIN_PASSWORD;

	if (!adminUser || !adminPassword) {
		return;
	}

	const [existing] = await query('SELECT id FROM users WHERE username = ?', [adminUser]);

	if (existing.length > 0) {
		return;
	}

	const hash = await bcrypt.hash(adminPassword, 12);
	await query(
		'INSERT INTO users (username, password, role, auth_source) VALUES (?, ?, ?, ?)',
		[adminUser, hash, 'admin', 'local']
	);

	console.log(`[migrate] Break-glass admin user "${adminUser}" created`);
}

/**
 * Remove expired sessions on startup.
 */
async function cleanExpiredSessions() {
	const [result] = await query('DELETE FROM sessions WHERE expires_at < NOW()');
	if (result.affectedRows > 0) {
		console.log(`[migrate] Cleaned ${result.affectedRows} expired sessions`);
	}
}
