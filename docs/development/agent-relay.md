# Agent Relay Development

The agent relay is an Express + Socket.IO server that acts as an authenticated proxy between clients (desktop app, external tools) and Minecraft server services.

## Architecture

```
Client (Desktop / HTTP)
  │
  ├─ REST: POST /api/rcon/connect  ──► apiKeyAuth middleware ──► RconService
  │        POST /api/rcon/command
  │        ...
  │
  └─ WebSocket: socket.io           ──► socketAuth middleware ──► handleRequest()
       event: "request"                                            │
       data: { action, type, ... }                                 ├─► RconService
                                                                   ├─► QueryService
                                                                   ├─► MySqlService
                                                                   └─► SmbService
```

## REST API Reference

All REST endpoints are under `/api/` and require an API key. Unauthenticated endpoints are listed separately.

### Authentication

Include the API key in one of:

| Method | Location |
|--------|----------|
| Header | `X-API-Key: your-key` |
| Query param | `?apiKey=your-key` |
| Body field | `{ "apiKey": "your-key" }` |

### Unauthenticated Endpoints

| Method | Path | Response |
|--------|------|----------|
| GET | `/` | `{ name, version, status }` |
| GET | `/health` | `{ status, timestamp, uptime }` |

### API Info

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/` | `{ name, status }` |
| GET | `/api/status` | `{ success, status }` |
| GET | `/api/health` | `{ success, status, timestamp, uptime }` |

### RCON

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/rcon/connect` | `{ host, port, password }` | `{ success, clientId }` |
| POST | `/api/rcon/command` | `{ clientId, command }` | `{ success, response }` |
| POST | `/api/rcon/disconnect` | `{ clientId }` | `{ success }` |
| POST | `/api/rcon/reconnect` | `{ clientId }` | `{ success }` |
| GET | `/api/rcon/params` | `?clientId=` | `{ success, host, port }` |

### MySQL

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/mysql/connect` | `{ host, port?, user, password?, database, ssl? }` | `{ success, clientId }` |
| POST | `/api/mysql/query` | `{ clientId, sql, params? }` | `{ success, result }` |
| POST | `/api/mysql/disconnect` | `{ clientId }` | `{ success }` |
| POST | `/api/mysql/reconnect` | `{ clientId }` | `{ success }` |
| GET | `/api/mysql/params` | `?clientId=` | `{ success, host, port, user, database }` |

Note: the `/params` endpoint strips the password from the response.

### Query

| Method | Path | Params | Response |
|--------|------|--------|----------|
| GET | `/api/query/` | `?host=&port=&mode=basic\|full&bypassCache=true\|false` | `{ success, info }` |

### SMB

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/smb/connect` | `{ host, share, username, password, domain? }` | `{ success, clientId }` |
| POST | `/api/smb/disconnect` | `{ clientId }` | `{ success }` |
| POST | `/api/smb/readdir` | `{ clientId, path }` | `{ success, files }` |
| POST | `/api/smb/stat` | `{ clientId, path }` | `{ success, stats }` |
| POST | `/api/smb/readFile` | `{ clientId, path, encoding? }` | `{ success, content, isBase64 }` |
| POST | `/api/smb/writeFile` | `{ clientId, path, content, encoding?, isBase64? }` | `{ success }` |
| POST | `/api/smb/unlink` | `{ clientId, path }` | `{ success }` |

## WebSocket Protocol

The agent uses Socket.IO (not raw WebSocket). Connect with the `socket.io-client` library.

### Connection

```js
import { io } from 'socket.io-client';

const socket = io('http://agent:3500', {
  auth: { apiKey: 'your-key' },
  transports: ['websocket', 'polling']
});
```

Authentication is handled during the handshake. The API key can be provided via:
- `auth.apiKey` (recommended)
- `query.apiKey`
- `headers['x-api-key']`

### Events

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `welcome` | `{ message, socketId, time }` | Sent on successful connection |
| `response` | `{ id?, success, ... }` | Response when no callback provided |

#### Client → Server

| Event | Payload | Callback |
|-------|---------|----------|
| `request` | `{ action, type?, id?, ... }` | `(response) => {}` |

The `request` event is the primary communication channel. The `action` field determines the operation, and `type` provides sub-routing. If a callback function is provided, the response is sent via callback; otherwise it's emitted as a `response` event.

### Socket.IO Options

| Option | Value |
|--------|-------|
| `pingTimeout` | 30000 ms |
| `pingInterval` | 10000 ms |
| `connectTimeout` | 45000 ms |
| `maxHttpBufferSize` | 5 MB |
| `transports` | `['websocket', 'polling']` |

## Client Isolation

Each connection (REST or WebSocket) tracks state via a `clientId` (UUID v4):

- RCON connections are stored per `clientId` — disconnect one without affecting others.
- MySQL connection pools are scoped per `clientId`.
- SMB sessions are scoped per `clientId`.
- Query results are cached globally (shared across clients).

## Error Handling

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

HTTP status codes:
- `400` — missing or invalid parameters
- `401` — invalid or missing API key
- `500` — internal server error

## Service Installation

### Windows

```bash
cd agent
npm run service:install      # registers a Windows service
npm run service:uninstall    # removes the service
```

Uses `node-windows` (optional dependency).

### Linux

See the systemd unit file in [manual-setup.md](../deployment/manual-setup.md#linux-systemd).

## Running Tests

```bash
cd agent
npm test                    # Jest test suite
```

## Configuration

See the [Agent Relay](../configuration/environment-reference.md#agent-relay) section of the environment reference.
