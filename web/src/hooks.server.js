import crypto from 'node:crypto';

const SESSION_SECRET = process.env.WEB_PORTAL_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const sessions = new Map();

function signToken(sessionId) {
	const hmac = crypto.createHmac('sha256', SESSION_SECRET);
	hmac.update(sessionId);
	return `${sessionId}.${hmac.digest('hex')}`;
}

function verifyToken(token) {
	if (!token || !token.includes('.')) return null;
	const [sessionId, sig] = token.split('.');
	const hmac = crypto.createHmac('sha256', SESSION_SECRET);
	hmac.update(sessionId);
	const expected = hmac.digest('hex');

	if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
		return null;
	}

	return sessions.has(sessionId) ? sessionId : null;
}

export function createSession() {
	const sessionId = crypto.randomUUID();
	sessions.set(sessionId, { created: Date.now() });
	return signToken(sessionId);
}

export function destroySession(token) {
	if (!token) return;
	const sessionId = verifyToken(token);
	if (sessionId) {
		sessions.delete(sessionId);
	}
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const token = event.cookies.get('session');
	const sessionId = token ? verifyToken(token) : null;

	event.locals.authenticated = !!sessionId;

	const isLoginRoute = event.url.pathname === '/login';
	const isApiRoute = event.url.pathname.startsWith('/api/');

	if (!event.locals.authenticated && !isLoginRoute) {
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

	if (event.locals.authenticated && isLoginRoute) {
		return new Response(null, {
			status: 302,
			headers: { Location: '/' }
		});
	}

	return resolve(event);
}
