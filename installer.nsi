; ============================================================
; PH Code Editor 安装脚本
; 支持：新用户可选路径 / 旧用户路径只读
; ============================================================

!define PRODUCT_NAME "PH Code Editor"
!define PRODUCT_VERSION "${VERSION}"
!define PRODUCT_PUBLISHER "PHOI"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\PHCodeEditor"
!define DEFAULT_INSTALL_DIR "$PROGRAMFILES\PH Code Editor"

; 管理员权限
RequestExecutionLevel admin

!include "MUI2.nsh"
!include "LogicLib.nsh"

Name "${PRODUCT_NAME}"
OutFile "phcode-installer-${VERSION}.exe"
InstallDir "${DEFAULT_INSTALL_DIR}"
ShowInstDetails show

!define MUI_ABORTWARNING
!define MUI_ICON "static\logo.ico"
!define MUI_UNICON "static\logo.ico"

; 页面
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_PRE DirPre
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"

; 全局变量
Var OldVersion
Var OldInstallDir
Var IsUpgrade

; ============================================================
; 初始化：检测旧版本
; ============================================================
Function .onInit
    SetShellVarContext all
    
    ; 默认不是升级
    StrCpy $IsUpgrade 0
    
    ; 读取旧版本信息
    ReadRegStr $OldVersion HKLM "${UNINSTALL_KEY}" "DisplayVersion"
    ReadRegStr $OldInstallDir HKLM "${UNINSTALL_KEY}" "InstallLocation"
    
    ; 检测到旧版本
    ${If} $OldInstallDir != ""
        StrCpy $IsUpgrade 1
        StrCpy $INSTDIR $OldInstallDir
    ${EndIf}
FunctionEnd

; ============================================================
; 目录页面预处理：旧版本路径只读
; ============================================================
Function DirPre
    ${If} $IsUpgrade == 1
        ; 获取目录页面输入框控件 ID
        FindWindow $R0 "#32770" "" $HWNDPARENT
        GetDlgItem $R0 $R0 1019
        ; 设置为只读
        EnableWindow $R0 0
    ${EndIf}
FunctionEnd

; ============================================================
; 安装
; ============================================================
Section "PH Code Editor"
    SetShellVarContext all
    SetOutPath "$INSTDIR"
    
    ; 升级时先清理旧文件（保留用户数据）
    ${If} $IsUpgrade == 1
        Delete "$INSTDIR\phcode.exe"
        RMDir /r "$INSTDIR\templates"
        RMDir /r "$INSTDIR\static"
        RMDir /r "$INSTDIR\w64devkit"
    ${EndIf}
    
    ; 复制文件
    File "dist\phcode.exe"
    
    SetOutPath "$INSTDIR\templates"
    File /r "templates\*.*"
    
    SetOutPath "$INSTDIR\static"
    File /r "static\*.*"
    
    SetOutPath "$INSTDIR\w64devkit"
    File /r "w64devkit\*.*"
    
    SetOutPath "$INSTDIR"
    
    ; 创建快捷方式
    CreateDirectory "$SMPROGRAMS\PHCode"
    CreateShortcut "$SMPROGRAMS\PHCode\PH Code Editor.lnk" "$INSTDIR\phcode.exe"
    CreateShortcut "$SMPROGRAMS\PHCode\卸载.lnk" "$INSTDIR\uninstall.exe"
    CreateShortcut "$DESKTOP\PH Code Editor.lnk" "$INSTDIR\phcode.exe"
    
    ; 写入卸载程序
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    ; 注册表
    WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKLM "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
    WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\phcode.exe,0"
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair" 1
    WriteRegDWORD HKLM "${UNINSTALL_KEY}" "EstimatedSize" 100000
    
SectionEnd

; ============================================================
; 卸载初始化
; ============================================================
Function un.onInit
    SetShellVarContext all
    
    ReadRegStr $INSTDIR HKLM "${UNINSTALL_KEY}" "InstallLocation"
    ${If} $INSTDIR == ""
        StrCpy $INSTDIR "${DEFAULT_INSTALL_DIR}"
    ${EndIf}
FunctionEnd

; ============================================================
; 卸载
; ============================================================
Section "Uninstall"
    SetShellVarContext all
    
    ; 询问是否保留用户数据
    MessageBox MB_YESNO|MB_ICONQUESTION "是否删除用户数据目录？" IDYES del_data IDNO keep_data
    
    del_
        RMDir /r "$INSTDIR\phcode_data"
        Goto cont
        
    keep_
        ; 保留
    
    cont:
        ; 删除快捷方式
        Delete "$SMPROGRAMS\PHCode\PH Code Editor.lnk"
        Delete "$SMPROGRAMS\PHCode\卸载.lnk"
        RMDir "$SMPROGRAMS\PHCode"
        Delete "$DESKTOP\PH Code Editor.lnk"
        
        ; 删除文件
        Delete "$INSTDIR\phcode.exe"
        Delete "$INSTDIR\uninstall.exe"
        RMDir /r "$INSTDIR\templates"
        RMDir /r "$INSTDIR\static"
        RMDir /r "$INSTDIR\w64devkit"
        RMDir "$INSTDIR"
        
        ; 删除注册表
        DeleteRegKey HKLM "${UNINSTALL_KEY}"
        
SectionEnd