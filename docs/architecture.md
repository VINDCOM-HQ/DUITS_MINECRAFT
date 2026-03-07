# Architecture

## System Overview

```
                         ┌─────────────────────────────────────────────────┐
                         │              Docker Container                   │
                         │                                                 │
  Browser ──────────────►│  Web Portal (:3000)                             │
                         │    │  SvelteKit + Node adapter                  │
                         │    │                                            │
                         │    ├──► RCON Service ──────► MC Server (:25575) │
                         │    ├──► Query Service ─────► MC Server (:25565) │
                         │    ├──► File Service ──────► /minecraft (fs)    │
                         │    ├──► Game DB Service ──► MySQL (:3306)       │
                         │    ├──► Supervisor Service ► supervisorctl      │
                         │    ├──► Log Tail Service ─► server.log (tail)   │
                         │    └──► Map Service ──────► MapHttpServer(:8100)│
                         │                                                 │
  Desktop / ────────────►│  Agent Relay (:3500)                            │
  External Client        │    │  Express + Socket.IO                       │
                         │    │                                            │
                         │    ├──► RCON Service ──────► MC Server (:25575) │
                         │    ├──► Query Service ─────► MC Server (:25565) │
                         │    ├──► MySQL Service ────► MySQL (:3306)       │
                         │    └──► SMB Service ──────► Samba (:445)        │
                         │                                                 │
                         │  Supervisor                                     │
                         │    ├── mysqld                                   │
                         │    ├── smbd + nmbd                              │
                         │    ├── paper (Java)                             │
                         │    ├── agent (Node)                             │
                         │    ├── web-portal (Node)                        │
                         │    └── cron                                     │
                         └─────────────────────────────────────────────────┘
```

## Component Responsibilities

### Web Portal (`web/`)

SvelteKit application compiled to a Node.js server via `@sveltejs/adapter-node`. Runs inside the container or standalone.

- **Server hooks** (`hooks.server.js`): initialise database (run migrations), auto-connect RCON, authenticate every request via signed session cookie.
- **Service layer** (`lib/server/services/`): thin wrappers around protocol clients — each service manages its own connection lifecycle.
- **API routes** (`routes/api/`): JSON endpoints consumed by the Svelte frontend. Every route is protected by the session check in hooks.
- **Pages** (`routes/`): SSR + client-side Svelte 5 pages for console, query, files, database, server control, settings, map.

### Agent Relay (`agent/`)

Express HTTP server with Socket.IO for real-time communication. Designed as a lightweight proxy that the desktop app (or any HTTP client) talks to.

- **Auth middleware**: timing-safe API key comparison on every HTTP request and Socket.IO handshake.
- **REST API** (`/api/*`): stateful endpoints — clients first `POST /connect` to get a `clientId`, then use that ID for subsequent operations.
- **WebSocket** (`socket.io`): event-based `request`/`response` protocol for real-time operations.
- **Client isolation**: each connection gets a UUID; connection state (RCON sessions, MySQL pools, SMB clients) is scoped to that UUID.

### Desktop App (`desktop/`)

Electron application bundling the agent relay locally. Can operate in two modes:

1. **Direct mode**: the bundled agent connects directly to the Minecraft server.
2. **Remote mode**: connects to an external agent relay over HTTP/S.

### Container (`container/`)

Docker image based on Ubuntu with Supervisor managing all services. The `entrypoint.sh` script handles:

1. Input validation (identifiers, IPs, memory values)
2. MySQL initialisation and credential management
3. `server.properties` generation from `MC_*` environment variables
4. Samba user and share setup
5. Agent and web portal `.env` file generation
6. Supervisor config template rendering

### NetherDeck Server (`NetherDeck Server/`)

Hybrid NeoForge + Paper server fork targeting Minecraft 1.21.1. Includes a built-in world map feature powered by BlueMap Core and bundled ViaVersion/ViaBackwards plugins for cross-version client support.

## Data Flows

### Docker Mode (portal + agent in container)

```
Browser → Portal (:3000) → Service Layer → MC Server / MySQL / Filesystem
```

The portal talks directly to services over localhost. No agent needed for portal operations.

### Remote / Agent Mode (desktop app)

```
Desktop App → Agent (:3500) → RCON / Query / MySQL / SMB
```

The desktop app sends API-key-authenticated requests to the agent. The agent proxies to the target services.

### Desktop Direct Mode

```
Desktop App → Bundled Agent (localhost) → RCON / Query / MySQL / SMB
```

Same as remote mode, but the agent runs locally inside the Electron process.

## Authentication Flow

```
User                    Browser                  Portal Server            MySQL
  │                       │                          │                      │
  ├─ POST /login ────────►│                          │                      │
  │  {username, password}  ├─────────────────────────►│                      │
  │                        │   validateCredentials()  ├─ SELECT ... WHERE ──►│
  │                        │                          │   username = ?       │
  │                        │                          │◄─ {id, hash, role} ──┤
  │                        │                          │                      │
  │                        │                          ├─ bcrypt.compare()    │
  │                        │                          │                      │
  │                        │                          ├─ createSession()     │
  │                        │                          │  UUID + HMAC-SHA256  │
  │                        │                          ├─ INSERT session ────►│
  │                        │                          │                      │
  │◄─ Set-Cookie: session=UUID.HMAC ─────────────────┤                      │
  │                        │                          │                      │
  ├─ GET /console ────────►│                          │                      │
  │  Cookie: session=...   ├─────────────────────────►│                      │
  │                        │   verifySession()        ├─ SELECT ... JOIN ───►│
  │                        │                          │   WHERE id = ?       │
  │                        │                          │   AND expires > NOW  │
  │                        │                          │◄─ {id, user, role} ──┤
  │◄─ 200 (page) ─────────┤◄─────────────────────────┤                      │
```

For OAuth/OIDC and SAML flows, the portal redirects to the identity provider, receives a callback, and calls `findOrCreateExternalUser()` to provision the user before creating a session.

## Database Schema

The web portal uses a MySQL database (`netherdeck` by default) with four tables:

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `username` | VARCHAR(255) | Unique |
| `password` | VARCHAR(255) | bcrypt hash (null for external users) |
| `role` | ENUM('admin','user') | Default: 'user' |
| `auth_source` | ENUM('local','oauth','saml') | Default: 'local' |
| `oauth_sub` | VARCHAR(255) | OIDC subject identifier |
| `saml_name_id` | VARCHAR(255) | SAML NameID |
| `created_at` | TIMESTAMP | Auto |
| `updated_at` | TIMESTAMP | Auto on update |

### `sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | UUID primary key |
| `user_id` | INT | FK → users.id (CASCADE delete) |
| `created_at` | TIMESTAMP | Auto |
| `expires_at` | TIMESTAMP | Indexed for cleanup |

### `login_attempts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `username` | VARCHAR(255) | Attempted username |
| `ip_address` | VARCHAR(45) | Client IP (supports IPv6) |
| `user_agent` | VARCHAR(512) | Browser user agent |
| `reason` | ENUM('invalid_credentials','account_locked') | Failure reason |
| `created_at` | TIMESTAMP | Auto |

Indexes: `(ip_address, created_at)`, `(username, created_at)`, `(created_at)`. Used by the rate limiter (5 attempts per IP in 15 minutes). Created automatically by migration v2.

### `schema_version`

| Column | Type | Notes |
|--------|------|-------|
| `version` | INT | Primary key |
| `applied_at` | TIMESTAMP | Auto |

## Port Map

| Port | Protocol | Service | Exposed By Default |
|------|----------|---------|-------------------|
| 25565 | TCP + UDP | Minecraft game server + query | Yes |
| 25575 | TCP | RCON | Yes |
| 3306 | TCP | MySQL | Yes (bind 127.0.0.1 default) |
| 445/139 | TCP | Samba (SMB) | Yes |
| 137/138 | UDP | NetBIOS | Yes |
| 3500 | TCP | Agent relay (REST + WebSocket) | When `ENABLE_AGENT=true` |
| 3000 | TCP | Web portal | When `ENABLE_WEB_PORTAL=true` |
| 8100 | TCP | World map HTTP (NetherDeck Server) | Configurable in `netherdeck.yml` |

## World Map Architecture

The world map is a NetherDeck Server feature that uses BlueMap Core as a vendored library.

```
MC Server (Java)
  └── NetherDeckMapService
        ├── Adapters (World, Player, Plugin → BlueMap Core API)
        ├── RenderScheduler (chunk rendering on server thread)
        └── MapHttpServer (:8100)
              ├── /maps/{id}/tiles/...   (rendered tile images)
              ├── /maps                  (map metadata)
              └── /maps/{id}/players     (live player positions)

Web Portal
  └── /map page
        ├── /api/map/tiles/[...path]   → proxy to MapHttpServer
        ├── /api/map/metadata          → proxy to MapHttpServer
        └── /api/map/players           → proxy to MapHttpServer
```

Tiles are rendered by BlueMap Core into an in-memory tile store and served over a lightweight HTTP server. The web portal proxies these endpoints so the map is accessible through the authenticated portal without exposing port 8100 directly.
