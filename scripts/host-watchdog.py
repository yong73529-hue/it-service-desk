#!/usr/bin/env python3
import glob
import json
import os
import shutil
import ssl
import subprocess
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

APP_DIR = "/opt/it-service-desk"
STATE_FILE = f"{APP_DIR}/.watchdog-state.json"


def load_env():
    values = {}
    with open(f"{APP_DIR}/.env.production", encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key] = value.strip().strip('"').strip("'")
    return values


def request_json(url, data=None):
    body = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"} if body else {})
    with urllib.request.urlopen(request, timeout=12) as response:
        return json.loads(response.read())


def send_alert(env, title, description):
    query = urllib.parse.urlencode({"corpid": env["WECOM_CORP_ID"], "corpsecret": env["WECOM_SECRET"]})
    token_data = request_json(f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?{query}")
    if token_data.get("errcode", 0) != 0:
        raise RuntimeError(f"WeCom token error {token_data.get('errcode')}")
    result = request_json(
        f"https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token={urllib.parse.quote(token_data['access_token'])}",
        {
            "touser": env.get("WECOM_NOTIFY_USER_IDS") or env.get("WECOM_OPS_USER_IDS"),
            "msgtype": "textcard",
            "agentid": int(env["WECOM_AGENT_ID"]),
            "textcard": {
                "title": title,
                "description": description,
                "url": env.get("WECOM_APP_URL", "https://it.tianhejiaoyu.cn") + "/admin",
                "btntxt": "查看系统",
            },
        },
    )
    if result.get("errcode", 0) != 0:
        raise RuntimeError(f"WeCom message error {result.get('errcode')}")


def main():
    failures = []
    try:
        status = subprocess.check_output(
            ["docker", "inspect", "--format={{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}", "it-service-desk"],
            text=True,
            timeout=10,
        ).strip()
        if status != "running healthy":
            failures.append(f"应用容器状态异常：{status or 'unknown'}")
    except Exception as error:
        failures.append(f"无法读取应用容器状态：{error}")
    try:
        with urllib.request.urlopen("https://it.tianhejiaoyu.cn/login", timeout=12) as response:
            if response.status != 200:
                failures.append(f"网站响应异常：HTTP {response.status}")
    except Exception as error:
        failures.append(f"网站无法访问：{error}")
    usage = shutil.disk_usage(APP_DIR)
    if usage.free / usage.total < 0.15:
        failures.append(f"服务器磁盘剩余不足 15%：{usage.free / usage.total:.1%}")
    backups = glob.glob(f"{APP_DIR}/data/backups/itdesk-*.db")
    if not backups or time.time() - max(os.path.getmtime(item) for item in backups) > 36 * 3600:
        failures.append("数据库备份超过 36 小时未更新")
    try:
        context = ssl.create_default_context()
        with context.wrap_socket(__import__("socket").create_connection(("it.tianhejiaoyu.cn", 443), timeout=10), server_hostname="it.tianhejiaoyu.cn") as sock:
            expires = datetime.strptime(sock.getpeercert()["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc).timestamp()
        if expires - time.time() < 14 * 24 * 3600:
            failures.append("HTTPS 证书将在 14 天内过期")
    except Exception as error:
        failures.append(f"HTTPS 证书检查失败：{error}")

    env = load_env()
    try:
        with open(STATE_FILE, encoding="utf-8") as handle:
            state = json.load(handle)
    except Exception:
        state = {}
    signature = "|".join(sorted(failures))
    last_sent = float(state.get("lastSent", 0))
    if failures and (state.get("signature") != signature or time.time() - last_sent > 6 * 3600):
        send_alert(env, "【系统告警】IT 服务台运行异常", "\n".join(failures))
        state = {"signature": signature, "lastSent": time.time(), "active": True}
    elif not failures and state.get("active"):
        send_alert(env, "【系统恢复】IT 服务台已恢复正常", "网站、容器、磁盘、证书和数据库备份检查均已恢复正常。")
        state = {"signature": "", "lastSent": time.time(), "active": False}
    else:
        state.update({"signature": signature, "active": bool(failures)})
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as handle:
        json.dump(state, handle)
    print("Host watchdog:", "OK" if not failures else "; ".join(failures))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
