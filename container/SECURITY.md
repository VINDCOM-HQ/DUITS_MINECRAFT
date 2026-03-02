# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please follow these steps:

1. **Do not disclose the vulnerability publicly** or create a public GitHub issue
2. Email the maintainer directly with details of the vulnerability
3. Include steps to reproduce the issue and any proof-of-concept code if possible
4. Allow time for the vulnerability to be addressed before any public disclosure

## Security Features

This Docker image includes several security measures:

- **Non-root Minecraft process**: The game server runs as an unprivileged `minecraft` user
- **MySQL isolation**: MySQL runs as the `mysql` user and binds to localhost by default
- **SMB3 enforcement**: Samba requires SMB3 minimum protocol with encryption support
- **Restrictive permissions**: File permissions use 755/644 (directories/files)
- **Input validation**: Environment variable inputs are validated before use in SQL and config generation
- **Template-based config**: Configuration files are generated from templates on each startup (idempotent)
- **Docker healthcheck**: Built-in health monitoring on the game port

## Security Best Practices

When using this Docker image:

1. **Change default passwords**: Always modify the default MySQL and Samba passwords
2. **Use a firewall**: Limit access to only the required ports (especially MySQL 3306, RCON 25575, and Samba 445)
3. **Regular updates**: Keep the image updated to receive security patches
4. **Backups**: Implement regular backups of your Minecraft world and database
5. **Access control**: Restrict access to the Samba share to trusted users only
6. **RCON security**: If enabling RCON, use a strong password and restrict port access

## Known Issues

- MySQL, Samba, and Cron services run as root within the container (required for service management). The Minecraft server process runs as the unprivileged `minecraft` user.
- Samba and MySQL run in the same container as the game server. For maximum isolation, consider separating them into individual containers.

## Security Updates

Security updates will be released as new versions of the Docker image. Check the GitHub repository regularly for updates.
