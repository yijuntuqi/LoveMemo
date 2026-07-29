use reqwest::Client;
use serde_json::json;
use tracing::{error, info};

const RESEND_API_URL: &str = "https://api.resend.com/emails";

/// 发送欢迎邮件。若未配置 RESEND_API_KEY 则静默跳过，不影响注册流程。
pub async fn send_welcome_email(to: &str, phone: &str) {
    let api_key = match std::env::var("RESEND_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => {
            info!("RESEND_API_KEY 未配置，跳过发送欢迎邮件");
            return;
        }
    };

    let from = std::env::var("FROM_EMAIL").unwrap_or_else(|_| "LoveMemo <noreply@lovememo.app>".to_string());

    let client = Client::new();
    let body = json!({
        "from": from,
        "to": [to],
        "subject": "欢迎来到 LoveMemo",
        "html": format!(
            r#"<div style="font-family:PingFang SC,Microsoft YaHei,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#334155;">
                <h2 style="color:#e11d48;">欢迎来到 LoveMemo</h2>
                <p>亲爱的用户，您好！</p>
                <p>感谢您注册 LoveMemo，您的手机号是：<strong>{}</strong></p>
                <p>LoveMemo 是一款温馨的恋爱纪念册应用，希望它能帮您记录下每一段美好的时光。</p>
                <p style="margin-top:24px;color:#94a3b8;font-size:12px;">本邮件由 LoveMemo 自动发送，请勿回复。</p>
            </div>"#,
            phone
        ),
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
