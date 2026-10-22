#!/usr/bin/env bash
set -euo pipefail

env_file=/opt/it-service-desk/.env.production
sudo cp "$env_file" "${env_file}.bak.$(date +%Y%m%d%H%M%S)"
sudo python3 - "$env_file" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
updates = {
    "WECOM_OPS_USER_IDS": "ZhangYong,ZhongJiaHao",
    "WECOM_ADMIN_USER_IDS": "ZhangYong,xiongziye",
}
lines = path.read_text(encoding="utf-8").splitlines()
seen = set()
result = []
for line in lines:
    key = line.split("=", 1)[0] if "=" in line else ""
    if key in updates:
        result.append(f'{key}="{updates[key]}"')
        seen.add(key)
    else:
        result.append(line)
for key, value in updates.items():
    if key not in seen:
        result.append(f'{key}="{value}"')
path.write_text("\n".join(result) + "\n", encoding="utf-8")
PY
sudo chmod 600 "$env_file"
sudo grep -E '^(WECOM_OPS_USER_IDS|WECOM_ADMIN_USER_IDS)=' "$env_file"
