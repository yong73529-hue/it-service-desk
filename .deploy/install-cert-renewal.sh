#!/usr/bin/env bash
set -euo pipefail

sudo install -d -m 755 /opt/it-service-desk
sudo tee /opt/it-service-desk/renew-cert.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
docker run --rm \
  -v /opt/tianhe-yunxue/secrets/letsencrypt:/etc/letsencrypt \
  -v /opt/tianhe-yunxue/acme-challenges:/var/www/certbot \
  certbot/certbot:latest renew --webroot -w /var/www/certbot --quiet
docker exec tianhe-yunxue-edge-nginx-1 nginx -s reload
EOF
sudo chmod 750 /opt/it-service-desk/renew-cert.sh
sudo tee /etc/cron.d/itdesk-cert-renew >/dev/null <<'EOF'
17 3,15 * * * root /opt/it-service-desk/renew-cert.sh >>/var/log/itdesk-cert-renew.log 2>&1
EOF
sudo chmod 644 /etc/cron.d/itdesk-cert-renew
echo "CERT_RENEWAL_INSTALLED"
