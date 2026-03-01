import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			envPrefix: 'WEB_PORTAL_'
		})
	}
};

export default config;
