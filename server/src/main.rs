mod ai;
mod auth;
mod db;
mod email;
mod map;
mod membership;
mod sync;

use axum::{
    routing::{get, post},
    Router,
};
use sqlx::PgPool;
use std::env;
use tower_http::cors::{Any, CorsLayer};
#[cfg(not(feature = "shuttle"))]
use tracing::info;

fn build_router(pool: PgPool) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health))
        .route("/auth/register", post(auth::register))
        .route("/auth/login", post(auth::login))
        .route("/auth/me", get(auth::me))
        .route("/sync", post(sync::sync))
        .route("/ai/polish", post(ai::polish))
        .route("/map/geocode", get(map::geocode))
        .route("/membership/activate", post(membership::activate))
        .layer(cors)
        .with_state(pool)
}

async fn health() -> &'static str {
    "ok"
}

async fn init_pool() -> anyhow::Result<PgPool> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

// Shuttle 部署：shuttle deploy 时自动启用 shuttle feature
#[cfg(feature = "shuttle")]
#[shuttle_runtime::main]
async fn main() -> shuttle_axum::ShuttleAxum {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();
    let pool = init_pool().await?;
    let app = build_router(pool);
    Ok(app.into())
}

// 本地运行：cargo run 或 cargo build --release 后运行 exe
#[cfg(not(feature = "shuttle"))]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();
    let pool = init_pool().await?;
    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let app = build_router(pool);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("LoveMemo server listening on {}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}
