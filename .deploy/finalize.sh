#!/usr/bin/env bash
set -euo pipefail
cd /opt/it-service-desk
docker compose -f docker-compose.server.yml run --rm itdesk npm run db:seed
docker compose -f docker-compose.server.yml up -d
for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3200/login >/dev/null; then
    break
  fi
  sleep 2
done
curl -fsSI http://127.0.0.1:3200/login | head -5
docker compose -f docker-compose.server.yml ps
docker compose -f docker-compose.server.yml logs --tail=30 itdesk
