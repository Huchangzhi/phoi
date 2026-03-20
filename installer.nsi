!define PRODUCT_NAME "PH Code Editor"
!define PRODUCT_VERSION "${VERSION}"
!define PRODUCT_PUBLISHER "PHOI"
!define PRODUCT_WEB_SITE "https://github.com/huchangzhi/phoi"

!define INSTALL_DIR "$PROGRAMFILES\PH Code Editor"
!define UNINSTALL_DIR "$PROGRAMFILES\PH Code Editor"
!define DESKTOP_SHORTCUT "$DESKTOP\PH Code Editor.lnk"
!define STARTMENU_DIR "$SMPROGRAMS\PHOI"
!define STARTMENU_SHORTCUT "$STARTMENU_DIR\PH Code Editor.lnk"
!define UNINSTALL_SHORTCUT "$STARTMENU_DIR\卸载 PH Code Editor.lnk"

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
; 检测旧版本
; ----------------------------------------------------------
Function .onInit
    ; 读取注册表中的旧版本信息
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion"
    ReadRegStr $R1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString"

    ; 如果检测到旧版本
    IfErrors done_check
    StrCmp $R0 "" done_check 0

    ; 检测到已安装版本
    MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "Found installed version $R0 Upgrade now $\n Yes Upgrade $\n No Overwrite $\n Cancel Exit" IDYES upgrade IDNO no_upgrade IDCANCEL done_check

    upgrade:
        ; 询问是否先卸载旧版本
        MessageBox MB_YESNO|MB_ICONQUESTION "Upgrade mode Suggest uninstall old version first Uninstall now" IDYES do_uninstall IDNO do_upgrade

    do_uninstall:
        ; 执行卸载程序
        ExecWait '$R1 /S _?=$INSTDIR'
        ; 删除旧的安装目录（保留phcode_data）
        Delete "$INSTDIR\phcode.exe"
        RMDir /r "$INSTDIR\templates"
        RMDir /r "$INSTDIR\static"
        RMDir /r "$INSTDIR\w64devkit"
        Goto do_upgrade

    no_upgrade:
        MessageBox MB_OK|MB_ICONWARNING "Overwrite mode This may delete all existing data"
        Goto do_upgrade

    do_upgrade:
        ; 升级模式：保留phcode_data目录
        Goto done_check

    done_check:
FunctionEnd

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
    CreateDirectory "$STARTMENU_DIR"
    CreateShortcut "$STARTMENU_SHORTCUT" "$INSTDIR\phcode.exe" "" "$INSTDIR\phcode.exe" 0
    CreateShortcut "$UNINSTALL_SHORTCUT" "$INSTDIR\uninstall.exe" "" "$INSTDIR\phcode.exe" 0

    ; 创建桌面快捷方式
    CreateShortcut "$DESKTOP_SHORTCUT" "$INSTDIR\phcode.exe" "" "$INSTDIR\phcode.exe" 0

    ; 写入注册表信息（用于卸载）
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayIcon" "$INSTDIR\phcode.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "NoModify" 1
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "NoRepair" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "EstimatedSize" 100000

    ; 添加卸载程序
    SetOutPath "$INSTDIR"
    WriteUninstaller "$INSTDIR\uninstall.exe"

SectionEnd

; ----------------------------------------------------------
; 卸载部分
; ----------------------------------------------------------
Section "Uninstall"
    ; 删除主程序文件
    Delete "$INSTDIR\phcode.exe"
    Delete "$INSTDIR\uninstall.exe"

    ; 删除模板、静态文件和编译器工具
    RMDir /r "$INSTDIR\templates"
    RMDir /r "$INSTDIR\static"
    RMDir /r "$INSTDIR\w64devkit"

    ; 询问是否删除用户数据目录
    MessageBox MB_YESNO|MB_ICONQUESTION "Delete user data directory Contains user settings and files Select No to keep" IDYES delete_data IDNO keep_data

    delete_data:
        RMDir /r "$INSTDIR\phcode_data"
        Goto shortcuts

    keep_data:
        ; 保留用户数据目录，只删除空目录
        RMDir "$INSTDIR\phcode_data"

    shortcuts:
        ; 删除快捷方式
        Delete "$STARTMENU_SHORTCUT"
        Delete "$UNINSTALL_SHORTCUT"
        RMDir "$STARTMENU_DIR"
        Delete "$DESKTOP_SHORTCUT"

        ; 删除注册表项
        DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

        ; 尝试删除安装目录（如果是空的）
        RMDir "$INSTDIR"
SectionEnd