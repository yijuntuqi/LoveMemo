// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use std::path::PathBuf;
use tauri::Manager;

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))
}

#[tauri::command]
async fn import_media(
    app: tauri::AppHandle,
    source_path: String,
    target_dir: Option<String>,
) -> Result<String, String> {
    let media_dir = match target_dir {
        Some(dir) if !dir.trim().is_empty() => PathBuf::from(dir.trim()),
        _ => {
            let data_dir = app_data_dir(&app)?;
            data_dir.join("media")
        }
    };
    std::fs::create_dir_all(&media_dir).map_err(|e| format!("创建媒体目录失败: {}", e))?;

    let source = PathBuf::from(&source_path);
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let filename = format!("{}.{}", uuid::Uuid::new_v4(), ext);
    let target = media_dir.join(&filename);

    std::fs::copy(&source, &target).map_err(|e| format!("复制文件失败: {}", e))?;

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    Ok(app_data_dir(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
async fn save_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("写入文件失败: {}", e))
}

#[tauri::command]
async fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

#[derive(serde::Serialize)]
struct LocationResult {
    name: String,
    display_name: String,
    latitude: f64,
    longitude: f64,
}

#[tauri::command]
async fn geocode_address(address: String, key: String) -> Result<Vec<LocationResult>, String> {
    if address.trim().is_empty() {
        return Ok(vec![]);
    }
    if key.trim().is_empty() {
        return Err("未配置高德地图 Key".to_string());
    }

    let url = format!(
        "https://restapi.amap.com/v3/geocode/geo?key={}&address={}&output=JSON",
        urlencoding::encode(&key),
        urlencoding::encode(&address)
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("地点搜索请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("地点搜索请求失败: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析高德响应失败: {}", e))?;

    if data["status"].as_str() != Some("1") {
        let info = data["info"].as_str().unwrap_or("未知错误");
        return Err(format!("高德搜索失败: {}", info));
    }

    let geocodes = data["geocodes"].as_array().ok_or("高德响应格式异常")?;
    let mut results = Vec::new();
    for item in geocodes {
        let location = item["location"].as_str();
        if location.is_none() {
            continue;
        }
        let parts: Vec<&str> = location.unwrap().split(',').collect();
        if parts.len() != 2 {
            continue;
        }
        let lng: f64 = parts[0].trim().parse().map_err(|_| "坐标解析失败")?;
        let lat: f64 = parts[1].trim().parse().map_err(|_| "坐标解析失败")?;
        let name = item["name"].as_str().unwrap_or(&address).to_string();
        let display_name = item["formatted_address"]
            .as_str()
            .unwrap_or(&name)
            .to_string();
        results.push(LocationResult {
            name,
            display_name,
            latitude: lat,
            longitude: lng,
        });
    }

    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            import_media,
            get_app_data_dir,
            save_text_file,
            read_text_file,
            geocode_address
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
