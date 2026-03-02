import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

const MC_DIR = process.env.WEB_PORTAL_MC_DIR || '/minecraft';
const LOG_PATH = path.join(MC_DIR, 'logs', 'latest.log');
const INITIAL_LINES = 200;
const POLL_INTERVAL_MS = 500;
const CHUNK_SIZE = 8192;

/**
 * Check whether the log file exists.
 * @returns {Promise<boolean>}
 */
async function logFileExists() {
	try {
		await fsPromises.access(LOG_PATH, fs.constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read the last N lines from a file by seeking backwards in chunks.
 * @param {number} n - Number of lines to read
 * @returns {Promise<{ lines: string[], byteOffset: number }>}
 */
async function readLastNLines(n) {
	const stat = await fsPromises.stat(LOG_PATH);
	const fileSize = stat.size;

	if (fileSize === 0) {
		return { lines: [], byteOffset: 0 };
	}

	const fd = await fsPromises.open(LOG_PATH, 'r');
	try {
		let position = fileSize;
		let collected = '';
		let lineCount = 0;

		while (position > 0 && lineCount <= n) {
			const readSize = Math.min(CHUNK_SIZE, position);
			position -= readSize;

			const buffer = Buffer.alloc(readSize);
			await fd.read(buffer, 0, readSize, position);
			collected = buffer.toString('utf-8') + collected;

			// Count newlines to see if we have enough
			lineCount = 0;
			for (let i = 0; i < collected.length; i++) {
				if (collected[i] === '\n') lineCount++;
			}
		}

		const allLines = collected.split('\n');
		// Take the last N non-empty lines
		const trimmed = allLines.filter((l) => l.length > 0);
		const lines = trimmed.slice(-n);

		return { lines, byteOffset: fileSize };
	} finally {
		await fd.close();
	}
}

/**
 * Read new bytes from a file starting at the given offset.
 * @param {number} offset - Byte position to start reading from
 * @returns {Promise<{ text: string, newOffset: number }>}
 */
async function readFromOffset(offset) {
	const stat = await fsPromises.stat(LOG_PATH);

	if (stat.size <= offset) {
		return { text: '', newOffset: offset };
	}

	const fd = await fsPromises.open(LOG_PATH, 'r');
	try {
		const readSize = stat.size - offset;
		const buffer = Buffer.alloc(readSize);
		await fd.read(buffer, 0, readSize, offset);
		return { text: buffer.toString('utf-8'), newOffset: stat.size };
	} finally {
		await fd.close();
	}
}

/**
 * Create a log tail instance that watches the Minecraft server log.
 *
 * @param {(lines: string[], isInitial: boolean) => void} onLines - Called with new log lines
 * @param {(error: Error) => void} onError - Called on errors
 * @returns {{ start: () => Promise<void>, stop: () => void }}
 */
export function createLogTail(onLines, onError) {
	let offset = 0;
	let trailingPartial = '';
	let stopped = false;
	let watching = false;

	function handleChange(curr, prev) {
		if (stopped) return;

		// File deleted — wait for it to reappear
		if (curr.size === 0 && curr.mtime.getTime() === 0) {
			return;
		}

		// Rotation: file is smaller than our offset (was replaced)
		if (curr.size < offset) {
			offset = 0;
			trailingPartial = '';
		}

		// New data available
		if (curr.size > offset) {
			readFromOffset(offset)
				.then(({ text, newOffset }) => {
					if (stopped) return;
					offset = newOffset;

					// Prepend any trailing partial line from last read
					const combined = trailingPartial + text;
					const parts = combined.split('\n');

					// Last element may be incomplete (no trailing newline)
					trailingPartial = parts.pop() || '';

					const lines = parts.filter((l) => l.length > 0);
					if (lines.length > 0) {
						onLines(lines, false);
					}
				})
				.catch((err) => {
					if (!stopped) onError(err);
				});
		}
	}

	function startWatching() {
		if (watching || stopped) return;
		watching = true;
		fs.watchFile(LOG_PATH, { interval: POLL_INTERVAL_MS }, handleChange);
	}

	async function start() {
		if (stopped) return;

		const exists = await logFileExists();
		if (!exists) {
			onError(new Error('Log file not found — server may not have started yet'));
			// Still start watching — file may appear later
			startWatching();
			return;
		}

		try {
			const result = await readLastNLines(INITIAL_LINES);
			offset = result.byteOffset;
			if (result.lines.length > 0) {
				onLines(result.lines, true);
			}
		} catch (err) {
			onError(err);
		}

		startWatching();
	}

	function stop() {
		stopped = true;
		if (watching) {
			fs.unwatchFile(LOG_PATH, handleChange);
			watching = false;
		}
		trailingPartial = '';
	}

	return { start, stop };
}
