// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

// 编译时嵌入后端 .env 配置（文件在 .gitignore 中，不会提交 git）
const SERVER_ENV: &str = include_str!("../../server/.env");

/// 解析 .env 文件内容为 (key, value) 键值对
fn parse_env_file(contents: &str) -> Vec<(String, String)> {
    let mut vars = Vec::new();
    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim().to_string();
            let value = value
                .trim()
                .trim_matches('\'')
                .trim_matches('"')
                .to_string();
            if !key.is_empty() {
                vars.push((key, value));
            }
        }
    }
    vars
}

/// 持有 sidecar 子进程句柄，用于应用退出时清理
struct SidecarChild(std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

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

#[tauri::command]
async fn save_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| format!("写入文件失败: {}", e))
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
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            import_media,
            get_app_data_dir,
            save_text_file,
            read_text_file,
            save_binary_file,
            geocode_address
        ])
        .setup(|app| {
            // 启动后端 sidecar
            match app.shell().sidecar("lovememo-server") {
                Ok(command) => {
                    // 从嵌入的 .env 设置环境变量
                    let mut cmd = command;
                    for (key, value) in parse_env_file(SERVER_ENV) {
                        cmd = cmd.env(key, value);
                    }
                    // 确保后端监听 3000 端口
                    cmd = cmd.env("PORT", "3000");

                    match cmd.spawn() {
                        Ok((mut rx, child)) => {
                            app.manage(SidecarChild(std::sync::Mutex::new(Some(child))));

                            // 异步打印后端日志（方便调试）
                            tauri::async_runtime::spawn(async move {
                                while let Some(event) = rx.recv().await {
                                    match event {
                                        CommandEvent::Stdout(line) => {
                                            eprintln!("[server] {}", String::from_utf8_lossy(&line));
                                        }
                                        CommandEvent::Stderr(line) => {
                                            eprintln!("[server] {}", String::from_utf8_lossy(&line));
                                        }
                                        CommandEvent::Error(err) => {
                                            eprintln!("[server] error: {}", err);
                                        }
                                        CommandEvent::Terminated(_) => {
                                            eprintln!("[server] terminated");
                                            break;
                                        }
                                        _ => {}
                                    }
                                }
                            });
                        }
                        Err(e) => {
                            eprintln!("启动后端 sidecar 失败: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("找不到后端 sidecar 二进制: {}", e);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        // 应用退出时终止后端 sidecar
        if let tauri::RunEvent::Exit = event {
            if let Some(sidecar) = app_handle.try_state::<SidecarChild>() {
                if let Ok(mut guard) = sidecar.0.lock() {
                    if let Some(child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}
