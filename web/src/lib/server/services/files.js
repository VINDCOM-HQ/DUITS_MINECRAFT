import fs from 'node:fs/promises';
import path from 'node:path';

const MC_DIR = process.env.WEB_PORTAL_MC_DIR || '/minecraft';

const BINARY_EXTENSIONS = new Set([
	'.jar', '.zip', '.gz', '.tar', '.exe', '.dll',
	'.png', '.jpg', '.gif', '.dat', '.mca', '.nbt'
]);

/**
 * Resolve a relative path within MC_DIR and validate against path traversal.
 * @param {string} relativePath
 * @returns {string} The resolved absolute path
 * @throws {Error} If the resolved path escapes MC_DIR
 */
function safePath(relativePath) {
	const resolvedBase = path.resolve(MC_DIR);
	const normalized = path.resolve(resolvedBase, relativePath || '');

	if (normalized !== resolvedBase && !normalized.startsWith(resolvedBase + path.sep)) {
		throw new Error('Path traversal detected: access denied');
	}

	return normalized;
}

/**
 * Check whether a file extension indicates binary content.
 * @param {string} filePath
 * @returns {boolean}
 */
function isBinaryFile(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	return BINARY_EXTENSIONS.has(ext);
}

/**
 * Build a file info object from a dirent name and stat result.
 * @param {string} name
 * @param {import('node:fs').Stats} stat
 * @returns {{name: string, isDirectory: boolean, size: number, modifiedAt: string}}
 */
function toFileInfo(name, stat) {
	return {
		name,
		isDirectory: stat.isDirectory(),
		size: stat.size,
		modifiedAt: stat.mtime.toISOString()
	};
}

/**
 * List the contents of a directory within the Minecraft server root.
 * @param {string} relativePath
 * @returns {Promise<Array<{name: string, isDirectory: boolean, size: number, modifiedAt: string}>>}
 */
export async function listDirectory(relativePath) {
	const dirPath = safePath(relativePath);

	const entries = await fs.readdir(dirPath, { withFileTypes: true });

	const results = await Promise.all(
		entries.map(async (entry) => {
			try {
				const entryPath = path.join(dirPath, entry.name);
				const stat = await fs.stat(entryPath);
				return toFileInfo(entry.name, stat);
			} catch (error) {
				// Skip entries that cannot be stat'd (broken symlinks, permission issues)
				return null;
			}
		})
	);

	return results.filter(Boolean);
}

/**
 * Read a file from the Minecraft server root.
 * Binary files are returned as base64; text files as UTF-8.
 * @param {string} relativePath
 * @returns {Promise<{content: string, isBase64: boolean}>}
 */
export async function readFile(relativePath) {
	const filePath = safePath(relativePath);

	if (isBinaryFile(filePath)) {
		const buffer = await fs.readFile(filePath);
		return { content: buffer.toString('base64'), isBase64: true };
	}

	const content = await fs.readFile(filePath, 'utf-8');
	return { content, isBase64: false };
}

/**
 * Write content to a file in the Minecraft server root.
 * @param {string} relativePath
 * @param {string} content
 * @param {boolean} isBase64 - When true, content is decoded from base64 before writing
 * @returns {Promise<void>}
 */
export async function writeFile(relativePath, content, isBase64 = false) {
	const filePath = safePath(relativePath);

	const data = isBase64
		? Buffer.from(content, 'base64')
		: content;

	await fs.writeFile(filePath, data);
}

/**
 * Delete a file from the Minecraft server root.
 * @param {string} relativePath
 * @returns {Promise<void>}
 */
export async function deleteFile(relativePath) {
	const filePath = safePath(relativePath);

	await fs.unlink(filePath);
}

/**
 * Create a directory (and any missing parents) within the Minecraft server root.
 * @param {string} relativePath
 * @returns {Promise<void>}
 */
export async function createDirectory(relativePath) {
	const dirPath = safePath(relativePath);

	await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Get info about a single file or directory within the Minecraft server root.
 * @param {string} relativePath
 * @returns {Promise<{name: string, isDirectory: boolean, size: number, modifiedAt: string}>}
 */
export async function getFileInfo(relativePath) {
	const filePath = safePath(relativePath);

	const stat = await fs.stat(filePath);
	return toFileInfo(path.basename(filePath), stat);
}
