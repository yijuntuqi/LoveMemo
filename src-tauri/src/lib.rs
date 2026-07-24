// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::path::PathBuf;
use tauri::Manager;

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))
}

#[tauri::command]
async fn import_media(app: tauri::AppHandle, source_path: String) -> Result<String, String> {
    let data_dir = app_data_dir(&app)?;
    let media_dir = data_dir.join("media");
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            import_media,
            get_app_data_dir,
            save_text_file,
            read_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
