#!/usr/bin/env bash
set -euo pipefail

env_file=/opt/it-service-desk/.env.production
sudo cp "$env_file" "${env_file}.bak.$(date +%Y%m%d%H%M%S)"
sudo python3 - "$env_file" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
values = {"DEV_MODE": "false", "NEXT_PUBLIC_DEV_MODE": "false"}
lines = path.read_text(encoding="utf-8").splitlines()
found = set()
result = []
for line in lines:
    key = line.split("=", 1)[0] if "=" in line else ""
    if key in values:
        result.append(f'{key}="{values[key]}"')
        found.add(key)
    else:
        result.append(line)
for key, value in values.items():
    if key not in found:
        result.append(f'{key}="{value}"')
path.write_text("\n".join(result) + "\n", encoding="utf-8")
PY

cd /opt/it-service-desk
sudo docker compose -f docker-compose.server.yml up -d --force-recreate
for attempt in $(seq 1 20); do
  status=$(sudo docker inspect -f '{{.State.Health.Status}}' it-service-desk 2>/dev/null || true)
  [ "$status" = "healthy" ] && break
  sleep 2
done
sudo grep -E '^(DEV_MODE|NEXT_PUBLIC_DEV_MODE)=' "$env_file"
sudo docker inspect -f '{{.State.Health.Status}}' it-service-desk
