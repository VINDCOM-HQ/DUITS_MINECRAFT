# Minecraft Server Docker Image

A production-ready Docker image for running a Minecraft Paper server with built-in Samba file sharing and MySQL database support.

## Features

- **Paper Minecraft Server**: Paper 1.21.11 server for optimal performance
- **Samba File Sharing**: Built-in SMB3 server for easy world file access
- **MySQL Database**: Integrated MySQL server for plugins requiring database support
- **Supervisor Management**: Uses supervisord to manage all services
- **Log Rotation**: Automatic log rotation to prevent disk space issues
- **Docker Swarm Ready**: Optimized configuration for both standalone and swarm deployments
- **Healthcheck**: Built-in Docker healthcheck on the game port
- **Non-root Minecraft**: Game server runs as an unprivileged `minecraft` user

## Quick Start

```bash
docker-compose up -d
```

Access your Minecraft server at port 25565 and connect to the Samba share at `\\your-server-ip\minecraft`.

## Environment Variables

### Infrastructure

| Variable | Description | Default |
|----------|-------------|---------|
| MYSQL_USER | MySQL username | mcuser |
| MYSQL_PASSWORD | MySQL password | *random if not set* |
| DATABASE_NAME | MySQL database name | minecraft |
| SMB_USER | Samba username | mcadmin |
| SMB_PASSWORD | Samba password | *random if not set* |
| TZ | Timezone | UTC |

### Java / Performance

| Variable | Description | Default |
|----------|-------------|---------|
| MC_MIN_MEMORY | Java minimum heap (-Xms) | 2G |
| MC_MAX_MEMORY | Java maximum heap (-Xmx) | 6G |
| MC_MYSQL_BIND | MySQL bind address | 127.0.0.1 |

Set `MC_MYSQL_BIND=0.0.0.0` if you need external MySQL access via port 3306.

### Minecraft Server Properties

All `MC_*` variables are optional and map to `server.properties`. See `.env.example` for the full list.

## Ports

- **25565**: Minecraft server (TCP + UDP query)
- **25575**: RCON port (optional)
- **3306**: MySQL (internal by default, see MC_MYSQL_BIND)
- **445/139**: SMB/CIFS
- **137/138**: NetBIOS (UDP)

## Volumes

- **/minecraft**: Game server files
- **/var/lib/mysql**: MySQL database
- **/var/log/samba**: Samba logs
- **/var/log/supervisor**: Supervisor logs

## Security Notes

- The Minecraft server process runs as the unprivileged `minecraft` user
- MySQL runs as the `mysql` user and binds to localhost by default
- Samba enforces SMB3 minimum protocol with encryption support
- File permissions use 755/644 (not world-writable)
- Always change default passwords in production environments
- Consider using Docker secrets for credentials in Swarm mode
- Use firewall rules to restrict access to non-game ports (MySQL, Samba, RCON)

## Swarm Deployment

A `docker-compose-swarm.yml` file is included for Docker Swarm deployments.

## License

See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
