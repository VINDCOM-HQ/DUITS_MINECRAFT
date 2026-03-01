#!/bin/bash
set -e

# 2) MySQL Setup
echo "[init] Setting up MySQL..."

# Get environment variables for MySQL credentials
MYSQL_USER=${MYSQL_USER:-mcuser}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-$(openssl rand -base64 12)}
MYSQL_DATABASE=${MYSQL_DATABASE:-minecraft}

# First run - initialize the database
if [ ! -d /var/lib/mysql/mysql ]; then
  echo "[init] First run - Initializing MySQL data directory..."
  # Initialize MySQL data directory
  mysqld --initialize-insecure --user=root --datadir=/var/lib/mysql
  
  # Start MySQL temporarily
  echo "[init] Starting temporary MySQL server..."
  mysqld --user=root --datadir=/var/lib/mysql --skip-networking=0 &
  mysql_pid=$!
  
  # Wait for MySQL to become available
  echo "[init] Waiting for MySQL to start..."
  max_tries=30
  tries=0
  while ! mysqladmin ping --silent && [ $tries -lt $max_tries ]; do
    tries=$((tries + 1))
    echo "[init] Waiting for MySQL to start (attempt $tries/$max_tries)..."
    sleep 1
  done
  
  if [ $tries -eq $max_tries ]; then
    echo "[init] Failed to start MySQL after $max_tries attempts"
    exit 1
  fi
  
  # Create database and user
  echo "[init] Creating database and user..."
  mysql -u root <<-EOSQL
    CREATE DATABASE IF NOT EXISTS $MYSQL_DATABASE;
    CREATE USER IF NOT EXISTS '$MYSQL_USER'@'%' IDENTIFIED BY '$MYSQL_PASSWORD';
    GRANT ALL PRIVILEGES ON $MYSQL_DATABASE.* TO '$MYSQL_USER'@'%';
    FLUSH PRIVILEGES;
EOSQL
  
  # Shutdown MySQL
  echo "[init] Shutting down temporary MySQL server..."
  mysqladmin -u root shutdown
  
else
  # Database already exists - handle upgrade scenario
  echo "[init] MySQL data directory already exists"
  
  # Start MySQL temporarily to update user if password changed
  echo "[init] Starting temporary MySQL server to update credentials..."
  mysqld --user=root --datadir=/var/lib/mysql --skip-networking=0 &
  mysql_pid=$!
  
  # Wait for MySQL to become available
  echo "[init] Waiting for MySQL to start..."
  max_tries=30
  tries=0
  while ! mysqladmin ping --silent && [ $tries -lt $max_tries ]; do
    tries=$((tries + 1))
    echo "[init] Waiting for MySQL to start (attempt $tries/$max_tries)..."
    sleep 1
  done
  
  if [ $tries -eq $max_tries ]; then
    echo "[init] Failed to start MySQL after $max_tries attempts"
    exit 1
  fi
  
  # Update user credentials (will work even if they didn't change)
  echo "[init] Updating user credentials..."
  mysql -u root <<-EOSQL
    CREATE DATABASE IF NOT EXISTS $MYSQL_DATABASE;
    CREATE USER IF NOT EXISTS '$MYSQL_USER'@'%' IDENTIFIED BY '$MYSQL_PASSWORD';
    ALTER USER '$MYSQL_USER'@'%' IDENTIFIED BY '$MYSQL_PASSWORD';
    GRANT ALL PRIVILEGES ON $MYSQL_DATABASE.* TO '$MYSQL_USER'@'%';
    FLUSH PRIVILEGES;
EOSQL
  
  # DO NOT save credentials to file - they're already in environment variables
  # Credentials are accessible via environment variables MYSQL_USER and MYSQL_PASSWORD
  
  # Shutdown MySQL
  echo "[init] Shutting down temporary MySQL server..."
  mysqladmin -u root shutdown
fi

echo "[init] MySQL setup complete"

# 3) Ensure world folder exists and set up Samba directories properly
mkdir -p /minecraft /var/run/samba /var/cache/samba /var/lib/samba/private
# Change ownership of minecraft directory to match the SMB user
SMB_USER=${SMB_USER:-mcadmin}
id -u "$SMB_USER" &>/dev/null || adduser --disabled-password --gecos "" "$SMB_USER"
chown -R "$SMB_USER":"$SMB_USER" /minecraft
chmod -R 777 /minecraft
chmod -R 1777 /var/run/samba

# 3.5) Run Samba repair script
if [ -f /samba-repair.sh ]; then
  echo "[init] Running Samba repair..."
  bash /samba-repair.sh
fi

# 3.6) Set up log rotation
if [ -f /etc/logrotate.d/minecraft ]; then
  echo "[init] Setting up log rotation..."
  # Create cron job to run logrotate hourly
  echo "0 * * * * /usr/sbin/logrotate /etc/logrotate.d/minecraft" > /etc/cron.d/minecraft-logrotate
  chmod 644 /etc/cron.d/minecraft-logrotate
  # Start cron service in supervisord
fi

# Sleep to ensure network is ready in Swarm mode
sleep 5
echo "[init] Network should be ready now"

# 4) Hand off to Supervisor (which launches MySQL, Samba daemons, PaperMC)
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf

