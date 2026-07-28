#!/usr/bin/env python3
"""
手动将指定用户升级为会员，或直接使用 SQL 修改 lovememo_users 表。

用法示例：
  cd E:\old-new\backup\BNU_leaning\LoveMemo\server
  set DATABASE_URL=postgresql://...
  python scripts\upgrade_user.py --phone 13800138000 --days 365
  python scripts\upgrade_user.py --email user@example.com --days 365
"""
import os
import argparse
import datetime
import psycopg2


def parse_args():
    p = argparse.ArgumentParser(description="手动升级 LoveMemo 用户会员等级")
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--phone", help="用户手机号")
    group.add_argument("--email", help="用户邮箱")
    p.add_argument("--days", type=int, default=365, help="会员有效期天数，0 表示永久")
    p.add_argument("--type", type=str, default="premium", help="会员类型，默认 premium")
    return p.parse_args()


def main():
    args = parse_args()
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("错误：请设置环境变量 DATABASE_URL")
        return 1

    expires_at = None
    if args.days > 0:
        expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=args.days)

    conn = psycopg2.connect(url)
    cur = conn.cursor()

    if args.phone:
        cur.execute(
            """
            UPDATE lovememo_users
            SET membership_type = %s,
                membership_expires_at = %s,
                updated_at = now()
            WHERE phone = %s
            RETURNING id, phone, email, membership_type, membership_expires_at
            """,
            (args.type, expires_at, args.phone),
        )
    else:
        cur.execute(
            """
            UPDATE lovememo_users
            SET membership_type = %s,
                membership_expires_at = %s,
                updated_at = now()
            WHERE email = %s
            RETURNING id, phone, email, membership_type, membership_expires_at
            """,
            (args.type, expires_at, args.email),
        )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    if row:
        print(f"已升级用户：手机号={row[1]}，邮箱={row[2] or '无'}")
        print(f"会员类型：{row[3]}")
        print(f"有效期至：{row[4] or '永久'}")
    else:
        identifier = args.phone or args.email
        print(f"未找到用户：{identifier}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
