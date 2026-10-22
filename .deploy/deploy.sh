#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/it-service-desk
ARCHIVE=/tmp/it-service-desk-release.tar.gz

sudo mkdir -p "$APP_DIR" "$APP_DIR/data" "$APP_DIR/uploads"
sudo chown -R ubuntu:ubuntu "$APP_DIR"
tar -xzf "$ARCHIVE" -C "$APP_DIR"
cd "$APP_DIR"

if [ ! -f .env.production ]; then
  AUTH_SECRET=$(openssl rand -hex 32)
  cat > .env.production <<EOF
DATABASE_URL="file:/data/itdesk.db"
AUTH_SECRET="$AUTH_SECRET"
DEV_MODE="true"
NEXT_PUBLIC_DEV_MODE="true"
WECOM_CORP_ID=""
WECOM_AGENT_ID=""
WECOM_SECRET=""
WECOM_CALLBACK_URL=""
MAX_UPLOAD_MB="5"
EOF
  chmod 600 .env.production
fi

docker compose -f docker-compose.server.yml build
if [ ! -s data/itdesk.db ]; then
  docker compose -f docker-compose.server.yml run --rm itdesk npx prisma db push
  docker compose -f docker-compose.server.yml run --rm itdesk npm run db:seed
else
  docker compose -f docker-compose.server.yml run --rm itdesk npx prisma db push
fi
docker compose -f docker-compose.server.yml up -d
docker compose -f docker-compose.server.yml ps
rm -f "$ARCHIVE"
