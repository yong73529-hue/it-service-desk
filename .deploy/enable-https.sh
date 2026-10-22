#!/usr/bin/env bash
set -euo pipefail

config=/opt/tianhe-yunxue/app/nginx/edge-live.conf
replacement=/tmp/itdesk-deploy/itdesk-https.conf
backup="${config}.bak.$(date +%Y%m%d%H%M%S)"

sudo cp "$config" "$backup"
sudo python3 - "$config" "$replacement" <<'PY'
from pathlib import Path
import sys

config = Path(sys.argv[1])
replacement = Path(sys.argv[2]).read_text(encoding="utf-8").rstrip() + "\n"
text = config.read_text(encoding="utf-8")
start_marker = "# IT Service Desk - managed block"
end_marker = "# End IT Service Desk - managed block"
start = text.find(start_marker)
end = text.find(end_marker)
if start < 0 or end < start:
    raise SystemExit("managed block not found")
end += len(end_marker)
updated = text[:start] + replacement + text[end:].lstrip("\n")
config.write_text(updated, encoding="utf-8")
PY

if ! sudo docker exec tianhe-yunxue-edge-nginx-1 nginx -t; then
  sudo cp "$backup" "$config"
  echo "Nginx validation failed; original configuration restored." >&2
  exit 1
fi

sudo docker exec tianhe-yunxue-edge-nginx-1 nginx -s reload
curl -fsSI https://it.tianhejiaoyu.cn/login | head -8
echo "HTTPS_ENABLED backup=$backup"
