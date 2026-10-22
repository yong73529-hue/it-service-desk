#!/usr/bin/env bash
set -u
echo "USER=$(whoami)"
echo "HOST=$(hostname)"
. /etc/os-release
echo "OS=$PRETTY_NAME"
echo "NODE=$(node --version 2>/dev/null || echo missing)"
echo "NPM=$(npm --version 2>/dev/null || echo missing)"
echo "DISK=$(df -h / | tail -1)"
echo "NGINX=$(nginx -v 2>&1 || true)"
echo "PM2=$(pm2 --version 2>/dev/null || echo missing)"
echo "PORTS"
sudo ss -lntp 2>/dev/null || true
echo "OPT"
sudo find /opt -maxdepth 2 -mindepth 1 -type d 2>/dev/null | head -30
echo "NGINX_SITES"
sudo find /etc/nginx/sites-enabled -maxdepth 1 -type l -printf '%f -> %l\n' 2>/dev/null || true
