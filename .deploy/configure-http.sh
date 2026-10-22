#!/usr/bin/env bash
set -euo pipefail
APP_DIR=/opt/it-service-desk
EDGE_CONF=/opt/tianhe-yunxue/app/nginx/edge-live.conf
STAMP=$(date +%Y%m%d-%H%M%S)

cd "$APP_DIR"
docker compose -f docker-compose.server.yml up -d

if ! sudo grep -q 'IT Service Desk - managed block' "$EDGE_CONF"; then
  sudo cp "$EDGE_CONF" "${EDGE_CONF}.backup-itdesk-${STAMP}"
  sudo tee -a "$EDGE_CONF" >/dev/null < /tmp/itdesk-deploy/itdesk-http.conf
fi

sudo docker exec tianhe-yunxue-edge-nginx-1 nginx -t
sudo docker exec tianhe-yunxue-edge-nginx-1 nginx -s reload
docker compose -f docker-compose.server.yml ps
