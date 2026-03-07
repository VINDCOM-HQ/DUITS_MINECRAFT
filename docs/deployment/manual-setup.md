# Manual Setup

Run the agent relay and/or web portal on bare metal without Docker.

## Agent Relay

### Prerequisites

- Node.js 16+ (LTS recommended)
- Network access to the Minecraft server's RCON, Query, MySQL, and/or SMB ports

### Install

```bash
cd agent
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env`:

```ini
AGENT_API_KEY=your-strong-random-key
AGENT_PORT=3500
```

### Run

```bash
npm start
```

The agent listens on `http://0.0.0.0:3500` (or HTTPS if TLS is configured).

### TLS

```ini
AGENT_ENABLE_TLS=true
AGENT_TLS_CERT=/path/to/cert.pem
AGENT_TLS_KEY=/path/to/key.pem
AGENT_TLS_PASSPHRASE=optional-passphrase
```

### Install as System Service

#### Windows

```bash
npm run service:install
```

This uses `node-windows` to register the agent as a Windows service. To remove:

```bash
npm run service:uninstall
```

#### Linux (systemd)

Create `/etc/systemd/system/netherdeck-agent.service`:

```ini
[Unit]
Description=NetherDeck Agent Relay
After=network.target

[Service]
Type=simple
User=netherdeck
WorkingDirectory=/opt/netherdeck/agent
ExecStart=/usr/bin/node index.js
Restart=on-failure
EnvironmentFile=/opt/netherdeck/agent/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now netherdeck-agent
```

### Interactive Setup

For a guided configuration experience:

```bash
npm run setup
```

This walks through API key generation, port selection, and TLS configuration.

## Web Portal

### Prerequisites

- Node.js 22+
- MySQL 8+ (local or remote)
- Network access to the Minecraft server's RCON and Query ports
- (Optional) Filesystem access to the Minecraft server directory for the file browser

### Install

```bash
cd web
npm ci
npm run build
```

### Configure

Set environment variables (or create a `.env` file in the `web/` directory):

```ini
# Core
PORT=3000
WEB_PORTAL_SESSION_SECRET=generate-a-random-64-char-hex-string

# Database
WEB_PORTAL_DB_HOST=localhost
WEB_PORTAL_DB_PORT=3306
WEB_PORTAL_DB_USER=netherdeck
WEB_PORTAL_DB_PASSWORD=your-db-password
WEB_PORTAL_DB_NAME=netherdeck

# Break-glass admin (created on first run)
WEB_PORTAL_ADMIN_USER=admin
WEB_PORTAL_ADMIN_PASSWORD=strong-password-here

# RCON connection to Minecraft
WEB_PORTAL_RCON_HOST=localhost
WEB_PORTAL_RCON_PORT=25575
WEB_PORTAL_RCON_PASSWORD=rcon-password

# Game database (for the Database page)
WEB_PORTAL_GAME_DB_NAME=minecraft

# Minecraft server directory (for the File Browser page)
WEB_PORTAL_MC_DIR=/path/to/minecraft

# Query port
WEB_PORTAL_QUERY_PORT=25565

# World map (if NetherDeck Server map is running)
WEB_PORTAL_MAP_HOST=127.0.0.1
WEB_PORTAL_MAP_PORT=8100

# Cookie security (set false if not using HTTPS)
WEB_PORTAL_SECURE_COOKIES=true
```

### Database Setup

Create the portal database and user in MySQL:

```sql
CREATE DATABASE netherdeck;
CREATE USER 'netherdeck'@'localhost' IDENTIFIED BY 'your-db-password';
GRANT ALL PRIVILEGES ON netherdeck.* TO 'netherdeck'@'localhost';

-- If using the Database page, grant read access to the game DB:
GRANT SELECT ON minecraft.* TO 'netherdeck'@'localhost';

FLUSH PRIVILEGES;
```

The portal runs migrations automatically on first start — no manual table creation needed.

### Run

```bash
cd web
node build/index.js
```

The portal listens on `http://0.0.0.0:3000` (configurable via `PORT`).

### Run as a systemd Service

```ini
[Unit]
Description=NetherDeck Web Portal
After=network.target mysql.service

[Service]
Type=simple
User=netherdeck
WorkingDirectory=/opt/netherdeck/web
ExecStart=/usr/bin/node build/index.js
Restart=on-failure
EnvironmentFile=/opt/netherdeck/web/.env

[Install]
WantedBy=multi-user.target
```

### OAuth / SAML

See [../configuration/authentication.md](../configuration/authentication.md) for OAuth/OIDC and SAML 2.0 setup.
