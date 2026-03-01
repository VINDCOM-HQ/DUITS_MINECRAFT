#!/bin/bash
set -e

echo "[*] Samba repair script starting"

# Stop any running Samba processes
echo "[*] Stopping any existing Samba processes"
pkill -9 smbd || true
pkill -9 nmbd || true
sleep 2

# Create required directories with correct permissions
echo "[*] Creating and fixing permissions for Samba directories"
mkdir -p /var/run/samba /var/cache/samba /var/lib/samba/private /var/log/samba
chmod 755 /var/run/samba
chmod 755 /var/cache/samba /var/lib/samba /var/log/samba
chown -R root:root /var/run/samba /var/cache/samba /var/lib/samba /var/lib/samba/private

# Create missing directories
mkdir -p /var/lib/samba/winbindd_privileged
mkdir -p /var/lib/samba/lock
chmod 755 /var/lib/samba/winbindd_privileged
chmod 755 /var/lib/samba/lock

# Clean up any socket files
echo "[*] Cleaning up old socket files"
rm -f /var/run/samba/*.sock || true

# Check network configuration
echo "[*] Network configuration"
ip addr | grep -E 'inet|eth'

# Initialize or reset Samba databases
echo "[*] Initializing Samba databases"
rm -f /var/lib/samba/winbindd_idmap.tdb || true
touch /var/lib/samba/winbindd_idmap.tdb
chmod 600 /var/lib/samba/winbindd_idmap.tdb

# Initialize the TDB files
echo "[*] Creating TDB files"
for tdb in account notify_db session_db; do
  touch "/var/lib/samba/${tdb}.tdb"
  chmod 600 "/var/lib/samba/${tdb}.tdb"
done

# Use environment variables for SMB credentials
echo "[*] Setting up Samba users"
SMB_USER=${SMB_USER:-mcadmin}
SMB_PASSWORD=${SMB_PASSWORD:-$(openssl rand -base64 32)}

# Create the user if it doesn't exist
id -u "$SMB_USER" &>/dev/null || adduser --disabled-password --gecos "" "$SMB_USER"

# Set the password (printf avoids echo -e escape interpretation)
printf '%s\n%s\n' "${SMB_PASSWORD}" "${SMB_PASSWORD}" | smbpasswd -a -s "$SMB_USER"

# Generate smb.conf from template (idempotent - always regenerates from template)
echo "[*] Generating SMB configuration for user: $SMB_USER"
sed "s|%SMB_USER%|${SMB_USER}|g" /etc/samba/smb.conf.tmpl > /etc/samba/smb.conf

# Ensure correct permissions on /minecraft directory
echo "[*] Setting proper permissions on /minecraft directory"
chown -R minecraft:minecraft /minecraft
find /minecraft -type d -exec chmod 755 {} +
find /minecraft -type f -exec chmod 644 {} +

# Verify configuration
echo "[*] Verifying Samba configuration"
testparm -s

echo "[*] Samba repair completed"
