!define PRODUCT_NAME "PH Code Editor"
!define PRODUCT_VERSION "${VERSION}"
!define PRODUCT_PUBLISHER "PHOI"
!define PRODUCT_WEB_SITE "https://github.com/huchangzhi/phoi"
!define UNINSTALL_REGISTRY_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

!define INSTALL_DIR "$PROGRAMFILES\PH Code Editor"
!define DESKTOP_SHORTCUT "$DESKTOP\PH Code Editor.lnk"
!define STARTMENU_DIR "$SMPROGRAMS\PHCode"
!define STARTMENU_SHORTCUT "$STARTMENU_DIR\PH Code Editor.lnk"
!define UNINSTALL_SHORTCUT "$STARTMENU_DIR\卸载 PH Code Editor.lnk"

; ?? 关键修复1: 添加管理员权限请求
RequestExecutionLevel admin

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

; ?? 关键修复2: 设置所有用户上下文
SetShellVarContext all

; 欢迎页面
!insertmacro MUI_PAGE_WELCOME

; 安装目录选择
!insertmacro MUI_PAGE_DIRECTORY

; 安装进度
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"

; ----------------------------------------------------------
; 初始化 - 检测旧版本
; ----------------------------------------------------------
Function .onInit
    ReadRegStr $R0 HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    ReadRegStr $R1 HKLM "${UNINSTALL_REGISTRY_KEY}" "UninstallString"

    IfErrors done_check
    StrCmp $R0 "" done_check 0

    MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "发现已安装版本，是否升级？" IDYES upgrade IDNO no_upgrade
    Abort

    upgrade:
        ExecWait '$R1 /S _?=$INSTDIR'
        Delete "$INSTDIR\phcode.exe"
        RMDir /r "$INSTDIR\templates"
        RMDir /r "$INSTDIR\static"
        RMDir /r "$INSTDIR\w64devkit"
        Goto done_check

    no_upgrade:
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

    ; 复制编译器工具
    SetOutPath "$INSTDIR\w64devkit"
    File /r "w64devkit\*.*"

    ; 复制数据目录
    SetOutPath "$INSTDIR\phcode_data"

    ; ?? 关键修复3: 创建开始菜单目录
    CreateDirectory "$STARTMENU_DIR"
    
    ; ?? 关键修复4: 正确的快捷方式创建语法
    ; 参数: 快捷方式文件 目标文件 参数 图标文件 图标索引 启动选项 键盘快捷键 描述
    CreateShortcut "$STARTMENU_SHORTCUT" "$INSTDIR\phcode.exe" "" "$INSTDIR\phcode.exe" 0 "" "" "PH Code Editor"
    CreateShortcut "$UNINSTALL_SHORTCUT" "$INSTDIR\uninstall.exe" "" "$INSTDIR\phcode.exe" 0 "" "" "卸载 PH Code Editor"
    CreateShortcut "$DESKTOP_SHORTCUT" "$INSTDIR\phcode.exe" "" "$INSTDIR\phcode.exe" 0 "" "" "PH Code Editor"

    ; ?? 关键修复5: 写入注册表信息
    WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayIcon" "$INSTDIR\phcode.exe,0"
    WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString" "$INSTDIR\uninstall.exe /S"
    WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "NoModify" 1
    WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "NoRepair" 1
    WriteRegDWORD HKLM "${UNINSTALL_REGISTRY_KEY}" "EstimatedSize" 100000

    ; 添加卸载程序
    SetOutPath "$INSTDIR"
    WriteUninstaller "$INSTDIR\uninstall.exe"

SectionEnd

; ----------------------------------------------------------
; 卸载部分
; ----------------------------------------------------------
Section "Uninstall"
    ; ?? 关键修复6: 卸载时也需要设置所有用户上下文
    SetShellVarContext all
    
    ; ?? 关键修复7: 从注册表读取安装路径（如果$INSTDIR为空）
    ReadRegStr $INSTDIR HKLM "${UNINSTALL_REGISTRY_KEY}" "InstallLocation"
    StrCmp $INSTDIR "" +2
        StrCpy $INSTDIR "$PROGRAMFILES\PH Code Editor"

    ; 删除主程序文件
    Delete "$INSTDIR\phcode.exe"
    Delete "$INSTDIR\uninstall.exe"

    ; 删除模板、静态文件和编译器工具
    RMDir /r "$INSTDIR\templates"
    RMDir /r "$INSTDIR\static"
    RMDir /r "$INSTDIR\w64devkit"

    ; 询问是否删除用户数据目录
    MessageBox MB_YESNO|MB_ICONQUESTION "是否删除用户数据目录？" IDYES delete_data IDNO keep_data

    delete_data:
        RMDir /r "$INSTDIR\phcode_data"
        Goto shortcuts

    keep_data:
        RMDir "$INSTDIR\phcode_data"

    shortcuts:
        ; ?? 关键修复8: 删除快捷方式（使用绝对路径）
        Delete "$STARTMENU_SHORTCUT"
        Delete "$UNINSTALL_SHORTCUT"
        RMDir "$STARTMENU_DIR"
        Delete "$DESKTOP_SHORTCUT"
        
        ; 也删除所有用户桌面的快捷方式（以防万一）
        Delete "$ALLUSERSPROFILE\Desktop\PH Code Editor.lnk"

        ; 删除注册表项
        DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"

        ; 尝试删除安装目录
        RMDir "$INSTDIR"
SectionEnd