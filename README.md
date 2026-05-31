# NetherDeck

Full-stack Minecraft server management — from console commands to world maps.

## Components

| Component | Tech | Directory | Description |
|-----------|------|-----------|-------------|
| **Container** | Docker, Supervisor, Paper MC | `container/` | Production Minecraft server with MySQL, Samba, optional agent + portal |
| **Web Portal** | SvelteKit 2, Svelte 5, Tailwind 4 | `web/` | Browser-based management UI with SSO support |
| **Agent Relay** | Express, Socket.IO | `agent/` | Authenticated proxy for RCON, Query, MySQL, and SMB |
| **Desktop App** | Electron | `desktop/` | Native Windows client with direct + agent connection modes |
| **NetherDeck Server** | Java 21, NeoForge, Paper | `NetherDeck Server/` | Hybrid NeoForge+Paper server fork (mods + plugins) |

## Quick Start

### Docker (recommended)

```bash
cp container/.env.example container/.env   # edit passwords + set MC_EULA=true
cd container && docker compose up -d
# Game: localhost:25565  |  Portal: localhost:3000  |  Agent: localhost:3500
```

### Desktop App

```bash
cd desktop && npm ci && npm run start
```

### Development (web portal)

```bash
cd web && npm ci && npm run dev    # http://localhost:5173
```

## Features

- **RCON Console** — send commands, view colour-coded responses, command history
- **Server Query** — real-time player list, server status, performance metrics
- **File Browser** — browse, edit, upload, and delete server files (Docker: direct filesystem; remote: SMB via agent)
- **Database** — connect to the game MySQL instance, run queries, view results
- **World Map** — 2D live map powered by BlueMap Core (NetherDeck Server only)
- **Authentication** — local accounts (bcrypt), OAuth/OIDC, SAML 2.0
- **Server Control** — start, stop, restart the Minecraft process via Supervisor

## Documentation

| Topic | Link |
|-------|------|
| System architecture | [docs/architecture.md](docs/architecture.md) |
| Docker deployment | [docs/deployment/docker.md](docs/deployment/docker.md) |
| Manual setup | [docs/deployment/manual-setup.md](docs/deployment/manual-setup.md) |
| Desktop app | [docs/deployment/desktop-app.md](docs/deployment/desktop-app.md) |
| Environment variables | [docs/configuration/environment-reference.md](docs/configuration/environment-reference.md) |
| Authentication | [docs/configuration/authentication.md](docs/configuration/authentication.md) |
| Getting started (dev) | [docs/development/getting-started.md](docs/development/getting-started.md) |
| Project structure | [docs/development/project-structure.md](docs/development/project-structure.md) |
| Web portal internals | [docs/development/web-portal.md](docs/development/web-portal.md) |
| Agent relay API | [docs/development/agent-relay.md](docs/development/agent-relay.md) |
| NetherDeck Server | [docs/development/netherdeck-server.md](docs/development/netherdeck-server.md) |

## Ports

| Port | Protocol | Service |
|------|----------|---------|
| 25565 | TCP/UDP | Minecraft game + query |
| 25575 | TCP | RCON |
| 3306 | TCP | MySQL |
| 445 | TCP | SMB file share |
| 3500 | TCP | Agent relay (HTTP + WebSocket) |
| 3000 | TCP | Web portal |
| 8100 | TCP | World map HTTP (NetherDeck Server only) |

## CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `docker-build.yml` | Push to develop/main | Build + push Docker image to Docker Hub |
| `electron-release.yml` | Push to main | Build + release desktop MSI installer |
| `security-scan.yml` | Push + weekly schedule | Trivy, Semgrep, TruffleHog scans |

## License

[MIT](LICENSE) — Copyright (c) 2025 VINDCOM
