// DOM Elements
const editorWrapper = document.getElementById('editor-wrapper');
const fullEditor = document.getElementById('full-editor');
const highlightLayer = document.getElementById('highlight-layer');
const gutter = document.getElementById('gutter');

const keyboardContainer = document.getElementById('keyboard-container');
const toggleBtn = document.getElementById('mode-toggle-btn');
const runBtn = document.getElementById('run-btn');
const copyBtn = document.getElementById('copy-btn');
const linesContainer = document.getElementById('lines-container');

// 终端面板元素（替代旧的 output-panel）
const terminalPanel = document.getElementById('terminal-panel');
const terminalTabs = document.querySelectorAll('.terminal-tab');
const terminalContents = document.querySelectorAll('.terminal-content');
const terminalResizer = document.getElementById('terminal-resizer');

// 旧的 output-panel 元素（保留兼容性，但不再使用）
const outputPanel = null; // 已废弃
const closeOutputBtn = null; // 已废弃

// 各终端内容区域
const terminalRunContent = document.getElementById('terminal-run-content');
const terminalInfoContent = document.getElementById('terminal-info-content');
const terminalDebugContent = document.getElementById('terminal-debug-content');



// 3行模式的元素
const linePrev = document.getElementById('line-prev');
const lineCurr = document.getElementById('line-curr');
const lineNext = document.getElementById('line-next');
const lnPrev = document.getElementById('ln-prev');
const lnCurr = document.getElementById('ln-curr');
const lnNext = document.getElementById('ln-next');

const keys = document.querySelectorAll('.key');
const shiftKeys = document.querySelectorAll('.shift-key');
const ctrlKeys = document.querySelectorAll('.ctrl-key');

const inputModal = document.getElementById('input-modal');
const modalTextarea = document.getElementById('modal-textarea');
const modalRun = document.getElementById('modal-run');
const modalCancel = document.getElementById('modal-cancel');

// VS Code 风格新元素 - 需要检查这些元素是否存在
const topMenuBar = document.getElementById('top-menu-bar');
const fileMenu = document.getElementById('file-menu');
const windowMenu = document.getElementById('window-menu');
const terminalMenu = document.getElementById('terminal-menu');
const helpMenu = document.getElementById('help-menu');
const aboutMenu = document.getElementById('about-menu');
const fileDropdown = document.getElementById('file-dropdown');
const windowDropdown = document.getElementById('window-dropdown');
const helpDropdown = document.getElementById('help-dropdown');
const uploadFileBtn = document.getElementById('upload-file');
const downloadFileBtn = document.getElementById('download-file');
const saveAsBtn = document.getElementById('save-as');
const preferencesBtn = document.getElementById('preferences');
const newFileBtn = document.getElementById('new-file');
const newFolderBtn = document.getElementById('new-folder');

// 窗口控制按钮
const windowZoomInBtn = document.getElementById('window-zoom-in');
const windowZoomOutBtn = document.getElementById('window-zoom-out');
const windowZoomResetBtn = document.getElementById('window-zoom-reset');
const windowReloadBtn = document.getElementById('window-reload');

// 首选项弹窗相关元素
const preferencesModal = document.getElementById('preferences-modal');
const closePreferences = document.getElementById('close-preferences');
const cancelPreferences = document.getElementById('cancel-preferences');
const savePreferences = document.getElementById('save-preferences');
const resetDefaultCode = document.getElementById('reset-default-code');
const defaultCodeEditor = document.getElementById('default-code-editor');


const leftSidebar = document.getElementById('left-sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const mobileModeBtn = document.getElementById('mobile-mode-btn');

const vfsPanel = document.getElementById('vfs-panel');
const vfsCloseBtn = document.getElementById('vfs-close-btn');
const vfsContent = document.getElementById('vfs-content');

// 插件中心相关元素
const pluginCenterToggle = document.getElementById('plugin-center-toggle');
const pluginCenterPanel = document.getElementById('plugin-center-panel');
const pluginCenterCloseBtn = document.getElementById('plugin-center-close-btn');
const pluginCenterContent = document.getElementById('plugin-center-content');

// 初始化虚拟文件系统
if (typeof window.vfsModule.initVFSModule === 'function') {
    // 将DOM元素设置为全局变量，以便VFS模块可以访问
    window.vfsPanel = vfsPanel;
    window.vfsCloseBtn = vfsCloseBtn;
    window.vfsContent = vfsContent;
    window.sidebarToggle = sidebarToggle;
    
    window.vfsModule.initVFSModule();
}


// --- 恢复保存的代码 ---
const defaultDefaultCode = `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`;
// 从本地存储获取用户自定义的默认代码，如果没有则使用系统默认代码
const defaultCode = localStorage.getItem('phoi_defaultCode') || defaultDefaultCode;
// 如果本地没有保存过，才使用默认代码
let globalText = localStorage.getItem('phoi_savedCode') || defaultCode;
let globalCursorPos = globalText.length;

// --- 恢复保存的模式 ---
let isFullMode = localStorage.getItem('phoi_isFullMode') !== null ? localStorage.getItem('phoi_isFullMode') === 'true' : true; // 默认为电脑模式

// --- 插件设置 ---
const CPP_AUTOCOMPLETE_ENABLED_KEY = 'phoi_cpp_autocomplete_enabled';
const CPP_AUTOCOMPLETE_DELAY_KEY = 'phoi_cpp_autocomplete_delay';

// 默认设置值
let cppAutocompleteEnabled = localStorage.getItem(CPP_AUTOCOMPLETE_ENABLED_KEY) !== 'false'; // 默认为true
let cppAutocompleteDelayValue = localStorage.getItem(CPP_AUTOCOMPLETE_DELAY_KEY);
let cppAutocompleteDelay = cppAutocompleteDelayValue !== null ? parseInt(cppAutocompleteDelayValue) : 200; // 默认为 200ms


let isShiftActive = false;
let isShiftHeld = false;
let shiftUsageFlag = false;
let isCtrlActive = false;
let keyRepeatTimer = null, keyDelayTimer = null;
let saveTimer = null; // 用于防抖保存

// --- [优化] 防抖保存代码到本地 ---
// 避免每次按键都写入硬盘造成卡顿，延迟 500ms 保存
async function triggerSaveCode() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        localStorage.setItem('phoi_savedCode', globalText);

        // 如果当前文件已打开，则保存到虚拟文件系统
        if (window.vfsModule && typeof window.vfsModule.saveFileToVFS === 'function') {
            await window.vfsModule.saveFileToVFS(currentFileName, globalText);
        }
    }, 500);
}



// Initialize Monaco Editor
let monacoEditor = null; // Global reference to the Monaco editor instance


require.config({ paths: { 'vs': '/static/lib/monaco-editor/min/vs' } });
require(['vs/editor/editor.main'], function() {
    // 在初始化 Monaco 之前应用缩放
    applyScale();

    // 根据设置确定初始的quickSuggestionsDelay值
    // 根据设置确定初始的quickSuggestionsDelay值
    const initialQuickSuggestionsDelay = cppAutocompleteEnabled ? cppAutocompleteDelay : 0;

    monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
        value: globalText,
        language: 'cpp',
        theme: 'vs-dark', // 使用暗色主题
        automaticLayout: true,
        // 启用 glyph margin 以支持断点
        glyphMargin: true,
        folding: false,
        // 启用语义高亮
        'semanticHighlighting.enabled': true,
        // 设置代码补全的延迟时间
        quickSuggestions: cppAutocompleteEnabled,  // 根据设置启用或禁用快速建议
        quickSuggestionsDelay: initialQuickSuggestionsDelay,  // 根据设置和延迟值确定
        // 控制参数提示的延迟
        parameterHints: {
            enabled: cppAutocompleteEnabled,  // 根据设置启用或禁用参数提示
            cycle: false
        },
        // 禁用内置的单词补全，避免与自定义补全重复
        wordBasedSuggestions: false,
        suggest: {
            // 确保自定义补全优先级更高
            localityBonus: false,
            // 根据设置启用或禁用建议
            snippetsPrevented: !cppAutocompleteEnabled
        }
    });


    // 添加一个标志来跟踪程序化更新
    window.isUpdatingProgrammatically = false;

    // Initialize clangd LSP after Monaco Editor is ready (使用 Monaco 内置 LSP 客户端)
    initializeMonacoClangdIntegration();

    // Update globalText when editor content changes
    monacoEditor.onDidChangeModelContent(() => {
        if (!window.isUpdatingProgrammatically) {
            globalText = monacoEditor.getValue();
            triggerSaveCode();
        } else {
            // 重置标志
            window.isUpdatingProgrammatically = false;
        }
    });

    // Update editor when globalText changes
    window.addEventListener('codeUpdated', () => {
        if (monacoEditor && monacoEditor.getValue() !== globalText) {
            monacoEditor.setValue(globalText);
            // Update Monaco editor cursor position if possible
            if (typeof globalCursorPos !== 'undefined') {
                const newPosition = monacoEditor.getModel().getPositionAt(globalCursorPos);
                monacoEditor.setPosition(newPosition);
            }
        }
    });

    // 根据设置决定是否注册代码补全提供程序
    // 如果 clangd 启用，由 clangd_lsp.js 决定使用哪个补全
    // 如果 clangd 未启用，使用 autocomplete.js
    const clangdEnabled = localStorage.getItem('phoi_clangd_enabled') === 'true';
    
    if (cppAutocompleteEnabled && !clangdEnabled) {
        // clangd 未启用，使用 autocomplete.js
        if (typeof registerCompletionProviders === 'function') {
            registerCompletionProviders();
        }
    }
    // 如果 clangd 启用，由 clangd_lsp.js 的 registerCompletionProvider() 处理

    // 添加终端面板调整大小功能
    let isResizing = false;
    const terminalPanel = document.getElementById('terminal-panel');
    const terminalResizer = document.getElementById('terminal-resizer');
    const globalToolbar = document.getElementById('global-toolbar');

    // 鼠标按下调整大小手柄时
    if (terminalResizer) {
        terminalResizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        });
    }

    // 鼠标移动时调整终端面板大小
    document.addEventListener('mousemove', (e) => {
        if (!isResizing || !terminalPanel) return;

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

        if (terminalPanel) {
            terminalPanel.style.height = `${clampedHeight}px`;
        }
    });

    // 鼠标释放时停止调整大小
    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = '';
    });

    // 终端标签页切换功能
    function switchTerminalTab(tabName) {
        // 移除所有标签页的 active 类
        terminalTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });

        // 隐藏所有终端内容
        terminalContents.forEach(content => {
            content.style.display = 'none';
        });

        // 显示选中的终端内容
        const selectedContent = document.getElementById(`terminal-${tabName}`);
        if (selectedContent) {
            // 调试终端使用 flex 布局，其他使用 block
            if (tabName === 'debug') {
                selectedContent.style.display = 'flex';
            } else {
                selectedContent.style.display = 'block';
            }
        }

        // 特殊处理：如果是调试终端且正在调试，显示输入行
        const debugInputLine = document.getElementById('debug-input-line');
        if (debugInputLine) {
            if (tabName === 'debug' && window.debugState && window.debugState.isDebugging) {
                debugInputLine.style.display = 'flex';
            } else {
                debugInputLine.style.display = 'none';
            }
        }
    }

    // 暴露到全局作用域，供 debug.js 使用
    window.switchTerminalTab = switchTerminalTab;

    // 绑定标签页点击事件
    terminalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTerminalTab(tab.dataset.tab);
        });
    });

    // 终端面板关闭按钮
    const terminalCloseBtn = document.getElementById('terminal-close-btn');
    if (terminalCloseBtn) {
        terminalCloseBtn.addEventListener('click', () => {
            if (terminalPanel) {
                terminalPanel.style.display = 'none';
            }
        });
    }

    // 终端面板最小化按钮
    const terminalMinimizeBtn = document.getElementById('terminal-minimize-btn');
    if (terminalMinimizeBtn && terminalPanel) {
        terminalMinimizeBtn.addEventListener('click', () => {
            terminalPanel.classList.toggle('minimized');
            if (terminalPanel.classList.contains('minimized')) {
                terminalPanel.style.height = '36px';
            } else {
                terminalPanel.style.height = '30%';
            }
        });
    }

    // 在 Monaco Editor 完全初始化后注册快捷键
    if (typeof initContextMenu === 'function') {
        initContextMenu();
    }
    
    // 检查是否需要显示新手教程
    checkFirstRun();
});

// --- 恢复保存的输入数据 ---
if (modalTextarea) {
    modalTextarea.value = localStorage.getItem('phoi_savedStdin') || "";
    modalTextarea.addEventListener('input', () => {
        localStorage.setItem('phoi_savedStdin', modalTextarea.value);
    });
}

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

// 终端菜单按钮
if (terminalMenu) {
    terminalMenu.addEventListener('click', () => {
        if (terminalPanel) {
            terminalPanel.style.display = 'flex';
            terminalPanel.classList.remove('minimized');
        }
    });
}

// 全局函数：显示终端面板
window.showTerminalPanel = function() {
    if (terminalPanel) {
        terminalPanel.style.display = 'flex';
        terminalPanel.classList.remove('minimized');
    }
};
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

// 监听数据输入框的按键事件
if (modalTextarea) {
    modalTextarea.addEventListener('keydown', function(e) {
        // 检测到 Enter 键，且不是 Shift+Enter 或 Ctrl+Enter 时，执行运行
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault(); // 阻止默认的换行行为
            if (inputModal) {
                inputModal.style.display = 'none';
            }
            executeRunCode(modalTextarea.value);
        }
        // Shift+Enter 或 Ctrl+Enter 保持默认换行行为
        // Alt+Enter 也允许换行
    });
}

async function executeRunCode(stdin) {
    // 显示终端面板并切换到"运行"标签页
    if (terminalPanel) {
        terminalPanel.style.display = 'flex';
    }
    // 切换到运行终端标签页
    switchTerminalTab('run');

    // 在运行终端显示内容
    if (terminalRunContent) {
        terminalRunContent.innerHTML = '<span style="color:#888;">Compiling and running...</span>';
    }
    try {
        const response = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: globalText, input: stdin })
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        let html = "";
        if(data.Warnings) html += `<div class="out-section"><span class="out-title out-warn">WARNINGS:</span><div class="out-warn">${escapeHtml(data.Warnings)}</div></div>`;
        if(data.Errors) html += `<div class="out-section"><span class="out-title out-err">ERRORS:</span><div class="out-err">${escapeHtml(data.Errors)}</div></div>`;
        if(data.Result) html += `<div class="out-section"><span class="out-title">OUTPUT:</span><div class="out-res">${escapeHtml(data.Result)}</div></div>`;
        else if(!data.Errors) html += `<div class="out-section"><span class="out-title">OUTPUT:</span><div class="out-res" style="color:#666">(No output)</div></div>`;
        if(data.Stats) html += `<div class="out-stat">${escapeHtml(data.Stats)}</div>`;
        if (terminalRunContent) {
            terminalRunContent.innerHTML = html;
        }
    } catch (e) {
        if (terminalRunContent) {
            terminalRunContent.innerHTML = `<span class="out-err">Server Connection Error: ${e.message}<br>请确定网络状态良好并稍后再试</span>`;
        }
    }
}

function copyCode() {
    const t = document.createElement('textarea'); t.value = globalText; document.body.appendChild(t); t.select();
    try { if(document.execCommand('copy')){ if(navigator.vibrate)navigator.vibrate(50); } else alert('Fail'); } catch(e){}
    document.body.removeChild(t);
}
if (copyBtn) {
    copyBtn.addEventListener('click', copyCode);
}

// 旧的 closeOutputBtn 已废弃，不再需要

// Core Helpers
function escapeHtml(t) { 
    return (t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); 
}

// 3行预览功能函数
function renderThreeLines() {
    if(isFullMode) return; // 只在手机模式下显示

    // 统一处理换行符，将\r\n替换为\n进行计算
    const normalizedText = globalText.replace(/\r\n/g, '\n');
    const lines = normalizedText.split('\n');
    let accum = 0, idx = 0, start = 0;
    
    // 寻找光标所在的行
    for(let i=0; i<lines.length; i++) {
        // 检查光标是否在当前行（包括行末的换行符位置）
        if(globalCursorPos >= accum && globalCursorPos <= accum + lines[i].length) {
            idx = i;
            start = accum;
            break;
        }
        accum += lines[i].length + 1; // +1 for the newline character
    }

    // 更新行号
    if (lnPrev) lnPrev.textContent = (idx > 0) ? (idx) : "";
    if (lnCurr) lnCurr.textContent = idx + 1;
    if (lnNext) lnNext.textContent = (idx < lines.length - 1) ? (idx + 2) : "";

    // 更新行内容 - 使用原始文本以保持换行符的一致性
    const originalLines = globalText.replace(/\r\n/g, '\n').split('\n'); // 保持一致的分割方式
    if (linePrev) linePrev.textContent = originalLines[idx-1]||(idx===0?"-- TOP --":"");
    if (lineNext) lineNext.textContent = originalLines[idx+1]||(idx===lines.length-1?"-- END --":"");
    if (lineCurr) {
        const cT = originalLines[idx];
        // 计算光标在当前行中的相对位置
        const rC = globalCursorPos - start;
        lineCurr.innerHTML = escapeHtml(cT.substring(0, rC)) + '<span class="cursor"></span>' + escapeHtml(cT.substring(rC));

        setTimeout(() => {
            const c = lineCurr.querySelector('.cursor');
            if(c) c.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
        }, 0);
    }
}

// 转义HTML函数
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Editor Logic
function toggleLineComment() {
    let start = globalText.lastIndexOf('\n', globalCursorPos - 1) + 1;
    let end = globalText.indexOf('\n', globalCursorPos);
    if (end === -1) end = globalText.length;
    const line = globalText.substring(start, end);
    let newLine = "", offset = 0;
    if(line.trim().startsWith('//')) { newLine = line.replace('//', ''); offset = -2; }
    else { newLine = '//' + line; offset = 2; }
    globalText = globalText.substring(0, start) + newLine + globalText.substring(end);
    globalCursorPos += offset;
    syncState();
}

function handleEnter() {
    // 统一处理换行符，将\r\n替换为\n进行计算
    const normalizedText = globalText.replace(/\r\n/g, '\n');
    const prevChar = normalizedText[globalCursorPos-1];
    const nextChar = normalizedText[globalCursorPos];
    const lastNL = normalizedText.lastIndexOf('\n', globalCursorPos - 1);
    const lineStart = lastNL === -1 ? 0 : lastNL + 1;
    const currentLine = normalizedText.substring(lineStart, globalCursorPos);
    const indentMatch = currentLine.match(/^(\t*)/);
    let indent = indentMatch ? indentMatch[1] : "";

    if (prevChar === '{' && nextChar === '}') {
        insertTextAtCursor('\n' + indent + '\t' + '\n' + indent, 1 + indent.length);
        return;
    }
    if (prevChar === '{') indent += '\t';
    insertTextAtCursor('\n' + indent);
}

function handleAutoPair(char) {
    const pairs = {'(':')', '{':'}', '[':']', '"':'"', "'":"'"};
    if (pairs[char]) insertTextAtCursor(char + pairs[char], 1);
    else insertTextAtCursor(char);
}

function insertTextAtCursor(t, back=0) {
    globalText = globalText.slice(0, globalCursorPos) + t + globalText.slice(globalCursorPos);
    globalCursorPos += t.length - back;
    syncState();
}
function deleteText(fw) {
    if(fw) { // 向前删除（Delete键）
        if(globalCursorPos < globalText.length) {
            globalText = globalText.slice(0, globalCursorPos) + globalText.slice(globalCursorPos+1);
        }
    }
    else { // 向后删除（Backspace键）
        if(globalCursorPos > 0) {
            // 检查是否在行首（即前一个字符是换行符或Windows换行符的一部分）
            let charsToDelete = 1; // 默认删除一个字符
            
            // 检查是否是Windows换行符（\r\n）的后半部分
            if(globalCursorPos >= 2 && globalText[globalCursorPos-2] === '\r' && globalText[globalCursorPos-1] === '\n') {
                // 删除\r\n这两个字符
                globalText = globalText.slice(0, globalCursorPos-2) + globalText.slice(globalCursorPos);
                globalCursorPos -= 2; // 光标向前移动两位
            }
            // 检查是否是普通换行符（\n）
            else if(globalText[globalCursorPos-1] === '\n') {
                // 删除\n这个字符
                globalText = globalText.slice(0, globalCursorPos-1) + globalText.slice(globalCursorPos);
                globalCursorPos -= 1; // 光标向前移动一位
            }
            else {
                // 普通字符删除
                globalText = globalText.slice(0, globalCursorPos-1) + globalText.slice(globalCursorPos);
                globalCursorPos -= 1; // 光标向前移动一位
            }
        }
    }
    syncState();
}
function moveCursor(d) {
    if(d==='left'&&globalCursorPos>0)globalCursorPos--;
    else if(d==='right'&&globalCursorPos<globalText.length)globalCursorPos++;
    else if(d==='up'||d==='down'){
        // 统一处理换行符，将\r\n替换为\n进行计算
        const normalizedText = globalText.replace(/\r\n/g, '\n');
        const lines = normalizedText.split('\n');
        const lineStarts = [];
        let accum = 0;
        
        for(const line of lines) {
            lineStarts.push({s: accum, l: line.length});
            accum += line.length + 1; // +1 for the newline character
        }
        
        const ci = lineStarts.findIndex(l => globalCursorPos >= l.s && globalCursorPos <= l.s + l.l);
        if(ci !== -1) { 
            const ti = d === 'up' ? ci-1 : ci+1; 
            if(ti >= 0 && ti < lineStarts.length) {
                // 移动到上一行或下一行，保持相同的列位置（如果可能）
                const currentCol = globalCursorPos - lineStarts[ci].s;
                globalCursorPos = Math.min(lineStarts[ti].s + lineStarts[ti].l, lineStarts[ti].s + currentCol);
            }
        }
    }
    syncState();
}

function syncState() {
    // 触发防抖保存
    triggerSaveCode();

    if(isFullMode) {
        if (fullEditor) {
            fullEditor.value=globalText;
            fullEditor.setSelectionRange(globalCursorPos, globalCursorPos);
            updateHighlight();
        }

        // Also update the Monaco editor if it exists
        if(monacoEditor) {
            monacoEditor.setValue(globalText);
        }
    }
    else renderThreeLines();

    // Dispatch custom event to notify Monaco editor of content change
    window.dispatchEvent(new CustomEvent('codeUpdated'));
    
    // 触发移动代码补全更新（如果存在）
    if (typeof updateMobileAutocomplete === 'function') {
        setTimeout(updateMobileAutocomplete, 0); // 使用setTimeout确保在状态更新后执行
    }
}

function handleKeyInput(keyEl) {
    const rawKey = keyEl.getAttribute('data-key');
    if (rawKey === 'Shift') return;
    if (rawKey === 'Control') { isCtrlActive = !isCtrlActive; updateKeyboardVisuals(); return; }

    if (isCtrlActive) {
        if (rawKey === '/') { toggleLineComment(); isCtrlActive = false; updateKeyboardVisuals(); return; }
        isCtrlActive = false; updateKeyboardVisuals();
    }

    let char = null;
    if (isShiftActive) {
        const shiftAttr = keyEl.getAttribute('data-shift');
        if (shiftAttr) char = shiftAttr;
        else if (rawKey.length === 1 && /[a-z]/i.test(rawKey)) char = rawKey.toUpperCase();
        shiftUsageFlag = true;
        if (!isShiftHeld) { isShiftActive = false; updateKeyboardVisuals(); }
    } else {
        char = (rawKey.length === 1 && /[a-z]/i.test(rawKey)) ? rawKey.toLowerCase() : (rawKey.length === 1 ? rawKey : null);
    }

    if (char && ['(', '{', '[', '"', "'"].includes(char)) { handleAutoPair(char); }
    else if (char) insertTextAtCursor(char);
    else {
        switch(rawKey){
            case 'Enter': handleEnter(); break;
            case 'Backspace': deleteText(false); break;
            case 'Delete': deleteText(true); break;
            case 'Space': insertTextAtCursor(' '); break;
            case 'Tab': insertTextAtCursor('\t'); break;
            case 'ArrowLeft': moveCursor('left'); break;
            case 'ArrowRight': moveCursor('right'); break;
            case 'ArrowUp': moveCursor('up'); break;
            case 'ArrowDown': moveCursor('down'); break;
            case 'Home': {
                // 统一处理换行符，将\r\n替换为\n进行计算
                const normalizedText = globalText.replace(/\r\n/g, '\n');
                globalCursorPos = normalizedText.lastIndexOf('\n', globalCursorPos-1) + 1;
                syncState(); 
                break;
            }
            case 'End': {
                // 找到当前行的开始位置
                const currentLineStart = globalText.lastIndexOf('\n', globalCursorPos - 1) + 1;
                // 找到当前行的结束位置（下一个换行符的位置）
                let currentLineEnd;
                
                // 检查是否是Windows换行符 \r\n
                let pos = currentLineStart;
                while (pos < globalText.length) {
                    if (pos < globalText.length - 1 && 
                        globalText[pos] === '\r' && 
                        globalText[pos + 1] === '\n') {
                        currentLineEnd = pos; // 换行符前的位置
                        break;
                    } else if (globalText[pos] === '\n') {
                        currentLineEnd = pos; // 换行符前的位置
                        break;
                    }
                    pos++;
                }
                
                // 如果当前行没有换行符（即在最后一行），则移动到文档末尾
                // 否则移动到当前行的末尾（换行符前一个位置）
                if (typeof currentLineEnd === 'undefined') {
                    globalCursorPos = globalText.length;
                } else {
                    globalCursorPos = currentLineEnd;
                }
                syncState(); 
                break;
            }
            case 'PageUp': for(let i=0;i<5;i++)moveCursor('up'); break;
            case 'PageDown': for(let i=0;i<5;i++)moveCursor('down'); break;
        }
    }
    
    // 触发移动代码补全更新（如果存在）
    if (typeof updateMobileAutocomplete === 'function') {
        setTimeout(updateMobileAutocomplete, 0); // 使用setTimeout确保在状态更新后执行
    }
}

if (fullEditor) {
    fullEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '\t'); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            const val = fullEditor.value; const pos = fullEditor.selectionStart;
            const prev = val[pos-1]; const next = val[pos];
            const lastNL = val.lastIndexOf('\n', pos - 1);
            const lineStart = lastNL === -1 ? 0 : lastNL + 1;
            const currentLine = val.substring(lineStart, pos);
            const indentMatch = currentLine.match(/^(\t*)/);
            let indent = indentMatch ? indentMatch[1] : "";
            if (prev === '{' && next === '}') {
                document.execCommand('insertText', false, '\n' + indent + '\t' + '\n' + indent);
                fullEditor.selectionStart = fullEditor.selectionEnd = pos + 1 + indent.length + 1;
            } else {
                if (prev === '{') indent += '\t';
                document.execCommand('insertText', false, '\n' + indent);
            }
        }
        else if (['(','{','[','"',"'"].includes(e.key)) {
            e.preventDefault();
            const pairs = {'(':')', '{':'}', '[':']', '"':'"', "'":"'"};
            document.execCommand('insertText', false, e.key + pairs[e.key]);
            fullEditor.selectionStart = fullEditor.selectionEnd = fullEditor.selectionStart - 1;
        }
        else if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            globalText = fullEditor.value; globalCursorPos = fullEditor.selectionStart;
            toggleLineComment();
            fullEditor.value = globalText; fullEditor.setSelectionRange(globalCursorPos, globalCursorPos); updateHighlight();
        }
    });
}

if (keys) {
    keys.forEach(k => {
        if(k.getAttribute('data-key')==='Shift'||k.getAttribute('data-key')==='Control'||k.classList.contains('spacer'))return;
        const rep = k.classList.contains('repeat-key');
        const tr=(e)=>{e.preventDefault();k.classList.add('active');if(navigator.vibrate)navigator.vibrate(10);handleKeyInput(k);
        if(rep){keyDelayTimer=setTimeout(()=>{keyRepeatTimer=setInterval(()=>{if(navigator.vibrate)navigator.vibrate(5);handleKeyInput(k);},50)},400);}};
        const rl=(e)=>{e.preventDefault();k.classList.remove('active');clearTimeout(keyDelayTimer);clearInterval(keyRepeatTimer);};
        k.addEventListener('touchstart',tr,{passive:false}); k.addEventListener('touchend',rl);
        k.addEventListener('mousedown',tr); k.addEventListener('mouseup',rl); k.addEventListener('mouseleave',rl);
    });
}

function updateKeyboardVisuals() {
    if (!keys) return; // 如果keys不存在则返回
    
    keys.forEach(k => {
        const sVal = k.getAttribute('data-shift');
        const dKey = k.getAttribute('data-key');
        if(dKey==='Shift') k.classList.toggle('shift-hold', isShiftActive);
        if(dKey==='Control') k.classList.toggle('ctrl-hold', isCtrlActive);
        if(k.classList.contains('alpha-key')) k.innerText=isShiftActive?dKey.toUpperCase():dKey.toUpperCase();
        else if(sVal){ const sup=k.querySelector('.sup');const main=k.querySelector('.main'); if(sup&&main) k.classList.toggle('shifted', isShiftActive); }
    });
}
if (shiftKeys) {
    shiftKeys.forEach(k=>{
        const s=(e)=>{e.preventDefault();isShiftHeld=true;shiftUsageFlag=false;isShiftActive=true;updateKeyboardVisuals();if(navigator.vibrate)navigator.vibrate(10);};
        const e=(e)=>{e.preventDefault();isShiftHeld=false;if(shiftUsageFlag)isShiftActive=false;updateKeyboardVisuals();};
        k.addEventListener('touchstart',s,{passive:false});k.addEventListener('touchend',e);
        k.addEventListener('mousedown',s);k.addEventListener('mouseup',e);
    });
}
if (ctrlKeys) {
    ctrlKeys.forEach(k=>{
        const s=(e)=>{e.preventDefault();k.classList.add('active');if(navigator.vibrate)navigator.vibrate(10);handleKeyInput(k);};
        const e=(e)=>{e.preventDefault();k.classList.remove('active');};
        k.addEventListener('touchstart',s,{passive:false});k.addEventListener('touchend',e);
        k.addEventListener('mousedown',s);k.addEventListener('mouseup',e);
    });
}

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        // 在切换前先保存当前编辑器的内容到globalText
        if (isFullMode) {
            // 当前是全屏模式，从fullEditor获取内容
            if (fullEditor) {
                globalText = fullEditor.value;
                globalCursorPos = fullEditor.selectionStart;
            }
        } else {
            // 当前是3行模式，从globalText获取内容（实际上不需要改变，因为3行模式就是显示globalText）
            // 但我们需要确保globalText是最新的
            // 由于3行模式只是显示globalText的一部分，所以不需要额外操作
        }

        isFullMode = !isFullMode;
        localStorage.setItem('phoi_isFullMode', isFullMode);

        if (isFullMode) {
            if (keyboardContainer) {
                keyboardContainer.classList.add('hide-keyboard');
            }
            if (linesContainer) {
                linesContainer.style.display = 'none';
            }
            if (editorWrapper) {
                editorWrapper.style.display = 'flex';
            }
            if (fullEditor) {
                fullEditor.value=globalText; 
                fullEditor.focus(); 
                fullEditor.setSelectionRange(globalCursorPos, globalCursorPos);
            }
            updateHighlight();
            syncScroll();
            toggleBtn.textContent = '▲';

            // 同时更新Monaco编辑器
            if (monacoEditor) {
                monacoEditor.setValue(globalText);
            }
        } else {
            // Before switching to 3-line mode, get latest content from Monaco editor if it exists
            if (monacoEditor) {
                globalText = monacoEditor.getValue();
            }

            globalCursorPos = globalText.length; // Set cursor to end of text

            if (keyboardContainer) {
                keyboardContainer.classList.remove('hide-keyboard');
            }
            if (linesContainer) {
                linesContainer.style.display = 'flex';
            }
            if (editorWrapper) {
                editorWrapper.style.display = 'none';
            }
            toggleBtn.textContent = '▼';
            renderThreeLines();
        }

        // Show/hide Monaco Editor container based on mode
        const editorContainer = document.getElementById('editor-container');
        if (editorContainer) {
            editorContainer.style.display = isFullMode ? 'block' : 'none';
        }
    });
}

// 初始化：根据保存的模式直接应用布局
if (isFullMode) {
    if (keyboardContainer) {
        keyboardContainer.classList.add('hide-keyboard');
    }
    if (linesContainer) {
        linesContainer.style.display = 'none';
    }
    if (editorWrapper) {
        editorWrapper.style.display = 'flex';
    }
    if (toggleBtn) {
        toggleBtn.textContent = '▲';
    }
    if (fullEditor) {
        fullEditor.value = globalText;
        updateHighlight();
    }

    // 如果Monaco编辑器已创建，也要更新它
    if (monacoEditor) {
        monacoEditor.setValue(globalText);
    }
} else {
    updateGutter();
    renderThreeLines();
}

// 根据保存的模式设置 Monaco Editor 容器的显示状态
const editorContainer = document.getElementById('editor-container');
if (editorContainer) {
    editorContainer.style.display = isFullMode ? 'block' : 'none';
}

updateKeyboardVisuals();

// --- 事件监听器 ---
// 顶部菜单栏事件 - 需要检查元素是否存在
if (fileMenu) {
    fileMenu.addEventListener('click', function() {
        // 显示文件下拉菜单
        if (fileDropdown) {
            fileDropdown.style.display = 'block';
        }
    });
}

// 窗口菜单事件
if (windowMenu) {
    windowMenu.addEventListener('click', function() {
        // 显示窗口下拉菜单
        if (windowDropdown) {
            windowDropdown.style.display = 'block';
        }
    });
}

// 获取关于弹窗元素
const aboutModal = document.getElementById('about-modal');
const closeAbout = document.getElementById('close-about');

if (aboutMenu) {
    aboutMenu.addEventListener('click', function() {
        // 显示关于弹窗
        if (aboutModal) {
            aboutModal.style.display = 'flex';
        }
    });
}

// 帮助菜单事件
const helpTutorialBtn = document.getElementById('help-tutorial');
const helpShortcutsBtn = document.getElementById('help-shortcuts');

if (helpMenu) {
    helpMenu.addEventListener('click', function() {
        // 显示帮助下拉菜单
        if (helpDropdown) {
            helpDropdown.style.display = 'block';
        }
    });
}

// 新手教程按钮
if (helpTutorialBtn) {
    helpTutorialBtn.addEventListener('click', function() {
        // 重置教程步骤
        currentTutorialStep = 0;
        // 显示教程
        showTutorial();
        // 隐藏下拉菜单
        if (helpDropdown) {
            helpDropdown.style.display = 'none';
        }
    });
}

// 快捷键按钮
if (helpShortcutsBtn) {
    helpShortcutsBtn.addEventListener('click', function() {
        // 显示快捷键信息
        showShortcutsInfo();
        // 隐藏下拉菜单
        if (helpDropdown) {
            helpDropdown.style.display = 'none';
        }
    });
}

// 关闭关于弹窗
if (closeAbout) {
    closeAbout.addEventListener('click', function() {
        if (aboutModal) {
            aboutModal.style.display = 'none';
        }
    });
}

// 点击弹窗外部关闭弹窗
window.addEventListener('click', function(event) {
    if (event.target === aboutModal) {
        if (aboutModal) {
            aboutModal.style.display = 'none';
        }
    }
});

// 点击其他地方关闭下拉菜单
document.addEventListener('click', function(event) {
    if (fileMenu && fileDropdown && !fileMenu.contains(event.target) && !fileDropdown.contains(event.target)) {
        fileDropdown.style.display = 'none';
    }
    if (windowMenu && windowDropdown && !windowMenu.contains(event.target) && !windowDropdown.contains(event.target)) {
        windowDropdown.style.display = 'none';
    }
    if (helpMenu && helpDropdown && !helpMenu.contains(event.target) && !helpDropdown.contains(event.target)) {
        helpDropdown.style.display = 'none';
    }
});

// 文件操作按钮事件 - 需要检查元素是否存在
if (uploadFileBtn) {
    uploadFileBtn.addEventListener('click', function() {
        if (window.vfsModule && typeof window.vfsModule.uploadFile === 'function') {
            window.vfsModule.uploadFile();
        }
    });
}
if (downloadFileBtn) {
    downloadFileBtn.addEventListener('click', function() {
        if (window.vfsModule && typeof window.vfsModule.downloadCurrentFile === 'function') {
            window.vfsModule.downloadCurrentFile();
        }
    });
}
if (saveAsBtn) {
    saveAsBtn.addEventListener('click', function() {
        if (window.vfsModule && typeof window.vfsModule.saveCurrentFileAs === 'function') {
            window.vfsModule.saveCurrentFileAs();
        }
    });
}
if (newFileBtn) {
    newFileBtn.addEventListener('click', function() {
        if (window.vfsModule && typeof window.vfsModule.newFile === 'function') {
            window.vfsModule.newFile();
        }
    });
}

// 窗口控制按钮事件
// 当前缩放级别，从localStorage读取，默认为1
let currentScale = parseFloat(localStorage.getItem('phoi_zoomScale')) || 1;

function applyScale() {
    // 清理transform设置
    document.body.style.transform = '';
    document.body.style.transformOrigin = '';
    document.body.style.width = '';
    document.body.style.height = '';

    // 使用 zoom 属性缩放
    document.documentElement.style.zoom = currentScale;

    // 确保html和body都能正确显示内容
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';
    document.documentElement.style.overflow = 'auto';

    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.overflow = 'auto';

    // 保存到localStorage
    localStorage.setItem('phoi_zoomScale', currentScale.toString());

    // 触发Monaco编辑器重新布局（如果存在）
    if (typeof monacoEditor !== 'undefined' && monacoEditor) {
        try {
            setTimeout(() => monacoEditor.layout(), 100);
        } catch (e) {
            console.log('Monaco layout error:', e);
        }
    }
}

if (windowZoomInBtn) {
    windowZoomInBtn.addEventListener('click', function() {
        // 放大页面
        if (currentScale < 2.0) {
            currentScale += 0.1;
            applyScale();
        }
        windowDropdown.style.display = 'none';
    });
}

if (windowZoomOutBtn) {
    windowZoomOutBtn.addEventListener('click', function() {
        // 缩小页面
        if (currentScale > 0.5) {
            currentScale -= 0.1;
            applyScale();
        }
        windowDropdown.style.display = 'none';
    });
}

if (windowZoomResetBtn) {
    windowZoomResetBtn.addEventListener('click', function() {
        // 重置缩放
        currentScale = 1;
        applyScale();
        windowDropdown.style.display = 'none';
    });
}

if (windowReloadBtn) {
    windowReloadBtn.addEventListener('click', function() {
        // 重载页面
        location.reload();
        windowDropdown.style.display = 'none';
    });
}

// 键盘事件：Ctrl+上/下箭头缩放
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey) {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (currentScale < 2.0) {
                currentScale += 0.1;
                applyScale();
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (currentScale > 0.5) {
                currentScale -= 0.1;
                applyScale();
            }
        }
    }
});

// 滚轮事件：Ctrl+滚轮缩放
document.addEventListener('wheel', function(event) {
    if (event.ctrlKey) {
        event.preventDefault();
        const delta = event.deltaY;
        if (delta < 0) {
            // 滚轮向上，放大
            if (currentScale < 2.0) {
                currentScale += 0.1;
                applyScale();
            }
        } else {
            // 滚轮向下，缩小
            if (currentScale > 0.5) {
                currentScale -= 0.1;
                applyScale();
            }
        }
    }
}, { passive: false });


// 插件中心面板切换功能
function togglePluginCenterPanel() {
    if (!pluginCenterPanel || !pluginCenterToggle) return; // 如果元素不存在则返回

    if (pluginCenterPanel.style.display === 'none' || pluginCenterPanel.style.display === '') {
        pluginCenterPanel.style.display = 'flex';
        // 添加CSS类来表示面板打开状态
        pluginCenterToggle.classList.add('plugin-center-open');

        // 同时隐藏VFS面板（如果它是可见的）
        if (vfsPanel) {
            vfsPanel.style.display = 'none';
        }
        if (sidebarToggle) {
            sidebarToggle.classList.remove('vfs-open');
        }
    } else {
        pluginCenterPanel.style.display = 'none';
        // 移除CSS类来表示面板关闭状态
        pluginCenterToggle.classList.remove('plugin-center-open');
    }
}

// 插件中心事件处理
if (pluginCenterToggle) {
    pluginCenterToggle.addEventListener('click', togglePluginCenterPanel);
}

// 插件中心关闭按钮事件
if (pluginCenterCloseBtn) {
    pluginCenterCloseBtn.addEventListener('click', function() {
        if (pluginCenterPanel) {
            pluginCenterPanel.style.display = 'none';
        }
        if (pluginCenterToggle) {
            pluginCenterToggle.classList.remove('plugin-center-open');
        }
    });
}

// 初始化插件设置UI
function initPluginSettings() {
    // 设置C++代码补全插件的UI状态
    const cppAutocompleteEnabledCheckbox = document.getElementById('cpp-autocomplete-enabled');
    const cppAutocompleteDelayInput = document.getElementById('cpp-autocomplete-delay');

    if (cppAutocompleteEnabledCheckbox) {
        cppAutocompleteEnabledCheckbox.checked = cppAutocompleteEnabled;

        // 添加事件监听器
        cppAutocompleteEnabledCheckbox.addEventListener('change', function() {
            cppAutocompleteEnabled = this.checked;
            localStorage.setItem(CPP_AUTOCOMPLETE_ENABLED_KEY, cppAutocompleteEnabled);

            // 更新编辑器的代码补全设置
            if (monacoEditor) {
                const newQuickSuggestionsDelay = cppAutocompleteEnabled ? cppAutocompleteDelay : 0;

                monacoEditor.updateOptions({
                    quickSuggestions: cppAutocompleteEnabled,
                    quickSuggestionsDelay: newQuickSuggestionsDelay,
                    parameterHints: {
                        enabled: cppAutocompleteEnabled
                    },
                    suggest: {
                        snippetsPrevented: !cppAutocompleteEnabled
                    }
                });

                // 重新注册补全提供程序以反映开关状态
                // 注意：Monaco Editor不提供直接注销补全提供程序的方法
                // 因此我们只能通过重新创建编辑器或刷新模型来实现
                // 这里我们简单地重新创建编辑器
                const currentValue = monacoEditor.getValue();
                const currentSelection = monacoEditor.getSelection();

                // 销毁当前编辑器实例
                monacoEditor.dispose();

                // 重新创建编辑器
                monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
                    value: currentValue,
                    language: 'cpp',
                    theme: 'vs-dark',
                    automaticLayout: true,
                    quickSuggestions: cppAutocompleteEnabled,
                    quickSuggestionsDelay: newQuickSuggestionsDelay,
                    parameterHints: {
                        enabled: cppAutocompleteEnabled
                    },
                    wordBasedSuggestions: false,
                    suggest: {
                        localityBonus: false,
                        snippetsPrevented: !cppAutocompleteEnabled
                    }
                });

                // 恢复光标位置
                if(currentSelection) {
                    monacoEditor.setSelection(currentSelection);
                }

                // 重新注册补全提供程序
                if (cppAutocompleteEnabled && typeof registerCompletionProviders === 'function') {
                    registerCompletionProviders();
                }

                // 重新绑定编辑器事件
                monacoEditor.onDidChangeModelContent(() => {
                    globalText = monacoEditor.getValue();
                    triggerSaveCode();
                });
            }
        });
    }

    if (cppAutocompleteDelayInput) {
        cppAutocompleteDelayInput.value = cppAutocompleteDelay;

        // 添加事件监听器
        cppAutocompleteDelayInput.addEventListener('change', function() {
            cppAutocompleteDelay = this.value !== '' ? parseInt(this.value) : 200;
            localStorage.setItem(CPP_AUTOCOMPLETE_DELAY_KEY, cppAutocompleteDelay);

            // 更新编辑器的自动补全延迟（仅在代码补全启用时）
            if (monacoEditor && cppAutocompleteEnabled) {
                monacoEditor.updateOptions({
                    quickSuggestionsDelay: cppAutocompleteDelay
                });
            }
        });
    }

}

// 初始化插件设置
initPluginSettings();



// 初始化模式
if (isFullMode) {
    if (linesContainer) {
        linesContainer.style.display = 'none';
    }
    if (keyboardContainer) {
        keyboardContainer.style.display = 'flex';
    }
    if (toggleBtn) {
        toggleBtn.textContent = '▲';
    }
    // 显示Monaco编辑器
    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
        editorContainer.style.display = 'block';
    }
} else {
    if (linesContainer) {
        linesContainer.style.display = 'flex';
    }
    if (keyboardContainer) {
        keyboardContainer.style.display = 'flex'; // 在手机模式下也显示键盘
        // 让键盘铺满屏幕，不留空白
        keyboardContainer.style.position = 'fixed';
        keyboardContainer.style.bottom = '0';
        keyboardContainer.style.left = '0';
        keyboardContainer.style.right = '0';
        keyboardContainer.style.top = 'auto';
    }
    if (toggleBtn) {
        toggleBtn.textContent = '▼';
    }
    // 隐藏Monaco编辑器
    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
        editorContainer.style.display = 'none';
    }
    // 渲染3行预览
    renderThreeLines();
}

// 高亮函数
function highlight(code) {
    let pMap = {}, pIdx = 0;
    // --- [修正] 正则表达式修复 ---
    // 之前是 ".?" (0或1个字符)，导致长字符串不高亮。改为 "[^"]*" (非引号的任意字符序列)
    // 同时也修复了注释匹配
    let safe = code.replace(/("[^"]*"|'[^']*'|\/\/.*$)/gm, (m) => {
        const k = `___P${pIdx++}_`;
        pMap[k]=m;
        return k;
    });

    safe = escapeHtml(safe);

    // 关键词高亮
    safe = safe.replace(/\b(int|float|double|char|void|if|else|for|while|do|return|class|struct|public|private|protected|virtual|static|const|namespace|using|template|typename|bool|true|false|new|delete|std|cin|cout|endl)\b/g, '<span class="hl-kw">$1</span>');
    // 数字高亮
    safe = safe.replace(/\b(\d+)\b/g, '<span class="hl-num">$1</span>');
    // 预处理指令高亮
    safe = safe.replace(/^(#\w+)(.*)$/gm, (m,d,r) => `<span class="hl-dir">${d}</span>${r}`);

    // 还原字符串和注释
    Object.keys(pMap).forEach(k => {
        let o = pMap[k], r = '';
        if(o.startsWith('"')||o.startsWith("'")) r = `<span class="hl-str">${escapeHtml(o)}</span>`;
        else if(o.startsWith('//')) r = `<span class="hl-com">${escapeHtml(o)}</span>`;
        safe = safe.replace(k, r);
    });
    return safe;
}

function updateHighlight() {
    if (!fullEditor) return; // 如果fullEditor不存在则返回
    
    const txt = fullEditor.value;
    // 确保最后一行也有换行符处理，防止正则漏掉
    if (highlightLayer) {
        highlightLayer.innerHTML = highlight(txt.endsWith('\n')?txt+' ':txt);
    }
    updateGutter();
}

function updateGutter() {
    if (!fullEditor || !gutter) return; // 如果元素不存在则返回
    
    const lineCount = fullEditor.value.split('\n').length;
    gutter.innerText = Array.from({length: lineCount}, (_, i) => i + 1).join('\n');
}

function syncScroll() {
    if (!fullEditor || !highlightLayer || !gutter) return; // 如果元素不存在则返回
    
    highlightLayer.scrollTop = fullEditor.scrollTop;
    highlightLayer.scrollLeft = fullEditor.scrollLeft;
    gutter.scrollTop = fullEditor.scrollTop;
}

if (fullEditor) {
    fullEditor.addEventListener('input', () => {
        updateHighlight();
        globalText = fullEditor.value;
        globalCursorPos = fullEditor.selectionStart;
        // 触发防抖保存
        triggerSaveCode();
    });
    fullEditor.addEventListener('scroll', syncScroll);
}



// 公共接口，供插件使用
window.PhoiAPI = {
    // 获取当前文件名
    getCurrentFileName: function() {
        return currentFileName;
    },

    // 设置当前文件名
    setCurrentFileName: function(fileName) {
        currentFileName = fileName;
        localStorage.setItem('phoi_currentFileName', currentFileName);

        // 更新顶部菜单栏中显示的当前文件名
        const currentFileNameElement = document.getElementById('current-file-name');
        if (currentFileNameElement) {
            currentFileNameElement.textContent = currentFileName;
        }
    },

    // 获取当前文件内容
    getCurrentFileContent: function() {
        return globalText;
    },

    // 设置当前文件内容
    setCurrentFileContent: function(content) {
        globalText = content;
        if (monacoEditor) {
            monacoEditor.setValue(content);
        }
    },

    // 打开文件
    openFile: async function(fileName) {
        // 从虚拟文件系统获取文件内容
        if (window.vfsModule && typeof window.vfsModule.getFileContent === 'function') {
            const fileContent = await window.vfsModule.getFileContent(fileName);
            
            if (fileContent !== null) {
                // 更新全局文本为文件内容
                globalText = fileContent;
                currentFileName = fileName; // 更新当前文件名

                // 更新编辑器内容
                if (monacoEditor) {
                    monacoEditor.setValue(globalText);
                }

                // 更新顶部菜单栏中显示的当前文件名
                const currentFileNameElement = document.getElementById('current-file-name');
                if (currentFileNameElement) {
                    currentFileNameElement.textContent = currentFileName;
                }

                // 保存当前文件名到本地存储
                localStorage.setItem('phoi_currentFileName', currentFileName);

                // 关闭虚拟文件系统面板
                if (window.vfsPanel) {
                    window.vfsPanel.style.display = 'none';
                }
                if (window.sidebarToggle) {
                    window.sidebarToggle.classList.remove('vfs-open');
                }

                // 显示提示信息
                if (typeof showMessage === 'function') {
                    showMessage(`已打开文件: ${fileName}`, 'user');
                }

                return true;
            } else {
                console.error(`文件 ${fileName} 不存在`);
                return false;
            }
        }
    },

    // 创建新文件
    createNewFile: async function(fileName, content = '') {
        if (window.vfsModule && typeof window.vfsModule.createNewFile === 'function') {
            return await window.vfsModule.createNewFile(fileName, content);
        }
    },

    // 获取所有文件列表
    getFileList: async function() {
        if (window.vfsModule && typeof window.vfsModule.getFileList === 'function') {
            return await window.vfsModule.getFileList();
        }
        return [];
    }
};



// 首选项功能相关函数
function showPreferencesModal() {
    // 加载当前默认代码到编辑器
    const currentDefaultCode = localStorage.getItem('phoi_defaultCode') || defaultDefaultCode;
    if (defaultCodeEditor) {
        defaultCodeEditor.value = currentDefaultCode;
    }

    // 加载 clangd 设置
    const clangdEnabledCheckbox = document.getElementById('clangd-enabled');
    if (clangdEnabledCheckbox) {
        clangdEnabledCheckbox.checked = localStorage.getItem('phoi_clangd_enabled') === 'true';
    }
    
    // 加载 clangd 代码提示设置
    const clangdCompletionCheckbox = document.getElementById('clangd-completion-enabled');
    if (clangdCompletionCheckbox) {
        clangdCompletionCheckbox.checked = localStorage.getItem('phoi_clangd_completion_enabled') === 'true';
        // 根据 clangd 是否启用显示/隐藏此选项
        const settingDiv = document.getElementById('clangd-completion-setting');
        if (settingDiv) {
            settingDiv.style.display = clangdEnabledCheckbox?.checked ? 'block' : 'none';
        }
    }

    // 加载 clangd 语义高亮设置
    const clangdSemanticCheckbox = document.getElementById('clangd-semantic-enabled');
    if (clangdSemanticCheckbox) {
        // 默认禁用语义高亮
        clangdSemanticCheckbox.checked = localStorage.getItem('phoi_clangd_semantic_enabled') === 'true';
        // 根据 clangd 是否启用显示/隐藏此选项
        const settingDiv = document.getElementById('clangd-semantic-setting');
        if (settingDiv) {
            settingDiv.style.display = clangdEnabledCheckbox?.checked ? 'block' : 'none';
        }
    }

    // 添加 clangd 启用状态变化监听（使用 onchange 避免重复绑定）
    if (clangdEnabledCheckbox) {
        clangdEnabledCheckbox.onchange = function() {
            const completionSettingDiv = document.getElementById('clangd-completion-setting');
            if (completionSettingDiv) {
                completionSettingDiv.style.display = this.checked ? 'block' : 'none';
            }
            const semanticSettingDiv = document.getElementById('clangd-semantic-setting');
            if (semanticSettingDiv) {
                semanticSettingDiv.style.display = this.checked ? 'block' : 'none';
            }
            // 如果关闭 clangd，同时取消代码提示和语义高亮勾选
            if (!this.checked) {
                if (clangdCompletionCheckbox) {
                    clangdCompletionCheckbox.checked = false;
                }
                if (clangdSemanticCheckbox) {
                    clangdSemanticCheckbox.checked = false;
                }
            }
        };
    }

    // 显示弹窗
    if (preferencesModal) {
        preferencesModal.style.display = 'flex';
    }
}

function hidePreferencesModal() {
    // 隐藏弹窗
    if (preferencesModal) {
        preferencesModal.style.display = 'none';
    }
}

function savePreferencesChanges() {
    // 保存默认代码到本地存储
    if (defaultCodeEditor) {
        const newDefaultCode = defaultCodeEditor.value;
        localStorage.setItem('phoi_defaultCode', newDefaultCode);
        
        // 更新当前的 defaultCode 变量
        // 注意：这不会影响当前已打开的文件，只会影响新创建的文件
        showMessage('默认代码已保存！', 'system');
    }

    // 保存 clangd 设置
    const clangdEnabledCheckbox = document.getElementById('clangd-enabled');
    const clangdCompletionCheckbox = document.getElementById('clangd-completion-enabled');
    const clangdSemanticCheckbox = document.getElementById('clangd-semantic-enabled');
    if (clangdEnabledCheckbox) {
        const isEnabled = clangdEnabledCheckbox.checked;
        localStorage.setItem('phoi_clangd_enabled', isEnabled);

        if (isEnabled) {
            showMessage('Clangd 设置已保存！刷新页面后生效。', 'system');
        } else {
            showMessage('Clangd 已禁用！刷新页面后生效。', 'system');
        }

        // 保存 clangd 代码提示设置
        if (clangdCompletionCheckbox) {
            const isCompletionEnabled = clangdCompletionCheckbox.checked;
            localStorage.setItem('phoi_clangd_completion_enabled', isCompletionEnabled);
        }

        // 保存 clangd 语义高亮设置
        if (clangdSemanticCheckbox) {
            const isSemanticEnabled = clangdSemanticCheckbox.checked;
            localStorage.setItem('phoi_clangd_semantic_enabled', isSemanticEnabled);
        }

        // 更新右键菜单状态
        updateContextMenuState();
    } else {
        // 保存 clangd 代码提示设置（即使 clangd 未启用也要保存）
        if (clangdCompletionCheckbox) {
            const isCompletionEnabled = clangdCompletionCheckbox.checked;
            localStorage.setItem('phoi_clangd_completion_enabled', isCompletionEnabled);
        }
        // 保存 clangd 语义高亮设置
        if (clangdSemanticCheckbox) {
            const isSemanticEnabled = clangdSemanticCheckbox.checked;
            localStorage.setItem('phoi_clangd_semantic_enabled', isSemanticEnabled);
        }
    }

    // 隐藏弹窗
    hidePreferencesModal();
}

function resetToDefaultCode() {
    if (defaultCodeEditor) {
        defaultCodeEditor.value = defaultDefaultCode;
    }
}

// 更新本地文件系统启用状态
function updateNativeFSStatus() {
    const nativeFSEnabledCheckbox = document.getElementById('native-fs-enabled');
    if (nativeFSEnabledCheckbox) {
        nativeFSEnabledCheckbox.checked = localStorage.getItem('phoi_useNativeFS') === 'true';
        
        nativeFSEnabledCheckbox.addEventListener('change', function() {
            const isEnabled = this.checked;
            localStorage.setItem('phoi_useNativeFS', isEnabled);
            
            // 重新初始化VFS模块以应用更改
            if (window.vfsModule && typeof window.vfsModule.initVFSModule === 'function') {
                window.location.reload(); // 重新加载页面以应用更改
            }
        });
    }
    
}

// 显示本地存储信息
function showLocalStorageInfo() {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'local-storage-info-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // 创建弹窗内容
    const modal = document.createElement('div');
    modal.id = 'local-storage-info-modal';
    modal.style.backgroundColor = '#252526';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    modal.style.textAlign = 'left';
    modal.style.maxWidth = '500px';
    modal.style.width = '80%';
    modal.style.color = '#cccccc';
    modal.style.maxHeight = '80vh';
    modal.style.overflowY = 'auto';

    // 添加标题
    const title = document.createElement('h3');
    title.textContent = '本地文件系统功能说明';
    title.style.color = '#ffffff';
    title.style.marginTop = '0';
    title.style.marginBottom = '15px';
    modal.appendChild(title);

    // 添加说明内容
    const content = document.createElement('div');
    content.innerHTML = `
        <p>目前PH code使用的浏览器内置储存用来存储代码，使用该功能可将代码储存到本地，但注意当前版本可能有一些奇怪的问题...</p>
        <ul style="margin: 15px 0; padding-left: 20px;">
            <li>本地文件系统功能允许直接访问您的文件系统</li>
            <li>所有代码将直接保存到您选择的文件夹中</li>
            <li>功能仍在开发中，可能存在一些不稳定因素</li>
            <li>如果遇到问题，可以随时切换回虚拟文件系统</li>
        </ul>
        <p>启用此功能需要您手动选择一个文件夹进行访问授权。</p>
    `;
    modal.appendChild(content);

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.textAlign = 'right';
    buttonContainer.style.marginTop = '20px';

    // 确定按钮
    const okButton = document.createElement('button');
    okButton.textContent = '确定';
    okButton.style.backgroundColor = '#0e639c';
    okButton.style.color = 'white';
    okButton.style.border = 'none';
    okButton.style.padding = '8px 16px';
    okButton.style.borderRadius = '4px';
    okButton.style.cursor = 'pointer';
    okButton.onclick = function() {
        document.body.removeChild(overlay);
    };

    buttonContainer.appendChild(okButton);
    modal.appendChild(buttonContainer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}


// 显示 Clangd 语言服务器信息
function showClangdInfo() {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'clangd-info-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // 创建弹窗内容
    const modal = document.createElement('div');
    modal.id = 'clangd-info-modal';
    modal.style.backgroundColor = '#252526';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    modal.style.textAlign = 'left';
    modal.style.maxWidth = '500px';
    modal.style.width = '80%';
    modal.style.color = '#cccccc';
    modal.style.maxHeight = '80vh';
    modal.style.overflowY = 'auto';

    // 添加标题
    const title = document.createElement('h3');
    title.textContent = 'Clangd 前端语言服务器';
    title.style.color = '#ffffff';
    title.style.marginTop = '0';
    title.style.marginBottom = '15px';
    modal.appendChild(title);

    // 添加说明内容
    const content = document.createElement('div');
    content.innerHTML = `
        <p>Clangd 是一个强大的 C/C++ 语言服务器，提供以下功能：</p>
        <ul style="margin: 15px 0; padding-left: 20px;">
            <li>实时错误诊断</li>
            <li>代码提示</li>
            <li>函数参数标签</li>
            <li>鼠标悬停提示</li>
            <li>语法高亮</li>
        </ul>
        <p><strong>注意事项：</strong></p>
        <ul style="margin: 15px 0; padding-left: 20px;">
            <li>此功能为实验性功能，可能存在不稳定因素</li>
            <li>首次加载需要下载较大的 WASM 文件（约 25MB），请耐心等待</li>
            <li>需要浏览器支持解压api</li>
            <li>启用后会增加内存占用和初始加载时间</li>
            <li>错误诊断延迟时间据电脑性能定</li>
        </ul>
        <p>如果您在移动设备上使用或网络条件不佳，建议禁用此功能。</p>
    `;
    modal.appendChild(content);

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.textAlign = 'right';
    buttonContainer.style.marginTop = '20px';

    // 确定按钮
    const okButton = document.createElement('button');
    okButton.textContent = '确定';
    okButton.style.backgroundColor = '#0e639c';
    okButton.style.color = 'white';
    okButton.style.border = 'none';
    okButton.style.padding = '8px 16px';
    okButton.style.borderRadius = '4px';
    okButton.style.cursor = 'pointer';
    okButton.onclick = function() {
        document.body.removeChild(overlay);
    };

    buttonContainer.appendChild(okButton);
    modal.appendChild(buttonContainer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// --- 新手教程功能 ---
const tutorialModal = document.getElementById('tutorial-modal');
const tutorialContent = document.getElementById('tutorial-content');
const tutorialPrev = document.getElementById('tutorial-prev');
const tutorialNext = document.getElementById('tutorial-next');
const tutorialSkip = document.getElementById('tutorial-skip');
const closeTutorial = document.getElementById('close-tutorial');

// 教程内容
const tutorialSteps = [
    {
        title: '欢迎使用 PH Code！',
        content: `
            <p>PH Code 是一个强大的在线/本地 C++ 代码编辑器，专为算法竞赛和学习编程而设计。</p>
            <p>本教程将帮助您快速了解 PH Code 的主要功能。</p>
            <p><strong>建议耐心阅读完哦，点击"下一步"继续学习，或点击"跳过"直接开始使用。</strong></p>
        `
    },
    {
        title: '📱 手机模式',
        content: `
            <p>点击右上角的<strong>▼/▲按钮</strong>切换模式：</p>
            <ul>
                <li><strong>桌面模式（默认）</strong> - 完整的Monaco编辑器界面</li>
                <li><strong>手机模式</strong> - 优化的移动端界面，显示3行预览和虚拟键盘</li>
            </ul>
            <p>手机模式适合在移动设备上使用，提供完整的编程体验。</p>
        `
    },
    {
        title: '📝 代码编辑',
        content: `
            <p>主编辑器区域是您编写代码的地方，基于monaco，支持：</p>
            <ul>
                <li><strong>基本语法高亮</strong> - 自动识别 C++ 语法</li>
                <li><strong>基本代码补全</strong> - 智能提示和自动补全</li>
                <li><strong>更多语法加强功能（值得一试）</strong> - 请在文件->首选项中启用clangd</li>
            </ul>
        `
    },
    {
        title: '⚙️ 设置首选项',
        content: `
            <p>点击顶部菜单的<strong>首选项</strong>可以自定义设置：</p>
            <ul>
                <li><strong>默认代码</strong> - 设置新建文件时的默认代码模板</li>
                <li><strong>本地存储</strong> - 启用实验性本地文件系统功能</li>
                <li><strong>Clangd</strong> - 配置高级语言服务器（实验性）</li>
            </ul>
            <p>Clangd 提供更强大的代码补全和语法高亮功能，但需要较长的加载时间。</p>
        `
    },
    {
        title: '▶️ 运行代码',
        content: `
            <p>运行您的代码非常简单：</p>
            <ul>
                <li>点击顶部工具栏的<strong>运行按钮</strong></li>
                <li>或使用快捷键 <strong>F8</strong></li>
            </ul>
            <p>运行结果会显示在底部的终端面板中。</p>
        `
    },
    {
        title: '📁 文件管理',
        content: `
            <p>点击左侧的<strong>文件图标</strong>打开虚拟文件系统）：</p>
            <ul>
                <li><strong>新建文件</strong> - 创建新的代码文件</li>
                <li><strong>打开文件</strong> - 切换到已有文件</li>
                <li><strong>删除文件</strong> - 删除不需要的文件</li>
                <li>注意：清除浏览器缓存等行为可能导致代码丢失，请不要存放贵重代码</li>
            </ul>
        `
    },
    {
        title: '🔌 插件中心',
        content: `
            <p>点击左侧的<strong>插件图标</strong>打开插件中心：</p>
            <ul>
                <li><strong>C++ 代码补全</strong> - 启用/禁用代码补全功能，设置延迟时间</li>
                <li><strong>查看洛谷主题库</strong> - 浏览洛谷题目（实验性）</li>
                <li><strong>CPH 插件</strong> - 管理测试用例，批量运行测试</li>
            </ul>
            <p>CPH 插件特别适合算法竞赛，可以方便地管理多个测试用例。</p>
        `
    },
    {
        title: '🎯 CPH 测试用例管理',
        content: `
            <p>CPH 插件功能：</p>
            <ul>
                <li><strong>快速导入</strong> - 从Luogu插件导入测试点</li>
                <li><strong>添加测试用例</strong> - 为每个测试点设置输入和预期输出</li>
                <li><strong>批量运行</strong> - 按 F9 一次性运行所有测试用例</li>
                <li><strong>结果对比</strong> - 自动比较实际输出和预期输出</li>
                <li><strong>错误识别</strong> - 智能识别编译错误、RE、TLE、MLE 等</li>
            </ul>
            <p>注意：F9 快捷键专门用于运行CPH测试用例，普通代码运行请使用 F8 或 Ctrl+Enter。</p>
            <p>本地版PH Code配合 Competitive Companion 浏览器插件，可以一键导入题目测试用例！</p>
        `
    },
    {
        title: '🎉 开始使用吧！',
        content: `
            <p>恭喜您完成了新手教程！</p>
            <p>现在您可以：</p>
            <ul>
                <li>创建新文件开始编写代码</li>
                <li>尝试运行示例代码</li>
                <li>探索各种插件功能</li>
                <li>配置您的个人偏好设置</li>
            </ul>
            <p><strong>祝您编程愉快！如有问题，欢迎反馈。</strong></p>
        `
    }
];

let currentTutorialStep = 0;

function showTutorial() {
    if (!tutorialModal) return;
    tutorialModal.style.display = 'flex';
    renderTutorialStep();
}

function hideTutorial() {
    if (!tutorialModal) return;
    tutorialModal.style.display = 'none';
    // 标记为已看过教程
    localStorage.setItem('notfirstrun', 'true');
}

function renderTutorialStep() {
    if (!tutorialContent) return;
    
    const step = tutorialSteps[currentTutorialStep];
    const progressText = `(${currentTutorialStep + 1}/${tutorialSteps.length})`;
    
    tutorialContent.innerHTML = `
        <h3 style="color: #4daafc; margin-bottom: 15px;">${step.title}</h3>
        <div style="color: #ccc; line-height: 1.6;">${step.content}</div>
    `;
    
    // 更新按钮状态
    if (tutorialPrev) {
        tutorialPrev.disabled = currentTutorialStep === 0;
        tutorialPrev.style.opacity = currentTutorialStep === 0 ? '0.5' : '1';
    }
    
    if (tutorialNext) {
        tutorialNext.textContent = currentTutorialStep === tutorialSteps.length - 1 ? '完成' : '下一步';
    }
}

function nextTutorialStep() {
    if (currentTutorialStep < tutorialSteps.length - 1) {
        currentTutorialStep++;
        renderTutorialStep();
    } else {
        hideTutorial();
    }
}

function prevTutorialStep() {
    if (currentTutorialStep > 0) {
        currentTutorialStep--;
        renderTutorialStep();
    }
}

// 新手教程事件监听器
if (closeTutorial) {
    closeTutorial.addEventListener('click', hideTutorial);
}

if (tutorialPrev) {
    tutorialPrev.addEventListener('click', prevTutorialStep);
}

if (tutorialNext) {
    tutorialNext.addEventListener('click', nextTutorialStep);
}

if (tutorialSkip) {
    tutorialSkip.addEventListener('click', hideTutorial);
}

// 点击模态框外部关闭
if (tutorialModal) {
    tutorialModal.addEventListener('click', function(event) {
        if (event.target === tutorialModal) {
            hideTutorial();
        }
    });
}

// 检查是否需要显示新手教程
function checkFirstRun() {
    const notFirstRun = localStorage.getItem('notfirstrun');
    if (!notFirstRun) {
        // 延迟显示教程，等待页面完全加载
        setTimeout(showTutorial, 1000);
    }
}

// 显示快捷键信息
function showShortcutsInfo() {
    const shortcutsInfo = `
        <h3 style="color: #4daafc; margin-bottom: 15px;">⌨️ 快捷键</h3>
        <div style="color: #ccc; line-height: 1.6;">
            <h4 style="color: #fff; margin-top: 15px;">运行代码</h4>
            <ul>
                <li><strong>F8</strong> - 运行当前代码（普通运行）</li>
                <li><strong>F9</strong> - 运行CPH测试用例</li>
            </ul>
            
            <h4 style="color: #fff; margin-top: 15px;">编辑操作</h4>
            <ul>
                <li><strong>Ctrl+C</strong> - 复制</li>
                <li><strong>Ctrl+V</strong> - 粘贴</li>
                <li><strong>Ctrl+X</strong> - 剪切</li>
                <li><strong>Ctrl+Z</strong> - 撤销</li>
                <li><strong>Ctrl+Y</strong> - 重做</li>
                <li><strong>Ctrl+A</strong> - 全选</li>
                <li><strong>Ctrl+F</strong> - 查找</li>
                <li><strong>Ctrl+H</strong> - 替换</li>
            </ul>
            
            <h4 style="color: #fff; margin-top: 15px;">编辑器操作</h4>
            <ul>
                <li><strong>Ctrl+/</strong> - 注释/取消注释</li>
                <li><strong>Alt+Up/Down</strong> - 移动行</li>
                <li><strong>Shift+Alt+Up/Down</strong> - 复制行</li>
            </ul>
        </div>
    `;
    
    showInfoModal('快捷键', shortcutsInfo);
}

// 显示信息模态框
function showInfoModal(title, content) {
    // 创建模态框
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.maxWidth = '600px';
    
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `<h2>${title}</h2><span class="close-btn" style="cursor: pointer;">×</span>`;
    
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.maxHeight = '400px';
    body.style.overflowY = 'auto';
    body.innerHTML = content;
    
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    
    const okButton = document.createElement('button');
    okButton.className = 'modal-btn';
    okButton.textContent = '确定';
    okButton.style.backgroundColor = '#0e639c';
    okButton.style.cursor = 'pointer';
    
    okButton.onclick = function() {
        document.body.removeChild(overlay);
    };
    
    // 关闭按钮事件
    header.querySelector('.close-btn').onclick = function() {
        document.body.removeChild(overlay);
    };
    
    // 点击模态框外部关闭
    overlay.onclick = function(event) {
        if (event.target === overlay) {
            document.body.removeChild(overlay);
        }
    };
    
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    footer.appendChild(okButton);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// 首选项弹窗事件监听器
if (preferencesBtn) {
    preferencesBtn.addEventListener('click', function() {
        showPreferencesModal();
        updateNativeFSStatus(); // 更新本地文件系统启用状态
    });
}

// 为本地存储信息图标添加事件监听器
document.addEventListener('click', function(event) {
    if (event.target && event.target.id === 'local-storage-info') {
        event.stopPropagation(); // 阻止事件冒泡
        showLocalStorageInfo();
    }
    if (event.target && event.target.id === 'clangd-info') {
        event.stopPropagation(); // 阻止事件冒泡
        showClangdInfo();
    }
});


// 显示本地存储信息
function showLocalStorageInfo() {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'local-storage-info-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // 创建弹窗内容
    const modal = document.createElement('div');
    modal.id = 'local-storage-info-modal';
    modal.style.backgroundColor = '#252526';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    modal.style.textAlign = 'left';
    modal.style.maxWidth = '500px';
    modal.style.width = '80%';
    modal.style.color = '#cccccc';
    modal.style.maxHeight = '80vh';
    modal.style.overflowY = 'auto';

    // 添加标题
    const title = document.createElement('h3');
    title.textContent = '本地文件系统功能说明';
    title.style.color = '#ffffff';
    title.style.marginTop = '0';
    title.style.marginBottom = '15px';
    modal.appendChild(title);

    // 添加说明内容
    const content = document.createElement('div');
    content.innerHTML = `
        <p>目前PH code使用的浏览器内置储存用来存储代码，使用该功能可将代码储存到本地，但注意当前版本可能有一些奇怪的问题...</p>
        <ul style="margin: 15px 0; padding-left: 20px;">
            <li>本地文件系统功能允许直接访问您的文件系统</li>
            <li>所有代码将直接保存到您选择的文件夹中</li>
            <li>功能仍在开发中，可能存在一些不稳定因素</li>
            <li>如果遇到问题，可以随时切换回虚拟文件系统</li>
        </ul>
        <p>启用此功能需要您手动选择一个文件夹进行访问授权。</p>
    `;
    modal.appendChild(content);

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.textAlign = 'right';
    buttonContainer.style.marginTop = '20px';

    // 确定按钮
    const okButton = document.createElement('button');
    okButton.textContent = '确定';
    okButton.style.backgroundColor = '#0e639c';
    okButton.style.color = 'white';
    okButton.style.border = 'none';
    okButton.style.padding = '8px 16px';
    okButton.style.borderRadius = '4px';
    okButton.style.cursor = 'pointer';
    okButton.onclick = function() {
        document.body.removeChild(overlay);
    };

    buttonContainer.appendChild(okButton);
    modal.appendChild(buttonContainer);

    overlay.appendChild(modal);  // 修复拼写错误
    document.body.appendChild(overlay);
}

// 关闭首选项弹窗事件监听器
if (closePreferences) {
    closePreferences.addEventListener('click', function() {
        hidePreferencesModal();
    });
}

if (cancelPreferences) {
    cancelPreferences.addEventListener('click', function() {
        hidePreferencesModal();
    });
}

if (savePreferences) {
    savePreferences.addEventListener('click', function() {
        savePreferencesChanges();
    });
}

if (resetDefaultCode) {
    resetDefaultCode.addEventListener('click', function() {
        resetToDefaultCode();
    });
}

// 重新显示新手教程按钮
const showTutorialBtn = document.getElementById('show-tutorial-btn');
if (showTutorialBtn) {
    showTutorialBtn.addEventListener('click', function() {
        // 重置教程步骤
        currentTutorialStep = 0;
        // 删除notfirstrun标记
        localStorage.removeItem('notfirstrun');
        // 显示教程
        showTutorial();
        // 关闭首选项弹窗
        hidePreferencesModal();
    });
}

// 点击弹窗外部关闭弹窗
window.addEventListener('click', function(event) {
    if (event.target === preferencesModal) {
        hidePreferencesModal();
    }
});

// ===== 右键菜单功能 =====

// 使用 Monaco 编辑器的内置菜单系统注册右键菜单项
function registerEditorContextMenu() {
    // 注册查找命令
    const findCommandId = 'phoi.find';
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, function() {
        monacoEditor.trigger('contextmenu', 'actions.find', null);
    });

    // 注册替换命令
    const replaceCommandId = 'phoi.replace';
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, function() {
        monacoEditor.trigger('contextmenu', 'editor.action.startFindReplaceAction', null);
    });

    // 注册执行代码命令
    const runCodeCommandId = 'phoi.runCode';
    // 原有快捷键：Ctrl+Enter
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function() {
        // 唤起数据输入框
        if (inputModal) {
            inputModal.style.display = 'flex';
            if (modalTextarea) {
                modalTextarea.focus();
            }
        }
    });
    // 新增快捷键：F8
    monacoEditor.addCommand(monaco.KeyCode.F8, function() {
        // 唤起数据输入框
        if (inputModal) {
            inputModal.style.display = 'flex';
            if (modalTextarea) {
                modalTextarea.focus();
            }
        }
    });

    // 注册CPH运行命令
    const cphRunCommandId = 'phoi.cphRun';
    // 原有快捷键：Alt+Enter
    monacoEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, function() {
        // 运行CPH所有测试点
        if (window.cphPlugin && typeof window.cphPlugin.runAllTests === 'function') {
            // 保存当前编辑器内容到全局变量，以便CPH使用
            if (monacoEditor) {
                globalText = monacoEditor.getValue();
            }
            window.cphPlugin.runAllTests();
        } else {
            showMessage('CPH 插件未加载或不可用', 'system');
        }
    });
    // 新增快捷键：F9
    monacoEditor.addCommand(monaco.KeyCode.F9, function() {
        // 运行CPH所有测试点
        if (window.cphPlugin && typeof window.cphPlugin.runAllTests === 'function') {
            // 保存当前编辑器内容到全局变量，以便CPH使用
            if (monacoEditor) {
                globalText = monacoEditor.getValue();
            }
            window.cphPlugin.runAllTests();
        } else {
            showMessage('CPH 插件未加载或不可用', 'system');
        }
    });

    // 查找菜单项
    monacoEditor.addAction({
        id: findCommandId,
        label: '查找',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
        contextMenuGroupId: '2_find',
        contextMenuOrder: 1.1,
        run: function() {
            monacoEditor.trigger('contextmenu', 'actions.find', null);
            return null;
        }
    });

    // 替换菜单项
    monacoEditor.addAction({
        id: replaceCommandId,
        label: '替换',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH],
        contextMenuGroupId: '2_find',
        contextMenuOrder: 1.2,
        run: function() {
            monacoEditor.trigger('contextmenu', 'editor.action.startFindReplaceAction', null);
            return null;
        }
    });

    // 执行代码菜单项
    monacoEditor.addAction({
        id: runCodeCommandId,
        label: '执行代码',
        keybindings: [
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,  // Ctrl+Enter
            monaco.KeyCode.F8  // F8
        ],
        contextMenuGroupId: 'run_group',
        contextMenuOrder: 1.1,
        run: function() {
            // 唤起数据输入框
            if (inputModal) {
                inputModal.style.display = 'flex';
                if (modalTextarea) {
                    modalTextarea.focus();
                }
            }
            return null;
        }
    });

    // CPH运行菜单项
    monacoEditor.addAction({
        id: cphRunCommandId,
        label: 'CPH 运行',
        keybindings: [
            monaco.KeyMod.Alt | monaco.KeyCode.Enter,  // Alt+Enter
            monaco.KeyCode.F9  // F9
        ],
        contextMenuGroupId: 'run_group',
        contextMenuOrder: 1.2,
        run: function() {
            // 运行CPH所有测试点
            if (window.cphPlugin && typeof window.cphPlugin.runAllTests === 'function') {
                // 保存当前编辑器内容到全局变量，以便CPH使用
                if (monacoEditor) {
                    globalText = monacoEditor.getValue();
                }
                window.cphPlugin.runAllTests();
            } else {
                showMessage('CPH 插件未加载或不可用', 'system');
            }
            return null;
        }
    });
}

// 更新右键菜单状态
function updateContextMenuState() {
    if (monacoEditor) {
        registerEditorContextMenu();
    }
}

// 在编辑器初始化后注册右键菜单
function initContextMenu() {
    if (monacoEditor) {
        registerEditorContextMenu();
    }
}