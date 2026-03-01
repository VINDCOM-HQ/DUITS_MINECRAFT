#!/bin/bash
set -euo pipefail

# --- Logging helper ---
log() { echo "[$(date '+%H:%M:%S')] [init] $*"; }

# --- Input validation ---
validate_identifier() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[a-zA-Z0-9_]+$ ]]; then
    log "ERROR: $name contains invalid characters. Only alphanumeric and underscore allowed."
    exit 1
  fi
}

validate_memory() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[0-9]+[KMGkmg]$ ]]; then
    log "ERROR: $name must be a number followed by K, M, or G (e.g., 2G, 512M)"
    exit 1
  fi
}

validate_ip() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    log "ERROR: $name must be a valid IPv4 address (e.g., 127.0.0.1)"
    exit 1
  fi
}

# Escape single quotes for safe SQL interpolation
sql_escape() {
  printf '%s' "${1//\'/\'\'}"
}

# --- Safe property writer (avoids sed injection) ---
set_property() {
  local key="$1"
  local value="$2"
  local tmpfile

  if [ -f "$SERVER_PROPERTIES" ]; then
    tmpfile=$(mktemp)
    grep -v "^${key}=" "$SERVER_PROPERTIES" > "$tmpfile" || true
    mv "$tmpfile" "$SERVER_PROPERTIES"
  fi
  printf '%s=%s\n' "$key" "$value" >> "$SERVER_PROPERTIES"
}

# 1) Environment variables
MYSQL_USER=${MYSQL_USER:-mcuser}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-$(openssl rand -base64 32)}
MYSQL_DATABASE=${MYSQL_DATABASE:-minecraft}
MYSQL_BIND=${MC_MYSQL_BIND:-127.0.0.1}
SMB_USER=${SMB_USER:-mcadmin}

# Validate all inputs
validate_identifier "MYSQL_USER" "$MYSQL_USER"
validate_identifier "MYSQL_DATABASE" "$MYSQL_DATABASE"
validate_identifier "SMB_USER" "$SMB_USER"
validate_ip "MC_MYSQL_BIND" "$MYSQL_BIND"

# Agent relay configuration
ENABLE_AGENT=${ENABLE_AGENT:-false}
AGENT_PORT=${AGENT_PORT:-3500}
AGENT_API_KEY=${AGENT_API_KEY:-}
AGENT_AUTOSTART=false

if [ "$ENABLE_AGENT" = "true" ]; then
  AGENT_AUTOSTART=true
  log "Agent relay enabled on port ${AGENT_PORT}"

  # Auto-generate API key if not provided
  if [ -z "$AGENT_API_KEY" ]; then
    AGENT_API_KEY=$(openssl rand -hex 32)
    log "WARNING: No AGENT_API_KEY set. A random key was generated for this session."
    log "Set AGENT_API_KEY in your .env to persist a key across restarts."
    log "Retrieve the current key from /opt/agent/.env if needed."
  fi
else
  log "Agent relay disabled (set ENABLE_AGENT=true to enable)"
fi

# Escape password for SQL
MYSQL_PASSWORD_SQL=$(sql_escape "$MYSQL_PASSWORD")

# 2) MySQL Setup
log "Setting up MySQL..."

# Ensure MySQL data directory ownership
mkdir -p /var/lib/mysql /var/run/mysqld
chown -R mysql:mysql /var/lib/mysql /var/run/mysqld

# First run - initialize the database
if [ ! -d /var/lib/mysql/mysql ]; then
  log "First run - Initializing MySQL data directory..."
  mysqld --initialize-insecure --user=mysql --datadir=/var/lib/mysql

  # Start MySQL temporarily (socket-only for init)
  log "Starting temporary MySQL server..."
  mysqld --user=mysql --datadir=/var/lib/mysql &
  mysql_pid=$!

  # Wait for MySQL to become available
  log "Waiting for MySQL to start..."
  max_tries=30
  tries=0
  while ! mysqladmin ping --silent && [ $tries -lt $max_tries ]; do
    tries=$((tries + 1))
    log "Waiting for MySQL to start (attempt $tries/$max_tries)..."
    sleep 1
  done

  if [ $tries -eq $max_tries ]; then
    log "ERROR: Failed to start MySQL after $max_tries attempts"
    exit 1
  fi

  # Create database and user
  log "Creating database and user..."
  mysql -u root <<-EOSQL
    CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\`;
    CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'%' IDENTIFIED BY '${MYSQL_PASSWORD_SQL}';
    GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'%';
    FLUSH PRIVILEGES;
EOSQL

  # Shutdown MySQL and wait for clean exit
  log "Shutting down temporary MySQL server..."
  mysqladmin -u root shutdown
  wait "$mysql_pid" 2>/dev/null || true

else
  # Database already exists - handle upgrade scenario
  log "MySQL data directory already exists"

  # Start MySQL temporarily to update credentials
  log "Starting temporary MySQL server to update credentials..."
  mysqld --user=mysql --datadir=/var/lib/mysql &
  mysql_pid=$!

  # Wait for MySQL to become available
  log "Waiting for MySQL to start..."
  max_tries=30
  tries=0
  while ! mysqladmin ping --silent && [ $tries -lt $max_tries ]; do
    tries=$((tries + 1))
    log "Waiting for MySQL to start (attempt $tries/$max_tries)..."
    sleep 1
  done

  if [ $tries -eq $max_tries ]; then
    log "ERROR: Failed to start MySQL after $max_tries attempts"
    exit 1
  fi

  # Update user credentials
  log "Updating user credentials..."
  mysql -u root <<-EOSQL
    CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\`;
    CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'%' IDENTIFIED BY '${MYSQL_PASSWORD_SQL}';
    ALTER USER '${MYSQL_USER}'@'%' IDENTIFIED BY '${MYSQL_PASSWORD_SQL}';
    GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'%';
    FLUSH PRIVILEGES;
EOSQL

  # Shutdown MySQL and wait for clean exit
  log "Shutting down temporary MySQL server..."
  mysqladmin -u root shutdown
  wait "$mysql_pid" 2>/dev/null || true
fi

log "MySQL setup complete"

# 3) Create minecraft user if it doesn't exist (already in Dockerfile, but guard for safety)
if ! id -u minecraft &>/dev/null; then
  log "Creating minecraft user..."
  useradd -r -m -d /minecraft -s /bin/false minecraft
fi

# 4) Ensure directories exist with correct permissions
mkdir -p /minecraft /var/run/samba /var/cache/samba /var/lib/samba/private
id -u "$SMB_USER" &>/dev/null || adduser --disabled-password --gecos "" "$SMB_USER"
chown -R minecraft:minecraft /minecraft
find /minecraft -type d -exec chmod 755 {} +
find /minecraft -type f -exec chmod 644 {} +
chmod 755 /var/run/samba

# 5) Generate/Update server.properties from environment variables
log "Configuring server.properties..."

SERVER_PROPERTIES="/minecraft/server.properties"

# Server basics
[ -n "${MC_MOTD:-}" ] && set_property "motd" "$MC_MOTD"
[ -n "${MC_SERVER_PORT:-}" ] && set_property "server-port" "$MC_SERVER_PORT"
[ -n "${MC_MAX_PLAYERS:-}" ] && set_property "max-players" "$MC_MAX_PLAYERS"
[ -n "${MC_LEVEL_NAME:-}" ] && set_property "level-name" "$MC_LEVEL_NAME"
[ -n "${MC_LEVEL_SEED:-}" ] && set_property "level-seed" "$MC_LEVEL_SEED"
[ -n "${MC_LEVEL_TYPE:-}" ] && set_property "level-type" "$MC_LEVEL_TYPE"
[ -n "${MC_GENERATOR_SETTINGS:-}" ] && set_property "generator-settings" "$MC_GENERATOR_SETTINGS"

# Gameplay settings
[ -n "${MC_GAMEMODE:-}" ] && set_property "gamemode" "$MC_GAMEMODE"
[ -n "${MC_FORCE_GAMEMODE:-}" ] && set_property "force-gamemode" "$MC_FORCE_GAMEMODE"
[ -n "${MC_DIFFICULTY:-}" ] && set_property "difficulty" "$MC_DIFFICULTY"
[ -n "${MC_HARDCORE:-}" ] && set_property "hardcore" "$MC_HARDCORE"
[ -n "${MC_PVP:-}" ] && set_property "pvp" "$MC_PVP"
[ -n "${MC_ALLOW_FLIGHT:-}" ] && set_property "allow-flight" "$MC_ALLOW_FLIGHT"
[ -n "${MC_ALLOW_NETHER:-}" ] && set_property "allow-nether" "$MC_ALLOW_NETHER"

# Spawn settings
[ -n "${MC_SPAWN_PROTECTION:-}" ] && set_property "spawn-protection" "$MC_SPAWN_PROTECTION"
[ -n "${MC_SPAWN_NPCS:-}" ] && set_property "spawn-npcs" "$MC_SPAWN_NPCS"
[ -n "${MC_SPAWN_ANIMALS:-}" ] && set_property "spawn-animals" "$MC_SPAWN_ANIMALS"
[ -n "${MC_SPAWN_MONSTERS:-}" ] && set_property "spawn-monsters" "$MC_SPAWN_MONSTERS"

# World settings
[ -n "${MC_VIEW_DISTANCE:-}" ] && set_property "view-distance" "$MC_VIEW_DISTANCE"
[ -n "${MC_SIMULATION_DISTANCE:-}" ] && set_property "simulation-distance" "$MC_SIMULATION_DISTANCE"
[ -n "${MC_MAX_WORLD_SIZE:-}" ] && set_property "max-world-size" "$MC_MAX_WORLD_SIZE"
[ -n "${MC_MAX_BUILD_HEIGHT:-}" ] && set_property "max-build-height" "$MC_MAX_BUILD_HEIGHT"
[ -n "${MC_GENERATE_STRUCTURES:-}" ] && set_property "generate-structures" "$MC_GENERATE_STRUCTURES"

# Security and access
[ -n "${MC_ONLINE_MODE:-}" ] && set_property "online-mode" "$MC_ONLINE_MODE"
[ -n "${MC_WHITE_LIST:-}" ] && set_property "white-list" "$MC_WHITE_LIST"
[ -n "${MC_ENFORCE_WHITELIST:-}" ] && set_property "enforce-whitelist" "$MC_ENFORCE_WHITELIST"
[ -n "${MC_ENABLE_COMMAND_BLOCK:-}" ] && set_property "enable-command-block" "$MC_ENABLE_COMMAND_BLOCK"
[ -n "${MC_OP_PERMISSION_LEVEL:-}" ] && set_property "op-permission-level" "$MC_OP_PERMISSION_LEVEL"

# RCON configuration
[ -n "${MC_ENABLE_RCON:-}" ] && set_property "enable-rcon" "$MC_ENABLE_RCON"
[ -n "${MC_RCON_PORT:-}" ] && set_property "rcon.port" "$MC_RCON_PORT"
[ -n "${MC_RCON_PASSWORD:-}" ] && set_property "rcon.password" "$MC_RCON_PASSWORD"

# Query configuration
[ -n "${MC_ENABLE_QUERY:-}" ] && set_property "enable-query" "$MC_ENABLE_QUERY"
[ -n "${MC_QUERY_PORT:-}" ] && set_property "query.port" "$MC_QUERY_PORT"

# Performance settings
[ -n "${MC_MAX_TICK_TIME:-}" ] && set_property "max-tick-time" "$MC_MAX_TICK_TIME"
[ -n "${MC_NETWORK_COMPRESSION_THRESHOLD:-}" ] && set_property "network-compression-threshold" "$MC_NETWORK_COMPRESSION_THRESHOLD"
[ -n "${MC_RATE_LIMIT:-}" ] && set_property "rate-limit" "$MC_RATE_LIMIT"
[ -n "${MC_PLAYER_IDLE_TIMEOUT:-}" ] && set_property "player-idle-timeout" "$MC_PLAYER_IDLE_TIMEOUT"
[ -n "${MC_ENTITY_BROADCAST_RANGE:-}" ] && set_property "entity-broadcast-range-percentage" "$MC_ENTITY_BROADCAST_RANGE"

# Server behavior
[ -n "${MC_PREVENT_PROXY_CONNECTIONS:-}" ] && set_property "prevent-proxy-connections" "$MC_PREVENT_PROXY_CONNECTIONS"
[ -n "${MC_USE_NATIVE_TRANSPORT:-}" ] && set_property "use-native-transport" "$MC_USE_NATIVE_TRANSPORT"
[ -n "${MC_SYNC_CHUNK_WRITES:-}" ] && set_property "sync-chunk-writes" "$MC_SYNC_CHUNK_WRITES"
[ -n "${MC_ENABLE_JMX_MONITORING:-}" ] && set_property "enable-jmx-monitoring" "$MC_ENABLE_JMX_MONITORING"
[ -n "${MC_BROADCAST_CONSOLE_TO_OPS:-}" ] && set_property "broadcast-console-to-ops" "$MC_BROADCAST_CONSOLE_TO_OPS"
[ -n "${MC_BROADCAST_RCON_TO_OPS:-}" ] && set_property "broadcast-rcon-to-ops" "$MC_BROADCAST_RCON_TO_OPS"

# Resource pack
[ -n "${MC_RESOURCE_PACK:-}" ] && set_property "resource-pack" "$MC_RESOURCE_PACK"
[ -n "${MC_RESOURCE_PACK_SHA1:-}" ] && set_property "resource-pack-sha1" "$MC_RESOURCE_PACK_SHA1"
[ -n "${MC_REQUIRE_RESOURCE_PACK:-}" ] && set_property "require-resource-pack" "$MC_REQUIRE_RESOURCE_PACK"
[ -n "${MC_RESOURCE_PACK_PROMPT:-}" ] && set_property "resource-pack-prompt" "$MC_RESOURCE_PACK_PROMPT"

# Server icon and status
[ -n "${MC_SERVER_IP:-}" ] && set_property "server-ip" "$MC_SERVER_IP"
[ -n "${MC_ENABLE_STATUS:-}" ] && set_property "enable-status" "$MC_ENABLE_STATUS"
[ -n "${MC_HIDE_ONLINE_PLAYERS:-}" ] && set_property "hide-online-players" "$MC_HIDE_ONLINE_PLAYERS"

# Advanced/Additional settings
[ -n "${MC_ACCEPTS_TRANSFERS:-}" ] && set_property "accepts-transfers" "$MC_ACCEPTS_TRANSFERS"
[ -n "${MC_BUG_REPORT_LINK:-}" ] && set_property "bug-report-link" "$MC_BUG_REPORT_LINK"
[ -n "${MC_DEBUG:-}" ] && set_property "debug" "$MC_DEBUG"
[ -n "${MC_ENFORCE_SECURE_PROFILE:-}" ] && set_property "enforce-secure-profile" "$MC_ENFORCE_SECURE_PROFILE"
[ -n "${MC_FUNCTION_PERMISSION_LEVEL:-}" ] && set_property "function-permission-level" "$MC_FUNCTION_PERMISSION_LEVEL"
[ -n "${MC_INITIAL_DISABLED_PACKS:-}" ] && set_property "initial-disabled-packs" "$MC_INITIAL_DISABLED_PACKS"
[ -n "${MC_INITIAL_ENABLED_PACKS:-}" ] && set_property "initial-enabled-packs" "$MC_INITIAL_ENABLED_PACKS"
[ -n "${MC_LOG_IPS:-}" ] && set_property "log-ips" "$MC_LOG_IPS"
[ -n "${MC_MAX_CHAINED_NEIGHBOR_UPDATES:-}" ] && set_property "max-chained-neighbor-updates" "$MC_MAX_CHAINED_NEIGHBOR_UPDATES"
[ -n "${MC_PAUSE_WHEN_EMPTY_SECONDS:-}" ] && set_property "pause-when-empty-seconds" "$MC_PAUSE_WHEN_EMPTY_SECONDS"
[ -n "${MC_REGION_FILE_COMPRESSION:-}" ] && set_property "region-file-compression" "$MC_REGION_FILE_COMPRESSION"
[ -n "${MC_RESOURCE_PACK_ID:-}" ] && set_property "resource-pack-id" "$MC_RESOURCE_PACK_ID"
[ -n "${MC_TEXT_FILTERING_CONFIG:-}" ] && set_property "text-filtering-config" "$MC_TEXT_FILTERING_CONFIG"
[ -n "${MC_TEXT_FILTERING_VERSION:-}" ] && set_property "text-filtering-version" "$MC_TEXT_FILTERING_VERSION"

# Accept EULA automatically if env var is set
if [ "${MC_EULA:-}" = "true" ] || [ "${EULA:-}" = "true" ]; then
  echo "eula=true" > /minecraft/eula.txt
  log "EULA accepted via environment variable"
fi

# Set proper ownership for server files
chown -R minecraft:minecraft /minecraft

log "server.properties configuration complete"

# 6) Run Samba repair script
if [ -f /samba-repair.sh ]; then
  log "Running Samba repair..."
  bash /samba-repair.sh
fi

# 7) Set up log rotation
if [ -f /etc/logrotate.d/minecraft ]; then
  log "Setting up log rotation..."
  echo "0 * * * * /usr/sbin/logrotate /etc/logrotate.d/minecraft" > /etc/cron.d/minecraft-logrotate
  chmod 644 /etc/cron.d/minecraft-logrotate
fi

# 8) Write agent configuration file
if [ "$ENABLE_AGENT" = "true" ]; then
  install -m 600 -o agent -g agent /dev/null /opt/agent/.env
  cat > /opt/agent/.env <<-AGENT_EOF
AGENT_PORT=${AGENT_PORT}
AGENT_API_KEY=${AGENT_API_KEY}
AGENT_HOST=0.0.0.0
NODE_ENV=production
AGENT_EOF
  chmod 600 /opt/agent/.env
  chown agent:agent /opt/agent/.env
  log "Agent .env written to /opt/agent/.env"
fi

# 9) Generate supervisord config with memory settings
MC_MIN_MEMORY=${MC_MIN_MEMORY:-2G}
MC_MAX_MEMORY=${MC_MAX_MEMORY:-6G}

validate_memory "MC_MIN_MEMORY" "$MC_MIN_MEMORY"
validate_memory "MC_MAX_MEMORY" "$MC_MAX_MEMORY"

log "Configuring Java heap: min=${MC_MIN_MEMORY} max=${MC_MAX_MEMORY}"
log "MySQL bind address: ${MYSQL_BIND}"

# Generate supervisord config from template with env var substitution
sed -e "s|{{MC_MIN_MEMORY}}|${MC_MIN_MEMORY}|g" \
    -e "s|{{MC_MAX_MEMORY}}|${MC_MAX_MEMORY}|g" \
    -e "s|{{MYSQL_BIND}}|${MYSQL_BIND}|g" \
    -e "s|{{AGENT_AUTOSTART}}|${AGENT_AUTOSTART}|g" \
    /etc/supervisor/supervisord.conf.tmpl > /etc/supervisor/supervisord.conf

log "Startup complete, handing off to supervisord"

# 10) Hand off to Supervisor (which launches MySQL, Samba daemons, PaperMC, agent relay)
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
