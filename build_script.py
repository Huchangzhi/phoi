"""
PH Code 打包构建脚本
支持打包成exe并集成MinGW，以及发布版本功能
"""

import os
import sys
import subprocess
import shutil
import argparse
import zipfile
import json
from pathlib import Path


def install_pyinstaller():
    """安装PyInstaller"""
    print("正在安装PyInstaller...")
    subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)


def download_mingw():
    """下载MinGW-w64（简化版，实际使用时可能需要根据系统架构调整）"""
    print("注意: MinGW需要手动安装或通过包管理器安装")
    print("Windows用户可以从 https://www.mingw-w64.org/downloads/ 下载")
    print("或者使用MSYS2安装: pacman -S mingw-w64-x86_64-gcc")
    return False  # 暂时不自动下载，因为这涉及复杂的平台检测


def copy_mingw_to_dist(dist_path):
    """将MinGW复制到分发目录"""
    # 检测系统上的MinGW位置
    mingw_paths = [
        "C:/mingw64/bin",
        "C:/msys64/mingw64/bin",
        "C:/Program Files/mingw-w64/x86_64-*/*/bin",
        # 添加其他可能的路径
    ]
    
    mingw_found = False
    for path_pattern in mingw_paths:
        import glob
        matches = glob.glob(path_pattern)
        for path in matches:
            if os.path.exists(path):
                mingw_bin_path = path
                mingw_found = True
                break
        if mingw_found:
            break
    
    if not mingw_found:
        print("警告: 未找到MinGW安装，将尝试从PATH获取gcc信息")
        try:
            result = subprocess.run(['where' if os.name == 'nt' else 'which', 'gcc'], 
                                  capture_output=True, text=True, check=True)
            gcc_path = Path(result.stdout.strip()).parent
            mingw_bin_path = str(gcc_path)
            mingw_found = True
        except subprocess.CalledProcessError:
            print("错误: 未找到gcc编译器，请先安装MinGW或GCC")
            return False
    
    # 创建mingw目录并复制必要文件
    mingw_dist_path = os.path.join(dist_path, "mingw", "bin")
    os.makedirs(mingw_dist_path, exist_ok=True)
    
    # 复制gcc相关文件
    gcc_files = [
        "gcc.exe", "g++.exe", "ld.exe", "ar.exe", "ranlib.exe", "dlltool.exe",
        "libgcc_s_seh-1.dll", "libstdc++-6.dll", "libwinpthread-1.dll"  # Windows特定DLL
    ]
    
    for file in gcc_files:
        src = os.path.join(mingw_bin_path, file)
        dst = os.path.join(mingw_dist_path, file)
        if os.path.exists(src):
            print(f"复制 {file}...")
            shutil.copy2(src, dst)
        else:
            print(f"警告: 未找到 {src}")
    
    return True


def build_executable(version=None):
    """构建可执行文件"""
    print(f"开始构建 PH Code 可执行文件...")
    
    # 确保PyInstaller已安装
    try:
        import PyInstaller
    except ImportError:
        install_pyinstaller()
    
    # 准备spec文件
    spec_content = f"""# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['app_gui.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('templates', 'templates'),
        ('static', 'static'),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PH_Code_Server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='logo.png',  # 如果存在图标文件
)
"""
    
    # 写入spec文件
    with open('ph_code.spec', 'w', encoding='utf-8') as f:
        f.write(spec_content)
    
    # 运行PyInstaller
    cmd = ['pyinstaller', 'ph_code.spec', '--clean', '--noconfirm']
    result = subprocess.run(cmd, check=True)
    
    if result.returncode != 0:
        print(f"构建失败: {result.returncode}")
        return False
    
    dist_path = "dist/PH_Code_Server"
    
    # 复制MinGW到分发目录
    if not copy_mingw_to_dist(dist_path):
        print("警告: MinGW集成失败，生成的程序可能无法使用本地编译功能")
    
    # 创建版本信息文件
    if version:
        version_info = {
            "version": version,
            "build_date": str(Path.cwd().joinpath("dist").stat().st_mtime),
            "includes_mingw": True
        }
        with open(os.path.join(dist_path, "version.json"), 'w', encoding='utf-8') as f:
            json.dump(version_info, f, indent=2, ensure_ascii=False)
    
    print(f"构建成功！可执行文件位于: {dist_path}")
    return True


def create_zip_archive(version):
    """创建ZIP归档"""
    if not version:
        version = "dev-build"
    
    archive_name = f"PH_Code_Server_v{version}.zip"
    dist_path = "dist/PH_Code_Server"
    
    if not os.path.exists(dist_path):
        print(f"错误: {dist_path} 不存在")
        return False
    
    print(f"创建归档文件: {archive_name}")
    
    with zipfile.ZipFile(archive_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(dist_path):
            for file in files:
                file_path = os.path.join(root, file)
                arc_path = os.path.relpath(file_path, os.path.dirname(dist_path))
                zipf.write(file_path, arc_path)
    
    print(f"归档创建成功: {archive_name}")
    return True


def publish_release(version, github_token=None):
    """发布GitHub Release（简化版）"""
    if not version:
        print("错误: 发布版本需要指定版本号")
        return False
    
    print(f"准备发布版本: v{version}")
    
    # 创建归档
    if not create_zip_archive(version):
        return False
    
    if github_token:
        print("注意: 实际的GitHub发布需要额外的API调用，此处仅为示意")
        print("需要实现以下步骤:")
        print("1. 使用GitHub API创建release")
        print("2. 上传ZIP文件作为asset")
        print("3. 更新changelog")
        # 这里可以使用PyGithub库来实现真正的发布
    else:
        print(f"版本已打包为 ZIP 文件，但未发布到GitHub (缺少token)")
        print(f"请手动上传 dist/PH_Code_Server_v{version}.zip 文件到GitHub Release")
    
    return True


def main():
    parser = argparse.ArgumentParser(description='PH Code 构建和发布工具')
    parser.add_argument('--build', action='store_true', help='构建可执行文件')
    parser.add_argument('--version', type=str, help='版本号 (例如 1.0.0)')
    parser.add_argument('--publish', action='store_true', help='发布到GitHub (需要--token)')
    parser.add_argument('--token', type=str, help='GitHub token (用于发布)')
    parser.add_argument('--mingw', action='store_true', help='集成MinGW (如果可用)')
    
    args = parser.parse_args()
    
    if args.build:
        success = build_executable(args.version)
        if success and args.version:
            if args.publish:
                publish_release(args.version, args.token)
            else:
                # 只创建ZIP归档而不发布
                create_zip_archive(args.version or "dev-build")
    else:
        print("请使用 --build 参数来构建项目")
        parser.print_help()


if __name__ == "__main__":
    main()