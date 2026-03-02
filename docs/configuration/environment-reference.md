# Environment Variable Reference

Complete list of all environment variables across NetherDeck components.

## Container — Infrastructure

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MYSQL_USER` | MySQL game database username | `mcuser` | Yes |
| `MYSQL_PASSWORD` | MySQL game database password | Auto-generated | Yes |
| `DATABASE_NAME` | MySQL game database name | `minecraft` | No |
| `SMB_USER` | Samba file share username | `mcadmin` | Yes |
| `SMB_PASSWORD` | Samba file share password | — | Yes |
| `TZ` | Container timezone | `UTC` | No |
| `MC_MYSQL_BIND` | MySQL bind address | `127.0.0.1` | No |

## Container — Java

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MC_MIN_MEMORY` | JVM minimum heap (`-Xms`) | `2G` | No |
| `MC_MAX_MEMORY` | JVM maximum heap (`-Xmx`) | `6G` | No |

## Container — EULA

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MC_EULA` | Accept Minecraft EULA (`true`/`false`) | — | Yes (for Paper to start) |

## Container — Server Basics

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_MOTD` | Server message of the day | `A Minecraft Server` |
| `MC_SERVER_PORT` | Game port | `25565` |
| `MC_SERVER_IP` | Bind IP address | (all interfaces) |
| `MC_MAX_PLAYERS` | Maximum player count | `20` |
| `MC_LEVEL_NAME` | World folder name | `world` |
| `MC_LEVEL_SEED` | World seed | (random) |
| `MC_LEVEL_TYPE` | World type | `minecraft:normal` |
| `MC_GENERATOR_SETTINGS` | Custom generator JSON | `{}` |

## Container — Gameplay

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_GAMEMODE` | Default game mode | `survival` |
| `MC_FORCE_GAMEMODE` | Force default on join | `false` |
| `MC_DIFFICULTY` | Server difficulty | `easy` |
| `MC_HARDCORE` | Hardcore mode | `false` |
| `MC_PVP` | Player vs player | `true` |
| `MC_ALLOW_FLIGHT` | Allow flying | `false` |
| `MC_ALLOW_NETHER` | Enable the Nether | `true` |

## Container — Spawn

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_SPAWN_PROTECTION` | Spawn protection radius | `16` |
| `MC_SPAWN_NPCS` | Spawn villagers | `true` |
| `MC_SPAWN_ANIMALS` | Spawn animals | `true` |
| `MC_SPAWN_MONSTERS` | Spawn hostile mobs | `true` |

## Container — World

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_VIEW_DISTANCE` | View distance (chunks) | `10` |
| `MC_SIMULATION_DISTANCE` | Simulation distance (chunks) | `10` |
| `MC_MAX_WORLD_SIZE` | Maximum world radius | `29999984` |
| `MC_MAX_BUILD_HEIGHT` | Maximum build height | `256` |
| `MC_GENERATE_STRUCTURES` | Generate structures | `true` |

## Container — Security & Access

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_ONLINE_MODE` | Mojang authentication | `true` |
| `MC_WHITE_LIST` | Enable whitelist | `false` |
| `MC_ENFORCE_WHITELIST` | Kick non-whitelisted on reload | `false` |
| `MC_ENFORCE_SECURE_PROFILE` | Require signed chat | `true` |
| `MC_ENABLE_COMMAND_BLOCK` | Enable command blocks | `false` |
| `MC_OP_PERMISSION_LEVEL` | Default op permission level | `4` |
| `MC_FUNCTION_PERMISSION_LEVEL` | Function permission level | `2` |

## Container — RCON

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_ENABLE_RCON` | Enable RCON protocol | `false` |
| `MC_RCON_PORT` | RCON port | `25575` |
| `MC_RCON_PASSWORD` | RCON password | — |
| `MC_BROADCAST_RCON_TO_OPS` | Show RCON commands to ops | `true` |

## Container — Query

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_ENABLE_QUERY` | Enable query protocol | `false` |
| `MC_QUERY_PORT` | Query port | `25565` |

## Container — Performance

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_MAX_TICK_TIME` | Max ms per tick before watchdog | `60000` |
| `MC_NETWORK_COMPRESSION_THRESHOLD` | Packet compression threshold | `256` |
| `MC_RATE_LIMIT` | Packet rate limit (0 = off) | `0` |
| `MC_PLAYER_IDLE_TIMEOUT` | Kick idle players after N min | `0` |
| `MC_ENTITY_BROADCAST_RANGE` | Entity broadcast range % | `100` |
| `MC_MAX_CHAINED_NEIGHBOR_UPDATES` | Block update chain limit | `1000000` |

## Container — Server Behaviour

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_PREVENT_PROXY_CONNECTIONS` | Block proxy/VPN connections | `false` |
| `MC_USE_NATIVE_TRANSPORT` | Use epoll on Linux | `true` |
| `MC_SYNC_CHUNK_WRITES` | Synchronous chunk writes | `true` |
| `MC_ENABLE_JMX_MONITORING` | JMX monitoring | `false` |
| `MC_BROADCAST_CONSOLE_TO_OPS` | Show console to ops | `true` |
| `MC_ENABLE_STATUS` | Enable server list ping | `true` |
| `MC_HIDE_ONLINE_PLAYERS` | Hide player count | `false` |
| `MC_PAUSE_WHEN_EMPTY_SECONDS` | Pause when empty (-1 = off) | `-1` |

## Container — Resource Pack

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_RESOURCE_PACK` | Resource pack URL | — |
| `MC_RESOURCE_PACK_SHA1` | Resource pack SHA-1 hash | — |
| `MC_RESOURCE_PACK_ID` | Resource pack UUID | — |
| `MC_REQUIRE_RESOURCE_PACK` | Force resource pack | `false` |
| `MC_RESOURCE_PACK_PROMPT` | Custom prompt message | — |

## Container — Data Packs

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_INITIAL_ENABLED_PACKS` | Enabled data packs | `vanilla` |
| `MC_INITIAL_DISABLED_PACKS` | Disabled data packs | — |

## Container — Advanced

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_ACCEPTS_TRANSFERS` | Accept server transfers | `false` |
| `MC_LOG_IPS` | Log player IPs | `true` |
| `MC_DEBUG` | Debug mode | `false` |
| `MC_BUG_REPORT_LINK` | Custom bug report URL | — |
| `MC_REGION_FILE_COMPRESSION` | Region file compression | `deflate` |
| `MC_TEXT_FILTERING_CONFIG` | Text filtering config | — |
| `MC_TEXT_FILTERING_VERSION` | Text filtering version | `0` |

## Agent Relay

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AGENT_API_KEY` | API key for authentication | — | Yes |
| `AGENT_PORT` | HTTP(S) listen port | `3500` | No |
| `AGENT_ENABLE_TLS` | Enable HTTPS | `false` | No |
| `AGENT_TLS_CERT` | Path to TLS certificate | — | If TLS enabled |
| `AGENT_TLS_KEY` | Path to TLS private key | — | If TLS enabled |
| `AGENT_TLS_PASSPHRASE` | TLS key passphrase | — | No |
| `AGENT_LOG_FORMAT` | Morgan log format | `combined` | No |
| `AGENT_ALLOW_CORS` | Enable CORS for all origins | `true` | No |

## Agent Relay — Container Integration

These variables control the agent when running inside the Docker container:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ENABLE_AGENT` | Start agent in container | `false` | No |
| `AGENT_PORT` | Agent listen port | `3500` | No |
| `AGENT_API_KEY` | Agent API key (auto-generated if empty) | — | No |

## Web Portal — Core

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ENABLE_WEB_PORTAL` | Start portal in container | `false` | No |
| `WEB_PORTAL_PORT` / `PORT` | HTTP listen port | `3000` | No |
| `WEB_PORTAL_SESSION_SECRET` | HMAC-SHA256 signing key | Auto-generated | Recommended |

## Web Portal — Database

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WEB_PORTAL_DB_HOST` | MySQL host | `localhost` | No |
| `WEB_PORTAL_DB_PORT` | MySQL port | `3306` | No |
| `WEB_PORTAL_DB_USER` | MySQL user | `netherdeck` | No |
| `WEB_PORTAL_DB_PASSWORD` | MySQL password | Auto-generated | Yes (manual setup) |
| `WEB_PORTAL_DB_NAME` | Portal database name | `netherdeck` | No |

## Web Portal — Admin

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WEB_PORTAL_ADMIN_USER` | Break-glass admin username | `admin` | No |
| `WEB_PORTAL_ADMIN_PASSWORD` | Break-glass admin password | — | Yes (first login) |

## Web Portal — RCON

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WEB_PORTAL_RCON_HOST` | Minecraft RCON host | `localhost` | No |
| `WEB_PORTAL_RCON_PORT` | Minecraft RCON port | `25575` | No |
| `WEB_PORTAL_RCON_PASSWORD` | RCON password | `MC_RCON_PASSWORD` | Yes |

## Web Portal — Game Database

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WEB_PORTAL_GAME_DB_NAME` | Game database name | `MYSQL_DATABASE` value | No |

## Web Portal — Files

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WEB_PORTAL_MC_DIR` | Minecraft server directory | `/minecraft` | No |

## Web Portal — Query

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WEB_PORTAL_QUERY_PORT` | Minecraft query port | `25565` | No |

## Web Portal — OAuth / OIDC

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WEB_PORTAL_OAUTH_ENABLED` | Enable OAuth/OIDC | `false` | No |
| `WEB_PORTAL_OAUTH_ISSUER_URL` | OIDC issuer URL | — | If OAuth enabled |
| `WEB_PORTAL_OAUTH_CLIENT_ID` | OAuth client ID | — | If OAuth enabled |
| `WEB_PORTAL_OAUTH_CLIENT_SECRET` | OAuth client secret | — | If OAuth enabled |
| `WEB_PORTAL_OAUTH_SCOPES` | Requested scopes | `openid profile email` | No |
| `WEB_PORTAL_OAUTH_CALLBACK_URL` | OAuth redirect URI | — | If OAuth enabled |

## Web Portal — SAML 2.0

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WEB_PORTAL_SAML_ENABLED` | Enable SAML 2.0 | `false` | No |
| `WEB_PORTAL_SAML_IDP_METADATA_URL` | IdP metadata URL | — | If SAML enabled |
| `WEB_PORTAL_SAML_ENTITY_ID` | SP entity ID | — | If SAML enabled |
| `WEB_PORTAL_SAML_CALLBACK_URL` | SAML assertion consumer URL | — | If SAML enabled |

See [authentication.md](authentication.md) for setup examples.
