import { createLogTail } from '$lib/server/services/log-tail.js';

/** @type {import('./$types').RequestHandler} */
export function GET({ request }) {
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			function sendEvent(eventType, data) {
				try {
					const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
					controller.enqueue(encoder.encode(payload));
				} catch {
					// Controller may be closed if client disconnected
				}
			}

			const tail = createLogTail(
				(lines, isInitial) => {
					sendEvent(isInitial ? 'initial' : 'lines', { lines });
				},
				(err) => {
					sendEvent('error', { message: err.message });
				}
			);

			tail.start();

			// Cleanup when client disconnects
			request.signal.addEventListener('abort', () => {
				tail.stop();
				try {
					controller.close();
				} catch {
					// Already closed
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
}
