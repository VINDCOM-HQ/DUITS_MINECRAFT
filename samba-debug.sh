#!/bin/bash
set -e

echo "========== SAMBA DEBUG SCRIPT =========="
echo "Checking Samba directories..."
mkdir -p /var/run/samba /var/cache/samba /var/lib/samba/private /var/log/samba
ls -la /var/run/samba /var/cache/samba /var/lib/samba/private /var/log/samba

echo "Setting proper permissions..."
chmod -R 1777 /var/run/samba
chown -R root:root /var/run/samba /var/cache/samba /var/lib/samba/private

echo "Checking Samba configuration..."
testparm -s

echo "Checking network interfaces..."
ip addr

echo "Checking Samba status..."
smbd -b

echo "Initializing tdb files..."
mkdir -p /var/lib/samba/private
touch /var/lib/samba/private/secrets.tdb

echo "Validating smb.conf..."
testparm -v

echo "========== END DEBUG SCRIPT =========="