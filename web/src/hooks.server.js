import { runMigrations } from '$lib/server/migrate.js';
import { verifySession } from '$lib/server/auth.js';
import { connect as rconConnect, isConnected as isRconConnected } from '$lib/server/services/minecraft.js';

let initialized = false;
let initFailed = false;
let initRetryAfter = 0;

const INIT_RETRY_INTERVAL_MS = 10_000;

async function ensureInitialized() {
	if (initialized) {
		return true;
	}

	if (initFailed && Date.now() < initRetryAfter) {
		return false;
	}

	try {
		await runMigrations();
		initialized = true;
		initFailed = false;

		// Auto-connect RCON in background (non-blocking).
		// MC server may not be running yet — RCON will auto-reconnect on first command.
		if (!isRconConnected()) {
			rconConnect().catch(() => {});
		}

		return true;
	} catch (err) {
		console.error('[hooks] Database initialization failed:', err.message);
		initFailed = true;
		initRetryAfter = Date.now() + INIT_RETRY_INTERVAL_MS;
		return false;
	}
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const ready = await ensureInitialized();

	if (!ready) {
		const isApiRoute = event.url.pathname.startsWith('/api/');
		if (isApiRoute) {
			return new Response(
				JSON.stringify({ error: 'Service unavailable — database not ready' }),
				{ status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '10' } }
			);
		}
		return new Response('Service unavailable — database not ready. Retry shortly.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain', 'Retry-After': '10' }
		});
	}

	const token = event.cookies.get('session');
	const user = token ? await verifySession(token) : null;

	event.locals.user = user;

	const isLoginRoute = event.url.pathname === '/login';
	const isAuthRoute = event.url.pathname.startsWith('/auth/');
	const isApiRoute = event.url.pathname.startsWith('/api/');

	if (!user && !isLoginRoute && !isAuthRoute) {
		if (isApiRoute) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response(null, {
			status: 302,
			headers: { Location: '/login' }
		});
	}

	if (user && isLoginRoute) {
		return new Response(null, {
			status: 302,
			headers: { Location: '/' }
		});
	}

	return resolve(event);
}
