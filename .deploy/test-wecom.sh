#!/usr/bin/env bash
set -euo pipefail
cd /opt/it-service-desk
sudo docker compose -f docker-compose.server.yml exec -T itdesk node - <<'NODE'
const corpId = process.env.WECOM_CORP_ID;
const secret = process.env.WECOM_SECRET;
const params = new URLSearchParams({ corpid: corpId, corpsecret: secret });
fetch(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?${params}`)
  .then((response) => response.json())
  .then((data) => {
    console.log(JSON.stringify({ errcode: data.errcode, errmsg: data.errmsg, tokenReceived: Boolean(data.access_token) }));
    if (data.errcode !== 0 || !data.access_token) process.exit(1);
  })
  .catch((error) => { console.error(error.message); process.exit(1); });
NODE
