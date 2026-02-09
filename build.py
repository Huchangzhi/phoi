#!/usr/bin/env python3
"""
PH Code构建脚本
用于构建单文件可执行程序并准备发布
"""

import os
import sys
import shutil
import subprocess
import argparse
import zipfile
from pathlib import Path


def install_pyinstaller():
    """安装PyInstaller"""
    print("正在安装PyInstaller...")
    subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)


def build_executable(script_path, output_dir="dist"):
    """使用PyInstaller构建可执行文件"""
    print(f"正在构建可执行文件 from {script_path}...")
    
    # 创建spec文件以自定义构建过程
    spec_content = f"""# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    [{repr(script_path)}],
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
    name='phcode',
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
    icon=None,
)
"""
    
    spec_file = "phcode.spec"
    with open(spec_file, 'w', encoding='utf-8') as f:
        f.write(spec_content)
    
    # 运行PyInstaller
    subprocess.run([
        sys.executable, "-m", "pyinstaller", 
        "--onefile",  # 单文件
        "--add-data", "templates;templates",  # 包含templates目录
        "--add-data", "static;static",      # 包含static目录
        "--name", "phcode",
        spec_file
    ], check=True)
    
    # 清理spec文件
    os.remove(spec_file)
    
    print("构建完成！")


def create_zip_archive(output_dir="dist", version=None):
    """创建包含可执行文件和相关资源的zip归档"""
    print("正在创建ZIP归档...")
    
    if version:
        zip_filename = f"phcode-v{version}.zip"
    else:
        zip_filename = "phcode-build.zip"
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # 添加可执行文件
        exe_path = os.path.join(output_dir, "phcode.exe")
        if os.path.exists(exe_path):
            zipf.write(exe_path, "phcode.exe")
        
        # 添加其他必要文件
        for root, dirs, files in os.walk("templates"):
            for file in files:
                file_path = os.path.join(root, file)
                arc_path = os.path.join(root, file)
                zipf.write(file_path, arc_path)
        
        for root, dirs, files in os.walk("static"):
            for file in files:
                file_path = os.path.join(root, file)
                arc_path = os.path.join(root, file)
                zipf.write(file_path, arc_path)
    
    print(f"ZIP归档已创建: {zip_filename}")
    return zip_filename


def main():
    parser = argparse.ArgumentParser(description='PH Code构建工具')
    parser.add_argument('--version', type=str, help='版本号 (如果提供则发布新版本)')
    parser.add_argument('--skip-install', action='store_true', help='跳过PyInstaller安装')
    
    args = parser.parse_args()
    
    # 检查PyInstaller是否已安装
    try:
        import PyInstaller
    except ImportError:
        if not args.skip_install:
            install_pyinstaller()
        else:
            print("错误: PyInstaller未安装，请先安装或使用--skip-install参数")
            sys.exit(1)
    
    # 构建可执行文件
    build_executable("app_gui.py")
    
    # 创建ZIP归档
    zip_filename = create_zip_archive(version=args.version)
    
    print(f"构建完成! 输出文件: {zip_filename}")
    
    if args.version:
        print(f"已为版本 v{args.version} 创建发布包")


if __name__ == "__main__":
    main()