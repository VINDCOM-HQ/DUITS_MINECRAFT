import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			envPrefix: ''
		}),
		// CSRF: Self-hosted app accessed via varying IPs/hostnames (Docker, WSL, LAN).
		// CSRF protection provided by SameSite=strict session cookies instead.
		csrf: {
			trustedOrigins: ['*']
		}
	}
};

export default config;
