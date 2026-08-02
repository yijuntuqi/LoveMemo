use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

const JWT_SECRET_ENV: &str = "JWT_SECRET";

// 编译时把 Python 脚本嵌入二进制，运行时写入临时文件执行，
// 避免服务端在 target/release 等目录运行时找不到脚本文件。
const WELCOME_EMAIL_PY: &str = include_str!("../send_welcome_email.py");

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub phone: String,
    pub password: String,
    pub email: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub phone: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct UserInfo {
    pub id: Uuid,
    pub phone: String,
    pub email: Option<String>,
    pub membership_type: String,
    pub membership_expires_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

fn jwt_secret() -> String {
    std::env::var(JWT_SECRET_ENV).unwrap_or_else(|_| "change-me".to_string())
}

pub fn create_token(user_id: Uuid) -> anyhow::Result<String> {
    let exp = Utc::now()
        .checked_add_signed(Duration::days(30))
        .expect("valid timestamp")
        .timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret().as_bytes()),
    )
    .map_err(Into::into)
}

pub fn decode_token(token: &str) -> anyhow::Result<Uuid> {
    let token = token.trim_start_matches("Bearer ");
    let validation = Validation::default();
    let decoded = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_bytes()),
        &validation,
    )?;
    Ok(Uuid::parse_str(&decoded.claims.sub)?)
}

fn hash_password(password: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("密码哈希失败: {:?}", e))?;
    Ok(hash.to_string())
}

fn verify_password(password: &str, hash: &str) -> anyhow::Result<bool> {
    let parsed_hash =
        PasswordHash::new(hash).map_err(|e| anyhow::anyhow!("解析密码哈希失败: {:?}", e))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

pub async fn register(
    State(pool): State<PgPool>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<ErrorResponse>)> {
    if req.phone.is_empty() || req.password.len() < 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "手机号不能为空，密码至少 6 位".to_string(),
            }),
        ));
    }

    // 先检查手机号是否已注册
    let existing: Option<String> = sqlx::query_scalar(
        "SELECT phone FROM lovememo_users WHERE phone = $1",
    )
    .bind(&req.phone)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("数据库查询失败: {}", e),
            }),
        )
    })?;

    if existing.is_some() {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                error: "该手机号已注册".to_string(),
            }),
        ));
    }

    let password_hash = hash_password(&req.password).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("密码加密失败: {}", e),
            }),
        )
    })?;

    let email_val = req.email.as_deref().filter(|e| !e.is_empty());

    let user: UserInfo = sqlx::query_as::<_, UserInfo>(
        "INSERT INTO lovememo_users (phone, email, password_hash) VALUES ($1, $2, $3)
         RETURNING id, phone, email, membership_type, membership_expires_at",
    )
    .bind(&req.phone)
    .bind(email_val)
    .bind(&password_hash)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("创建用户失败: {}", e),
            }),
        )
    })?;

    let token = create_token(user.id).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("生成 Token 失败: {}", e),
            }),
        )
    })?;

    // 如果用户填写了邮箱，异步调用 Python 脚本发送欢迎邮件
    if let Some(email) = user.email.clone() {
        let phone = user.phone.clone();
        tokio::spawn(async move {
            // 将嵌入的 Python 脚本写入临时文件，再执行
            // 用进程 PID 固定文件名，避免每次注册都写一遍
            let temp_dir = std::env::temp_dir();
            let script_path = temp_dir.join(format!(
                "lovememo_send_welcome_email_{}.py",
                std::process::id()
            ));
            if let Err(e) = std::fs::write(&script_path, WELCOME_EMAIL_PY) {
                tracing::error!("写入临时邮件脚本失败: {}", e);
                return;
            }

            let result = tokio::process::Command::new("python")
                .arg(&script_path)
                .arg(&email)
                .arg(&phone)
                .output()
                .await;

            // 执行完删除临时脚本（失败也无所谓）
            let _ = std::fs::remove_file(&script_path);

            match result {
                Ok(output) if output.status.success() => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    tracing::info!("欢迎邮件已通过 Python 脚本发送至 {} ({})", email, stdout.trim());
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    tracing::error!(
                        "欢迎邮件发送失败 (Python): stderr={}, stdout={}",
                        stderr.trim(),
                        stdout.trim()
                    );
                }
                Err(e) => {
                    tracing::error!("调用 Python 邮件脚本失败: {}", e);
                }
            }
        });
    }

    Ok(Json(AuthResponse { token, user }))
}

pub async fn login(
    State(pool): State<PgPool>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<ErrorResponse>)> {
    let user: UserInfo = sqlx::query_as::<_, UserInfo>(
        "SELECT id, phone, email, membership_type, membership_expires_at FROM lovememo_users WHERE phone = $1",
    )
    .bind(&req.phone)
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
        StatusCode::UNAUTHORIZED,
        Json(ErrorResponse {
            error: "手机号或密码错误".to_string(),
        }),
    ))?;

    let stored_hash: String = sqlx::query_scalar("SELECT password_hash FROM lovememo_users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("数据库错误: {}", e),
                }),
            )
        })?;

    if !verify_password(&req.password, &stored_hash).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("密码校验失败: {}", e),
            }),
        )
    })? {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "手机号或密码错误".to_string(),
            }),
        ));
    }

    let token = create_token(user.id).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("生成 Token 失败: {}", e),
            }),
        )
    })?;

    Ok(Json(AuthResponse { token, user }))
}

pub async fn me(
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
) -> Result<Json<UserInfo>, (StatusCode, Json<ErrorResponse>)> {
    let user = auth_from_header(&headers, &pool).await?;
    Ok(Json(user))
}

pub async fn auth_from_header(
    headers: &axum::http::HeaderMap,
    pool: &PgPool,
) -> Result<UserInfo, (StatusCode, Json<ErrorResponse>)> {
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

    let user: UserInfo = sqlx::query_as::<_, UserInfo>(
        "SELECT id, phone, email, membership_type, membership_expires_at FROM lovememo_users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("数据库错误: {}", e),
            }),
        )
    })?;

    Ok(user)
}

pub async fn require_premium(
    headers: &axum::http::HeaderMap,
    pool: &PgPool,
) -> Result<UserInfo, (StatusCode, Json<ErrorResponse>)> {
    let user = auth_from_header(headers, pool).await?;

    if user.membership_type != "premium" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "该功能需要会员权限".to_string(),
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

    Ok(user)
}
