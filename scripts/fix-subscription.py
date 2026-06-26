#!/usr/bin/env python3
"""
订阅链接清理脚本 — 输入机场订阅链接，输出干净的 Clash YAML 配置文件。

解决问题：旧版 ClashX 的 YAML 解析器无法处理订阅中的"文本消息伪代理"
（● 开头、server=127.0.0.1 等），导致 "yaml: unmarshal errors"。

用法：
  python3 fix-subscription.py "https://xxx/subscribe?token=xxx"
  python3 fix-subscription.py "https://xxx/subscribe?token=xxx" -o my.yaml
"""

from __future__ import annotations

import sys
import json
import base64
import argparse
import re
import urllib.request
import urllib.error
import ssl

# ============================================================================
# 黑名单 — 匹配到以下规则的条目将被移除
# ============================================================================

BLACKLIST_NAME_PATTERNS = [
    r"^●",                              # ● 开头（推广文本伪装）
    r"^•",                              # • 开头
    r"建议.*更新.*订阅",
    r"每日更新",
    r"定期检查",
    r"准确到分钟",
    r"当前时间",
    r"官网",
    r"购买",
    r"续费",
    r"客服",
    r"电报群",
    r"Telegram",
    r"频道",
    r"剩余流量",
    r"到期时间",
    r"^\s*$",                           # 空名称
]

# ============================================================================
# 订阅获取 & 解码
# ============================================================================

def fetch_subscription(url: str) -> str:
    """抓取订阅原始内容"""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.0.0"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        print(f"[ERROR] 获取订阅失败: {e}", file=sys.stderr)
        sys.exit(1)


def decode_subscription(raw: str) -> list[dict]:
    """解码订阅内容（base64 → vmess:// URI → JSON 列表）"""
    raw = raw.strip()

    # 尝试 base64 解码
    try:
        decoded = base64.b64decode(raw).decode("utf-8", errors="replace")
        if "vmess://" in decoded:
            raw = decoded
    except Exception:
        pass

    entries = []
    for line in raw.splitlines():
        line = line.strip()
        if not line.startswith("vmess://"):
            continue
        try:
            b64 = line[len("vmess://"):].strip()
            padding = 4 - len(b64) % 4
            if padding != 4:
                b64 += "=" * padding
            obj = json.loads(base64.b64decode(b64).decode("utf-8"))
            entries.append(obj)
        except Exception:
            continue

    return entries


# ============================================================================
# 清洗逻辑
# ============================================================================

def is_dummy_entry(entry: dict) -> bool:
    """判断是否为虚假代理"""
    add = entry.get("add", "")

    # 服务器指向本地 → 虚假
    if re.match(r"^(127\.0\.0\.\d+|localhost|0\.0\.0\.0|::1)$", add):
        return True

    # 名称匹配黑名单
    ps = entry.get("ps", "")
    for pat in BLACKLIST_NAME_PATTERNS:
        if re.search(pat, ps):
            return True

    return False


def clean_entries(entries: list[dict]) -> tuple[list[dict], list[dict]]:
    """返回 (保留, 移除)"""
    kept, removed = [], []
    for e in entries:
        (removed if is_dummy_entry(e) else kept).append(e)
    return kept, removed


# ============================================================================
# YAML 生成
# ============================================================================

def entries_to_yaml(entries: list[dict], group_name: str = "PROXY") -> str:
    """将 vmess 条目列表转为完整的 Clash YAML 配置"""
    out: list[str] = []

    # 基本设置
    out.append("mixed-port: 7890")
    out.append("allow-lan: true")
    out.append("mode: rule")
    out.append("log-level: info")
    out.append("")
    out.append("proxies:")

    names: list[str] = []
    for e in entries:
        ps = e.get("ps", "Unknown")
        names.append(ps)
        name_safe = ps.replace("'", "''")
        net = e.get("net", "tcp")
        host = e.get("host", "")
        path = e.get("path", "")
        tls = e.get("tls", "")
        cipher = e.get("scy", "auto")

        out.append(f"  - name: '{name_safe}'")
        out.append(f"    type: vmess")
        out.append(f"    server: {e.get('add', '')}")
        out.append(f"    port: {e.get('port', '')}")
        out.append(f"    uuid: {e.get('id', '')}")
        out.append(f"    alterId: {e.get('aid', '0')}")
        out.append(f"    cipher: {cipher}")
        out.append(f"    udp: true")
        out.append(f"    network: {net}")
        out.append(f"    tls: {'true' if tls else 'false'}")
        if net == "ws" and host:
            out.append(f"    ws-opts:")
            out.append(f"      path: {path or '/'}")
            out.append(f"      headers:")
            out.append(f"        Host: {host}")
        out.append("")

    # 代理组
    out.append("proxy-groups:")
    out.append(f"  - name: {group_name}")
    out.append("    type: select")
    out.append("    proxies:")
    for n in names:
        safe = n.replace("'", "''")
        out.append(f"      - '{safe}'")
    out.append("")

    # 规则
    out.append("rules:")
    out.append("  - DOMAIN-SUFFIX,cn,DIRECT")
    out.append("  - GEOIP,CN,DIRECT")
    out.append(f"  - MATCH,{group_name}")

    return "\n".join(out)


# ============================================================================
# 主入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="订阅清洗 → Clash YAML 配置文件",
    )
    parser.add_argument("url", help="订阅链接 URL")
    parser.add_argument("-o", "--output", default="proxy.yaml",
                        help="输出 YAML 文件路径 (默认: proxy.yaml)")
    parser.add_argument("-n", "--name", default="PROXY",
                        help="代理组名称 (默认: PROXY)")
    args = parser.parse_args()

    # 1. 抓取
    print(f"⬇️  正在获取订阅...", file=sys.stderr)
    raw = fetch_subscription(args.url)

    # 2. 解码
    entries = decode_subscription(raw)
    if not entries:
        print("[ERROR] 未能解析出任何有效代理条目", file=sys.stderr)
        print(f"[ERROR] 原始内容前 200 字符:\n{raw[:200]}", file=sys.stderr)
        sys.exit(1)
    print(f"   解析到 {len(entries)} 个条目", file=sys.stderr)

    # 3. 清洗
    kept, removed = clean_entries(entries)
    for r in removed:
        print(f"   ❌ 移除虚假条目: [{r.get('ps', '?')}] (server={r.get('add', '?')})", file=sys.stderr)

    if not kept:
        print("[ERROR] 所有条目被过滤，请检查黑名单", file=sys.stderr)
        sys.exit(1)

    # 4. 输出 YAML
    yaml_content = entries_to_yaml(kept, args.name)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(yaml_content)

    print(f"   ✅ 已生成: {args.output} ({len(kept)} 个代理)", file=sys.stderr)
    print(f"   💡 将 {args.output} 放到 ~/.config/clash/ 目录即可使用", file=sys.stderr)


if __name__ == "__main__":
    main()
