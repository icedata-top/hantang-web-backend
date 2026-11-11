#!/usr/bin/env python3
"""从 config.secret.properties 连接 PostgreSQL，导出 UniSeek 视频样本为 JSON。

依赖：pip install "psycopg[binary]"
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

QUERY = """
SELECT
    u.aid,
    u.title,
    u.tag_new,
    p.description
FROM hantang_dynamic.adm_uniseek_videos AS u
LEFT JOIN hantang_dynamic.processed_videos AS p
    ON p.aid = u.aid
WHERE u.aid % 7 = 0
ORDER BY u."view" DESC
LIMIT 1000
"""

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
CONFIG_PATH = REPO_ROOT / "config.secret.properties"
OUTPUT_PATH = SCRIPT_DIR / "uniseek_videos.json"


def load_properties(path: Path) -> dict[str, str]:
    props: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith("!"):
            continue
        if line.startswith("\\"):
            line = line[1:]
        separator = None
        for index, char in enumerate(line):
            if char in "=:" or char.isspace():
                separator = index
                break
        if separator is None:
            props[line] = ""
            continue
        key = line[:separator].strip()
        value = line[separator + 1 :].lstrip()
        props[key] = value
    return props


def require_property(props: dict[str, str], key: str) -> str:
    value = props.get(key, "").strip()
    if not value:
        raise SystemExit(f"缺少配置项 {key}：{CONFIG_PATH}")
    return value


def json_default(value: object) -> object:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError(f"无法序列化 {type(value).__name__}")


def main() -> None:
    if not CONFIG_PATH.is_file():
        raise SystemExit(f"找不到数据库配置：{CONFIG_PATH}")

    props = load_properties(CONFIG_PATH)
    host = require_property(props, "db.postgre_host")
    port = props.get("db.postgre_port", "5432").strip() or "5432"
    database = require_property(props, "db.postgre_database")
    user = require_property(props, "db.postgre_user")
    password = require_property(props, "db.postgre_password")

    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as exc:
        raise SystemExit('缺少依赖，请先执行：pip install "psycopg[binary]"') from exc

    with psycopg.connect(
        host=host,
        port=int(port),
        dbname=database,
        user=user,
        password=password,
        connect_timeout=15,
    ) as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(QUERY)
            rows = cursor.fetchall()

    OUTPUT_PATH.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2, default=json_default) + "\n",
        encoding="utf-8",
    )
    print(f"已写入 {len(rows)} 行：{OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"导出失败：{exc}", file=sys.stderr)
        raise SystemExit(1) from exc
