!define PRODUCT_NAME "PH Code Editor"
!define PRODUCT_VERSION "${VERSION}"
!define PRODUCT_PUBLISHER "PHOI"
!define PRODUCT_WEB_SITE "https://github.com/huchangzhi/phoi"

!define INSTALL_DIR "$PROGRAMFILES\PH Code Editor"
!define UNINSTALL_DIR "$PROGRAMFILES\PH Code Editor"
!define DESKTOP_SHORTCUT "${DESKTOP}\PH Code Editor.lnk"
!define STARTMENU_SHORTCUT "$SMPROGRAMS\PH Code Editor.lnk"

; MUI 界面配置
!include "MUI2.nsh"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "phcode-installer-${VERSION}.exe"
InstallDir "${INSTALL_DIR}"
ShowInstDetails show

; 界面样式
!define MUI_ABORTWARNING
!define MUI_ICON "static\logo.ico"
!define MUI_UNICON "static\logo.ico"

; 欢迎页面
!insertmacro MUI_PAGE_WELCOME

; 许可协议（可选）
;!insertmacro MUI_PAGE_LICENSE "LICENSE"

; 安装目录选择
    !insertmacro MUI_PAGE_DIRECTORY

; 安装进度
    !insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese" ; 支持简体中文

; ----------------------------------------------------------
; 安装部分
; ----------------------------------------------------------
Section "PH Code Editor" SecMain
    SetOutPath "$INSTDIR"

    ; 复制主程序
    File "dist\phcode.exe"

    ; 复制模板文件
    SetOutPath "$INSTDIR\templates"
    File /r "templates\*.*"

    ; 复制静态文件
    SetOutPath "$INSTDIR\static"
    File /r "static\*.*"

    ; 复制编译器工具（w64devkit）
    SetOutPath "$INSTDIR\w64devkit"
    File /r "w64devkit\*.*"

    ; 复制数据目录
    SetOutPath "$INSTDIR\phcode_data"

    ; 创建开始菜单快捷方式
    CreateDirectory "$SMPROGRAMS\PHOI"
    CreateShortcut "$STARTMENU_SHORTCUT" "$INSTDIR\phcode.exe" "" "$INSTDIR\phcode.exe" 0
    CreateShortcut "$SMPROGRAMS\PHOI\卸载 PH Code Editor.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\phcode.exe" 0

    ; 创建桌面快捷方式
    CreateShortcut "$DESKTOP_SHORTCUT" "$INSTDIR\phcode.exe" "" "$INSTDIR\phcode.exe" 0

    ; 写入注册表信息（用于卸载）
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "DisplayIcon" "$INSTDIR\phcode.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "NoModify" 1
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "NoRepair" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "EstimatedSize" 100000

    ; 添加卸载程序
    SetOutPath "$INSTDIR"
    WriteUninstaller "$INSTDIR\uninstall.exe"

SectionEnd

; ----------------------------------------------------------
; 卸载部分
; ----------------------------------------------------------
Section "Uninstall"
    ; 删除文件
    Delete "$INSTDIR\phcode.exe"
    Delete /REBOOTOK "$INSTDIR\phcode.exe"
    RMDir /r /REBOOTOK "$INSTDIR\templates"
    RMDir /r /REBOOTOK "$INSTDIR\static"
    RMDir /r /REBOOTOK "$INSTDIR\w64devkit"
    RMDir /r /REBOOTOK "$INSTDIR\phcode_data"

    ; 删除快捷方式
    Delete "$STARTMENU_SHORTCUT"
    Delete "$SMPROGRAMS\PHOI\PH Code Editor.lnk"
    Delete "$SMPROGRAMS\PHOI\卸载 PH Code Editor.lnk"
    RMDir /r /REBOOTOK "$SMPROGRAMS\PHOI"

    Delete "$DESKTOP_SHORTCUT"

    ; 删除注册表项
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

    ; 删除安装目录
    RMDir /r "$INSTDIR"
SectionEnd