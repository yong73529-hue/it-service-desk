#!/usr/bin/env bash
set -u
echo "FILES"
sudo ls -la /opt/it-service-desk/data /opt/it-service-desk/uploads 2>&1 || true
echo "ENV_NON_SECRET"
sudo grep -E '^(DATABASE_URL|DEV_MODE|NEXT_PUBLIC_DEV_MODE|WECOM_CALLBACK_URL)=' /opt/it-service-desk/.env.production 2>/dev/null || true
echo "IMAGE_OPENSSL"
sudo docker run --rm it-service-desk:latest sh -lc 'openssl version; id; ls -ld /app /data 2>/dev/null || true'
echo "MOUNT_TEST"
sudo docker run --rm -v /opt/it-service-desk/data:/data it-service-desk:latest sh -lc 'id; ls -ld /data; touch /data/write-test && ls -l /data/write-test'
