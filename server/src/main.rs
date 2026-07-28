mod ai;
mod auth;
mod db;
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
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;

    // 运行 migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/auth/register", post(auth::register))
        .route("/auth/login", post(auth::login))
        .route("/auth/me", get(auth::me))
        .route("/sync", post(sync::sync))
        .route("/ai/polish", post(ai::polish))
        .route("/map/geocode", get(map::geocode))
        .route("/membership/activate", post(membership::activate))
        .layer(cors)
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("LoveMemo server listening on {}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health() -> &'static str {
    "ok"
}
