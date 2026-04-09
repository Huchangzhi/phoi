@echo off
chcp 65001 >nul
echo ========================================
echo   PH CODE Android 签名证书生成工具
echo ========================================
echo.

set /p STORE_PASS=请输入密钥库密码（至少6位）: 
set /p KEY_PASS=请输入密钥密码（至少6位）: 
set /p KEY_ALIAS=请输入密钥别名（默认 phcode）: 
if "%KEY_ALIAS%"=="" set KEY_ALIAS=phcode

echo.
echo 正在生成密钥库...

keytool -genkeypair -v ^
  -keystore phcode.keystore ^
  -alias %KEY_ALIAS% ^
  -keyalg RSA ^
  -keysize 2048 ^
  -validity 10000 ^
  -storepass %STORE_PASS% ^
  -keypass %KEY_PASS% ^
  -dname "CN=PH CODE, OU=Development, O=Huchangzhi, L=Beijing, ST=Beijing, C=CN"

if %ERRORLEVEL%==0 (
    echo.
    echo ========================================
    echo   密钥库生成成功！
    echo ========================================
    echo.
    echo 文件已保存为: phcode.keystore
    echo.
    echo 请在 GitHub Secrets 中添加以下配置：
    echo.
    echo 1. ANDROID_KEYSTORE = 
    certutil -encode phcode.keystore phcode.keystore.b64
    type phcode.keystore.b64 | findstr /v "BEGIN\|END" | findstr /v "^$"
    del phcode.keystore.b64
    echo.
    echo 2. KEYSTORE_PASSWORD = %STORE_PASS%
    echo 3. KEY_ALIAS = %KEY_ALIAS%
    echo 4. KEY_PASSWORD = %KEY_PASS%
    echo.
    echo 配置完成后，请删除本地的 phcode.keystore 文件以确保安全。
) else (
    echo.
    echo 密钥库生成失败！
)

pause
