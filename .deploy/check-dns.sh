#!/usr/bin/env bash
set -euo pipefail
echo "RESOLVE"
getent ahostsv4 it.tianhejiaoyu.cn
echo "HTTP"
curl -fsSI http://it.tianhejiaoyu.cn/login | head -8
