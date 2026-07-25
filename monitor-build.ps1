$logPath = ''E:\old-new\backup\BNU_leaning\LoveMemo\build-release.log''
$exePath = ''E:\old-new\backup\BNU_leaning\LoveMemo\src-tauri\target\release\lovememo.exe''
$resultPath = ''E:\old-new\backup\BNU_leaning\LoveMemo\monitor-result.txt''
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add(''开始监控 cargo/rustc 进程...'')
while ($true) {
    $proc = Get-Process -Name cargo,rustc -ErrorAction SilentlyContinue
    if (-not $proc) { break }
    $names = ($proc | Select-Object -ExpandProperty Name -Unique) -join '', ''
    $count = @($proc).Count
    $lines.Add("$(Get-Date -Format ''HH:mm:ss'') 仍在运行: $names ($count 个进程)")
    Start-Sleep -Seconds 20
}
$lines.Add("$(Get-Date -Format ''HH:mm:ss'') cargo/rustc 进程已全部结束。")
$logTail = if (Test-Path $logPath) { Get-Content $logPath -Tail 30 } else { $null }
if ($logTail) {
    $lines.Add(''--- build-release.log 最后 30 行 ---'')
    $lines.AddRange([string[]]$logTail)
} else {
    $lines.Add("未找到日志: $logPath")
}
$exeExists = Test-Path $exePath
$lines.Add("exe 存在: $exeExists")
$tailText = ($logTail) -join "`n"
$hasFinished = $tailText -match ''Finished release''
$hasError = $tailText -match ''error[\s:]''
$keyErrors = ''''
if ($hasError) {
    $status = ''失败''
    $keyErrors = ($logTail | Select-String -Pattern ''error[\s:]'' | Select-Object -Last 5 | ForEach-Object { $_.Line }) -join "`n"
} elseif ($exeExists -and $hasFinished) {
    $status = ''成功''
} elseif ($exeExists) {
    $status = ''成功（exe 已存在）''
} else {
    $status = ''失败''
}
$lines.Add("结论: $status")
if ($keyErrors) { $lines.Add(''关键错误信息:''); $lines.Add($keyErrors) }
$lines | Out-File -FilePath $resultPath -Encoding utf8
