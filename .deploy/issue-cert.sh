#!/usr/bin/env bash
set -euo pipefail

sudo docker run --rm \
  -v /opt/tianhe-yunxue/secrets/letsencrypt:/etc/letsencrypt \
  -v /opt/tianhe-yunxue/acme-challenges:/var/www/certbot \
  certbot/certbot:latest certonly \
  --webroot -w /var/www/certbot \
  -d it.tianhejiaoyu.cn \
  --non-interactive --agree-tos --register-unsafely-without-email

sudo test -s /opt/tianhe-yunxue/secrets/letsencrypt/live/it.tianhejiaoyu.cn/fullchain.pem
echo "CERTIFICATE_READY"
