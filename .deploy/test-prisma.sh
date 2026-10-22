#!/usr/bin/env bash
set -u
echo "INTERNAL"
sudo docker run --rm -e DATABASE_URL=file:/app/test.db it-service-desk:latest npx prisma db push 2>&1 || true
echo "MOUNTED"
sudo docker run --rm -v /opt/it-service-desk/data:/data -e DATABASE_URL=file:/data/itdesk.db it-service-desk:latest npx prisma db push 2>&1 || true
echo "ENGINE"
sudo docker run --rm it-service-desk:latest sh -lc 'find node_modules -name "schema-engine*" -type f -maxdepth 5 -exec {} --version \;' 2>&1 || true
