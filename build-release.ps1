# LoveMemo 一键 Release 打包脚本
# 运行后会生成：
#   - 后端可执行文件：server/target/release/lovememo-server.exe
#   - 前端可执行文件：src-tauri/target/release/lovememo.exe
# 用法：以管理员身份打开 PowerShell，执行：
#   E:\old-new\backup\BNU_leaning\LoveMemo\build-release.ps1

param(
    [switch]$SkipServer = $false,
    [switch]$SkipClient = $false
)

$ErrorActionPreference = "Stop"
$root = "E:\old-new\backup\BNU_leaning\LoveMemo"

# 禁用增量编译的 hard-link 优化，避免某些文件系统报错并减少警告
$env:CARGO_INCREMENTAL = "0"

function Step-Header($msg) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $msg -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Stop-LoveMemoProcesses() {
    Get-Process | Where-Object {
        $_.ProcessName -eq "lovememo-server" -or $_.ProcessName -eq "lovememo"
    } | ForEach-Object {
        Write-Host "正在停止占用中的进程：$($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Yellow
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

Stop-LoveMemoProcesses

if (-not $SkipServer) {
    Step-Header "1/2 构建后端（Release）"
    Push-Location "$root\server"
    cargo build --release
    Pop-Location
    Write-Host "后端构建完成：$root\server\target\release\lovememo-server.exe" -ForegroundColor Green
}

if (-not $SkipClient) {
    Step-Header "2/2 构建前端桌面端（Release）"
    Push-Location $root
    npm.cmd install
    npm.cmd run tauri build
    Pop-Location
    Write-Host "前端构建完成：$root\src-tauri\target\release\lovememo.exe" -ForegroundColor Green
}

Step-Header "构建完成"
Write-Host "手动启动服务： $root\server\target\release\lovememo-server.exe" -ForegroundColor Yellow
Write-Host "手动启动客户端： $root\src-tauri\target\release\lovememo.exe" -ForegroundColor Yellow
