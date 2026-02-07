// DOM Elements
const editorWrapper = document.getElementById('editor-wrapper');
const fullEditor = document.getElementById('full-editor');
const highlightLayer = document.getElementById('highlight-layer');
const gutter = document.getElementById('gutter');

const keyboardContainer = document.getElementById('keyboard-container');
const toggleBtn = document.getElementById('mode-toggle-btn');
const runBtn = document.getElementById('run-btn');
const copyBtn = document.getElementById('copy-btn');
const outputPanel = document.getElementById('output-panel');
const outputContent = document.getElementById('output-content');
const closeOutputBtn = document.getElementById('close-output');
const linesContainer = document.getElementById('lines-container');

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
const aboutMenu = document.getElementById('about-menu');
const fileDropdown = document.getElementById('file-dropdown');
const uploadFileBtn = document.getElementById('upload-file');
const downloadFileBtn = document.getElementById('download-file');
const saveAsBtn = document.getElementById('save-as');
const newFileBtn = document.getElementById('new-file');
const newFolderBtn = document.getElementById('new-folder');

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

// --- 虚拟文件系统相关变量 ---
let vfsStructure = null;
const VFS_STORAGE_KEY = 'phoi_vfs_structure';
let currentFileName = localStorage.getItem('phoi_currentFileName') || 'new.cpp'; // 当前正在编辑的文件名

// --- 恢复保存的代码 ---
const defaultCode = `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Phoi" << endl;\n\treturn 0;\n}`;
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
let cppAutocompleteDelay = parseInt(localStorage.getItem(CPP_AUTOCOMPLETE_DELAY_KEY)) || 200; // 默认为200ms


let isShiftActive = false;
let isShiftHeld = false;
let shiftUsageFlag = false;
let isCtrlActive = false;
let keyRepeatTimer = null, keyDelayTimer = null;
let saveTimer = null; // 用于防抖保存

// --- [优化] 防抖保存代码到本地 ---
// 避免每次按键都写入硬盘造成卡顿，延迟 500ms 保存
function triggerSaveCode() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        localStorage.setItem('phoi_savedCode', globalText);
        
        // 如果当前文件已打开，则保存到虚拟文件系统
        if (vfsStructure && currentFileName) {
            if (!vfsStructure['/'].children[currentFileName]) {
                // 如果文件不存在，创建新文件
                vfsStructure['/'].children[currentFileName] = {
                    type: 'file',
                    name: currentFileName,
                    content: globalText
                };
            } else {
                // 更新现有文件内容
                vfsStructure['/'].children[currentFileName].content = globalText;
            }
            saveVFS();
        }
    }, 500);
}

// 初始化虚拟文件系统
function initializeVFS() {
    // 尝试从本地存储加载虚拟文件系统
    const savedVFS = localStorage.getItem(VFS_STORAGE_KEY);
    
    if (savedVFS) {
        // 如果已有虚拟文件系统，则加载它
        vfsStructure = JSON.parse(savedVFS);
        
        // 检查是否有当前文件，如果没有则使用第一个文件
        if (!vfsStructure['/'].children[currentFileName]) {
            const firstFile = Object.keys(vfsStructure['/'].children).find(key => 
                vfsStructure['/'].children[key].type === 'file'
            );
            if (firstFile) {
                currentFileName = firstFile;
                globalText = vfsStructure['/'].children[firstFile].content;
            }
        } else {
            // 加载当前文件的内容
            globalText = vfsStructure['/'].children[currentFileName].content;
        }
    } else {
        // 否则初始化一个新的虚拟文件系统，并将当前代码作为 new.cpp 存储
        vfsStructure = {
            '/': {
                type: 'folder',
                name: 'root',
                children: {}
            }
        };
        
        // 创建初始的 new.cpp 文件
        vfsStructure['/'].children[currentFileName] = {
            type: 'file',
            name: currentFileName,
            content: globalText
        };
        
        // 保存到本地存储
        localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(vfsStructure));
    }
}

// 更新顶部菜单栏中显示的当前文件名
function updateCurrentFileNameDisplay() {
    const currentFileNameElement = document.getElementById('current-file-name');
    if (currentFileNameElement) {
        currentFileNameElement.textContent = currentFileName;
    }
}

// 保存虚拟文件系统到本地存储
function saveVFS() {
    localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(vfsStructure));
}

// 渲染虚拟文件系统
function renderVFS() {
    if (!vfsContent) return; // 如果元素不存在则返回

    // 清空内容
    vfsContent.innerHTML = '';

    // 创建操作按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.style.padding = '10px';
    buttonContainer.style.borderBottom = '1px solid #444';

    const newFileButton = document.createElement('button');
    newFileButton.textContent = '+ 文件';
    newFileButton.style.marginRight = '5px';
    newFileButton.onclick = newFile;

    buttonContainer.appendChild(newFileButton);
    vfsContent.appendChild(buttonContainer);

    // 创建根目录项
    const rootDiv = document.createElement('div');
    rootDiv.className = 'vfs-folder';
    rootDiv.textContent = '根目录';
    rootDiv.dataset.path = '/';
    // 为根目录添加点击事件
    rootDiv.addEventListener('click', function() {
        console.log('展开根目录');
    });
    vfsContent.appendChild(rootDiv);

    // 渲染根目录下的所有子项
    renderVFSDirectory('/', vfsContent);
}

// 打开文件
function openFile(filePath) {
    // 从虚拟文件系统中获取文件内容
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];

    if (vfsStructure['/'].children[fileName] && vfsStructure['/'].children[fileName].type === 'file') {
        // 更新全局文本为文件内容
        globalText = vfsStructure['/'].children[fileName].content;
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
        if (vfsPanel) {
            vfsPanel.style.display = 'none';
        }
        if (sidebarToggle) {
            // 移除CSS类来表示面板关闭状态，而不是修改文本内容
            sidebarToggle.classList.remove('vfs-open');
        }

        // 显示提示信息
        showMessage(`已打开文件: ${fileName}`, 'user');
    }
}

// 显示消息
function showMessage(content, sender) {
    // 创建消息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = `debug-message ${sender}`;
    messageDiv.innerHTML = `<strong>${sender === 'user' ? '用户:' : '系统:'}</strong> ${content}`;
    
    // 添加到输出面板
    const outputContent = document.getElementById('output-content');
    if (outputContent) {
        outputContent.appendChild(messageDiv);
        outputContent.scrollTop = outputContent.scrollHeight;
        
        // 显示输出面板
        const outputPanel = document.getElementById('output-panel');
        if (outputPanel) {
            outputPanel.style.display = 'flex';
            
            // 3秒后自动隐藏
            setTimeout(() => {
                outputPanel.style.display = 'none';
            }, 3000);
        }
    }
}

// 渲染指定路径的目录
function renderVFSDirectory(path, parentElement) {
    if (!parentElement) return; // 如果父元素不存在则返回

    const folder = vfsStructure[path];
    if (!folder || folder.type !== 'folder') return;

    const container = document.createElement('div');
    container.className = 'vfs-subfolder';
    container.style.paddingLeft = '16px';

    for (const itemName in folder.children) {
        const item = folder.children[itemName];

        if (item.type === 'file') { // 只渲染文件，不渲染文件夹
            const itemElement = document.createElement('div');
            itemElement.className = 'vfs-file';
            itemElement.style.color = 'white'; // 设置文字为白色
            itemElement.style.display = 'flex';
            itemElement.style.justifyContent = 'space-between';
            itemElement.style.alignItems = 'center';
            itemElement.style.padding = '5px';
            itemElement.style.cursor = 'pointer';

            // 文件名部分
            const fileNameSpan = document.createElement('span');
            fileNameSpan.textContent = item.name;
            fileNameSpan.style.flexGrow = '1';
            itemElement.appendChild(fileNameSpan);

            // 删除按钮
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '×';
            deleteButton.style.backgroundColor = '#ff4444';
            deleteButton.style.color = 'white';
            deleteButton.style.border = 'none';
            deleteButton.style.borderRadius = '50%';
            deleteButton.style.width = '20px';
            deleteButton.style.height = '20px';
            deleteButton.style.cursor = 'pointer';
            deleteButton.onclick = function(e) {
                e.stopPropagation(); // 阻止事件冒泡到父元素
                deleteFile(item.name);
            };
            itemElement.appendChild(deleteButton);

            itemElement.dataset.path = path + itemName;

            // 为每个项目添加点击事件
            itemElement.addEventListener('click', function(e) {
                if (e.target !== deleteButton) { // 只有当点击的不是删除按钮时才打开文件
                    const itemPath = this.dataset.path;
                    openFile(itemPath);
                }
            });

            container.appendChild(itemElement);
        }
    }

    parentElement.appendChild(container);
}

// 删除文件
function deleteFile(fileName) {
    // 检查是否是当前正在使用的文件
    if (fileName === currentFileName) {
        alert(`无法删除当前正在使用的文件 "${fileName}"`);
        return;
    }

    if (confirm(`确定要删除文件 "${fileName}" 吗？`)) {
        // 从虚拟文件系统中删除文件
        delete vfsStructure['/'].children[fileName];

        saveVFS();
        renderVFS();

        showMessage(`文件 "${fileName}" 已删除`, 'user');
    }
}

// 切换虚拟文件系统面板显示状态
function toggleVFSPanel() {
    if (!vfsPanel || !sidebarToggle) return; // 如果元素不存在则返回

    if (vfsPanel.style.display === 'none' || vfsPanel.style.display === '') {
        vfsPanel.style.display = 'flex';
        // 添加CSS类来表示面板打开状态
        sidebarToggle.classList.add('vfs-open');
    } else {
        vfsPanel.style.display = 'none';
        // 移除CSS类来表示面板关闭状态
        sidebarToggle.classList.remove('vfs-open');
    }
}

// 上传文件到虚拟文件系统
function uploadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = event => {
        const file = event.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const content = e.target.result;
            const fileName = file.name;
            
            // 将文件添加到根目录
            vfsStructure['/'].children[fileName] = {
                type: 'file',
                name: fileName,
                content: content
            };
            
            saveVFS();
            renderVFS();
            
            // 自动打开刚上传的文件
            openFile(fileName);
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// 下载当前活动文件
function downloadCurrentFile() {
    const blob = new Blob([globalText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFileName || 'current.cpp'; // 使用当前文件名
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// 另存为当前文件
function saveCurrentFileAs() {
    const fileName = prompt('请输入文件名:', currentFileName || 'new_file.cpp');
    if (!fileName) return;
    
    // 将当前代码保存为新文件
    vfsStructure['/'].children[fileName] = {
        type: 'file',
        name: fileName,
        content: globalText
    };
    
    saveVFS();
    renderVFS();
    
    // 更新当前文件名
    currentFileName = fileName;
    
    showMessage(`文件已另存为: ${fileName}`, 'user');
}

// 新建文件
function newFile() {
    const fileName = prompt('请输入文件名:', 'new.cpp');
    if (!fileName) return;

    // 检查文件是否已存在
    if (vfsStructure['/'].children[fileName]) {
        alert('文件已存在！');
        return;
    }

    // 创建新文件
    vfsStructure['/'].children[fileName] = {
        type: 'file',
        name: fileName,
        content: defaultCode
    };

    saveVFS();
    renderVFS();

    // 自动打开新创建的文件
    openFile(fileName);
}

// 新建文件夹
function newFolder() {
    const folderName = prompt('请输入文件夹名:');
    if (!folderName) return;
    
    // 检查文件夹是否已存在
    if (vfsStructure['/'].children[folderName]) {
        alert('文件夹已存在！');
        return;
    }
    
    // 创建新文件夹
    vfsStructure['/'].children[folderName] = {
        type: 'folder',
        name: folderName,
        children: {}
    };
    
    saveVFS();
    renderVFS();
}


// Initialize Monaco Editor
let monacoEditor = null; // Global reference to the Monaco editor instance

require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.33.0/min/vs' } });
require(['vs/editor/editor.main'], function() {
    // 根据设置确定初始的quickSuggestionsDelay值
    const initialQuickSuggestionsDelay = cppAutocompleteEnabled ? cppAutocompleteDelay : 0;

    monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
        value: globalText,
        language: 'cpp',
        theme: 'vs-dark', // 使用暗色主题
        automaticLayout: true,
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


    // Update globalText when editor content changes
    monacoEditor.onDidChangeModelContent(() => {
        globalText = monacoEditor.getValue();
        triggerSaveCode();
    });

    // Update editor when globalText changes
    window.addEventListener('codeUpdated', () => {
        if (monacoEditor && monacoEditor.getValue() !== globalText) {
            monacoEditor.setValue(globalText);
        }
    });

    // 根据设置决定是否注册代码补全提供程序
    if (cppAutocompleteEnabled) {
        // 确保autocomplete.js已加载后再注册补全提供程序
        if (typeof registerCompletionProviders === 'function') {
            registerCompletionProviders();
        }
    }

    // 添加输出面板调整大小功能
    let isResizing = false;
    const outputPanel = document.getElementById('output-panel');
    const outputResizer = document.getElementById('output-resizer');
    const globalToolbar = document.getElementById('global-toolbar');

    // 鼠标按下调整大小手柄时
    outputResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
    });

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
            outputPanel.style.height = `${clampedHeight}px`;
        }
    });

    // 鼠标释放时结束调整大小
    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = '';
    });
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
        outputContent.innerHTML = '<span style="color:#888;">Compiling and running...</span>';
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
        if (outputContent) {
            outputContent.innerHTML = html;
        }
    } catch (e) {
        if (outputContent) {
            outputContent.innerHTML = `<span class="out-err">Server Connection Error: ${e.message}<br>请确定网络状态良好并稍后再试</span>`;
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
if (closeOutputBtn) {
    closeOutputBtn.addEventListener('click', () => {
        if (outputPanel) {
            outputPanel.style.display = 'none';
        }
    });
}

// Core Helpers
function escapeHtml(t) { 
    return (t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); 
}

// 3行预览功能函数
function renderThreeLines() {
    if(isFullMode) return; // 只在手机模式下显示
    
    const lines = globalText.split('\n');
    let accum = 0, idx = 0, start = 0;
    for(let i=0; i<lines.length; i++) {
        if(globalCursorPos >= accum && globalCursorPos <= accum + lines[i].length) { 
            idx=i; 
            start=accum; 
            break; 
        }
        accum += lines[i].length + 1;
    }
    
    // 更新行号
    if (lnPrev) lnPrev.textContent = (idx > 0) ? (idx) : "";
    if (lnCurr) lnCurr.textContent = idx + 1;
    if (lnNext) lnNext.textContent = (idx < lines.length - 1) ? (idx + 2) : "";

    // 更新行内容
    if (linePrev) linePrev.textContent = lines[idx-1]||(idx===0?"-- TOP --":"");
    if (lineNext) lineNext.textContent = lines[idx+1]||(idx===lines.length-1?"-- END --":"");
    if (lineCurr) {
        const cT = lines[idx]; 
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
    const prevChar = globalText[globalCursorPos-1];
    const nextChar = globalText[globalCursorPos];
    const lastNL = globalText.lastIndexOf('\n', globalCursorPos - 1);
    const lineStart = lastNL === -1 ? 0 : lastNL + 1;
    const currentLine = globalText.substring(lineStart, globalCursorPos);
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
    if(fw) { if(globalCursorPos<globalText.length) globalText = globalText.slice(0,globalCursorPos)+globalText.slice(globalCursorPos+1); }
    else { if(globalCursorPos>0) { globalText = globalText.slice(0,globalCursorPos-1)+globalText.slice(globalCursorPos); globalCursorPos--; } }
    syncState();
}
function moveCursor(d) {
    if(d==='left'&&globalCursorPos>0)globalCursorPos--;
    else if(d==='right'&&globalCursorPos<globalText.length)globalCursorPos++;
    else if(d==='up'||d==='down'){
        const ls=[]; let a=0; globalText.split('\n').forEach(l=>{ls.push({s:a,l:l.length});a+=l.length+1});
        const ci=ls.findIndex(l=>globalCursorPos>=l.s&&globalCursorPos<=l.s+l.l);
        if(ci!==-1){ const ti=d==='up'?ci-1:ci+1; if(ti>=0&&ti<ls.length)globalCursorPos=ls[ti].s+Math.min(globalCursorPos-ls[ci].s,ls[ti].l); }
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

    if (char && ['(', '{', '[', '"', "'"].includes(char)) { handleAutoPair(char); return; }
    if (char) insertTextAtCursor(char);
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
            case 'Home': globalCursorPos=globalText.lastIndexOf('\n',globalCursorPos-1)+1; syncState(); break;
            case 'End': const n=globalText.indexOf('\n',globalCursorPos); globalCursorPos=n===-1?globalText.length:n; syncState(); break;
            case 'PageUp': for(let i=0;i<5;i++)moveCursor('up'); break;
            case 'PageDown': for(let i=0;i<5;i++)moveCursor('down'); break;
        }
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
});

// 文件操作按钮事件 - 需要检查元素是否存在
if (uploadFileBtn) {
    uploadFileBtn.addEventListener('click', uploadFile);
}
if (downloadFileBtn) {
    downloadFileBtn.addEventListener('click', downloadCurrentFile);
}
if (saveAsBtn) {
    saveAsBtn.addEventListener('click', saveCurrentFileAs);
}
if (newFileBtn) {
    newFileBtn.addEventListener('click', newFile);
}
if (newFolderBtn) {
    newFolderBtn.addEventListener('click', newFolder);
}

// 左侧边栏事件 - 需要检查元素是否存在
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleVFSPanel);
}

// 虚拟文件系统关闭按钮 - 需要检查元素是否存在
if (vfsCloseBtn) {
    vfsCloseBtn.addEventListener('click', function() {
        if (vfsPanel) {
            vfsPanel.style.display = 'none';
        }
        if (sidebarToggle) {
            // 移除CSS类来表示面板关闭状态，而不是修改文本内容
            sidebarToggle.classList.remove('vfs-open');
        }
    });
}

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
            cppAutocompleteDelay = parseInt(this.value) || 200;
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
    openFile: function(fileName) {
        // 检查文件是否存在于VFS中
        if (vfsStructure['/'].children[fileName] && vfsStructure['/'].children[fileName].type === 'file') {
            // 更新全局文本为文件内容
            globalText = vfsStructure['/'].children[fileName].content;
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
            const vfsPanel = document.getElementById('vfs-panel');
            const sidebarToggle = document.getElementById('sidebar-toggle');
            if (vfsPanel) {
                vfsPanel.style.display = 'none';
            }
            if (sidebarToggle) {
                sidebarToggle.classList.remove('vfs-open');
            }

            // 显示提示信息
            if (typeof showMessage === 'function') {
                showMessage(`已打开文件: ${fileName}`, 'user');
            }
            
            return true;
        } else {
            // 文件不存在，检查是否在localStorage中有该文件
            const fileKey = `phoi_file_${fileName}`;
            const fileContent = localStorage.getItem(fileKey);
            
            if (fileContent !== null) {
                // 文件存在于localStorage中，将其添加到VFS
                vfsStructure['/'].children[fileName] = {
                    type: 'file',
                    name: fileName,
                    content: fileContent
                };
                
                // 保存VFS结构
                saveVFS();
                
                // 打开文件
                return this.openFile(fileName); // 递归调用
            } else {
                console.error(`文件 ${fileName} 不存在`);
                return false;
            }
        }
    },

    // 创建新文件
    createNewFile: function(fileName, content = '') {
        // 检查文件是否已存在
        if (vfsStructure['/'].children[fileName]) {
            console.warn(`文件 ${fileName} 已存在`);
            return false;
        }

        // 使用提供的内容或默认模板创建文件
        const cppTemplate = `#include <iostream>
using namespace std;

int main() {

    return 0;
}`;
        const fileContent = content || cppTemplate;
        
        // 创建新文件
        vfsStructure['/'].children[fileName] = {
            type: 'file',
            name: fileName,
            content: fileContent
        };

        saveVFS();
        renderVFS();

        // 自动打开新创建的文件
        return this.openFile(fileName);
    },

    // 获取所有文件列表
    getFileList: function() {
        return Object.keys(vfsStructure['/'].children).filter(key => {
            return vfsStructure['/'].children[key].type === 'file';
        });
    }
};



// 初始化虚拟文件系统
initializeVFS();
renderVFS();
updateCurrentFileNameDisplay();