# PH code clangd 集成说明

## 概述

已成功将 [clangd-in-browser](https://github.com/guyutongxue/clangd-in-browser) 的真 C++ IntelliSense 功能集成到 PH code 项目中。

## 集成功能

- ✅ **代码补全**：基于 AST 的语义分析，提供准确的代码补全
- ✅ **错误诊断**：实时编译错误/警告显示（红色波浪线）
- ✅ **悬停提示**：鼠标悬停显示变量类型、函数签名
- ✅ **降级方案**：clangd 加载失败时自动切换到 autocomplete.js

## 文件结构

```
phoi/
├── app.py                          # Flask 后端（已添加 COOP/COEP 头）
├── app_gui.py                      # GUI 版本（已添加 COOP/COEP 头）
├── app_local.py                    # 本地执行版本（已添加 COOP/COEP 头）
├── server_gui.py                   # GUI 服务器（已添加 COOP/COEP 头）
├── worker/
│   └── index.js                    # Cloudflare Worker（已添加 COOP/COEP 头）
├── static/
│   ├── clangd/
│   │   ├── clangd.js               # clangd Emscripten 加载器
│   │   └── clangd.wasm.gz          # 压缩的 clangd WASM（25MB）
│   ├── lib/
│   │   └── pako.min.js             # gzip 解压库
│   └── clangd_lsp.js               # clangd LSP 集成模块
└── templates/
    └── index.html                  # 主页（已添加 clangd 脚本引用）
```

## 技术说明

### 1. COOP/COEP 头

clangd WASM 使用 `SharedArrayBuffer`，需要跨源隔离。已在所有服务器端添加：

```python
@app.after_request
def add_security_headers(response):
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    response.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'
    return response
```

### 2. WASM 文件处理

- 原始 clangd.wasm：126MB
- gzip 压缩后：25MB（节省 80%）
- 前端使用 pako.js 解压

### 3. 加载流程

```
1. 页面加载 → 加载 pako.min.js 和 clangd_lsp.js
2. 初始化 clangd → 下载 clangd.wasm.gz (25MB)
3. pako 解压 → 得到 clangd.wasm (126MB)
4. 创建 Worker → 初始化 clangd LSP 服务
5. 连接 Monaco Editor → 提供智能感知
```

### 4. 降级策略

```javascript
try {
    await initializeClangdLSP(editor);
    console.log('clangd 初始化成功');
} catch (error) {
    console.warn('clangd 失败，使用 autocomplete.js');
    // 自动切换到原有的 autocomplete.js
}
```

## 使用方法

### 本地运行

```bash
pip install flask requests
python app.py
```

访问 http://localhost:5000

### Cloudflare Pages 部署

1. 构建静态资源：
```bash
# 将 static 和 templates 目录部署到 Cloudflare Pages
```

2. wrangler.toml 配置：
```toml
name = "phoi"
main = "worker/index.js"
compatibility_date = "2024-05-28"

[assets]
directory = "./dist"
binding = "ASSETS"
```

## 浏览器兼容性

- ✅ Chrome 85+
- ✅ Edge 85+
- ✅ Firefox 114+
- ✅ Safari 15+

**注意**：需要支持 `SharedArrayBuffer` 的现代浏览器

## 性能指标

| 阶段 | 时间 |
|------|------|
| 下载 wasm.gz | 2-5 秒（25MB） |
| 解压 | 1-2 秒 |
| 初始化 clangd | 3-5 秒 |
| **总计** | **6-12 秒** |

## 内存占用

- clangd WASM：约 2GB（堆内存）
- Monaco Editor：约 100MB
- 总计：约 2.1GB

**建议**：低端设备（<4GB 内存）可能无法运行 clangd，会自动降级到 autocomplete.js

## 现有功能保留

- ✅ autocomplete.js 完整保留
- ✅ Struct 成员补全
- ✅ STL 容器方法补全
- ✅ 变量名补全
- ✅ C++ 关键字补全

## 新增功能

- ✅ 实时错误诊断（编译错误/警告）
- ✅ 类型推断和悬停提示
- ✅ 定义跳转（Ctrl+ 点击）
- ✅ 符号重命名（F2）
- ✅ 引用查找

## 故障排除

### 1. SharedArrayBuffer 不可用

**症状**：控制台显示 `SharedArrayBuffer is not defined`

**解决**：确保服务器发送了 COOP/COEP 头

### 2. clangd 加载失败

**症状**：控制台显示 `Failed to download clangd.wasm.gz`

**解决**：
- 检查 `/static/clangd/clangd.wasm.gz` 文件是否存在
- 确保 Flask 静态文件服务正常

### 3. 内存不足

**症状**：浏览器崩溃或 clangd 初始化失败

**解决**：
- 关闭其他标签页释放内存
- 使用 autocomplete.js 降级方案

## 下一步优化建议

1. **Service Worker 缓存**：缓存 wasm 文件，二次访问无需重新下载
2. **懒加载**：用户需要时才加载 clangd
3. **WebAssembly SIMD**：加速解压过程
4. **增量加载**：分块加载 wasm 文件

## 参考项目

- [clangd-in-browser](https://github.com/guyutongxue/clangd-in-browser)
- [monaco-languageclient](https://github.com/TypeFox/monaco-languageclient)
- [pako](https://github.com/nodeca/pako)
