use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;

use crate::auth::ErrorResponse;

fn is_latin(c: char) -> bool {
    // 简单判断：非中文、非日文、非韩文常见字符视为 latin/国际地址
    !matches!(c as u32, 0x4E00..=0x9FFF | 0x3040..=0x309F | 0x30A0..=0x30FF | 0xAC00..=0xD7AF)
}

fn looks_like_international(address: &str) -> bool {
    address.chars().any(|c| c.is_alphabetic() && is_latin(c))
}

#[derive(Deserialize)]
pub struct GeocodeQuery {
    pub address: String,
}

#[derive(Serialize)]
pub struct GeocodeResult {
    pub name: String,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Serialize)]
pub struct GeocodeResponse {
    pub results: Vec<GeocodeResult>,
}

pub async fn geocode(
    State(_pool): State<PgPool>,
    Query(query): Query<GeocodeQuery>,
) -> Result<Json<GeocodeResponse>, (StatusCode, Json<ErrorResponse>)> {
    let key = std::env::var("AMAP_KEY").unwrap_or_default();

    if query.address.trim().is_empty() {
        return Ok(Json(GeocodeResponse { results: vec![] }));
    }

    let mut results = Vec::new();

    // 国际地址使用 Nominatim（OpenStreetMap）
    if looks_like_international(&query.address) {
        match geocode_nominatim(&query.address).await {
            Ok(r) => results.extend(r),
            Err(_) => {} // 国际源失败不阻断，继续尝试高德
        }
    }

    // 高德搜索（国内为主，但也能搜部分国际地址）
    if !key.is_empty() {
        match geocode_amap(&key, &query.address).await {
            Ok(r) => {
                // 去重：高德和国际源可能有重复
                for item in r {
                    let dup = results.iter().any(|e: &GeocodeResult| {
                        (e.latitude - item.latitude).abs() < 0.01
                            && (e.longitude - item.longitude).abs() < 0.01
                    });
                    if !dup {
                        results.push(item);
                    }
                }
            }
            Err(e) => {
                // 高德也失败时，如果国际源没结果才报错
                if results.is_empty() {
                    return Err(e);
                }
            }
        }
    }

    // 如果高德没配 key 且国际源也没结果
    if results.is_empty() && key.is_empty() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse {
                error: "地图服务未配置".to_string(),
            }),
        ));
    }

    Ok(Json(GeocodeResponse { results }))
}

async fn geocode_amap(
    key: &str,
    address: &str,
) -> Result<Vec<GeocodeResult>, (StatusCode, Json<ErrorResponse>)> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://restapi.amap.com/v3/geocode/geo")
        .query(&[("key", key), ("address", address.trim()), ("output", "JSON")])
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: format!("地图请求失败: {}", e),
                }),
            )
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("地图服务错误 ({}): {}", status, body),
            }),
        ));
    }

    let data: Value = response.json().await.map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("解析地图响应失败: {}", e),
            }),
        )
    })?;

    let mut results = Vec::new();
    if let Some(geocodes) = data.get("geocodes").and_then(|g| g.as_array()) {
        for item in geocodes {
            let location = item.get("location").and_then(|l| l.as_str()).unwrap_or("");
            let parts: Vec<&str> = location.split(',').collect();
            if parts.len() != 2 {
                continue;
            }
            let lng: f64 = parts[0].parse().unwrap_or(0.0);
            let lat: f64 = parts[1].parse().unwrap_or(0.0);
            if lat == 0.0 && lng == 0.0 {
                continue;
            }

            let name = item
                .get("formatted_address")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            results.push(GeocodeResult {
                name: name.clone(),
                address: name,
                latitude: lat,
                longitude: lng,
            });
        }
    }

    Ok(results)
}

async fn geocode_nominatim(
    address: &str,
) -> Result<Vec<GeocodeResult>, (StatusCode, Json<ErrorResponse>)> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.mirror-earth.com/nominatim/search")
        .query(&[
            ("q", address.trim()),
            ("format", "json"),
            ("limit", "5"),
            ("addressdetails", "0"),
            ("accept-language", "zh-CN"),
        ])
        .header("User-Agent", "LoveMemo/0.1")
        .header("Accept-Charset", "utf-8")
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: format!("国际地图请求失败: {}", e),
                }),
            )
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("国际地图服务错误 ({}): {}", status, body),
            }),
        ));
    }

    let body_bytes = response.bytes().await.map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("读取国际地图响应失败: {}", e),
            }),
        )
    })?;
    // 镜像地球返回 UTF-8，但 header 可能缺失；强制按 UTF-8 解析
    let body_text = String::from_utf8_lossy(&body_bytes);
    let data: Value = serde_json::from_str(&body_text).map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("解析国际地图响应失败: {}", e),
            }),
        )
    })?;

    let mut results = Vec::new();
    if let Some(items) = data.as_array() {
        for item in items {
            let lat = item.get("lat").and_then(|v| v.as_str()).unwrap_or("").parse::<f64>().unwrap_or(0.0);
            let lon = item.get("lon").and_then(|v| v.as_str()).unwrap_or("").parse::<f64>().unwrap_or(0.0);
            if lat == 0.0 && lon == 0.0 {
                continue;
            }
            let name = item
                .get("display_name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            results.push(GeocodeResult {
                name: name.clone(),
                address: name,
                latitude: lat,
                longitude: lon,
            });
        }
    }

    Ok(results)
}
