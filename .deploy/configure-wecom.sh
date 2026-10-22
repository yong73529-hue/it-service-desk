#!/usr/bin/env bash
set -euo pipefail

env_file=/opt/it-service-desk/.env.production
IFS= read -r corp_id
IFS= read -r agent_id
IFS= read -rs secret

if [ -z "$corp_id" ] || [ -z "$agent_id" ] || [ -z "$secret" ]; then
  echo "Missing WeCom configuration" >&2
  exit 1
fi

sudo cp "$env_file" "${env_file}.bak.$(date +%Y%m%d%H%M%S)"
export CONFIG_CORP_ID="$corp_id" CONFIG_AGENT_ID="$agent_id" CONFIG_SECRET="$secret"
sudo -E python3 - "$env_file" <<'PY'
from pathlib import Path
import os
import sys

path = Path(sys.argv[1])
updates = {
    "WECOM_CORP_ID": os.environ["CONFIG_CORP_ID"],
    "WECOM_AGENT_ID": os.environ["CONFIG_AGENT_ID"],
    "WECOM_SECRET": os.environ["CONFIG_SECRET"],
    "WECOM_CALLBACK_URL": "https://it.tianhejiaoyu.cn/api/wecom/callback",
    "WECOM_APP_URL": "https://it.tianhejiaoyu.cn",
    "DEV_MODE": "false",
    "NEXT_PUBLIC_DEV_MODE": "false",
}
lines = path.read_text(encoding="utf-8").splitlines()
seen = set()
result = []
for line in lines:
    key = line.split("=", 1)[0] if "=" in line else ""
    if key in updates:
        value = updates[key].replace("\\", "\\\\").replace('"', '\\"')
        result.append(f'{key}="{value}"')
        seen.add(key)
    else:
        result.append(line)
for key, raw_value in updates.items():
    if key not in seen:
        value = raw_value.replace("\\", "\\\\").replace('"', '\\"')
        result.append(f'{key}="{value}"')
path.write_text("\n".join(result) + "\n", encoding="utf-8")
PY
unset CONFIG_SECRET secret
sudo chmod 600 "$env_file"

cd /opt/it-service-desk
sudo docker compose -f docker-compose.server.yml up -d --force-recreate
for attempt in $(seq 1 20); do
  status=$(sudo docker inspect -f '{{.State.Health.Status}}' it-service-desk 2>/dev/null || true)
  [ "$status" = "healthy" ] && break
  sleep 2
done
echo "WECOM_CONFIGURED"
sudo docker inspect -f '{{.State.Health.Status}}' it-service-desk
