# DUITS Minecraft RMM Tool

A Remote Monitoring and Management tool for Minecraft servers. This electron-based desktop application allows you to:

- Connect to Minecraft servers via RCON protocol
- Execute commands remotely
- Query server status
- Browse server files via SMB
- Execute MySQL queries
- Use a secure HTTP/S relay agent for remote access

## Features

- **Server Management**:
  - Connect via RCON
  - Execute commands and view responses
  - Query server status (basic and full)
  - View and manage players, bans, and IP bans

- **File Operations**:
  - Connect to server file shares via SMB
  - Browse, edit, create, and delete files
  - Upload files

- **Database Management**:
  - Connect to MySQL databases
  - Execute SQL queries
  - View results

- **Relay Agent**:
  - Connect to servers through a single HTTP/S port
  - Secure API key authentication
  - TLS/SSL support
  - WebSocket support
  - Multi-platform support (Windows, Linux, macOS)
  - Docker deployment option

## Desktop Application

The desktop application (Electron) provides a user-friendly interface for all features.

## Docker Container

The `DUITS_MINECRAFT/` directory contains a production-ready Docker image for running a Minecraft Paper server with built-in Samba file sharing, MySQL database support, and an optional agent relay server.

See [DUITS_MINECRAFT/docker-compose.yml](DUITS_MINECRAFT/docker-compose.yml) for deployment.

### Agent Relay in Docker

The agent relay can be bundled into the Minecraft Docker container as an optional Supervisor-managed service:

```bash
# Enable in your .env file:
ENABLE_AGENT=true
AGENT_PORT=3500
AGENT_API_KEY=your-secret-key
```

## Relay Agent

The relay agent allows you to securely expose your Minecraft servers to the internet through a single port.

### Agent Setup

See the [Agent README](agent/README.md) for detailed setup instructions.

Quick start with Docker:

```bash
cd agent
docker-compose up -d
```

Quick start as a system service:

```bash
cd agent
npm install
npm run service:install
```

## Configuration

Configuration is encrypted and stored locally using machine-specific or password-based encryption.

## Development

### Setup

```bash
git clone <repository-url>
cd Minecraft_RCON
npm install
```

### Run in Development Mode

```bash
npm run start
```

### Build

```bash
npm run build
```

## License

See the [LICENSE](LICENSE) file for details.
