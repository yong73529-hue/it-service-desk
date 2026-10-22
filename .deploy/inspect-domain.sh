#!/usr/bin/env bash
set -u
echo "DNS"
getent ahostsv4 it.tianhejiaoyu.cn || true
echo "CERTBOT"
command -v certbot || true
echo "CERTS"
sudo find /opt/tianhe-yunxue/secrets/letsencrypt/live -maxdepth 2 -type l -printf '%p -> %l\n' 2>/dev/null || true
echo "RENEWAL"
sudo find /opt/tianhe-yunxue/secrets/letsencrypt/renewal -maxdepth 1 -type f -printf '%f\n' 2>/dev/null || true
echo "COMPOSE_NETWORKS"
sudo sed -n '/^networks:/,$p' /opt/tianhe-yunxue/app/docker-compose.yml 2>/dev/null || true
