#!/usr/bin/env python3
"""
生成 LoveMemo 激活码并写入 Neon PostgreSQL。

用法示例：
  cd E:\old-new\backup\BNU_leaning\LoveMemo\server
  set DATABASE_URL=postgresql://...
  python scripts\generate_activation_code.py --count 5 --days 365
"""
import os
import argparse
import uuid
import psycopg2
from urllib.parse import urlparse


def parse_args():
    p = argparse.ArgumentParser(description="生成 LoveMemo 会员激活码")
    p.add_argument("--count", type=int, default=1, help="生成数量")
    p.add_argument("--days", type=int, default=365, help="会员有效期天数，0 表示永久")
    p.add_argument("--type", type=str, default="premium", help="会员类型，默认 premium")
    return p.parse_args()


def generate_code():
    return uuid.uuid4().hex[:16].upper()


def main():
    args = parse_args()
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("错误：请设置环境变量 DATABASE_URL")
        return 1

    conn = psycopg2.connect(url)
    cur = conn.cursor()
    codes = []
    for _ in range(args.count):
        code = generate_code()
        cur.execute(
            "INSERT INTO lovememo_activation_codes (code, membership_type, expires_days) VALUES (%s, %s, %s)",
            (code, args.type, args.days if args.days > 0 else None),
        )
        codes.append(code)
    conn.commit()
    cur.close()
    conn.close()

    print(f"已生成 {len(codes)} 个激活码（类型={args.type}，有效期={args.days or '永久'}天）：")
    for c in codes:
        print(c)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
