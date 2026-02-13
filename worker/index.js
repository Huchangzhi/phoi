// Cloudflare Worker for PH Code API
// Supports only API endpoints from the original Flask app

// Rextester API configuration
const REXTESTER_URL = "https://rextester.com/rundotnet/Run";
const LANG_CPP_GCC = 7;

// Security patterns to block
const DANGEROUS_PATTERNS = [
    /system\s*\(/,
    /exec[lqvpe]*\s*\(/,
    /fork\s*\(/,
    /popen\s*\(/,
    /kill\s*\(/,
    /<windows\.h>/,
    /<unistd\.h>/,
    /\bfstream\b/,
    /\bfreopen\b/,
    /\bFILE\s*\*/,
    /\bfopen\s*\(/,
    /__asm__/,
    /asm\s*\(/,
];

function checkSecurity(code) {
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(code)) {
            return { safe: false, message: `Security Alert: Detected forbidden pattern` };
        }
    }
    return { safe: true, message: "" };
}

// Helper function to create a response with CORS headers
function createResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        status
    });
}

// Handle CORS preflight requests
function handleOptions(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }
    return null;
}

// Main fetch handler
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        const optionsResponse = handleOptions(request);
        if (optionsResponse) {
            return optionsResponse;
        }

        const url = new URL(request.url);
        
        // Route: /run (POST) - Execute code via Rextester
        if (request.method === 'POST' && url.pathname === '/run') {
            try {
                const { code, input } = await request.json();
                
                // Security check
                const securityCheck = checkSecurity(code || '');
                if (!securityCheck.safe) {
                    return createResponse({
                        Errors: securityCheck.message,
                        Result: "",
                        Stats: "Compilation aborted due to security violation."
                    }, 400);
                }

                // Prepare payload for Rextester
                const payload = {
                    LanguageChoiceWrapper: LANG_CPP_GCC,
                    Program: code || '',
                    Input: input || '',
                    CompilerArgs: "-o a.out source_file.cpp -Wall -std=c++14 -O2"
                };

                // Send request to Rextester
                const resp = await fetch(REXTESTER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(payload)
                });

                if (!resp.ok) {
                    throw new Error(`Rextester API error: ${resp.status}`);
                }

                const result = await resp.json();
                return createResponse(result);

            } catch (error) {
                if (error.name === 'TimeoutError') {
                    return createResponse({
                        Errors: "Server Timeout: Request to compiler timed out, please try again later."
                    }, 504);
                }
                return createResponse({
                    Errors: `Internal Server Error: ${error.message}`
                }, 500);
            }
        }
        
        // Route: /easyrun_api (GET) - Execute code from URL parameter
        else if (request.method === 'GET' && url.pathname === '/easyrun_api') {
            try {
                const urlEncodedCode = url.searchParams.get('url');
                if (!urlEncodedCode) {
                    return createResponse({
                        Errors: "Missing code in URL parameter"
                    }, 400);
                }

                // Decode the URL-encoded code
                const code = decodeURIComponent(urlEncodedCode);

                // Security check
                const securityCheck = checkSecurity(code);
                if (!securityCheck.safe) {
                    return createResponse({
                        Errors: securityCheck.message,
                        Result: "",
                        Stats: "Compilation aborted due to security violation."
                    }, 400);
                }

                // Get optional stdin
                const stdin = url.searchParams.get('stdin') || '';

                // Prepare payload for Rextester
                const payload = {
                    LanguageChoiceWrapper: LANG_CPP_GCC,
                    Program: code,
                    Input: stdin,
                    CompilerArgs: "-o a.out source_file.cpp -Wall -std=c++14 -O2"
                };

                // Send request to Rextester
                const resp = await fetch(REXTESTER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(payload)
                });

                if (!resp.ok) {
                    throw new Error(`Rextester API error: ${resp.status}`);
                }

                const result = await resp.json();
                return createResponse(result);

            } catch (error) {
                if (error.name === 'TimeoutError') {
                    return createResponse({
                        Errors: "Server Timeout: Request to compiler timed out, please try again later."
                    }, 504);
                }
                return createResponse({
                    Errors: `Internal Server Error: ${error.message}`
                }, 500);
            }
        }
        
        // Route: /health (GET) - Health check endpoint
        else if (request.method === 'GET' && url.pathname === '/health') {
            return createResponse({ status: 'OK', message: 'PH Code API is running' });
        }
        
        // Route: Serve the main page (GET /)
        else if (request.method === 'GET' && url.pathname === '/') {
            const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PH Code - 在线C++编辑器</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💻</text></svg>">
    <style>
        /* 基础样式 */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #1e1e1e;
            color: #d4d4d4;
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        /* 工具栏样式 */
        #global-toolbar {
            background-color: #252526;
            padding: 8px 12px;
            display: flex;
            align-items: center;
            border-bottom: 1px solid #3c3c3c;
            z-index: 10;
        }
        
        .toolbar-btn {
            background: #3c3c3c;
            color: #d4d4d4;
            border: none;
            padding: 6px 12px;
            margin-right: 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        
        .toolbar-btn:hover {
            background: #494949;
        }
        
        .toolbar-btn:active {
            background: #2a2d2e;
        }
        
        .toolbar-separator {
            width: 1px;
            height: 20px;
            background: #454545;
            margin: 0 8px;
        }
        
        #current-file-name {
            color: #9cdcfe;
            font-weight: bold;
            margin-left: 8px;
            font-size: 14px;
        }
        
        /* 编辑器区域 */
        #editor-wrapper {
            flex: 1;
            display: flex;
            overflow: hidden;
        }
        
        #editor-container {
            flex: 1;
            min-height: 0;
        }
        
        /* 输出面板 */
        #output-panel {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 300px;
            background: #1e1e1e;
            border-top: 1px solid #3c3c3c;
            display: none;
            flex-direction: column;
            z-index: 100;
        }
        
        #output-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #252526;
            cursor: ns-resize;
        }
        
        #output-title {
            font-weight: bold;
            color: #9cdcfe;
        }
        
        #output-resizer {
            width: 100%;
            height: 4px;
            background: #3c3c3c;
            cursor: ns-resize;
        }
        
        #output-content {
            flex: 1;
            padding: 12px;
            overflow-y: auto;
            white-space: pre-wrap;
            font-family: 'Consolas', 'Courier New', monospace;
        }
        
        .out-section {
            margin-bottom: 12px;
        }
        
        .out-title {
            display: block;
            font-weight: bold;
            margin-bottom: 4px;
            padding: 4px 0;
        }
        
        .out-title.out-err { color: #f48771; }
        .out-title.out-warn { color: #ffcc02; }
        
        .out-err { color: #f48771; }
        .out-warn { color: #ffcc02; }
        .out-res { color: #d4d4d4; }
        
        .out-stat { color: #808080; font-size: 0.9em; }
        
        /* 输入模态框 */
        #input-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .modal-content {
            background: #2d2d30;
            padding: 20px;
            border-radius: 5px;
            width: 80%;
            max-width: 500px;
        }
        
        .modal-title {
            color: #9cdcfe;
            margin-bottom: 15px;
            font-size: 1.2em;
        }
        
        #modal-textarea {
            width: 100%;
            height: 150px;
            background: #1e1e1e;
            color: #d4d4d4;
            border: 1px solid #3c3c3c;
            border-radius: 3px;
            padding: 10px;
            font-family: 'Consolas', 'Courier New', monospace;
            resize: vertical;
        }
        
        .modal-buttons {
            display: flex;
            justify-content: flex-end;
            margin-top: 15px;
        }
        
        .modal-btn {
            padding: 8px 16px;
            margin-left: 10px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }
        
        #modal-run {
            background: #007acc;
            color: white;
        }
        
        #modal-cancel {
            background: #3c3c3c;
            color: #d4d4d4;
        }
        
        /* 虚拟文件系统面板 */
        #vfs-panel {
            position: fixed;
            top: 0;
            left: 0;
            width: 300px;
            height: 100%;
            background: #252526;
            border-right: 1px solid #3c3c3c;
            display: none;
            flex-direction: column;
            z-index: 90;
            overflow: hidden;
        }
        
        #vfs-header {
            padding: 12px;
            background: #2d2d30;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        #vfs-title {
            font-weight: bold;
            color: #9cdcfe;
        }
        
        #vfs-close-btn {
            background: none;
            border: none;
            color: #d4d4d4;
            font-size: 1.2em;
            cursor: pointer;
        }
        
        #vfs-content {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }
        
        .vfs-item {
            padding: 8px;
            cursor: pointer;
            border-radius: 3px;
        }
        
        .vfs-item:hover {
            background: #2a2d2e;
        }
        
        .vfs-file {
            color: #d4d4d4;
        }
        
        .vfs-folder {
            color: #c586c0;
            font-weight: bold;
        }
        
        /* 插件中心面板 */
        #plugin-center-panel {
            position: fixed;
            top: 0;
            right: 0;
            width: 300px;
            height: 100%;
            background: #252526;
            border-left: 1px solid #3c3c3c;
            display: none;
            flex-direction: column;
            z-index: 90;
            overflow: hidden;
        }
        
        #plugin-center-header {
            padding: 12px;
            background: #2d2d30;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        #plugin-center-title {
            font-weight: bold;
            color: #9cdcfe;
        }
        
        #plugin-center-close-btn {
            background: none;
            border: none;
            color: #d4d4d4;
            font-size: 1.2em;
            cursor: pointer;
        }
        
        #plugin-center-content {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }
        
        /* 移动端适配 */
        @media (max-width: 768px) {
            #editor-wrapper {
                flex-direction: column;
            }
            
            #output-panel {
                height: 150px;
            }
        }
    </style>
</head>
<body>
    <!-- 全局工具栏 -->
    <div id="global-toolbar">
        <button id="sidebar-toggle" class="toolbar-btn">📁</button>
        <div class="toolbar-separator"></div>
        <button id="run-btn" class="toolbar-btn">▶ 运行</button>
        <button id="copy-btn" class="toolbar-btn">📋 复制</button>
        <div class="toolbar-separator"></div>
        <span id="current-file-name">new.cpp</span>
        <div style="flex: 1;"></div>
        <button id="plugin-center-toggle" class="toolbar-btn">🔌</button>
    </div>
    
    <!-- 编辑器区域 -->
    <div id="editor-wrapper">
        <div id="editor-container"></div>
    </div>
    
    <!-- 输出面板 -->
    <div id="output-panel">
        <div id="output-header">
            <span id="output-title">输出</span>
            <button id="close-output" class="toolbar-btn">✕</button>
        </div>
        <div id="output-resizer"></div>
        <div id="output-content"></div>
    </div>
    
    <!-- 输入模态框 -->
    <div id="input-modal">
        <div class="modal-content">
            <div class="modal-title">程序输入</div>
            <textarea id="modal-textarea" placeholder="在此输入程序的标准输入..."></textarea>
            <div class="modal-buttons">
                <button id="modal-cancel" class="modal-btn">取消</button>
                <button id="modal-run" class="modal-btn">运行</button>
            </div>
        </div>
    </div>
    
    <!-- 虚拟文件系统面板 -->
    <div id="vfs-panel">
        <div id="vfs-header">
            <span id="vfs-title">文件系统</span>
            <button id="vfs-close-btn">×</button>
        </div>
        <div id="vfs-content"></div>
    </div>
    
    <!-- 插件中心面板 -->
    <div id="plugin-center-panel">
        <div id="plugin-center-header">
            <span id="plugin-center-title">插件中心</span>
            <button id="plugin-center-close-btn">×</button>
        </div>
        <div id="plugin-center-content">
            <div class="vfs-item">代码补全插件</div>
            <div class="vfs-item">洛谷题库插件</div>
            <div class="vfs-item">CPH插件</div>
        </div>
    </div>

    <!-- Monaco Editor -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js"></script>
    <script>
        // DOM Elements
        const editorWrapper = document.getElementById('editor-wrapper');
        const runBtn = document.getElementById('run-btn');
        const copyBtn = document.getElementById('copy-btn');
        const outputPanel = document.getElementById('output-panel');
        const outputContent = document.getElementById('output-content');
        const closeOutputBtn = document.getElementById('close-output');
        const inputModal = document.getElementById('input-modal');
        const modalTextarea = document.getElementById('modal-textarea');
        const modalRun = document.getElementById('modal-run');
        const modalCancel = document.getElementById('modal-cancel');
        const vfsPanel = document.getElementById('vfs-panel');
        const vfsCloseBtn = document.getElementById('vfs-close-btn');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const pluginCenterPanel = document.getElementById('plugin-center-panel');
        const pluginCenterCloseBtn = document.getElementById('plugin-center-close-btn');
        const pluginCenterToggle = document.getElementById('plugin-center-toggle');
        const currentFileNameElement = document.getElementById('current-file-name');

        // Global variables
        let globalText = \`#include <iostream>

using namespace std;

int main() {
    cout << "Hello Ph Code" << endl;
    return 0;
}\`;
        let currentFileName = 'new.cpp';

        // Initialize Monaco Editor
        let monacoEditor = null; // Global reference to the Monaco editor instance

        require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], function() {
            monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
                value: globalText,
                language: 'cpp',
                theme: 'vs-dark', // 使用暗色主题
                automaticLayout: true,
                // 设置代码补全的延迟时间
                quickSuggestions: true,
                quickSuggestionsDelay: 200,
                // 控制参数提示的延迟
                parameterHints: {
                    enabled: true,
                    cycle: false
                },
                // 禁用内置的单词补全，避免与自定义补全重复
                wordBasedSuggestions: false,
                suggest: {
                    // 确保自定义补全优先级更高
                    localityBonus: false,
                    // 根据设置启用或禁用建议
                    snippetsPrevented: false
                }
            });

            // Update globalText when editor content changes
            monacoEditor.onDidChangeModelContent(() => {
                globalText = monacoEditor.getValue();
            });

            // Update editor when globalText changes
            window.addEventListener('codeUpdated', () => {
                if (monacoEditor && monacoEditor.getValue() !== globalText) {
                    monacoEditor.setValue(globalText);
                }
            });
        });

        // Run & Copy
        if (runBtn) {
            runBtn.addEventListener('click', () => {
                if (inputModal) {
                    inputModal.style.display = 'flex';
                    if (modalTextarea) {
                        modalTextarea.focus();
                    }
                }
            });
        }
        if (modalCancel) {
            modalCancel.addEventListener('click', () => {
                if (inputModal) {
                    inputModal.style.display = 'none';
                }
            });
        }
        if (modalRun) {
            modalRun.addEventListener('click', () => {
                if (inputModal) {
                    inputModal.style.display = 'none';
                }
                if (modalTextarea) {
                    executeRunCode(modalTextarea.value);
                }
            });
        }

        async function executeRunCode(stdin) {
            if (outputPanel) {
                outputPanel.style.display = 'flex';
            }
            if (outputContent) {
                outputContent.innerHTML = '<span style="color:#888;">正在编译和运行...</span>';
            }
            try {
                // 修改API端点为当前域名
                const response = await fetch('/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: globalText, input: stdin })
                });
                if (!response.ok) throw new Error(\`HTTP Error: \${response.status}\`);
                const data = await response.json();
                let html = "";
                if(data.Warnings) html += \`<div class="out-section"><span class="out-title out-warn">警告:</span><div class="out-warn">\${escapeHtml(data.Warnings)}</div></div>\`;
                if(data.Errors) html += \`<div class="out-section"><span class="out-title out-err">错误:</span><div class="out-err">\${escapeHtml(data.Errors)}</div></div>\`;
                if(data.Result) html += \`<div class="out-section"><span class="out-title">输出:</span><div class="out-res">\${escapeHtml(data.Result)}</div></div>\`;
                else if(!data.Errors) html += \`<div class="out-section"><span class="out-title">输出:</span><div class="out-res" style="color:#666">(无输出)</div></div>\`;
                if(data.Stats) html += \`<div class="out-stat">\${escapeHtml(data.Stats)}</div>\`;
                if (outputContent) {
                    outputContent.innerHTML = html;
                }
            } catch (e) {
                if (outputContent) {
                    outputContent.innerHTML = \`<span class="out-err">服务器连接错误: \${e.message}<br>请确定网络状态良好并稍后再试</span>\`;
                }
            }
        }

        function copyCode() {
            const t = document.createElement('textarea'); 
            t.value = globalText; 
            document.body.appendChild(t); 
            t.select();
            try { 
                if(document.execCommand('copy')){
                    if(navigator.vibrate)navigator.vibrate(50); 
                } else alert('复制失败'); 
            } catch(e){
                console.error('复制失败:', e);
            }
            document.body.removeChild(t);
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', copyCode);
        }
        if (closeOutputBtn) {
            closeOutputBtn.addEventListener('click', () => {
                if (outputPanel) {
                    outputPanel.style.display = 'none';
                }
            });
        }

        // 虚拟文件系统
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleVFSPanel);
        }
        if (vfsCloseBtn) {
            vfsCloseBtn.addEventListener('click', () => {
                if (vfsPanel) {
                    vfsPanel.style.display = 'none';
                }
            });
        }

        function toggleVFSPanel() {
            if (vfsPanel) {
                if (vfsPanel.style.display === 'none' || vfsPanel.style.display === '') {
                    vfsPanel.style.display = 'flex';
                } else {
                    vfsPanel.style.display = 'none';
                }
            }
        }

        // 插件中心
        if (pluginCenterToggle) {
            pluginCenterToggle.addEventListener('click', togglePluginCenter);
        }
        if (pluginCenterCloseBtn) {
            pluginCenterCloseBtn.addEventListener('click', () => {
                if (pluginCenterPanel) {
                    pluginCenterPanel.style.display = 'none';
                }
            });
        }

        function togglePluginCenter() {
            if (pluginCenterPanel) {
                if (pluginCenterPanel.style.display === 'none' || pluginCenterPanel.style.display === '') {
                    pluginCenterPanel.style.display = 'flex';
                } else {
                    pluginCenterPanel.style.display = 'none';
                }
            }
        }

        // Core Helpers
        function escapeHtml(text) {
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // 添加输出面板调整大小功能
        let isResizing = false;
        const outputResizer = document.getElementById('output-resizer');
        const globalToolbar = document.getElementById('global-toolbar');

        // 鼠标按下调整大小手柄时
        if (outputResizer) {
            outputResizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                document.body.style.cursor = 'ns-resize';
                e.preventDefault();
            });
        }

        // 鼠标移动时调整输出面板大小
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            // 计算新的高度（基于窗口高度和鼠标位置）
            const windowHeight = window.innerHeight;
            const newY = e.clientY;
            const newHeight = windowHeight - newY;

            // 设置最小和最大高度限制
            const minHeight = 150; // 最小高度
            const toolbarHeight = globalToolbar ? globalToolbar.offsetHeight : 0;
            const maxHeight = windowHeight - toolbarHeight - 100; // 最大高度

            // 应用边界限制
            const clampedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

            if (outputPanel) {
                outputPanel.style.height = \`\${clampedHeight}px\`;
            }
        });

        // 鼠标释放时结束调整大小
        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.body.style.cursor = '';
        });
    </script>
</body>
</html>
            `;
            return new Response(html, {
                headers: {
                    'Content-Type': 'text/html',
                },
            });
        }
        
        // 404 for all other routes
        else {
            return createResponse({
                Errors: "Endpoint not found",
                Result: "",
                Stats: "The requested endpoint does not exist"
            }, 404);
        }
    }
};