!macro NSIS_HOOK_POSTINSTALL
  ; Microsoft Store 验证三项关键注册表字段补全
  ; Tauri 2 默认模板只写 UninstallString，没写 QuietUninstallString / Publisher / DisplayIcon
  ; 这里在默认写入之后覆盖 DisplayName、Publisher，并补全 QuietUninstallString
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LoveMemo" "DisplayName" "LoveMemo 恋爱纪念册"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LoveMemo" "Publisher" "张异"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LoveMemo" "DisplayIcon" '"$INSTDIR\LoveMemo.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LoveMemo" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LoveMemo" "URLInfoAbout" "https://github.com/yijuntuqi/LoveMemo"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LoveMemo" "HelpLink" "support@lovememo.app"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LoveMemo" "NoModify" "1"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LoveMemo" "NoRepair" "1"
!macroend
