"""
PH Code 构建和发布工具
完整的工作流，包括版本管理、构建、打包和发布
"""

import os
import sys
import subprocess
import shutil
import argparse
import zipfile
import json
import tempfile
from pathlib import Path
import requests


def install_dependencies():
    """安装必要的依赖"""
    print("正在安装依赖...")
    subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller", "flask", "requests"], check=True)


def detect_and_copy_mingw(dist_path):
    """检测并复制MinGW到目标路径"""
    print("正在检测系统中的MinGW...")
    
    # 常见的MinGW安装路径
    possible_paths = [
        "C:/mingw64/bin",
        "C:/msys64/mingw64/bin",
        "C:/Program Files/mingw-w64/x86_64-*/*/bin",
    ]
    
    mingw_path = None
    
    # 尝试查找MinGW
    for path_pattern in possible_paths:
        if "*" in path_pattern:
            import glob
            matches = glob.glob(path_pattern)
            for path in matches:
                if os.path.exists(path) and os.path.isfile(os.path.join(path, "g++.exe")):
                    mingw_path = path
                    break
        else:
            if os.path.exists(path_pattern) and os.path.isfile(os.path.join(path_pattern, "g++.exe")):
                mingw_path = path_pattern
                break
        
        if mingw_path:
            break
    
    if not mingw_path:
        # 尝试从PATH查找
        try:
            result = subprocess.run(['where' if os.name == 'nt' else 'which', 'g++'], 
                                  capture_output=True, text=True, check=True)
            gpp_path = Path(result.stdout.strip())
            mingw_path = str(gpp_path.parent)
        except subprocess.CalledProcessError:
            print("警告: 未找到g++编译器，将跳过MinGW集成")
            return False
    
    print(f"找到MinGW: {mingw_path}")
    
    # 创建mingw目录
    mingw_dist_path = os.path.join(dist_path, "mingw", "bin")
    os.makedirs(mingw_dist_path, exist_ok=True)
    
    # 要复制的文件列表
    files_to_copy = [
        "g++.exe", "gcc.exe", "ld.exe", "ar.exe", "ranlib.exe", "dlltool.exe",
        "libgcc_s_seh-1.dll", "libstdc++-6.dll", "libwinpthread-1.dll"
    ]
    
    copied_count = 0
    for file in files_to_copy:
        src = os.path.join(mingw_path, file)
        dst = os.path.join(mingw_dist_path, file)
        if os.path.exists(src):
            print(f"复制 {file}...")
            shutil.copy2(src, dst)
            copied_count += 1
        else:
            print(f"文件不存在: {src}")
    
    print(f"成功复制了 {copied_count}/{len(files_to_copy)} 个文件")
    return copied_count > 0


def create_spec_file(version=None):
    """创建PyInstaller spec文件"""
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
    hiddenimports=['tkinter', 'subprocess', 'socket', 'urllib.parse', 're', 'tempfile', 'shutil', 'time'],
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
    icon='logo.png' if Path('logo.png').exists() else None,
)
"""
    
    with open('ph_code.spec', 'w', encoding='utf-8') as f:
        f.write(spec_content)
    
    return 'ph_code.spec'


def build_executable(version=None):
    """构建可执行文件"""
    print(f"开始构建 PH Code 可执行文件...")
    
    # 安装依赖
    install_dependencies()
    
    # 创建spec文件
    spec_file = create_spec_file(version)
    
    # 运行PyInstaller
    cmd = ['pyinstaller', spec_file, '--clean', '--noconfirm']
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"构建失败!")
        print("STDOUT:", result.stdout)
        print("STDERR:", result.stderr)
        return False
    
    dist_path = "dist/PH_Code_Server"
    
    # 集成MinGW
    mingw_success = detect_and_copy_mingw(dist_path)
    if not mingw_success:
        print("警告: MinGW集成失败，生成的程序可能无法使用本地编译功能")
    
    # 创建版本信息文件
    if version:
        version_info = {
            "version": version,
            "build_date": str(Path().resolve()),
            "includes_mingw": mingw_success,
            "platform": os.name
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
                # 计算相对路径
                rel_path = os.path.relpath(file_path, start=os.path.dirname(dist_path))
                zipf.write(file_path, rel_path)
    
    print(f"归档创建成功: {archive_name}")
    return True


def publish_release(version, github_token=None):
    """发布GitHub Release"""
    if not version:
        print("错误: 发布版本需要指定版本号")
        return False
    
    print(f"准备发布版本: v{version}")
    
    # 创建归档
    if not create_zip_archive(version):
        return False
    
    if github_token:
        print("正在发布到GitHub...")
        
        # 创建临时文件存储发布信息
        release_info = {
            "tag_name": f"v{version}",
            "target_commitish": "main",
            "name": f"PH Code Server v{version}",
            "body": f"PH Code Server 版本 {version} 发布\n\n- GUI服务器版本\n- 支持本地MinGW编译\n- 包含完整的开发环境",
            "draft": False,
            "prerelease": False
        }
        
        # 注意：实际的GitHub API调用在这里
        # 这只是一个示例，实际实现需要使用GitHub API
        print(f"版本 v{version} 已准备好发布")
        print(f"请上传 dist/PH_Code_Server_v{version}.zip 到GitHub Release")
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
    parser.add_argument('--action', type=str, choices=['build', 'publish', 'both'], 
                       default='build', help='执行的操作: build, publish, or both')
    
    args = parser.parse_args()
    
    if args.action in ['build', 'both']:
        success = build_executable(args.version)
        if not success:
            print("构建失败")
            sys.exit(1)
    
    if args.action in ['publish', 'both']:
        if not args.version:
            print("错误: 发布需要指定版本号 (--version)")
            sys.exit(1)
        publish_release(args.version, args.token)


if __name__ == "__main__":
    main()