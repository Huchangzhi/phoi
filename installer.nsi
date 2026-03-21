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
Page custom WebView2CheckPage WebView2CheckPageLeave
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
Var WebView2Installed
Var WebView2CheckMessage

; ============================================================
; WebView2 检测页面创建
; ============================================================
Var WebView2Label
Var WebView2Status
Var WebView2InstallButton

Function WebView2CheckPage
    !insertmacro MUI_HEADER_TEXT "依赖项检查" "检查 WebView2 运行时"

    nsDialogs::Create 1018
    Pop $0

    ${NSD_CreateLabel} 0 0 100% 30u "正在检查系统依赖项..."
    Pop $WebView2Label

    ${NSD_CreateLabel} 0 40u 100% 20u ""
    Pop $WebView2Status

    nsDialogs::Show

    ; 页面显示后立即开始检测
    Call CheckWebView2
FunctionEnd

; ============================================================
; 检查 WebView2 函数
; ============================================================
Function CheckWebView2
    ; 更新状态
    SendMessage $WebView2Label ${WM_SETTEXT} 0 "STR:正在检查 WebView2 运行时...请点击下一步"

    ; 检查 WebView2 是否已安装
    ReadRegStr $WebView2Installed HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    ${If} $WebView2Installed == ""
        ReadRegStr $WebView2Installed HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    ${EndIf}

    ${If} $WebView2Installed != ""
        ; WebView2 已安装
        SendMessage $WebView2Label ${WM_SETTEXT} 0 "STR:✓ 依赖项齐全"
        SendMessage $WebView2Status ${WM_SETTEXT} 0 "STR:WebView2 运行时已安装，版本：$WebView2Installed"
    ${Else}
        ; WebView2 未安装，询问是否自动安装
        SendMessage $WebView2Label ${WM_SETTEXT} 0 "STR:✗ WebView2 运行时未安装"
        SendMessage $WebView2Status ${WM_SETTEXT} 0 "STR:PH Code Editor 需要 WebView2 运行时才能运行"

        MessageBox MB_YESNO|MB_ICONQUESTION "✗ WebView2 运行时未安装$\r$\n$\r$\nPH Code Editor 需要 WebView2 运行时才能运行。$\r$\n$\r$\n是否现在自动下载并安装 WebView2 运行时？$\r$\n（约 2-3 MB 下载 + 1-2 分钟安装，需要网络连接，安装时该程序会无响应）" IDYES install_webview2 IDNO cancel_install

        install_webview2:
            ; 更新状态
            SendMessage $WebView2Label ${WM_SETTEXT} 0 "STR:正在下载 WebView2 Runtime..."
            SendMessage $WebView2Status ${WM_SETTEXT} 0 "STR:从 Microsoft 官方服务器下载中，请稍候..."

            SetDetailsPrint both
            DetailPrint "正在从 Microsoft 官方服务器下载 WebView2 Runtime..."
            SetDetailsPrint listonly

            InitPluginsDir
            CreateDirectory "$pluginsdir\webview2"
            SetOutPath "$pluginsdir\webview2"

            ; 设置环境变量供 PowerShell 使用
            System::Call 'kernel32::SetEnvironmentVariable(t,t)i("WV2PATH", "$pluginsdir\webview2\MicrosoftEdgeWebview2Setup.exe")'

            ; 使用 PowerShell 下载
            ExecWait 'powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://go.microsoft.com/fwlink/p/?LinkId=2124703 -OutFile $env:WV2PATH"' $1

            ; 检查是否下载成功
            ${IfNot} ${FileExists} "$pluginsdir\webview2\MicrosoftEdgeWebview2Setup.exe"
                SendMessage $WebView2Label ${WM_SETTEXT} 0 "STR:✗ 下载失败"
                MessageBox MB_YESNO|MB_ICONEXCLAMATION "下载 WebView2 Runtime 失败。$\r$\n$\r$\n是否继续安装 PH Code Editor？$\r$\n（程序可能无法正常运行）" IDYES continue_install IDNO cancel_install
                Goto continue_install
            ${EndIf}

            ; 更新状态
            SendMessage $WebView2Label ${WM_SETTEXT} 0 "STR:正在安装 WebView2 Runtime..."
            SendMessage $WebView2Status ${WM_SETTEXT} 0 "STR:安装中，请稍候（可能需要 1-2 分钟）..."

            DetailPrint "正在安装 WebView2 Runtime..."

            ; 静默安装 WebView2
            ExecWait '"$pluginsdir\webview2\MicrosoftEdgeWebview2Setup.exe" /silent /install' $0

            ; 清理临时文件
            Delete "$pluginsdir\webview2\MicrosoftEdgeWebview2Setup.exe"
            RMDir "$pluginsdir\webview2"

            SetDetailsPrint both

            ; 检查安装结果
            ${If} $0 == 0
                ; 安装成功，重新检查
                ReadRegStr $WebView2Installed HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
                ${If} $WebView2Installed == ""
                    ReadRegStr $WebView2Installed HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
                ${EndIf}

                ${If} $WebView2Installed != ""
                    SendMessage $WebView2Label ${WM_SETTEXT} 0 "STR:✓ 依赖项齐全"
                    SendMessage $WebView2Status ${WM_SETTEXT} 0 "STR:WebView2 Runtime 安装成功，版本：$WebView2Installed"
                    MessageBox MB_OK "✓ WebView2 Runtime 安装成功$\r$\n$\r$\n版本：$WebView2Installed"
                ${Else}
                    SendMessage $WebView2Label ${WM_SETTEXT} 0 "STR:⚠ 安装状态未知"
                    SendMessage $WebView2Status ${WM_SETTEXT} 0 "STR:安装程序已运行，但未检测到完成"
                    MessageBox MB_YESNO|MB_ICONEXCLAMATION "WebView2 安装程序已运行，但未检测到安装完成。$\r$\n$\r$\n这可能是因为需要重启系统或安装正在后台进行。$\r$\n$\r$\n是否继续安装 PH Code Editor？" IDYES continue_install IDNO cancel_install
                ${EndIf}
            ${Else}
                ; 安装失败
                SendMessage $WebView2Label ${WM_SETTEXT} 0 "STR:✗ 安装失败"
                SendMessage $WebView2Status ${WM_SETTEXT} 0 "STR:错误代码：$0"
                MessageBox MB_YESNO|MB_ICONEXCLAMATION "WebView2 Runtime 安装失败（错误代码：$0）$\r$\n$\r$\n是否继续安装 PH Code Editor？$\r$\n（程序可能无法正常运行）" IDYES continue_install IDNO cancel_install
            ${EndIf}

            Goto continue_install

        cancel_install:
            ; 用户拒绝安装或安装失败，退出安装程序
            Abort

        continue_install:
            ; 继续安装
    ${EndIf}
FunctionEnd

; ============================================================
; WebView2 检测页面离开
; ============================================================
Function WebView2CheckPageLeave
    ; 页面离开时不需要做任何操作，所有逻辑已在 CheckWebView2 中完成
FunctionEnd

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