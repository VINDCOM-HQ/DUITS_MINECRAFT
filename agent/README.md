# DUITS Minecraft RMM Agent Relay

A secure HTTP/S relay agent for the DUITS Minecraft RMM Tool. This agent allows you to expose Minecraft servers to the internet through a single port, with proper authentication and TLS encryption.

## Features

- Single port HTTP/S relay for all DUITS Minecraft RMM Tool features
- Secure API key authentication
- TLS/SSL support (both native and via reverse proxy)
- WebSocket support for real-time communication
- Client-per-connection isolation
- Multi-platform service installation (Windows, Linux, macOS)
- Docker container support with easy configuration

## Installation Options

### Docker (Recommended)

The easiest way to deploy the agent is with Docker:

1. Clone the repository or download the agent directory
2. Create a `.env` file in the agent directory:

```env
AGENT_PORT=3500
AGENT_API_KEY=your-secure-api-key
AGENT_ENABLE_TLS=false
AGENT_ALLOW_CORS=true
AGENT_WEBSOCKETS=true
```

3. Run with Docker Compose:

```bash
cd agent
docker-compose up -d
```

### Native Installation

To install as a system service:

1. Clone the repository or download the agent directory
2. Install dependencies:

```bash
cd agent
npm install
```

3. Set up configuration:

   ```bash
   # Interactive setup (recommended)
   npm run setup
   ```
   
   This will guide you through creating a configuration and generating a secure API key.

4. Install as a service:

```bash
# Windows: Run as Administrator
npm run service:install

# Linux/macOS: Run as root
sudo npm run service:install
```

The service installer will automatically detect and use your `.env` file configuration.

## Configuration Options

Configuration can be done through a `.env` file, environment variables, or a config.json file (in order of precedence):

### Using .env file (Recommended)

The easiest way to configure the agent is by using a `.env` file:

#### Option 1: Interactive setup (recommended)

```bash
# Run the interactive setup script
npm run setup
```

This will guide you through all the configuration options, including generating a secure random API key.

#### Option 2: Manual setup

```bash
# Create a .env file from the example
npm run init

# Then edit the file with your preferred editor
nano .env
# or
vi .env
# or on Windows
notepad .env
```

### Configuration Parameters

| Option | Environment Variable | Description | Default |
|--------|---------------------|-------------|---------|
| Port | `AGENT_PORT` | Port to listen on | 3500 |
| API Key | `AGENT_API_KEY` | Authentication key | (required) |
| TLS Enabled | `AGENT_ENABLE_TLS` | Enable built-in TLS | false |
| TLS Certificate | `AGENT_TLS_CERT` | Path to TLS certificate | |
| TLS Key | `AGENT_TLS_KEY` | Path to TLS private key | |
| TLS Passphrase | `AGENT_TLS_PASSPHRASE` | Key passphrase if encrypted | |
| Log Format | `AGENT_LOG_FORMAT` | Morgan format (combined, dev, etc.) | combined |
| CORS | `AGENT_ALLOW_CORS` | Allow Cross-Origin requests | true |
| WebSockets | `AGENT_WEBSOCKETS` | Enable WS protocol | true |

## Using TLS/HTTPS

### Built-in TLS

For built-in TLS:

1. Generate certificates:
```bash
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out cert.pem
```

2. Configure the agent to use them:
```json
{
  "tls": {
    "enabled": true,
    "cert": "/path/to/cert.pem",
    "key": "/path/to/key.pem"
  }
}
```

### Reverse Proxy TLS (Recommended)

For production, it's recommended to use a reverse proxy like Traefik or Nginx:

1. Uncomment the Traefik service in `docker-compose.yml`
2. Edit `traefik/config/agent.yml` to match your domain
3. Traefik will automatically handle TLS certificates

Example NGINX configuration:

```nginx
server {
    listen 443 ssl;
    server_name agent.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3500;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## API Reference

The agent exposes the following endpoints:

- **GET /health** - Health check and status
- **GET /info** - Agent information
- **RCON**: 
  - **POST /rcon/connect** - Connect to a Minecraft server
  - **POST /rcon/command** - Send RCON command
  - **POST /rcon/disconnect** - Close RCON connection
- **Query**: 
  - **GET /query** - Query server status
- **SMB**: 
  - **POST /smb/connect** - Connect to file share
  - **POST /smb/disconnect** - Close file share connection
  - **GET /smb/readdir** - List directory contents
  - **GET /smb/stat** - Get file information
  - **GET /smb/readFile** - Read file contents
  - **POST /smb/writeFile** - Write file contents
  - **POST /smb/unlink** - Delete file
- **MySQL**: 
  - **POST /mysql/connect** - Connect to database
  - **POST /mysql/disconnect** - Close database connection
  - **POST /mysql/query** - Execute SQL query

All endpoints require an API key in the `x-api-key` header or as a Bearer token in the `Authorization` header.

## WebSocket Support

The agent also provides WebSocket endpoints that match the HTTP API. This enables better real-time communication and lower overhead for repeated operations.

## Desktop Client Configuration

In the DUITS Minecraft RMM desktop application:

1. Go to Settings
2. Enable "Use Remote Agent"
3. Enter the Agent URL (e.g., `https://agent.example.com` or `http://localhost:3500`)
4. Enter your API Key
5. Enable "Use SSL" if using HTTPS
6. Optionally provide a custom CA file path if using self-signed certificates