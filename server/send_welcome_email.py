#!/usr/bin/env python3
"""
LoveMemo 欢迎邮件发送脚本
用法: python send_welcome_email.py <收件人邮箱> [手机号]
配置从同目录 .env 文件读取
"""
import sys
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header


def load_env():
    """从同目录 .env 读取配置"""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    config = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, val = line.partition("=")
                    config[key.strip()] = val.strip()
    return config


def send_welcome_email(to_email, phone=""):
    config = load_env()

    smtp_host = config.get("SMTP_HOST", "smtp.mail.bnu.edu.cn")
    smtp_port = int(config.get("SMTP_PORT", "465"))
    smtp_user = config.get("SMTP_USER", "")
    smtp_pass = config.get("SMTP_PASS", "")
    from_email = config.get("FROM_EMAIL", smtp_user)

    if not smtp_user or not smtp_pass:
        print("ERROR: SMTP_USER 或 SMTP_PASS 未配置", file=sys.stderr)
        return False

    subject = "欢迎来到 LoveMemo 💕"
    body = f"""
    <div style="max-width:600px;margin:0 auto;font-family:'Microsoft YaHei',sans-serif;">
        <div style="background:linear-gradient(135deg,#f43f5e,#ec4899);padding:40px;text-align:center;border-radius:16px 16px 0 0;">
            <h1 style="color:white;font-size:28px;margin:0;">💕 LoveMemo</h1>
            <p style="color:rgba(255,255,255,0.9);font-size:16px;margin-top:8px;">记录爱的每一刻</p>
        </div>
        <div style="background:white;padding:40px;border:1px solid #fce7f3;border-top:none;border-radius:0 0 16px 16px;">
            <h2 style="color:#be123c;">欢迎来到 LoveMemo！</h2>
            <p style="color:#64748b;font-size:15px;line-height:1.8;">
                你的账号已成功注册{f"（手机号：{phone[:3]}****{phone[-4:]}）" if phone else ""}。<br/>
                从现在起，你可以开始记录你们的每一个甜蜜瞬间。
            </p>
            <div style="background:#fff1f2;padding:20px;border-radius:12px;margin:24px 0;">
                <p style="color:#be123c;font-weight:bold;margin:0;">✨ 开始使用</p>
                <p style="color:#64748b;font-size:14px;margin-top:8px;">
                    · 记录恋爱故事和珍贵回忆<br/>
                    · 标记你们去过的每一个地方<br/>
                    · 设置纪念日提醒，不再遗忘重要日子<br/>
                    · 生成专属恋爱统计报告
                </p>
            </div>
            <p style="color:#94a3b8;font-size:13px;text-align:center;margin-top:32px;">
                这是一封自动发送的邮件，请勿回复。<br/>
                © LoveMemo - 让爱被铭记
            </p>
        </div>
    </div>
    """

    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = Header(subject, "utf-8")
    msg.attach(MIMEText(body, "html", "utf-8"))

    try:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [to_email], msg.as_string())
        print(f"OK: 欢迎邮件已发送至 {to_email}")
        return True
    except Exception as e:
        print(f"ERROR: 邮件发送失败: {e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python send_welcome_email.py <收件人邮箱> [手机号]", file=sys.stderr)
        sys.exit(1)
    to_email = sys.argv[1]
    phone = sys.argv[2] if len(sys.argv) > 2 else ""
    success = send_welcome_email(to_email, phone)
    sys.exit(0 if success else 1)
