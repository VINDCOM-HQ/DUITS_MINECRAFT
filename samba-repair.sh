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
chmod 755 /var/run/samba  # Fix the warning about 755 permissions
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
chmod 644 /var/lib/samba/winbindd_idmap.tdb

# Initialize the TDB files
echo "[*] Creating TDB files"
for tdb in account notify_db session_db; do
  touch /var/lib/samba/${tdb}.tdb
  chmod 644 /var/lib/samba/${tdb}.tdb
done

# Use environment variables for SMB credentials
echo "[*] Setting up Samba users"
SMB_USER=${SMB_USER:-mcadmin}
SMB_PASSWORD=${SMB_PASSWORD:-$(openssl rand -base64 8)}

# Create the user if it doesn't exist
id -u "$SMB_USER" &>/dev/null || adduser --disabled-password --gecos "" "$SMB_USER"

# Set the password
echo -e "${SMB_PASSWORD}\n${SMB_PASSWORD}" | smbpasswd -a -s "$SMB_USER"

# DO NOT save credentials to file - they're already in environment variables
# Credentials are accessible via environment variables SMB_USER and SMB_PASSWORD

# Update smb.conf with correct user
echo "[*] Updating SMB configuration with user: $SMB_USER"
sed -i "s/%SMB_USER%/$SMB_USER/g" /etc/samba/smb.conf

# Ensure correct permissions on /minecraft directory
echo "[*] Setting proper permissions on /minecraft directory"
chown -R "$SMB_USER":"$SMB_USER" /minecraft
chmod -R 777 /minecraft

# Verify configuration
echo "[*] Verifying Samba configuration"
testparm -s

echo "[*] Samba repair completed"