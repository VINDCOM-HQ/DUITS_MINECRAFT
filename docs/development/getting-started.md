# Getting Started

## Prerequisites

| Tool | Version | Needed For |
|------|---------|------------|
| Node.js | 22+ | Web portal, agent, desktop |
| npm | 10+ | Comes with Node.js |
| Java | 21 (Temurin) | NetherDeck Server only |
| Git | Latest | All components |
| MySQL | 8+ | Web portal (dev) |

## Clone

```bash
git clone <repository-url>
cd Minecraft_RCON
```

## Web Portal

```bash
cd web
npm ci
npm run dev
```

Open `http://localhost:5173`. You need a MySQL instance running with the portal database configured — see [environment variables](../configuration/environment-reference.md#web-portal--database).

Minimal `.env` for development:

```ini
WEB_PORTAL_DB_HOST=localhost
WEB_PORTAL_DB_PORT=3306
WEB_PORTAL_DB_USER=netherdeck
WEB_PORTAL_DB_PASSWORD=dev-password
WEB_PORTAL_DB_NAME=netherdeck
WEB_PORTAL_ADMIN_USER=admin
WEB_PORTAL_ADMIN_PASSWORD=admin
WEB_PORTAL_RCON_HOST=localhost
WEB_PORTAL_RCON_PORT=25575
WEB_PORTAL_RCON_PASSWORD=your-rcon-password
WEB_PORTAL_MC_DIR=/path/to/minecraft
```

### Build for production

```bash
npm run build           # outputs to web/build/
node build/index.js     # run the production server
```

## Agent Relay

```bash
cd agent
cp .env.example .env    # edit with your API key
npm install
npm start
```

The agent starts on `http://localhost:3500`.

### Run tests

```bash
npm test
```

## Desktop App

```bash
cd desktop
npm ci
npm run start           # builds CSS + launches Electron
```

### Build installer

```bash
npm run dist            # outputs MSI to desktop/dist/
```

## NetherDeck Server

Requires Java 21 and Git on PATH.

```bash
cd "NetherDeck Server"

# Set JAVA_HOME to Java 21
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot"

# Ensure Git is on PATH (needed by BuildTools for Spigot compilation)
export PATH="/c/Program Files/Git/cmd:$PATH"

./gradlew build --no-daemon
```

Build outputs three platform JARs in `build/libs/`:
- `netherdeck-forge-*.jar`
- `netherdeck-neoforge-*.jar`
- `netherdeck-fabric-*.jar`

See [netherdeck-server.md](netherdeck-server.md) for detailed build and development instructions.

## Docker (full stack)

```bash
cp container/.env.example container/.env
# Edit .env — set passwords and MC_EULA=true
cd container
docker compose up -d
```

## Project Layout

```
Minecraft_RCON/
├── agent/              # Agent relay (Express + Socket.IO)
├── container/          # Docker image (Dockerfile, compose, entrypoint)
├── desktop/            # Electron desktop app
├── docs/               # Documentation (you are here)
├── web/                # SvelteKit web portal
├── NetherDeck Server/  # Java hybrid server fork
├── .github/workflows/  # CI/CD pipelines
├── README.md
├── SECURITY.md
└── LICENSE
```

See [project-structure.md](project-structure.md) for a detailed breakdown of each component.
