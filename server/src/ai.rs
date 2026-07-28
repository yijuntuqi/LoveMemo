use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::auth::{ErrorResponse, require_premium};

#[derive(Deserialize)]
pub struct PolishRequest {
    pub content: String,
}

#[derive(Serialize)]
pub struct PolishResponse {
    pub result: String,
}

fn env_or(name: &str, default: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| default.to_string())
}

pub async fn polish(
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(req): Json<PolishRequest>,
) -> Result<Json<PolishResponse>, (StatusCode, Json<ErrorResponse>)> {
    // AI 润色为会员功能
    let _user = require_premium(&headers, &pool).await?;
    let base_url = env_or("AI_BASE_URL", "https://api.moonshot.cn/v1");
    let api_key = env_or("AI_API_KEY", "");
    let model = env_or("AI_MODEL", "moonshot-v1-8k");

    if api_key.is_empty() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse {
                error: "AI 服务未配置".to_string(),
            }),
        ));
    }

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一位温暖的恋爱文案助手。请帮用户把下面的恋爱记录润色得更浪漫、更生动，保留原意，不要编造事实。只输出润色后的文案，不要加解释。"
                },
                { "role": "user", "content": req.content }
            ],
            "temperature": 0.7,
        }))
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: format!("AI 请求失败: {}", e),
                }),
            )
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("AI 服务错误 ({}): {}", status, body),
            }),
        ));
    }

    let data: Value = response.json().await.map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("解析 AI 响应失败: {}", e),
            }),
        )
    })?;

    let result = data
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();

    Ok(Json(PolishResponse { result }))
}
