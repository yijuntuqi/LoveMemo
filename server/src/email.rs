use lettre::{
    message::header::ContentType,
    transport::smtp::{
        authentication::{Credentials, Mechanism},
        client::{Tls, TlsParameters},
    },
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use reqwest::Client;
use serde_json::json;
use tracing::{error, info};

const RESEND_API_URL: &str = "https://api.resend.com/emails";
const SENDGRID_API_URL: &str = "https://api.sendgrid.com/v3/mail/send";

#[derive(Debug)]
struct EmailAddress {
    email: String,
    name: Option<String>,
}

fn parse_from_email(from: &str) -> EmailAddress {
    // 支持 "LoveMemo <noreply@example.com>" 或 "noreply@example.com"
    if let Some(start) = from.find('<') {
        if let Some(end) = from.find('>') {
            let name = from[..start].trim();
            let email = from[start + 1..end].trim();
            return EmailAddress {
                email: email.to_string(),
                name: if name.is_empty() {
                    None
                } else {
                    Some(name.to_string())
                },
            };
        }
    }
    EmailAddress {
        email: from.trim().to_string(),
        name: None,
    }
}

/// 发送欢迎邮件。
/// 优先级：SMTP > SendGrid > Resend；都未配置则静默跳过，不影响注册流程。
pub async fn send_welcome_email(to: &str, phone: &str) {
    let from = std::env::var("FROM_EMAIL")
        .unwrap_or_else(|_| "LoveMemo <noreply@lovememo.app>".to_string());

    if let Ok(host) = std::env::var("SMTP_HOST") {
        if !host.is_empty() {
            send_with_smtp(to, &from, phone).await;
            return;
        }
    }

    if let Ok(api_key) = std::env::var("SENDGRID_API_KEY") {
        if !api_key.is_empty() {
            send_with_sendgrid(to, &from, phone, &api_key).await;
            return;
        }
    }

    if let Ok(api_key) = std::env::var("RESEND_API_KEY") {
        if !api_key.is_empty() {
            send_with_resend(to, &from, phone, &api_key).await;
            return;
        }
    }

    info!("SMTP / SENDGRID_API_KEY / RESEND_API_KEY 均未配置，跳过发送欢迎邮件");
}

async fn send_with_smtp(to: &str, from: &str, phone: &str) {
    let host = match std::env::var("SMTP_HOST") {
        Ok(h) if !h.is_empty() => h,
        _ => {
            error!("SMTP_HOST 未配置");
            return;
        }
    };
    let port: u16 = std::env::var("SMTP_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(465);
    let user = match std::env::var("SMTP_USER") {
        Ok(u) if !u.is_empty() => u,
        _ => {
            error!("SMTP_USER 未配置");
            return;
        }
    };
    let pass = match std::env::var("SMTP_PASS") {
        Ok(p) if !p.is_empty() => p,
        _ => {
            error!("SMTP_PASS 未配置");
            return;
        }
    };

    let email = match Message::builder()
        .from(match from.parse() {
            Ok(a) => a,
            Err(e) => {
                error!("发件人地址解析失败 ({}): {}", from, e);
                return;
            }
        })
        .to(match to.parse() {
            Ok(a) => a,
            Err(e) => {
                error!("收件人地址解析失败 ({}): {}", to, e);
                return;
            }
        })
        .subject("欢迎来到 LoveMemo")
        .header(ContentType::TEXT_HTML)
        .body(welcome_html(phone))
    {
        Ok(m) => m,
        Err(e) => {
            error!("构造邮件失败: {}", e);
            return;
        }
    };

    let security = std::env::var("SMTP_SECURITY").unwrap_or_default().to_lowercase();
    let allow_invalid_certs = std::env::var("SMTP_ALLOW_INVALID_CERTS")
        .unwrap_or_default()
        .to_lowercase()
        == "true";
    let creds = Credentials::new(user, pass);

    let tls_params = match TlsParameters::builder(host.clone())
        .dangerous_accept_invalid_certs(allow_invalid_certs)
        .build()
    {
        Ok(p) => p,
        Err(e) => {
            error!("SMTP TLS 参数构建失败: {}", e);
            return;
        }
    };

    let (builder, tls) = if security == "starttls" {
        (AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host), Tls::Required(tls_params))
    } else {
        (AsyncSmtpTransport::<Tokio1Executor>::relay(&host), Tls::Wrapper(tls_params))
    };
    let transport = match builder {
        Ok(t) => t
            .port(port)
            .credentials(creds)
            .authentication(vec![Mechanism::Login, Mechanism::Plain])
            .tls(tls)
            .build(),
        Err(e) => {
            error!("SMTP 传输初始化失败: {}", e);
            return;
        }
    };

    match transport.send(email).await {
        Ok(_) => info!("欢迎邮件发送成功: {}", to),
        Err(e) => error!("欢迎邮件发送失败: {:?}", e),
    }
}

async fn send_with_resend(to: &str, from: &str, phone: &str, api_key: &str) {
    let client = Client::new();
    let body = json!({
        "from": from,
        "to": [to],
        "subject": "欢迎来到 LoveMemo",
        "html": welcome_html(phone),
    });

    match client
        .post(RESEND_API_URL)
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(res) => {
            if res.status().is_success() {
                info!("欢迎邮件发送成功: {}", to);
            } else {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                error!("欢迎邮件发送失败 ({}): {}", status, text);
            }
        }
        Err(e) => {
            error!("欢迎邮件请求失败: {}", e);
        }
    }
}

async fn send_with_sendgrid(to: &str, from: &str, phone: &str, api_key: &str) {
    let client = Client::new();
    let from_addr = parse_from_email(from);

    let mut from_json = json!({"email": from_addr.email});
    if let Some(name) = from_addr.name {
        from_json["name"] = json!(name);
    }

    let body = json!({
        "personalizations": [{"to": [{"email": to}]}],
        "from": from_json,
        "subject": "欢迎来到 LoveMemo",
        "content": [{"type": "text/html", "value": welcome_html(phone)}],
    });

    match client
        .post(SENDGRID_API_URL)
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(res) => {
            if res.status().is_success() {
                info!("欢迎邮件发送成功: {}", to);
            } else {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                error!("欢迎邮件发送失败 ({}): {}", status, text);
            }
        }
        Err(e) => {
            error!("欢迎邮件请求失败: {}", e);
        }
    }
}

fn welcome_html(phone: &str) -> String {
    // 手机号脱敏显示（与原 Python 版本一致，保护隐私）
    let masked_phone = if phone.len() >= 7 {
        format!("{}****{}", &phone[..3], &phone[phone.len() - 4..])
    } else {
        phone.to_string()
    };
    format!(
        r#"<div style="font-family:'PingFang SC','Microsoft YaHei',sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(244,63,94,0.15);">
            <div style="background:linear-gradient(135deg,#f43f5e 0%,#ec4899 100%);padding:48px 30px;text-align:center;">
                <div style="font-size:64px;margin-bottom:12px;line-height:1;">💕</div>
                <h1 style="color:#ffffff;font-size:34px;margin:0;font-weight:700;letter-spacing:3px;">LoveMemo</h1>
                <p style="color:rgba(255,255,255,0.95);font-size:15px;margin:12px 0 0;letter-spacing:2px;">记录爱 · 珍藏每一刻 · 让爱被铭记</p>
            </div>
            <div style="padding:40px 32px;">
                <h2 style="color:#be123c;font-size:24px;margin:0 0 20px;text-align:center;">🎉 欢迎来到 LoveMemo！</h2>
                <p style="color:#475569;font-size:15px;line-height:1.9;margin:0 0 20px;">
                    亲爱的用户，您好！<br>
                    非常感谢您选择 LoveMemo！我们由衷地为您感到开心，也无比荣幸能见证您与爱人的甜蜜旅程 🥰<br>
                    从这一刻起，您与爱人的每一个珍贵瞬间，都将被温柔珍藏，永不褪色。
                </p>
                <div style="background:linear-gradient(135deg,#fff1f2 0%,#fce7f3 100%);border-radius:14px;padding:22px;margin:24px 0;border-left:4px solid #ec4899;">
                    <p style="color:#94a3b8;font-size:13px;margin:0;">您的专属账号</p>
                    <p style="color:#1e293b;font-size:17px;margin:8px 0 0;font-weight:600;">📱 {}</p>
                </div>
                <p style="color:#be123c;font-size:16px;font-weight:600;margin:28px 0 14px;">✨ 在 LoveMemo，您可以尽情记录你们的爱情故事</p>
                <div style="background:#fffbeb;border-radius:14px;padding:20px 22px;margin:8px 0 16px;border:1px solid #fef3c7;">
                    <p style="color:#475569;font-size:14px;margin:10px 0;">💌 <strong>恋爱时间线</strong> — 记录每一个浪漫时刻，制作属于你们的专属恋爱纪念册</p>
                    <p style="color:#475569;font-size:14px;margin:10px 0;">🗺️ <strong>恋爱地图</strong> — 标记你们一起走过的每一个角落，珍藏每一段旅程</p>
                    <p style="color:#475569;font-size:14px;margin:10px 0;">✨ <strong>AI 智能润色</strong> — 让每一段文字更动人，AI 帮你写出心中的爱</p>
                    <p style="color:#475569;font-size:14px;margin:10px 0;">💎 <strong>照片与回忆</strong> — 珍藏每一张照片，永久保存你们的美好时光</p>
                    <p style="color:#475569;font-size:14px;margin:10px 0;">📅 <strong>纪念日提醒</strong> — 不再遗忘任何重要日子，每一个纪念日都被温柔记住</p>
                    <p style="color:#475569;font-size:14px;margin:10px 0;">📊 <strong>恋爱统计</strong> — 生成专属恋爱报告，看见你们的爱情成长轨迹</p>
                </div>
                <div style="background:linear-gradient(135deg,#f43f5e 0%,#ec4899 100%);border-radius:14px;padding:24px;margin:24px 0;text-align:center;">
                    <p style="color:#ffffff;font-size:17px;font-weight:600;margin:0;">💖 现在就开始，记录你们的第一个甜蜜瞬间吧！</p>
                    <p style="color:rgba(255,255,255,0.9);font-size:13px;margin:10px 0 0;">打开 LoveMemo，开启你们的专属恋爱纪念册</p>
                </div>
                <div style="text-align:center;margin:28px 0 8px;">
                    <p style="color:#be123c;font-size:16px;font-weight:600;margin:0;">🌹 愿你们的爱情，永远如初见般美好</p>
                    <p style="color:#94a3b8;font-size:13px;margin:10px 0 0;">LoveMemo · 用心记录每一份爱 · 让爱被永远铭记</p>
                </div>
            </div>
            <div style="background:#fff1f2;border-top:1px solid #fce7f3;padding:22px 30px;text-align:center;">
                <p style="color:#94a3b8;font-size:12px;margin:0;">本邮件由 LoveMemo 自动发送，请勿直接回复</p>
                <p style="color:#cbd5e1;font-size:11px;margin:8px 0 0;">© LoveMemo · 记录爱 · 珍藏每一刻</p>
            </div>
        </div>"#,
        masked_phone
    )
}
