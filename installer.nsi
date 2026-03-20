; ============================================================
; PH Code Editor 安装脚本
; ============================================================

!define PRODUCT_NAME "PH Code Editor"
!define PRODUCT_VERSION "${VERSION}"
!define PRODUCT_PUBLISHER "PHOI"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\PHCodeEditor"
!define DEFAULT_INSTALL_DIR "$PROGRAMFILES\PH Code Editor"

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

!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_PRE DirPre
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"

Var OldInstallDir
Var IsUpgrade

; ============================================================
; 初始化
; ============================================================
Function .onInit
    SetShellVarContext all
    StrCpy $IsUpgrade 0
    
    ReadRegStr $OldInstallDir HKLM "${UNINSTALL_KEY}" "InstallLocation"
    
    ${If} $OldInstallDir != ""
        StrCpy $IsUpgrade 1
        StrCpy $INSTDIR $OldInstallDir
    ${EndIf}
FunctionEnd

; ============================================================
; 目录页面：旧版本路径只读
; ============================================================
Function DirPre
    ${If} $IsUpgrade == 1
        FindWindow $R0 "#32770" "" $HWNDPARENT
        GetDlgItem $R0 $R0 1019
        EnableWindow $R0 0
    ${EndIf}
FunctionEnd

; ============================================================
; 安装
; ============================================================
Section "PH Code Editor"
    SetShellVarContext all
    SetOutPath "$INSTDIR"
    
    ${If} $IsUpgrade == 1
        Delete "$INSTDIR\phcode.exe"
        RMDir /r "$INSTDIR\templates"
        RMDir /r "$INSTDIR\static"
        RMDir /r "$INSTDIR\w64devkit"
    ${EndIf}
    
    File "dist\phcode.exe"
    
    SetOutPath "$INSTDIR\templates"
    File /r "templates\*.*"
    
    SetOutPath "$INSTDIR\static"
    File /r "static\*.*"
    
    SetOutPath "$INSTDIR\w64devkit"
    File /r "w64devkit\*.*"
    
    SetOutPath "$INSTDIR"
    
    CreateDirectory "$SMPROGRAMS\PHCode"
    CreateShortcut "$SMPROGRAMS\PHCode\PH Code Editor.lnk" "$INSTDIR\phcode.exe"
    CreateShortcut "$SMPROGRAMS\PHCode\卸载.lnk" "$INSTDIR\uninstall.exe"
    CreateShortcut "$DESKTOP\PH Code Editor.lnk" "$INSTDIR\phcode.exe"
    
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
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
    
    MessageBox MB_YESNO|MB_ICONQUESTION "是否删除用户数据目录？" IDYES del_data IDNO keep_data
    
    del_data:
        RMDir /r "$INSTDIR\phcode_data"
        Goto cont
        
    keep_data:
        ; 保留用户数据
    
    cont:
        Delete "$SMPROGRAMS\PHCode\PH Code Editor.lnk"
        Delete "$SMPROGRAMS\PHCode\卸载.lnk"
        RMDir "$SMPROGRAMS\PHCode"
        Delete "$DESKTOP\PH Code Editor.lnk"
        
        Delete "$INSTDIR\phcode.exe"
        Delete "$INSTDIR\uninstall.exe"
        RMDir /r "$INSTDIR\templates"
        RMDir /r "$INSTDIR\static"
        RMDir /r "$INSTDIR\w64devkit"
        RMDir "$INSTDIR"
        
        DeleteRegKey HKLM "${UNINSTALL_KEY}"
        
SectionEnd