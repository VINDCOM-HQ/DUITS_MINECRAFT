# Web Portal Development

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | SvelteKit | 2.x |
| UI | Svelte | 5.x (runes mode) |
| CSS | Tailwind CSS | 4.x |
| Build | Vite | 7.x |
| Runtime | Node.js | 22+ |
| Database | MySQL | 8+ (via mysql2) |
| Auth | bcryptjs, @node-saml/node-saml | — |
| Adapter | @sveltejs/adapter-node | 5.x |

## Server Hooks Lifecycle

Every request passes through `hooks.server.js`:

```
Request
  │
  ├─ ensureInitialized()
  │    ├─ runMigrations()          # Create tables, seed admin, clean sessions
  │    └─ rconConnect()            # Auto-connect RCON in background (non-blocking)
  │
  ├─ Check: database ready?
  │    └─ No → 503 Service Unavailable (retries every 10s)
  │
  ├─ Extract session cookie
  ├─ verifySession(token)          # HMAC verify + DB lookup
  ├─ event.locals.user = user
  │
  ├─ Check: authenticated?
  │    ├─ No + /login or /auth/* → allow through
  │    ├─ No + /api/* → 401 JSON
  │    ├─ No + page → 302 redirect to /login
  │    └─ Yes + /login → 302 redirect to /
  │
  └─ resolve(event)                # Render page or API route
```

## Service Layer

Each service in `lib/server/services/` is a singleton module that manages its own connection state:

| Service | File | Protocols | Description |
|---------|------|-----------|-------------|
| Minecraft | `minecraft.js` | RCON | Connect, send commands, auto-reconnect |
| RCON | `rcon.js` | RCON | Low-level RCON protocol helpers |
| Query | `query.js` | MC Query | Server status and player list |
| Game DB | `game-db.js` | MySQL | Read-only queries against the game database |
| Files | `files.js` | Filesystem | List, read, write, delete, mkdir, upload — with path traversal prevention |
| Supervisor | `supervisor.js` | XML-RPC | Start/stop/restart Minecraft and other processes |
| Log Tail | `log-tail.js` | File tail | Stream server log via SSE |
| Map | `map.js` | HTTP proxy | Proxy tiles, metadata, and player data from MapHttpServer |

## API Routes

All routes are under `src/routes/api/` and return JSON. Authentication is enforced by `hooks.server.js` — no per-route auth checks needed.

### RCON

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/rcon/connect` | — | `{ success }` |
| POST | `/api/rcon/command` | `{ command }` | `{ success, response }` |
| POST | `/api/rcon/disconnect` | — | `{ success }` |
| GET | `/api/rcon/status` | — | `{ success, connected }` |

### Query

| Method | Path | Params | Response |
|--------|------|--------|----------|
| GET | `/api/query` | `?mode=basic\|full` | `{ success, info }` |

### MySQL (Game DB)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/mysql/connect` | — | `{ success }` |
| POST | `/api/mysql/query` | `{ sql }` | `{ success, result }` |
| POST | `/api/mysql/disconnect` | — | `{ success }` |

### Files

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/files/list` | `?path=` | `{ success, files }` |
| GET | `/api/files/read` | `?path=` | `{ success, content }` |
| GET | `/api/files/info` | `?path=` | `{ success, info }` |
| POST | `/api/files/write` | `{ path, content }` | `{ success }` |
| POST | `/api/files/delete` | `{ path }` | `{ success }` |
| POST | `/api/files/mkdir` | `{ path }` | `{ success }` |
| POST | `/api/files/upload` | FormData | `{ success }` |

### Server Control

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/server/status` | — | `{ success, processes }` |
| POST | `/api/server/control` | `{ action, process }` | `{ success }` |

### Console (SSE)

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/console/stream` | Server-Sent Events (log lines) |

### Map

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/map/metadata` | Map configuration |
| GET | `/api/map/players` | Live player positions |
| GET | `/api/map/tiles/[...path]` | Tile images (proxied) |

### Status

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/status` | `{ success, status }` |

## Adding a New Feature

Step-by-step guide for adding a new server-side feature (e.g., a new management page):

### 1. Create the service

Add a new file in `web/src/lib/server/services/`:

```js
// web/src/lib/server/services/my-feature.js
let state = null;

export function doSomething(params) {
  // Implementation
  return { result: 'data' };
}
```

### 2. Create the API route

Add a new directory in `web/src/routes/api/`:

```js
// web/src/routes/api/my-feature/+server.js
import { json } from '@sveltejs/kit';
import { doSomething } from '$lib/server/services/my-feature.js';

export async function POST({ request }) {
  const body = await request.json();
  const result = doSomething(body);
  return json({ success: true, ...result });
}
```

### 3. Create the page

Add a new route in `web/src/routes/`:

```svelte
<!-- web/src/routes/my-feature/+page.svelte -->
<script>
  // Fetch from API, render UI
</script>
```

### 4. Add to sidebar

Edit `web/src/lib/components/Sidebar.svelte` to add a navigation link.

## Stores

The portal uses Svelte 5 runes for state management:

- `connections.svelte.js` — tracks RCON, MySQL, and query connection states
- `log-stream.svelte.js` — manages the SSE log stream subscription

## Development Server

```bash
cd web
npm run dev     # Vite dev server on http://localhost:5173
```

Hot module replacement is enabled. Server-side code changes require a restart.
