import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Load .env vars into process.env so server-side code can read them
	Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

	return {
		plugins: [tailwindcss(), sveltekit()]
	};
});
