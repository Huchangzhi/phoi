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

// HTML template with placeholders replaced
const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>C++ 在线编辑器</title>
    <link rel="icon" href="/static/logo.png" type="image/x-icon">
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>

    <!-- VS Code 风格顶部菜单栏 -->
    <div id="top-menu-bar">
        <div id="menu-bar-left">
            <img src="/static/logo.png" alt="Logo" id="logo">
            <div class="menu-item" id="file-menu">文件</div>
            <div class="menu-item" id="about-menu">关于</div>
        </div>
        <div id="menu-bar-center">
            <span id="current-file-name" class="current-file">new.cpp</span>
        </div>
        <div id="menu-bar-right">
            <!-- <button id="luogu-btn" class="tool-btn" title="洛谷题目"><img src="/static/Luogu.png" alt="Luogu" class="icon-btn"></button> -->
            <button id="run-btn" class="tool-btn" title="运行"><img src="/static/debug.png" alt="Run" class="icon-btn"></button>
            <button id="copy-btn" class="tool-btn" title="复制">❐</button>
            <button id="mode-toggle-btn" class="tool-btn">▲</button>
        </div>
    </div>

    <!-- 下拉菜单 -->
    <div id="file-dropdown" class="dropdown-menu" style="display: none;">
        <div class="dropdown-item" id="upload-file">上传文件</div>
        <div class="dropdown-item" id="download-file">下载文件</div>
        <div class="dropdown-item" id="save-as">另存为</div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-item" id="preferences">首选项</div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-item" id="new-file">新建文件</div>
    </div>

    <!-- 左侧边栏 -->
    <div id="left-sidebar">
        <div id="sidebar-toggle" class="sidebar-button" title="显示/隐藏虚拟文件系统"><img src="/static/file.png" alt="Files" class="icon-btn"></div>
        <div id="plugin-center-toggle" class="sidebar-button" title="插件中心"><img src="/static/ext.png" alt="Plugins" class="icon-btn"></div>
        <div id="cph-plugin-toggle" class="sidebar-button" title="CPH - 试题集管理"><img src="/static/cph.png" alt="CPH" class="icon-btn"></div>
    </div>

    <!-- 虚拟文件系统面板 -->
    <div id="vfs-panel" class="vfs-panel" style="display: none;">
        <div class="vfs-header">
            <span>资源管理器</span>
            <button id="vfs-close-btn" class="vfs-close-btn">×</button>
        </div>
        <div id="vfs-content" class="vfs-content">
            <div class="vfs-root">
                <div class="vfs-folder" data-path="/">根目录</div>
            </div>
        </div>
    </div>

    <!-- 插件中心面板 -->
    <div id="plugin-center-panel" class="vfs-panel" style="display: none;">
        <div class="vfs-header">
            <span>插件中心</span>
            <button id="plugin-center-close-btn" class="vfs-close-btn">×</button>
        </div>
        <div id="plugin-center-content" class="vfs-content">
            <!-- C++代码补全插件 -->
            <div class="plugin-item">
                <div class="plugin-header">C++代码补全</div>
                <div class="plugin-settings">
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="cpp-autocomplete-enabled" checked> 启用
                        </label>
                    </div>
                    <div class="setting-item">
                        <label for="cpp-autocomplete-delay">延迟时间(ms):</label>
                        <input type="number" id="cpp-autocomplete-delay" value="200" min="0">
                    </div>
                </div>
            </div>

            <!-- 查看洛谷主题库插件 -->
            <div class="plugin-item">
                <div class="plugin-header">查看洛谷主题库</div>
                <div class="plugin-header">题目来源于洛谷开放平台</div>
                <div class="plugin-settings">
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="luogu-theme-enabled"> 启用
                        </label>
                    </div>
                </div>
            </div>

            <!-- CPH插件 -->
            <div class="plugin-item">
                <div class="plugin-header">CPH - 刷题好帮手</div>
                <div class="plugin-description">记录测试点，一键运行!</div>
                <div class="plugin-settings">
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="cph-plugin-enabled"> 启用
                        </label>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <!-- 3行预览区 (结构已修改，包含行号) -->
    <div id="lines-container" style="display: none;">
        <!-- 上一行 -->
        <div class="line-wrapper">
            <div id="ln-prev" class="line-number"></div>
            <div id="line-prev" class="line-view"></div>
        </div>
        <!-- 当前行 -->
        <div class="line-wrapper current">
            <div id="ln-curr" class="line-number"></div>
            <div id="line-curr" class="line-view current"></div>
        </div>
        <!-- 下一行 -->
        <div class="line-wrapper">
            <div id="ln-next" class="line-number"></div>
            <div id="line-next" class="line-view"></div>
        </div>
    </div>

    <!-- 输入模态框 -->
    <div id="input-modal">
        <div class="modal-content">
            <div class="modal-header">Standard Input (Stdin)</div>
            <textarea id="modal-textarea" placeholder="在此输入数据..."></textarea>
            <div class="modal-footer">
                <button id="modal-cancel" class="modal-btn">取消</button>
                <button id="modal-run" class="modal-btn">运行</button>
            </div>
        </div>
    </div>

    <!-- 首选项弹窗 -->
    <div id="preferences-modal" class="modal-overlay">
        <div class="modal-content preferences-modal">
            <div class="modal-header">
                <h2>首选项</h2>
                <span id="close-preferences" class="close-btn">×</span>
            </div>
            <div class="modal-body">
                <div class="setting-item">
                    <label for="default-code-editor">默认代码:</label>
                    <textarea id="default-code-editor" placeholder="在此输入默认代码..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button id="reset-default-code" class="modal-btn">重置为默认</button>
                <button id="cancel-preferences" class="modal-btn">取消</button>
                <button id="save-preferences" class="modal-btn">保存</button>
            </div>
        </div>
    </div>

    <!-- 输出面板 -->
    <div id="output-panel">
        <div id="output-header">
            <span>Terminal</span>
            <span id="close-output">✕</span>
        </div>
        <div id="output-content"></div>
        <div id="output-resizer" class="output-resizer"></div>
    </div>

    <!-- 中心编辑器区域 -->
    <div id="editor-area" style="flex: 1; display: flex; overflow: hidden;">
        <!-- 编辑器容器 -->
        <div id="editor-container" style="flex: 1; height: 100%;"></div>
    </div>

    <!-- 移动端代码补全容器 -->
    <div id="mobile-autocomplete-container"></div>

    <!-- 虚拟键盘容器 -->
    <div id="keyboard-container">
        <!-- Row 1 -->
        <div class="row">
            <div class="key w-1" data-key="\`" data-shift="~"><div class="key-content"><span class="sup">~</span><span class="main">\`</span></div></div>
            <div class="key w-1" data-key="1" data-shift="!"><div class="key-content"><span class="sup">!</span><span class="main">1</span></div></div>
            <div class="key w-1" data-key="2" data-shift="@"><div class="key-content"><span class="sup">@</span><span class="main">2</span></div></div>
            <div class="key w-1" data-key="3" data-shift="#"><div class="key-content"><span class="sup">#</span><span class="main">3</span></div></div>
            <div class="key w-1" data-key="4" data-shift="$"><div class="key-content"><span class="sup">$</span><span class="main">4</span></div></div>
            <div class="key w-1" data-key="5" data-shift="%"><div class="key-content"><span class="sup">%</span><span class="main">5</span></div></div>
            <div class="key w-1" data-key="6" data-shift="^"><div class="key-content"><span class="sup">^</span><span class="main">6</span></div></div>
            <div class="key w-1" data-key="7" data-shift="&"><div class="key-content"><span class="sup">&</span><span class="main">7</span></div></div>
            <div class="key w-1" data-key="8" data-shift="*"><div class="key-content"><span class="sup">*</span><span class="main">8</span></div></div>
            <div class="key w-1" data-key="9" data-shift="("><div class="key-content"><span class="sup">(</span><span class="main">9</span></div></div>
            <div class="key w-1" data-key="0" data-shift=")"><div class="key-content"><span class="sup">)</span><span class="main">0</span></div></div>
            <div class="key w-1" data-key="-" data-shift="_"><div class="key-content"><span class="sup">_</span><span class="main">-</span></div></div>
            <div class="key w-1" data-key="=" data-shift="+"><div class="key-content"><span class="sup">+</span><span class="main">=</span></div></div>
            <div class="key w-2 mod repeat-key" data-key="Backspace">Bksp</div>
            <div class="spacer-sm"></div><div class="spacer"></div>
            <div class="key nav-key" data-key="Home">Hom</div><div class="key nav-key" data-key="PageUp">PgU</div>
        </div>
        <!-- Row 2 -->
        <div class="row">
            <div class="key w-1-5 mod" data-key="Tab">Tab</div>
            <div class="key w-1 alpha-key" data-key="q">Q</div><div class="key w-1 alpha-key" data-key="w">W</div><div class="key w-1 alpha-key" data-key="e">E</div>
            <div class="key w-1 alpha-key" data-key="r">R</div><div class="key w-1 alpha-key" data-key="t">T</div><div class="key w-1 alpha-key" data-key="y">Y</div>
            <div class="key w-1 alpha-key" data-key="u">U</div><div class="key w-1 alpha-key" data-key="i">I</div><div class="key w-1 alpha-key" data-key="o">O</div>
            <div class="key w-1 alpha-key" data-key="p">P</div>
            <div class="key w-1" data-key="[" data-shift="{"><div class="key-content"><span class="sup">{</span><span class="main">[</span></div></div>
            <div class="key w-1" data-key="]" data-shift="}"><div class="key-content"><span class="sup">}</span><span class="main">]</span></div></div>
            <div class="key w-1-5" data-key="\\" data-shift="|"><div class="key-content"><span class="sup">|</span><span class="main">\\</span></div></div>
            <div class="spacer-sm"></div>
            <div class="key nav-key" data-key="Delete">Del</div><div class="key nav-key" data-key="End">End</div><div class="key nav-key" data-key="PageDown">PgD</div>
        </div>
        <!-- Row 3 -->
        <div class="row">
            <div class="key w-1-75 mod" data-key="CapsLock">Caps</div>
            <div class="key w-1 alpha-key" data-key="a">A</div><div class="key w-1 alpha-key" data-key="s">S</div><div class="key w-1 alpha-key" data-key="d">D</div>
            <div class="key w-1 alpha-key" data-key="f">F</div><div class="key w-1 alpha-key" data-key="g">G</div><div class="key w-1 alpha-key" data-key="h">H</div>
            <div class="key w-1 alpha-key" data-key="j">J</div><div class="key w-1 alpha-key" data-key="k">K</div><div class="key w-1 alpha-key" data-key="l">L</div>
            <div class="key w-1" data-key=";" data-shift=":"><div class="key-content"><span class="sup">:</span><span class="main">;</span></div></div>
            <div class="key w-1" data-key="'" data-shift='"'><div class="key-content"><span class="sup">"</span><span class="main">'</span></div></div>
            <div class="key w-2-25 mod highlight" data-key="Enter" style="background:#444">Enter</div>
            <div class="spacer-sm"></div>
            <div class="spacer"></div><div class="spacer"></div><div class="spacer"></div>
        </div>
        <!-- Row 4 -->
        <div class="row">
            <div class="key w-2-25 mod shift-key" data-key="Shift">Shift</div>
            <div class="key w-1 alpha-key" data-key="z">Z</div><div class="key w-1 alpha-key" data-key="x">X</div><div class="key w-1 alpha-key" data-key="c">C</div>
            <div class="key w-1 alpha-key" data-key="v">V</div><div class="key w-1 alpha-key" data-key="b">B</div><div class="key w-1 alpha-key" data-key="n">N</div>
            <div class="key w-1 alpha-key" data-key="m">M</div>
            <div class="key w-1" data-key="," data-shift="<"><div class="key-content"><span class="sup">&lt;</span><span class="main">,</span></div></div>
            <div class="key w-1" data-key="." data-shift=">"><div class="key-content"><span class="sup">&gt;</span><span class="main">.</span></div></div>
            <div class="key w-1" data-key="/" data-shift="?"><div class="key-content"><span class="sup">?</span><span class="main">/</span></div></div>
            <div class="key w-2 mod shift-key" data-key="Shift">Shift</div>
            <div class="spacer-sm"></div><div class="spacer"></div>
            <div class="key nav-key repeat-key" data-key="ArrowUp">↑</div><div class="spacer"></div>
        </div>
        <!-- Row 5 -->
        <div class="row">
            <div class="key w-1-5 mod ctrl-key" data-key="Control">Ctrl</div>
            <div class="spacer"></div><div class="spacer-1-5"></div>
            <div class="key w-space" data-key=" ">Space</div>
            <div class="spacer"></div><div class="spacer"></div>
            <div class="key w-1 mod" data-key="ContextMenu">≡</div>
            <div class="key w-1-5 mod ctrl-key" data-key="Control">Ctrl</div>
            <div class="spacer-sm"></div>
            <div class="key nav-key repeat-key" data-key="ArrowLeft">←</div>
            <div class="key nav-key repeat-key" data-key="ArrowDown">↓</div>
            <div class="key nav-key repeat-key" data-key="ArrowRight">→</div>
        </div>
    </div>

    <!-- 关于弹窗 -->
    <div id="about-modal" class="modal-overlay">
        <div class="modal-content about-modal">
            <div class="modal-header">
                <h2>关于 PH code</h2>
                <span id="close-about" class="close-btn">×</span>
            </div>
            <div class="modal-body">
                <p><a href="https://github.com/huchangzhi/phoi" target="_blank">PH code(原名phoi v2)</a> - 适合OI的在线C++编辑器</p>
                <p>版本: 2.1.7</p>
                <p>这是一个专为信息学竞赛（OI）设计的在线C++编辑器，支持在手机等移动设备上编写和运行C++代码。</p>
            </div>
        </div>
    </div>

    <!-- 引入 KaTeX CSS -->
    <link rel="stylesheet" href="/static/lib/katex.min.css">

    <!-- 引入 Marked.js 和 KaTeX JS -->
    <script src="/static/lib/marked.min.js"></script>
    <script src="/static/lib/katex.min.js"></script>
    <script src="/static/lib/auto-render.min.js"></script>

    <script src="/static/lib/monaco-editor/loader.js"></script>
    <script src="/static/script.js"></script>
    <script src="/static/autocomplete.js"></script>
    <script src="/static/luogu.js"></script>
    <script src="/static/cph.js"></script>
    <script src="/static/mobile_autocomplete.js"></script>
</body>
</html>`;

// Static assets map
const ASSETS = {
  "/static/style.css": {
    content: `/* CSS content will be loaded dynamically */`,
    contentType: "text/css"
  },
  "/static/script.js": {
    content: `/* JS content will be loaded dynamically */`,
    contentType: "application/javascript"
  },
  "/static/autocomplete.js": {
    content: `/* JS content will be loaded dynamically */`,
    contentType: "application/javascript"
  },
  "/static/luogu.js": {
    content: `/* JS content will be loaded dynamically */`,
    contentType: "application/javascript"
  },
  "/static/cph.js": {
    content: `/* JS content will be loaded dynamically */`,
    contentType: "application/javascript"
  },
  "/static/mobile_autocomplete.js": {
    content: `/* JS content will be loaded dynamically */`,
    contentType: "application/javascript"
  },
  "/static/logo.png": {
    content: `/* Image data will be loaded dynamically */`,
    contentType: "image/png"
  },
  "/static/debug.png": {
    content: `/* Image data will be loaded dynamically */`,
    contentType: "image/png"
  },
  "/static/file.png": {
    content: `/* Image data will be loaded dynamically */`,
    contentType: "image/png"
  },
  "/static/ext.png": {
    content: `/* Image data will be loaded dynamically */`,
    contentType: "image/png"
  },
  "/static/cph.png": {
    content: `/* Image data will be loaded dynamically */`,
    contentType: "image/png"
  },
  "/static/Luogu.png": {
    content: `/* Image data will be loaded dynamically */`,
    contentType: "image/png"
  }
};

// Main fetch handler
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        const optionsResponse = handleOptions(request);
        if (optionsResponse) {
            return optionsResponse;
        }

        const url = new URL(request.url);
        
        // Route: / (GET) - Serve the main page
        if (request.method === 'GET' && url.pathname === '/') {
            return new Response(INDEX_HTML, {
                headers: {
                    'Content-Type': 'text/html',
                },
            });
        }
        
        // Route: /run (POST) - Execute code via Rextester
        else if (request.method === 'POST' && url.pathname === '/run') {
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
        
        // Route: /static/* - Serve static assets
        else if (url.pathname.startsWith('/static/')) {
            const assetPath = url.pathname;
            if (ASSETS[assetPath]) {
                return new Response(ASSETS[assetPath].content, {
                    headers: {
                        'Content-Type': ASSETS[assetPath].contentType,
                        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
                    }
                });
            } else {
                return createResponse({
                    Errors: "Static asset not found",
                    Result: "",
                    Stats: "The requested static asset does not exist"
                }, 404);
            }
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