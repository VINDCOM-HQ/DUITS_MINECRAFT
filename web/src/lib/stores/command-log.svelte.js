// Shared log of commands issued from anywhere in the portal (control panels,
// quick actions, etc.) plus the server's actual RCON response. The console page
// renders these so commands issued outside the console are still visible and
// confirmable.

let entries = $state([]);
let seq = 0;

const MAX_ENTRIES = 500;

/**
 * Record a command and the server's response.
 * @param {string} command - The raw command sent (without leading slash).
 * @param {string} [response] - The server's RCON response text.
 */
export function logCommand(command, response = '') {
	entries = [
		...entries,
		{
			id: ++seq,
			command,
			response: (response || '').trim(),
			time: new Date().toLocaleTimeString()
		}
	];

	if (entries.length > MAX_ENTRIES) {
		entries = entries.slice(entries.length - MAX_ENTRIES);
	}
}

/**
 * Reactive accessor for the command log.
 * @returns {Array<{ id: number, command: string, response: string, time: string }>}
 */
export function getCommandLog() {
	return entries;
}
