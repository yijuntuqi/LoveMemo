use lettre::{
    message::header::ContentType, transport::smtp::authentication::Credentials, AsyncSmtpTransport,
    AsyncTransport, Message, Tokio1Executor,
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

    let from_addr = parse_from_email(from);
    let from_header = match &from_addr.name {
        Some(name) => format!("{} <{}>", name, from_addr.email),
        None => from_addr.email.clone(),
    };

    let email = match Message::builder()
        .from(match from_header.parse() {
            Ok(a) => a,
            Err(e) => {
                error!("发件人地址解析失败 ({}): {}", from_header, e);
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

    let creds = Credentials::new(user, pass);
    let transport = match AsyncSmtpTransport::<Tokio1Executor>::relay(&host) {
        Ok(t) => t.port(port).credentials(creds).build(),
        Err(e) => {
            error!("SMTP 传输初始化失败: {}", e);
            return;
        }
    };

    match transport.send(email).await {
        Ok(_) => info!("欢迎邮件发送成功: {}", to),
        Err(e) => error!("欢迎邮件发送失败: {}", e),
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
    format!(
        r#"<div style="font-family:PingFang SC,Microsoft YaHei,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#334155;">
            <h2 style="color:#e11d48;">欢迎来到 LoveMemo</h2>
            <p>亲爱的用户，您好！</p>
            <p>感谢您注册 LoveMemo，您的手机号是：<strong>{}</strong></p>
            <p>LoveMemo 是一款温馨的恋爱纪念册应用，希望它能帮您记录下每一段美好的时光。</p>
            <p style="margin-top:24px;color:#94a3b8;font-size:12px;">本邮件由 LoveMemo 自动发送，请勿回复。</p>
        </div>"#,
        phone
    )
}
