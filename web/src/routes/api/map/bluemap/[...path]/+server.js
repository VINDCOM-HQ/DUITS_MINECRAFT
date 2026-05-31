import { fetchFromMapServer } from '$lib/server/services/map.js';

// Injected into BlueMap's index.html to retheme its controls to match the NetherDeck obsidian palette.
const BLUEMAP_THEME = `
  :root {
    --theme-bg:            #130826;
    --theme-bg-light:      #221540;
    --theme-bg-hover:      #1a1030;
    --theme-fg:            #ede9f6;
    --theme-fg-light:      #a89bc8;
    --theme-border:        #2d1d50;
    --theme-scrollbar:     #3d2a66;
    --theme-accent:        #a855f7;
  }

  /* Control bar */
  .control-bar {
    background: transparent !important;
    filter: none !important;
  }

  /* ── Buttons ── */
  .svg-button {
    background-color: #130826 !important;
    border: 1px solid #2d1d50 !important;
    border-radius: 6px !important;
    margin: 2px !important;
  }
  .svg-button:hover { background-color: #221540 !important; border-color: #3d2a66 !important; }
  .svg-button.active, .svg-button:active {
    background-color: rgba(168,85,247,0.15) !important;
    border-color: rgba(168,85,247,0.4) !important;
  }
  .svg-button svg { fill: #a89bc8 !important; }
  .svg-button:hover svg, .svg-button.active svg { fill: #ede9f6 !important; }

  /* ── Side panels / menus ── */
  .side-menu, .menu-container, .map-menu, #menu, .bluemap-menu {
    background-color: #130826 !important;
    border: 1px solid #2d1d50 !important;
    border-radius: 10px !important;
    backdrop-filter: blur(16px) !important;
  }

  /* ── X / Z coordinate inputs ── */
  .position-input {
    background-color: #130826 !important;
    border: 1px solid #2d1d50 !important;
    border-radius: 6px !important;
    overflow: hidden !important;
    height: 2em !important;
  }
  /* remove the internal left-border between X and Z */
  .position-input > *:not(:first-child) {
    border-left: 1px solid #2d1d50 !important;
  }
  .number-input {
    background-color: transparent !important;
    border: none !important;
    border-radius: 0 !important;
  }
  /* axis label (X / Z) */
  .number-input .label {
    color: #a855f7 !important;
    font-weight: 600 !important;
    font-size: 0.7em !important;
    letter-spacing: 0.05em !important;
    padding: 0 0.4em !important;
  }
  /* the actual coordinate number */
  .number-input input {
    background-color: transparent !important;
    border: none !important;
    color: #ede9f6 !important;
    font-size: 0.78em !important;
    font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
  }
  .number-input input:focus { outline: none !important; }

  /* ── Compass ── */
  .compass svg .north { fill: #a855f7 !important; }
  .compass svg .south { fill: #5b3d8a !important; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #0a0014; }
  ::-webkit-scrollbar-thumb { background: #3d2a66; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #5b3d8a; }

  /* ── General text / inputs ── */
  * { color: #ede9f6; }
  select, textarea {
    background-color: #1a1030 !important;
    border: 1px solid #2d1d50 !important;
    color: #ede9f6 !important;
    border-radius: 4px !important;
  }
`;

/**
 * Transparent proxy for BlueMap's Three.js web application.
 *
 * Routes ALL requests under /api/map/bluemap/[...path] to the Java map HTTP server
 * (http://MAP_HOST:MAP_PORT/<path>). This allows the SvelteKit portal to embed
 * BlueMap's web interface in an iframe without cross-origin issues.
 *
 * Handles:
 *  - GET /api/map/bluemap/            → BlueMap index.html
 *  - GET /api/map/bluemap/assets/...  → Three.js JS/CSS bundles
 *  - GET /api/map/bluemap/maps/...    → Tile data + live player positions
 */

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	try {
		const path = params.path || '';
		const response = await fetchFromMapServer(`/${path}`);

		if (!response.ok) {
			return new Response(null, { status: response.status });
		}

		const contentType = response.headers.get('content-type') || 'application/octet-stream';
		const cacheControl = response.headers.get('cache-control') || 'no-cache';

		// For BlueMap's index.html, inject a <base> tag so all relative asset URLs
		// resolve to /api/map/bluemap/ regardless of how the browser normalised the iframe URL.
		const isHtml = contentType.includes('text/html');
		const isRoot = path === '' || path === 'index.html';

		if (isHtml && isRoot) {
			const text = await response.text();
			const patched = text.replace(
				'<head>',
				`<head><base href="/api/map/bluemap/"><style>${BLUEMAP_THEME}</style>`
			);
			return new Response(patched, {
				status: 200,
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
			});
		}

		const body = await response.arrayBuffer();
		return new Response(body, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Cache-Control': cacheControl
			}
		});
	} catch {
		return new Response('Map server unavailable', { status: 502 });
	}
}
