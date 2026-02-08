# PH Code GUI Server - 使用说明

## 概述
PH Code GUI Server 是一个带有图形用户界面的C++在线编辑器服务器，支持启动/停止服务器、浏览器打开、网络访问设置以及本地MinGW编译器集成。

## 功能特性

### GUI服务器功能
- 图形化界面控制服务器启动/停止
- 支持设置服务器端口
- 支持选择网络访问模式（本地访问或对外公开）
- 支持启用/禁用本地MinGW编译器
- 在浏览器中一键打开服务器
- 实时日志输出

### 编译器选项
- **Rextester API**: 使用在线编译服务（默认）
- **本地MinGW**: 使用本地安装的MinGW编译器

## 使用方法

### 1. 直接运行GUI服务器
```bash
python app_gui.py
```

### 2. 使用构建脚本
```bash
# 构建可执行文件
python build_tool.py --build --version 1.0.0

# 构建并发布（需要GitHub token）
python build_tool.py --action both --version 1.0.0 --token YOUR_GITHUB_TOKEN
```

### 3. 构建选项
- `--build`: 构建可执行文件
- `--version`: 指定版本号
- `--publish`: 发布到GitHub（需要token）
- `--token`: GitHub访问令牌
- `--action`: 操作类型（build, publish, both）

## 界面说明

### 服务器控制区域
- **端口**: 设置服务器运行端口（默认5000）
- **对外公开**: 勾选后服务器将绑定到0.0.0.0，允许外部访问
- **使用本地MinGW**: 勾选后使用本地g++编译器而非在线服务
- **启动服务器**: 启动HTTP服务器
- **停止服务器**: 停止当前运行的服务器
- **在浏览器中打开**: 在默认浏览器中打开服务器地址

### 状态显示
- 显示当前服务器运行状态

### 日志输出
- 实时显示服务器运行日志

## 构建与发布

### 本地构建
项目包含完整的构建工具，可以将应用打包为独立的可执行文件：
1. 运行 `build_tool.py` 脚本
2. 应用会自动检测系统中的MinGW并将其集成到包中
3. 生成的可执行文件位于 `dist/PH_Code_Server` 目录

### 自动化发布
项目配置了GitHub Actions工作流，支持两种触发方式：
1. **推送标签**: 当推送以`v`开头的标签时会自动构建、集成MinGW、创建ZIP归档并发布到GitHub Releases
2. **手动触发**: 在Actions页面可以手动运行工作流，仅执行构建过程而不发布

**注意**: 如果GitHub Actions在下载MinGW时遇到网络问题，可以考虑以下替代方案：
- 使用GitHub自带的MSYS2环境（在工作流中替换MinGW下载部分）
- 构建时不集成MinGW，由用户自行安装

## 技术细节

### 安全措施
- 危险函数黑名单（system, exec, fork等）
- 时间和内存限制
- 代码内容过滤

### 依赖项
- Python 3.7+
- Flask
- Tkinter
- PyInstaller (构建时)

## 故障排除

### MinGW未找到
如果构建时提示找不到MinGW，请确保：
1. 已正确安装MinGW-w64
2. MinGW的bin目录已添加到系统PATH
3. g++命令可以在终端中正常运行

### 服务器无法启动
检查端口是否已被占用，或防火墙设置是否阻止了连接。

## 版本历史

### v2.1.2
- 添加GUI服务器版本
- 集成本地MinGW编译器支持
- 自动化构建和发布流程