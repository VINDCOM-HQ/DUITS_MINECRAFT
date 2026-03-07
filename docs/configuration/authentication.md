# Authentication

The web portal supports three authentication methods: local accounts, OAuth/OIDC, and SAML 2.0. Multiple methods can be active simultaneously.

## Session Architecture

All authentication methods share the same session mechanism:

1. User authenticates via any method (local, OAuth, SAML).
2. A session ID is generated with `crypto.randomUUID()`.
3. The session ID is signed with HMAC-SHA256 using `WEB_PORTAL_SESSION_SECRET`.
4. The signed token (`uuid.hmac_hex`) is set as a `session` cookie.
5. On every request, `hooks.server.js` extracts the cookie, verifies the HMAC signature using `crypto.timingSafeEqual`, and loads the user from the `sessions` table.
6. Sessions expire after **24 hours**. Expired sessions are cleaned up on portal startup.

**Important**: if `WEB_PORTAL_SESSION_SECRET` is not set, a random secret is generated per process — meaning all sessions are invalidated on restart. Set a persistent value in production.

## Local Authentication

### Break-Glass Admin

On first startup, the portal seeds a local admin user from environment variables:

```ini
WEB_PORTAL_ADMIN_USER=admin
WEB_PORTAL_ADMIN_PASSWORD=strong-password-here
```

This user has `role: admin` and `auth_source: local`. The password is hashed with bcrypt (cost factor 12) before storage.

The admin user is only created if it doesn't already exist — changing the env var password after first run has no effect on existing accounts.

### How Local Login Works

1. User submits username + password to `POST /login`.
2. The portal queries `SELECT ... FROM users WHERE username = ? AND auth_source = 'local'`.
3. The stored bcrypt hash is compared with `bcrypt.compare()`.
4. On success, a session is created and the session cookie is set.

## OAuth / OIDC

Generic OpenID Connect support — works with any provider that supports the standard discovery endpoint (Google, Keycloak, Auth0, Okta, Azure AD, etc.).

### Environment Variables

```ini
WEB_PORTAL_OAUTH_ENABLED=true
WEB_PORTAL_OAUTH_ISSUER_URL=https://accounts.google.com
WEB_PORTAL_OAUTH_CLIENT_ID=your-client-id
WEB_PORTAL_OAUTH_CLIENT_SECRET=your-client-secret
WEB_PORTAL_OAUTH_SCOPES=openid profile email
WEB_PORTAL_OAUTH_CALLBACK_URL=https://mc.example.com/auth/oauth/callback
```

### Flow

1. User clicks "Sign in with OAuth" on the login page.
2. Portal redirects to the provider's authorization endpoint with a CSRF `state` parameter.
3. User authenticates with the provider.
4. Provider redirects back to `WEB_PORTAL_OAUTH_CALLBACK_URL` with an authorization code.
5. Portal exchanges the code for tokens at the provider's token endpoint.
6. Portal fetches user info from the provider's userinfo endpoint.
7. `findOrCreateExternalUser('oauth', sub, displayName)` provisions or finds the user in the `users` table.
8. A session is created.

### Google Example

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an OAuth 2.0 Client ID (Web application).
3. Add `https://mc.example.com/auth/oauth/callback` as an authorized redirect URI.
4. Set the environment variables:

```ini
WEB_PORTAL_OAUTH_ENABLED=true
WEB_PORTAL_OAUTH_ISSUER_URL=https://accounts.google.com
WEB_PORTAL_OAUTH_CLIENT_ID=123456789.apps.googleusercontent.com
WEB_PORTAL_OAUTH_CLIENT_SECRET=GOCSPX-xxxxx
WEB_PORTAL_OAUTH_CALLBACK_URL=https://mc.example.com/auth/oauth/callback
```

### Keycloak Example

```ini
WEB_PORTAL_OAUTH_ENABLED=true
WEB_PORTAL_OAUTH_ISSUER_URL=https://keycloak.example.com/realms/minecraft
WEB_PORTAL_OAUTH_CLIENT_ID=netherdeck
WEB_PORTAL_OAUTH_CLIENT_SECRET=your-keycloak-secret
WEB_PORTAL_OAUTH_CALLBACK_URL=https://mc.example.com/auth/oauth/callback
```

## SAML 2.0

Enterprise SSO via SAML 2.0 — works with any IdP that exposes a metadata endpoint (Okta, Azure AD, ADFS, OneLogin, etc.).

### Environment Variables

```ini
WEB_PORTAL_SAML_ENABLED=true
WEB_PORTAL_SAML_IDP_METADATA_URL=https://idp.example.com/metadata
WEB_PORTAL_SAML_ENTITY_ID=https://mc.example.com
WEB_PORTAL_SAML_CALLBACK_URL=https://mc.example.com/auth/saml/callback
```

### Flow

1. User clicks "Sign in with SAML" on the login page.
2. Portal generates an AuthnRequest and redirects to the IdP's SSO URL (HTTP-Redirect binding).
3. User authenticates with the IdP.
4. IdP posts a signed SAML assertion to `WEB_PORTAL_SAML_CALLBACK_URL` (HTTP-POST binding).
5. Portal validates the assertion (requires both assertion and response to be signed).
6. `findOrCreateExternalUser('saml', nameId, displayName)` provisions or finds the user.
7. A session is created.

### Azure AD Example

1. In the Azure Portal, go to Enterprise Applications > New Application > Create your own.
2. Set up SAML SSO:
   - Entity ID: `https://mc.example.com`
   - Reply URL: `https://mc.example.com/auth/saml/callback`
3. Copy the App Federation Metadata URL.

```ini
WEB_PORTAL_SAML_ENABLED=true
WEB_PORTAL_SAML_IDP_METADATA_URL=https://login.microsoftonline.com/{tenant}/federationmetadata/2007-06/federationmetadata.xml
WEB_PORTAL_SAML_ENTITY_ID=https://mc.example.com
WEB_PORTAL_SAML_CALLBACK_URL=https://mc.example.com/auth/saml/callback
```

### Okta Example

1. In the Okta Admin Console, create a new SAML 2.0 application.
2. Set:
   - Single sign-on URL: `https://mc.example.com/auth/saml/callback`
   - Audience URI: `https://mc.example.com`
3. Copy the IdP Metadata URL from the Sign On tab.

```ini
WEB_PORTAL_SAML_ENABLED=true
WEB_PORTAL_SAML_IDP_METADATA_URL=https://your-org.okta.com/app/exk123/sso/saml/metadata
WEB_PORTAL_SAML_ENTITY_ID=https://mc.example.com
WEB_PORTAL_SAML_CALLBACK_URL=https://mc.example.com/auth/saml/callback
```

## Rate Limiting

The portal implements per-IP rate limiting on login attempts (OWASP-compliant):

- **Threshold**: 5 failed attempts per IP address within a 15-minute window.
- **Lockout**: Once locked, the login form shows a countdown timer. The lockout expires when the oldest failed attempt falls outside the 15-minute window.
- **Recording**: Every failed attempt is logged to the `login_attempts` table with the username, IP, user agent, and failure reason (`invalid_credentials` or `account_locked`).
- **IP extraction**: Uses `X-Forwarded-For` header (first), then `X-Real-IP`, then falls back to `127.0.0.1`. Configure your reverse proxy to set these headers for accurate IP tracking.
- **Graceful degradation**: If the `login_attempts` table hasn't been created yet (migration v2 not applied), rate limiting is silently skipped.
- **Warning hint**: The login form only shows "X attempts remaining" when the user has 2 or fewer attempts left.

Rate limit checks run **before** credential validation, so locked-out IPs never hit the bcrypt comparison.

## CSRF Protection

SvelteKit's built-in CSRF origin check is disabled (`trustedOrigins: ['*']` in `svelte.config.js`). This is intentional because the portal runs at variable hostnames/IPs in Docker, WSL, and LAN environments where a static trusted origin list is impractical.

CSRF protection is provided instead by session cookies with these attributes:
- `SameSite: strict` — cookies are never sent on cross-site requests
- `HttpOnly: true` — cookies are inaccessible to JavaScript
- `Secure: true` — cookies only sent over HTTPS (configurable via `WEB_PORTAL_SECURE_COOKIES`)

This combination makes cross-site request forgery impossible because the browser will not include the session cookie in any request originating from a different site.

Set `WEB_PORTAL_SECURE_COOKIES=false` if running over HTTP (development or behind a TLS-terminating proxy that forwards HTTP internally).

## Login Audit

Admins can view failed login attempts via the portal API:

```
GET /api/auth/login-attempts
```

This endpoint requires an authenticated user with `role: admin`.

### Summary mode (default)

```
GET /api/auth/login-attempts?mode=summary
```

Returns:
- `total24h` — total failed attempts in the last 24 hours
- `uniqueIps24h` — number of unique source IPs
- `uniqueUsernames24h` — number of unique usernames attempted
- `recentAttempts` — last 5 failed attempts with details

### Full mode

```
GET /api/auth/login-attempts?mode=full&limit=50&offset=0
```

Returns a paginated list of all failed login attempts with `total` count for pagination.

## User Roles

| Role | Source | Permissions |
|------|--------|-------------|
| `admin` | Break-glass env var only | Full access (including login audit) |
| `user` | OAuth/SAML provisioning, manual creation | Standard access |

External users (OAuth/SAML) are always created with `role: 'user'`. To grant admin access, update the user's role directly in the database:

```sql
UPDATE users SET role = 'admin' WHERE username = 'someone@example.com';
```
