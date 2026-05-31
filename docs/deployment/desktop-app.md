# Desktop App

The NetherDeck desktop app is an Electron application for Windows that provides a native UI for Minecraft server management.

## Download

Pre-built MSI installers are available from the GitHub Releases page (built automatically by the `electron-release.yml` workflow on pushes to `main`).

## Install

Run the MSI installer. The app installs per-machine to `C:\Program Files\NetherDeck\`.

## Connection Modes

### Direct Mode

The app bundles the agent relay and runs it locally. Configure your Minecraft server's RCON/Query/MySQL/SMB details directly in the app settings.

Best for: managing a server on the same machine or local network.

### Remote Agent Mode

Connect to an external agent relay server. You only need the agent URL and API key.

Best for: managing remote servers over the internet.

## Configuration

All configuration is managed through the Settings page in the app. Settings are encrypted and stored locally using machine-specific encryption.

### Required Settings

| Setting | Description |
|---------|-------------|
| RCON Host | Minecraft server IP or hostname |
| RCON Port | RCON port (default: 25575) |
| RCON Password | The `rcon.password` from `server.properties` |

### Optional Settings

| Setting | Description |
|---------|-------------|
| Query Host/Port | For server status queries (default: same as game port) |
| MySQL Host/Port/User/Password/Database | For the database management page |
| SMB Host/Share/User/Password | For the file browser page |
| Agent URL | Remote agent relay URL (e.g., `https://agent.example.com:3500`) |
| Agent API Key | API key for authenticating with the remote agent |

## Building from Source

### Prerequisites

- Node.js 22+ (LTS)
- Windows (the build targets MSI)

### Build

```bash
cd desktop
npm ci
npm run dist
```

The MSI installer is written to `desktop/dist/`.

### Development

```bash
cd desktop
npm ci
npm run start
```

This builds Tailwind CSS and launches Electron in development mode.

## Architecture

The desktop app consists of:

| Layer | Directory | Description |
|-------|-----------|-------------|
| Main process | `desktop/main.js` | Electron main process, window management, IPC handlers |
| Preload | `desktop/preload.js`, `desktop/preload/` | Secure bridge between main and renderer |
| Renderer | `desktop/renderer/` | UI logic — DOM manipulation, event handlers, state |
| IPC handlers | `desktop/ipc/` | Main-process handlers for RCON, query, MySQL, SMB, config, agent, files, YAML |
| Libraries | `desktop/lib/` | Shared utilities — RCON client, query client, MySQL, SMB, config, storage, agent WebSocket |
| UI | `desktop/index.html`, `desktop/index.css` | HTML + Tailwind CSS |

The app bundles the `agent/` directory into the ASAR archive so the agent relay can run embedded.
