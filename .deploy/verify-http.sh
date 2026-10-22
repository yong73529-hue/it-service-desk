#!/usr/bin/env bash
set -euo pipefail
for attempt in $(seq 1 15); do
  if curl -fsS -H 'Host: it.tianhejiaoyu.cn' http://127.0.0.1/login >/dev/null; then break; fi
  sleep 2
done
curl -fsSI -H 'Host: it.tianhejiaoyu.cn' http://127.0.0.1/login | head -8
sudo docker inspect it-service-desk --format '{{json .NetworkSettings.Networks}}'
sudo docker ps --filter name=it-service-desk --format '{{.Names}} {{.Status}}'
