# Docker Deployment

The NetherDeck Docker image packages a NetherDeck Server (hybrid NeoForge + Paper) with MySQL, Samba file sharing, ViaVersion cross-version support, an optional agent relay, and an optional web portal — all managed by Supervisor.

Image: `vindcom/netherdeck`

## Quick Start

### 1. Configure environment

```bash
cp container/.env.example container/.env
```

Edit `container/.env`:

```ini
# Required — change these
MYSQL_PASSWORD=change-me
SMB_PASSWORD=change-me
MC_EULA=true

# Enable web portal
ENABLE_WEB_PORTAL=true
WEB_PORTAL_ADMIN_PASSWORD=strong-password-here

# Enable RCON (needed for portal console + agent)
MC_ENABLE_RCON=true
MC_RCON_PASSWORD=rcon-password-here

# Optional — enable agent relay for desktop app access
ENABLE_AGENT=true
AGENT_API_KEY=generate-a-random-key
```

### 2. Start the container

```bash
cd container
docker compose up -d
```

### 3. Verify

```bash
docker compose logs -f    # watch startup
docker compose ps         # check health
```

| Service | URL |
|---------|-----|
| Minecraft | `localhost:25565` |
| Web Portal | `http://localhost:3000` |
| Agent Relay | `http://localhost:3500` |

### 4. First login

Open `http://localhost:3000/login` and sign in with the `WEB_PORTAL_ADMIN_USER` / `WEB_PORTAL_ADMIN_PASSWORD` credentials you set in `.env`.

## Container Services

Supervisor manages these processes (in start order):

| Priority | Service | User | Description |
|----------|---------|------|-------------|
| 100 | `mysqld` | mysql | MySQL database |
| 200 | `smbd` + `nmbd` | root | Samba file sharing |
| 300 | `paper` | minecraft | Paper MC Java server |
| 400 | `agent` | agent | Agent relay (optional) |
| 500 | `web-portal` | agent | Web management portal (optional) |
| — | `cron` | root | Log rotation |

## Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `mc_data` | `/minecraft` | World data, server configs, plugins, logs |
| `mysql_data` | `/var/lib/mysql` | MySQL databases |
| `smb_logs` | `/var/log/samba` | Samba logs |
| `supervisor_logs` | `/var/log/supervisor` | Supervisor + service logs |

## Resource Limits

The default `docker-compose.yml` sets:

| Resource | Limit | Reservation |
|----------|-------|-------------|
| CPU | 4.0 cores | 2.0 cores |
| Memory | 10 GB | 4 GB |

Adjust based on your server size. Java heap is controlled separately via `MC_MIN_MEMORY` / `MC_MAX_MEMORY`.

## Advanced Configuration

### External MySQL

To use an existing MySQL server instead of the built-in one:

```ini
WEB_PORTAL_DB_HOST=db.example.com
WEB_PORTAL_DB_PORT=3306
WEB_PORTAL_DB_USER=netherdeck
WEB_PORTAL_DB_PASSWORD=external-db-password
WEB_PORTAL_DB_NAME=netherdeck
```

The portal will connect to the external host. The built-in MySQL still runs for the game database unless you also configure `MYSQL_USER`/`MYSQL_PASSWORD` to point elsewhere.

### Docker Swarm

A Swarm-ready compose file is available at `container/docker-compose-swarm.yml`. Key differences:

- Uses `deploy.replicas` instead of `container_name`
- Overlay network for multi-node setups
- Named volumes with `driver: local` for persistence

```bash
docker stack deploy -c container/docker-compose-swarm.yml netherdeck
```

### Reverse Proxy (Traefik)

The agent includes a Traefik config at `agent/traefik/config/agent.yml`. For a typical setup:

```yaml
# traefik dynamic config
http:
  routers:
    netherdeck-portal:
      rule: "Host(`mc.example.com`)"
      service: netherdeck-portal
      tls:
        certResolver: letsencrypt
  services:
    netherdeck-portal:
      loadBalancer:
        servers:
          - url: "http://netherdeck:3000"
```

### Reverse Proxy (NGINX)

```nginx
server {
    listen 443 ssl;
    server_name mc.example.com;

    ssl_certificate     /etc/ssl/certs/mc.example.com.pem;
    ssl_certificate_key /etc/ssl/private/mc.example.com.key;

    # Web portal
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Agent relay (WebSocket support)
    location /agent/ {
        proxy_pass http://localhost:3500/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### TLS on the Agent

Instead of a reverse proxy, you can terminate TLS directly on the agent:

```ini
AGENT_ENABLE_TLS=true
AGENT_TLS_CERT=/path/to/cert.pem
AGENT_TLS_KEY=/path/to/key.pem
```

### Java Tuning

```ini
MC_MIN_MEMORY=4G    # -Xms
MC_MAX_MEMORY=8G    # -Xmx
```

The JVM flags include `-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200`.

### Backups

World data and MySQL databases are stored in Docker volumes. Back them up regularly:

```bash
# World data
docker run --rm -v mc_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/mc-backup-$(date +%Y%m%d).tar.gz -C /data .

# MySQL dump
docker compose exec paper mysqldump -u root --all-databases > backup.sql
```

### Monitoring

The container exposes a health check on port 25565:

```yaml
healthcheck:
  test: ["CMD", "nc", "-z", "localhost", "25565"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 120s
```

The agent has an unauthenticated `/health` endpoint:

```bash
curl http://localhost:3500/health
# {"status":"ok","timestamp":"...","uptime":1234.5}
```

## Multi-Loader Builds

The `docker-compose.yml` defines three services for different mod loaders:

| Service | Loader | Game Port | RCON Port | Agent Port | Portal Port |
|---------|--------|-----------|-----------|------------|-------------|
| `netherdeck-neoforge` | NeoForge | 25565 | 25575 | 3500 | 3000 |
| `netherdeck-forge` | Forge | 25566 | 25576 | 3501 | 3001 |
| `netherdeck-fabric` | Fabric | 25567 | 25577 | 3502 | 3002 |

To build a specific loader variant:

```bash
docker compose build netherdeck-neoforge    # NeoForge (default)
docker compose build netherdeck-forge       # Forge
docker compose build netherdeck-fabric      # Fabric
```

The loader is controlled by the `LOADER` build arg in the Dockerfile.

## NeoForge Pre-Install

The NeoForge variant runs `neoforge-preinstall.sh` during the Docker build. This script:

1. Downloads the NeoForge 21.1.216 installer from `neoforged.net`
2. Pre-fetches ~25 Maven library JARs (SnakeYAML, SQLite JDBC, MySQL Connector, SpecialSource, etc.)
3. Stores everything in the image so the container starts **without internet access**

This ensures reliable offline startup and avoids dependency on external Maven mirrors.

## ViaVersion

The Docker image bundles [ViaVersion](https://viaversion.com/) and ViaBackwards (v5.7.2) as Bukkit plugins. These are automatically copied to `/minecraft/plugins/` during the image build.

ViaVersion enables players using older Minecraft client versions to connect to the 1.21.1 server. No configuration is needed — it works out of the box.

The plugin JARs are located in `NetherDeck Server/libraries/via/`.

## World Map

The built-in world map (NetherDeck Map) is enabled by default in Docker via the `ENABLE_WORLD_MAP` environment variable.

```ini
ENABLE_WORLD_MAP=true     # default — enable world map
ENABLE_WORLD_MAP=false    # disable world map
```

The map configuration is seeded from `container/netherdeck.yml` at build time. The entrypoint script patches the `enabled` flag based on the `ENABLE_WORLD_MAP` env var.

See [../configuration/world-map.md](../configuration/world-map.md) for detailed configuration.

## Feature Toggles

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPOSE_SQL` | `false` | Bind MySQL to `0.0.0.0` for external database tools |
| `EXPOSE_SMB` | `false` | Bind Samba to all interfaces |
| `ENABLE_WORLD_MAP` | `true` | Enable/disable the built-in world map |

## Environment Variables

See [../configuration/environment-reference.md](../configuration/environment-reference.md) for the complete list.
