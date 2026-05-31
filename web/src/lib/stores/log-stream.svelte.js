let streamStatus = $state('disconnected');
let eventSource = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

/**
 * Connect to the log stream SSE endpoint.
 * @param {(lines: string[], isInitial: boolean) => void} onLines
 * @param {(message: string) => void} onError
 * @returns {() => void} Cleanup function
 */
export function connectLogStream(onLines, onError) {
	disconnect();
	streamStatus = 'connecting';

	eventSource = new EventSource('/api/console/stream');

	eventSource.addEventListener('initial', (e) => {
		streamStatus = 'connected';
		reconnectAttempts = 0;
		const { lines } = JSON.parse(e.data);
		onLines(lines, true);
	});

	eventSource.addEventListener('lines', (e) => {
		streamStatus = 'connected';
		const { lines } = JSON.parse(e.data);
		onLines(lines, false);
	});

	eventSource.addEventListener('error', (e) => {
		if (e.data) {
			const { message } = JSON.parse(e.data);
			onError(message);
		}
	});

	// Browser-level connection error (network drop, server restart)
	eventSource.onerror = () => {
		streamStatus = 'error';
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
		scheduleReconnect(onLines, onError);
	};

	return () => disconnect();
}

function scheduleReconnect(onLines, onError) {
	if (reconnectTimer) return;

	const delay = Math.min(
		RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
		MAX_RECONNECT_DELAY_MS
	);
	reconnectAttempts++;

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connectLogStream(onLines, onError);
	}, delay);
}

function disconnect() {
	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	streamStatus = 'disconnected';
}

export function getStreamStatus() {
	return streamStatus;
}
