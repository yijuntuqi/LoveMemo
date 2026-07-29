use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use chrono::{Duration, Utc};
use serde::Deserialize;
use sqlx::PgPool;

use crate::auth::{decode_token, ErrorResponse, UserInfo};

#[derive(Deserialize)]
pub struct ActivateRequest {
    pub code: String,
}

pub async fn activate(
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(req): Json<ActivateRequest>,
) -> Result<Json<UserInfo>, (StatusCode, Json<ErrorResponse>)> {
    let auth = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "缺少认证信息".to_string(),
            }),
        ))?;

    let user_id = decode_token(auth).map_err(|e| {
        (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: format!("Token 无效: {}", e),
            }),
        )
    })?;

    let code = req.code.trim();
    if code.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "激活码不能为空".to_string(),
            }),
        ));
    }

    // 查询并锁定激活码
    let row: (String, Option<i32>, Option<chrono::DateTime<Utc>>) = sqlx::query_as(
        "SELECT membership_type, expires_days, used_at FROM lovememo_activation_codes WHERE code = $1",
    )
    .bind(code)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("数据库错误: {}", e),
            }),
        )
    })?
    .ok_or((
        StatusCode::NOT_FOUND,
        Json(ErrorResponse {
            error: "激活码不存在".to_string(),
        }),
    ))?;

    if row.2.is_some() {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                error: "激活码已被使用".to_string(),
            }),
        ));
    }

    let membership_type = row.0;
    let expires_at = row.1.map(|days| {
        Utc::now()
            .checked_add_signed(Duration::days(days as i64))
            .unwrap_or_else(Utc::now)
    });

    // 更新激活码状态
    sqlx::query(
        "UPDATE lovememo_activation_codes SET used_by = $1, used_at = now() WHERE code = $2",
    )
    .bind(user_id)
    .bind(code)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("更新激活码失败: {}", e),
            }),
        )
    })?;

    // 更新用户会员信息
    let user: UserInfo = sqlx::query_as::<_, UserInfo>(
        "UPDATE lovememo_users SET membership_type = $1, membership_expires_at = $2, updated_at = now()\n         WHERE id = $3\n         RETURNING id, phone, email, nickname, avatar_url, membership_type, membership_expires_at, created_at",
    )
    .bind(&membership_type)
    .bind(expires_at)
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("更新会员信息失败: {}", e),
            }),
        )
    })?;

    Ok(Json(user))
}
