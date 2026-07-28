use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::{auth_from_header, ErrorResponse};

#[derive(Deserialize, Serialize, sqlx::FromRow, Debug)]
pub struct SyncChange {
    pub table_name: String,
    pub record_id: String,
    pub updated_at: chrono::DateTime<Utc>,
    pub deleted: bool,
    pub payload: Value,
}

#[derive(Deserialize)]
pub struct SyncRequest {
    pub last_sync_at: Option<chrono::DateTime<Utc>>,
    pub changes: Vec<SyncChange>,
}

#[derive(Serialize)]
pub struct SyncResponse {
    pub server_time: chrono::DateTime<Utc>,
    pub changes: Vec<SyncChange>,
}

pub async fn sync(
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(req): Json<SyncRequest>,
) -> Result<Json<SyncResponse>, (StatusCode, Json<ErrorResponse>)> {
    let user = auth_from_header(&headers, &pool).await?;

    // 会员才能使用云端同步
    if user.membership_type != "premium" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "云端同步是会员功能".to_string(),
            }),
        ));
    }

    if let Some(expires) = user.membership_expires_at {
        if expires < Utc::now() {
            return Err((
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: "会员已过期".to_string(),
                }),
            ));
        }
    }

    let server_time = Utc::now();

    // 1. 写入客户端提交的变化（按 updated_at 冲突解决，取较新）
    for change in &req.changes {
        let existing: Option<(Uuid, chrono::DateTime<Utc>)> = sqlx::query_as(
            "SELECT id, updated_at FROM lovememo_sync_records
             WHERE user_id = $1 AND table_name = $2 AND record_id = $3",
        )
        .bind(user.id)
        .bind(&change.table_name)
        .bind(&change.record_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("查询同步记录失败: {}", e),
                }),
            )
        })?;

        match existing {
            Some((id, updated_at)) if change.updated_at > updated_at => {
                sqlx::query(
                    "UPDATE lovememo_sync_records
                     SET updated_at = $1, deleted = $2, payload = $3, created_at = now()
                     WHERE id = $4",
                )
                .bind(change.updated_at)
                .bind(change.deleted)
                .bind(&change.payload)
                .bind(id)
                .execute(&pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(ErrorResponse {
                            error: format!("更新同步记录失败: {}", e),
                        }),
                    )
                })?;
            }
            None => {
                sqlx::query(
                    "INSERT INTO lovememo_sync_records
                     (user_id, table_name, record_id, updated_at, deleted, payload)
                     VALUES ($1, $2, $3, $4, $5, $6)",
                )
                .bind(user.id)
                .bind(&change.table_name)
                .bind(&change.record_id)
                .bind(change.updated_at)
                .bind(change.deleted)
                .bind(&change.payload)
                .execute(&pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(ErrorResponse {
                            error: format!("插入同步记录失败: {}", e),
                        }),
                    )
                })?;
            }
            _ => {}
        }
    }

    // 2. 返回服务端自 last_sync_at 之后的变化
    let since = req.last_sync_at.unwrap_or_else(|| {
        // 如果没有上次同步时间，返回所有非删除记录（初始同步）
        chrono::DateTime::UNIX_EPOCH.into()
    });

    let changes: Vec<SyncChange> = sqlx::query_as::<_, SyncChange>(
        "SELECT table_name, record_id, updated_at, deleted, payload
         FROM lovememo_sync_records
         WHERE user_id = $1 AND updated_at > $2
         ORDER BY updated_at ASC",
    )
    .bind(user.id)
    .bind(since)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("拉取同步记录失败: {}", e),
            }),
        )
    })?;

    Ok(Json(SyncResponse {
        server_time,
        changes,
    }))
}
