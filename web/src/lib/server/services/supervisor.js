import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

const ALLOWED_ACTIONS = new Set(['start', 'stop', 'restart']);

const PROCESS_NAME = 'paper';

/**
 * Parse supervisorctl status output into a structured object.
 *
 * Typical formats:
 *   paper                            RUNNING   pid 123, uptime 0:05:30
 *   paper                            STOPPED   Mar 02 10:15 AM
 *   paper                            STARTING
 *   paper                            FATAL     Exited too quickly
 *
 * @param {string} stdout
 * @returns {{status: 'running'|'stopped'|'starting'|'error', pid: number|null, uptime: string|null}}
 */
function parseStatus(stdout) {
	const line = stdout.trim();

	if (!line) {
		return { status: 'error', pid: null, uptime: null };
	}

	const runningMatch = line.match(/RUNNING\s+pid\s+(\d+),\s*uptime\s+(.+)/i);
	if (runningMatch) {
		return {
			status: 'running',
			pid: parseInt(runningMatch[1], 10),
			uptime: runningMatch[2].trim()
		};
	}

	if (/STOPPED/i.test(line)) {
		return { status: 'stopped', pid: null, uptime: null };
	}

	if (/STARTING/i.test(line)) {
		return { status: 'starting', pid: null, uptime: null };
	}

	// FATAL, BACKOFF, EXITED, UNKNOWN — all treated as error
	return { status: 'error', pid: null, uptime: null };
}

/**
 * Control the Minecraft server process via supervisorctl.
 * @param {'start'|'stop'|'restart'} action
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function controlServer(action) {
	if (!ALLOWED_ACTIONS.has(action)) {
		throw new Error(`Invalid action: ${action}. Allowed: ${[...ALLOWED_ACTIONS].join(', ')}`);
	}

	try {
		const { stdout } = await execFile('supervisorctl', [action, PROCESS_NAME]);
		return { success: true, message: stdout.trim() };
	} catch (error) {
		const message = error.stderr
			? error.stderr.trim()
			: error.message;
		throw new Error(`supervisorctl ${action} failed: ${message}`);
	}
}

/**
 * Get the current status of the Minecraft server process.
 * @returns {Promise<{status: 'running'|'stopped'|'starting'|'error', pid: number|null, uptime: string|null}>}
 */
export async function getServerStatus() {
	try {
		const { stdout } = await execFile('supervisorctl', ['status', PROCESS_NAME]);
		return parseStatus(stdout);
	} catch (error) {
		// supervisorctl exits non-zero when process is not running
		if (error.stdout) {
			return parseStatus(error.stdout);
		}

		const message = error.stderr
			? error.stderr.trim()
			: error.message;
		throw new Error(`Failed to get server status: ${message}`);
	}
}
