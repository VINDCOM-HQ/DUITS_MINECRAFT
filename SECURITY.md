# Security Policy

## Supported Versions

| Component | Version | Supported |
|-----------|---------|-----------|
| Container (Docker) | 1.x | Yes |
| Web Portal | 1.x | Yes |
| Agent Relay | 1.x | Yes |
| Desktop App | 2.x | Yes |

## Reporting a Vulnerability

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Email the maintainer with a detailed description, reproduction steps, and any proof-of-concept code.
3. You will receive an acknowledgement within **48 hours**.
4. A fix or mitigation will be provided within **14 days** for critical issues, **30 days** for others.
5. We follow coordinated disclosure — please allow time for a patch before any public announcement.

## Security Architecture

### Agent Relay

- All API endpoints require an API key via `X-API-Key` header, query parameter, or request body.
- API keys are compared using `crypto.timingSafeEqual` to prevent timing attacks.
- Socket.IO connections are authenticated via the same API key mechanism (query, auth object, or header).
- TLS is supported natively — set `AGENT_ENABLE_TLS=true` with certificate and key paths.
- Each client connection receives a UUID; connection state is isolated per client.

### Web Portal

- **Sessions**: HMAC-SHA256 signed cookies with a 24-hour TTL. Session IDs are `crypto.randomUUID()`, signed with a secret (`WEB_PORTAL_SESSION_SECRET`). Signature verification uses `crypto.timingSafeEqual`.
- **Password storage**: bcrypt with cost factor 12.
- **Database queries**: All SQL uses parameterized queries via `mysql2` — no string interpolation.
- **Auth flow**: `hooks.server.js` intercepts every request, verifies the session cookie, and redirects unauthenticated users to `/login`. API routes return `401`.
- **OAuth/OIDC**: Standard authorization code flow with CSRF state parameter (`crypto.randomBytes(32)`). Discovery document is fetched from the issuer and cached for 1 hour.
- **SAML 2.0**: Assertions are validated with `wantAssertionsSigned: true` and `wantAuthnResponseSigned: true` via `@node-saml/node-saml`.
- **External users**: OAuth/SAML users are provisioned as `role: 'user'` — only the break-glass admin has `role: 'admin'` by default.

### Container

- The Minecraft server runs as a dedicated `minecraft` user, not root.
- The agent relay runs as a dedicated `agent` user with its `.env` file set to `chmod 600`.
- MySQL credentials and portal DB passwords are auto-generated with `openssl rand` if not provided.
- Input validation in `entrypoint.sh`: identifiers are alphanumeric-only, memory values are validated, IP addresses are validated, SQL values are escaped.
- MySQL binds to `127.0.0.1` by default — external access must be explicitly enabled.

### Desktop App

- Configuration is encrypted and stored locally using machine-specific or password-based encryption.
- The agent API key is stored in the encrypted config and transmitted over TLS when configured.

## CI Security Scans

Three automated scans run on every push to `develop`/`main` and on a weekly schedule:

| Tool | Purpose | Report Branch |
|------|---------|---------------|
| **Trivy** | Container vulnerability scanning (CRITICAL, HIGH, MEDIUM) | `reports/trivy` |
| **Semgrep** | Static analysis / SAST for code vulnerabilities | `reports/semgrep` |
| **TruffleHog** | Secret detection across git history | `reports/trufflehog` |

Reports are pushed to orphan branches and can be viewed in the GitHub repository.

## Hardening Checklist

- [ ] Change all default passwords (`MYSQL_PASSWORD`, `SMB_PASSWORD`, `MC_RCON_PASSWORD`, `WEB_PORTAL_ADMIN_PASSWORD`)
- [ ] Set a persistent `AGENT_API_KEY` (auto-generated keys change on restart)
- [ ] Set a persistent `WEB_PORTAL_SESSION_SECRET` (auto-generated secrets invalidate sessions on restart)
- [ ] Enable TLS on the agent relay (`AGENT_ENABLE_TLS=true`) or place it behind a reverse proxy
- [ ] Restrict MySQL to localhost (`MC_MYSQL_BIND=127.0.0.1` — the default)
- [ ] Use firewall rules to limit access to ports 25575 (RCON), 3306 (MySQL), 445 (SMB)
- [ ] Set `MC_ONLINE_MODE=true` to enforce Mojang authentication
- [ ] Enable whitelist (`MC_WHITE_LIST=true`, `MC_ENFORCE_WHITELIST=true`)
- [ ] Review Trivy, Semgrep, and TruffleHog reports regularly
- [ ] Keep the Docker image and all dependencies up to date
