; ============================================================
; PH Code Editor 安装脚本
; 基于 NSIS 官方 Wiki 示例: A simple installer with start menu shortcut and uninstaller
; https://nsis.sourceforge.io/A_simple_installer_with_start_menu_shortcut_and_uninstaller
; ============================================================

!define APPNAME "PH Code Editor"
!define COMPANYNAME "PHOI"
!define DESCRIPTION "PH Code Editor"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0
!define VERSIONBUILD 0
!define HELPURL "https://github.com/huchangzhi/phoi"
!define UPDATEURL "https://github.com/huchangzhi/phoi"
!define ABOUTURL "https://github.com/huchangzhi/phoi"
!define INSTALLSIZE 100000

; 管理员权限
RequestExecutionLevel admin

; 安装目录
InstallDir "$PROGRAMFILES\PH Code Editor"

; 安装程序信息
Name "${COMPANYNAME} - ${APPNAME}"
Icon "static\logo.ico"
OutFile "phcode-installer-${VERSION}.exe"

!include "MUI2.nsh"
!include "LogicLib.nsh"

; MUI 页面配置
!define MUI_ABORTWARNING
!define MUI_ICON "static\logo.ico"
!define MUI_UNICON "static\logo.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"

; ----------------------------------------------------------
; 初始化
; ----------------------------------------------------------
Function .onInit
    SetShellVarContext all
FunctionEnd

; ----------------------------------------------------------
; 检测旧版本并设置安装路径
; ----------------------------------------------------------
Function CheckOldVersion
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "InstallLocation"
    StrCmp $R0 "" +2
        StrCpy $INSTDIR $R0
FunctionEnd

; ----------------------------------------------------------
; 安装部分
; ----------------------------------------------------------
Section "install"
    Call CheckOldVersion
    
    SetOutPath $INSTDIR
    
    ; 复制文件
    File "dist\phcode.exe"
    File /r "templates\*.*"
    File /r "static\*.*"
    File /r "w64devkit\*.*"
    
    ; 创建开始菜单目录和快捷方式
    CreateDirectory "$SMPROGRAMS\PHCode"
    CreateShortcut "$SMPROGRAMS\PHCode\PH Code Editor.lnk" "$INSTDIR\phcode.exe" "" "$INSTDIR\phcode.exe" 0
    CreateShortcut "$SMPROGRAMS\PHCode\卸载.lnk" "$INSTDIR\uninstall.exe"
    CreateShortcut "$DESKTOP\PH Code Editor.lnk" "$INSTDIR\phcode.exe"
    
    ; 写入卸载程序
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    ; 注册表信息（用于 Add/Remove Programs）
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "DisplayName" "${COMPANYNAME} - ${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "DisplayIcon" "$INSTDIR\phcode.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "Publisher" "${COMPANYNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "HelpLink" "${HELPURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "URLUpdateInfo" "${UPDATEURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "URLInfoAbout" "${ABOUTURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "DisplayVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "VersionMajor" ${VERSIONMAJOR}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "VersionMinor" ${VERSIONMINOR}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "NoRepair" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "EstimatedSize" ${INSTALLSIZE}
SectionEnd

; ----------------------------------------------------------
; 卸载部分
; ----------------------------------------------------------
Function un.onInit
    SetShellVarContext all
FunctionEnd

Section "uninstall"
    ; 从注册表读取安装路径
    ReadRegStr $INSTDIR HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}" "InstallLocation"
    StrCmp $INSTDIR "" +2
        StrCpy $INSTDIR "$PROGRAMFILES\PH Code Editor"
    
    ; 删除开始菜单快捷方式
    Delete "$SMPROGRAMS\PHCode\PH Code Editor.lnk"
    Delete "$SMPROGRAMS\PHCode\卸载.lnk"
    RMDir "$SMPROGRAMS\PHCode"
    
    ; 删除桌面快捷方式
    Delete "$DESKTOP\PH Code Editor.lnk"
    
    ; 删除文件
    Delete "$INSTDIR\phcode.exe"
    Delete "$INSTDIR\uninstall.exe"
    RMDir /r "$INSTDIR\templates"
    RMDir /r "$INSTDIR\static"
    RMDir /r "$INSTDIR\w64devkit"
    RMDir /r "$INSTDIR\phcode_data"
    
    ; 删除安装目录（如果为空）
    RMDir "$INSTDIR"
    
    ; 删除注册表项
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${COMPANYNAME} ${APPNAME}"
SectionEnd