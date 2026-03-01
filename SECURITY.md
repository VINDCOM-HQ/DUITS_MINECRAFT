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

- Regular updates to security-critical Python packages:
  - cryptography (version 43.0.1+)
  - idna (version 3.7+)
  - protobuf (version 6.30.2+)

- Containerized services to isolate the Minecraft server from the host system

## Security Best Practices

When using this Docker image:

1. **Change default passwords**: Always modify the default MySQL and Samba passwords
2. **Use a firewall**: Limit access to only the required ports
3. **Regular updates**: Keep the image updated to receive security patches
4. **Backups**: Implement regular backups of your Minecraft world and database
5. **Access control**: Restrict access to the Samba share to trusted users only

## Known Issues

- The container runs services as root for simplicity. For production environments with specific security requirements, consider adjusting the service user settings.
- The Samba share permissions are set to 777 (full permissions). Consider customizing permissions for your specific security needs.

## Security Updates

Security updates will be released as new versions of the Docker image. Check the GitHub repository regularly for updates.