# Project Structure

## Root Monorepo

```
Minecraft_RCON/
├── agent/                  # Agent relay server
├── container/              # Docker deployment
├── desktop/                # Electron desktop app
├── web/                    # SvelteKit web portal
├── NetherDeck Server/      # Java hybrid MC server
├── docs/                   # Documentation
├── .github/workflows/      # CI/CD
├── README.md
├── SECURITY.md
└── LICENSE                 # MIT
```

## Agent (`agent/`)

Express + Socket.IO relay server that proxies RCON, Query, MySQL, and SMB connections.

```
agent/
├── index.js                    # Entry point — loads dotenv, calls init(), starts server
├── package.json                # vindcom-netherdeck-agent, Node >=16
├── .env.example                # Configuration template
│
├── src/
│   ├── app.js                  # Express setup, middleware, HTTP/HTTPS server, Socket.IO init
│   ├── server.js               # Server startup (listen on port)
│   │
│   ├── config/
│   │   └── index.js            # Config loader — reads env vars, builds config object
│   │
│   ├── middleware/
│   │   └── auth.js             # apiKeyAuth (Express) + socketAuth (Socket.IO) — timing-safe compare
│   │
│   ├── routes/
│   │   ├── index.js            # Route index — mounts /rcon, /smb, /mysql, /query + health/status
│   │   ├── rcon.js             # POST connect, command, disconnect, reconnect; GET params
│   │   ├── mysql.js            # POST connect, query, disconnect, reconnect; GET params
│   │   ├── query.js            # GET / — query server with host, port, mode, bypassCache
│   │   └── smb.js              # POST connect, disconnect, readdir, stat, readFile, writeFile, unlink
│   │
│   ├── services/
│   │   ├── RconService.js      # RCON client management (per-clientId connections)
│   │   ├── MySqlService.js     # MySQL pool management (per-clientId pools)
│   │   ├── QueryService.js     # MC query protocol client with caching
│   │   └── SmbService.js       # SMB client management (per-clientId sessions)
│   │
│   ├── socket/
│   │   ├── index.js            # Socket.IO server setup, connection handling, request routing
│   │   └── handlers.js         # Request handler — routes socket events to services
│   │
│   └── utils/
│       └── logger.js           # Morgan logger factory
│
├── scripts/
│   ├── setup.js                # Interactive setup wizard
│   ├── install-service.js      # Windows service installer (node-windows)
│   └── uninstall-service.js    # Windows service uninstaller
│
├── tests/
│   ├── index.test.js           # Unit/integration tests (Jest)
│   └── smoke-test.js           # Smoke test
│
├── docker-compose.yml          # Standalone agent Docker deployment
└── traefik/
    └── config/
        └── agent.yml           # Traefik reverse proxy config
```

## Web Portal (`web/`)

SvelteKit 2 application with Svelte 5, Tailwind 4, and a Node adapter for production.

```
web/
├── package.json                # vindcom-netherdeck-portal, Node 22+
├── svelte.config.js            # SvelteKit config (adapter-node)
├── vite.config.js              # Vite config (Svelte + Tailwind plugins)
│
├── src/
│   ├── app.html                # HTML shell
│   ├── app.css                 # Tailwind imports + global styles
│   ├── hooks.server.js         # Request interceptor — DB init, RCON auto-connect, auth
│   │
│   ├── lib/
│   │   ├── api.js              # Client-side fetch helpers
│   │   │
│   │   ├── server/             # Server-only modules (not shipped to browser)
│   │   │   ├── auth.js         # validateCredentials, createSession, verifySession, destroySession
│   │   │   ├── db.js           # MySQL connection pool (mysql2)
│   │   │   ├── migrate.js      # Schema migrations + admin seed + session cleanup
│   │   │   ├── oauth.js        # OIDC relying party (discovery, auth URL, code exchange, userinfo)
│   │   │   ├── saml.js         # SAML 2.0 SP (metadata fetch, AuthnRequest, assertion validation)
│   │   │   │
│   │   │   └── services/       # Service layer — one file per protocol/feature
│   │   │       ├── minecraft.js    # RCON client (connect, command, disconnect, auto-reconnect)
│   │   │       ├── rcon.js         # RCON protocol helpers
│   │   │       ├── query.js        # MC query protocol client
│   │   │       ├── game-db.js      # Game MySQL database queries
│   │   │       ├── files.js        # Filesystem operations (list, read, write, delete, mkdir, upload)
│   │   │       ├── supervisor.js   # Supervisor XML-RPC client (start/stop/restart processes)
│   │   │       ├── log-tail.js     # Server log tailing (SSE stream)
│   │   │       └── map.js          # World map proxy to MapHttpServer
│   │   │
│   │   ├── components/         # Shared Svelte components
│   │   │   ├── Modal.svelte
│   │   │   ├── Sidebar.svelte
│   │   │   ├── StatusIndicator.svelte
│   │   │   └── Toast.svelte
│   │   │
│   │   ├── stores/             # Svelte stores (runes-based, Svelte 5)
│   │   │   ├── connections.svelte.js   # Connection state management
│   │   │   └── log-stream.svelte.js    # SSE log stream state
│   │   │
│   │   └── utils/              # Client-side utilities
│   │
│   └── routes/
│       ├── +layout.server.js   # Layout load — passes user to client
│       ├── +layout.svelte      # App shell (sidebar, toast, status)
│       ├── +page.svelte        # Dashboard / home
│       │
│       ├── login/
│       │   ├── +page.server.js # Login form action (POST)
│       │   └── +page.svelte    # Login page
│       │
│       ├── auth/               # OAuth + SAML callback routes
│       │
│       ├── console/
│       │   └── +page.svelte    # RCON console
│       │
│       ├── query/
│       │   └── +page.svelte    # Server query
│       │
│       ├── players/
│       │   └── +page.svelte    # Player list
│       │
│       ├── files/
│       │   └── +page.svelte    # File browser
│       │
│       ├── database/
│       │   └── +page.svelte    # MySQL query interface
│       │
│       ├── server/
│       │   └── +page.svelte    # Server control (start/stop/restart)
│       │
│       ├── settings/
│       │   └── +page.svelte    # Portal settings
│       │
│       ├── map/
│       │   └── +page.svelte    # World map viewer
│       │
│       └── api/                # JSON API endpoints
│           ├── status/+server.js
│           ├── rcon/
│           │   ├── connect/+server.js
│           │   ├── command/+server.js
│           │   ├── disconnect/+server.js
│           │   └── status/+server.js
│           ├── query/+server.js
│           ├── mysql/
│           │   ├── connect/+server.js
│           │   ├── query/+server.js
│           │   └── disconnect/+server.js
│           ├── files/
│           │   ├── list/+server.js
│           │   ├── read/+server.js
│           │   ├── write/+server.js
│           │   ├── delete/+server.js
│           │   ├── mkdir/+server.js
│           │   ├── upload/+server.js
│           │   └── info/+server.js
│           ├── server/
│           │   ├── status/+server.js
│           │   └── control/+server.js
│           ├── console/
│           │   └── stream/+server.js   # SSE log stream
│           └── map/
│               ├── metadata/+server.js
│               ├── players/+server.js
│               └── tiles/[...path]/+server.js
│
└── static/
    ├── favicon.ico
    └── logo.svg
```

## Desktop App (`desktop/`)

Electron application with a bundled agent relay.

```
desktop/
├── package.json            # vindcom-netherdeck, Electron 35+
├── main.js                 # Electron main process — window, IPC registration
├── preload.js              # Context bridge — exposes API to renderer
├── index.html              # Main window HTML
├── input.css               # Tailwind source CSS
├── tailwind.css            # Built CSS output
├── icon.ico                # App icon (ICO)
├── icon.png                # App icon (PNG)
├── logo.svg                # App logo
│
├── preload/                # Preload modules — secure IPC bridge functions
│   ├── api.js              # General API helpers
│   ├── config.js           # Config read/write
│   ├── agent-function.js   # Agent management
│   ├── agent-websocket.js  # WebSocket connection management
│   ├── connection-manager.js
│   ├── ws-helpers.js       # WebSocket utility functions
│   ├── ws-rcon.js          # RCON over WebSocket
│   ├── ws-query.js         # Query over WebSocket
│   ├── ws-mysql.js         # MySQL over WebSocket
│   └── ws-smb.js           # SMB over WebSocket
│
├── ipc/                    # Main-process IPC handlers
│   ├── rcon.js             # RCON operations
│   ├── query.js            # Query operations
│   ├── mysql.js            # MySQL operations
│   ├── smb.js              # SMB operations
│   ├── config.js           # Config management
│   ├── agent.js            # Agent lifecycle
│   ├── files.js            # File operations
│   └── yaml.js             # YAML parsing
│
├── lib/                    # Shared libraries
│   ├── rcon.js             # RCON protocol client
│   ├── query.js            # MC query protocol client
│   ├── mysql.js            # MySQL client wrapper
│   ├── smbClient.js        # SMB client wrapper
│   ├── agentWebSocket.js   # Agent WebSocket client
│   ├── config.js           # Config encryption/decryption
│   └── storage.js          # Encrypted local storage
│
├── renderer/               # Renderer process — UI logic
│   ├── index.js            # Entry point — initialise all modules
│   ├── domElements.js      # DOM element references
│   ├── actions.js          # User action handlers
│   ├── rconClient.js       # RCON UI logic
│   ├── query.js            # Query UI logic
│   ├── mysql.js            # MySQL UI logic
│   ├── smb.js              # SMB/file browser UI logic
│   ├── agent.js            # Agent connection UI
│   ├── agentStatus.js      # Agent status indicator
│   ├── autocomplete.js     # Command autocomplete
│   ├── configLoader.js     # Config loading UI
│   ├── errorHandlers.js    # Global error handling
│   ├── initwebSocket.js    # WebSocket initialisation
│   ├── modals.js           # Modal dialogs
│   ├── refreshers.js       # Auto-refresh timers
│   ├── serverFunctions.js  # Server control UI
│   ├── serverManagement.js # Server management UI
│   ├── settings.js         # Settings page UI
│   ├── toast.js            # Toast notifications
│   ├── uiTabs.js           # Tab navigation
│   └── utils.js            # UI utilities
│
├── build/
│   ├── icon.ico            # Build icon
│   ├── installer.gif       # MSI installer image
│   └── certs/              # Code signing certificates
│
├── postcss.config.js
└── tailwind.config.js
```

## Container (`container/`)

```
container/
├── Dockerfile              # Multi-stage build (Ubuntu + Paper MC + Node services)
├── docker-compose.yml      # Standard deployment
├── docker-compose-swarm.yml # Docker Swarm deployment
├── .env.example            # Complete env var template
├── entrypoint.sh           # Init script — MySQL, Samba, server.properties, supervisor config
├── supervisord.conf        # Supervisor template (placeholders replaced by entrypoint)
├── smb.conf                # Samba configuration
├── logrotate.conf          # Log rotation config
├── samba-repair.sh         # Samba repair utility
├── samba-debug.sh          # Samba debugging utility
├── LICENSE
├── README.md
└── SECURITY.md
```

## NetherDeck Server (`NetherDeck Server/`)

Java 21 Gradle project. Full structure documented in [netherdeck-server.md](netherdeck-server.md).

```
NetherDeck Server/
├── build.gradle                # Root build config
├── settings.gradle             # Module declarations
├── buildSrc/                   # Custom Gradle plugin (NetherDeckGradlePlugin)
├── netherdeck-common/          # Shared code — config, mixins (680+), world map
├── netherdeck-neoforge/        # NeoForge platform
├── netherdeck-forge/           # Forge platform
├── netherdeck-fabric/          # Fabric platform
├── netherdeck-bootstrap/       # Bootstrap loader
├── netherdeck-installer/       # Installer
├── libraries/                  # Vendored dependencies
│   ├── netherdeck-api/         # Public API (source)
│   ├── netherdeck-mixin-tools/ # Mixin utilities (source)
│   ├── netherdeck-tools/       # Build tools (source)
│   └── bluemap/                # BlueMap Core JARs (vendored, MIT)
└── .github/workflows/
    └── build.yml               # CI build pipeline
```

## CI/CD (`.github/workflows/`)

| Workflow | File | Purpose |
|----------|------|---------|
| Docker Build | `docker-build.yml` | Build + push Docker image to Docker Hub |
| Electron Release | `electron-release.yml` | Build + release Windows MSI |
| Security Scans | `security-scan.yml` | Trivy, Semgrep, TruffleHog |
