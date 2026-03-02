// Minecraft log format: [HH:MM:SS] [Thread/LEVEL]: Message
const LOG_LINE_REGEX = /^\[(\d{2}:\d{2}:\d{2})\]\s+\[([^\]]+)\/(INFO|WARN|ERROR|FATAL)\]:\s*(.*)$/;

/**
 * Map log level to output type for color coding.
 * @param {string} level
 * @returns {string}
 */
function levelToType(level) {
	switch (level) {
		case 'WARN':
			return 'log-warn';
		case 'ERROR':
		case 'FATAL':
			return 'log-error';
		default:
			return 'log';
	}
}

/**
 * Parse a Minecraft server log line into structured data.
 * @param {string} raw - Raw log line string
 * @returns {{ time: string, source: string, level: string, message: string, text: string, type: string }}
 */
export function parseLogLine(raw) {
	const match = raw.match(LOG_LINE_REGEX);

	if (match) {
		const [, time, source, level, message] = match;
		return { time, source, level, message, text: raw, type: levelToType(level) };
	}

	// Non-matching lines (stack traces, multiline output, blank lines)
	return { time: '', source: '', level: '', message: raw, text: raw, type: 'log' };
}
