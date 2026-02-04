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
const LUOGU_THEME_ENABLED_KEY = 'phoi_luogu_theme_enabled';

// 默认设置值
let cppAutocompleteEnabled = localStorage.getItem(CPP_AUTOCOMPLETE_ENABLED_KEY) !== 'false'; // 默认为true
let cppAutocompleteDelay = parseInt(localStorage.getItem(CPP_AUTOCOMPLETE_DELAY_KEY)) || 200; // 默认为200ms
let luoguThemeEnabled = localStorage.getItem(LUOGU_THEME_ENABLED_KEY) === 'true'; // 默认为false

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

// Define C++ keywords for autocompletion
const cppKeywords = [
    // Control Flow
    'if', 'else', 'switch', 'case', 'default', 'break', 'continue', 'goto',
    // Loops
    'while', 'do', 'for',
    // Functions
    'return', 'extern', 'inline',
    // Data Types
    'void', 'bool', 'char', 'wchar_t', 'char8_t', 'char16_t', 'char32_t', 'short', 'int', 'long', 'float', 'double',
    'signed', 'unsigned', 'typedef',
    // Modifiers
    'const', 'volatile', 'static', 'auto', 'register', 'mutable',
    // Classes & Objects
    'class', 'struct', 'union', 'enum', 'public', 'private', 'protected', 'friend', 'virtual', 'override', 'final',
    'this', 'explicit', 'constexpr', 'consteval', 'constinit',
    // Inheritance
    'public', 'private', 'protected', 'virtual', 'override',
    // Storage Classes
    'static', 'extern', 'register', 'mutable',
    // Operators
    'new', 'delete', 'sizeof', 'typeid', 'dynamic_cast', 'static_cast', 'reinterpret_cast', 'const_cast',
    // Namespace
    'namespace', 'using',
    // Templates
    'template', 'typename', 'decltype', 'concept', 'requires',
    // Exception Handling
    'try', 'catch', 'throw', 'noexcept',
    // Others
    'true', 'false', 'nullptr', 'asm', 'thread_local', 'alignas', 'alignof'
];

// Define C++ STL containers and their methods for autocompletion
const stlContainers = {
    'vector': {
        functions: ['assign', 'at', 'insert', 'emplace', 'erase', 'push_back', 'emplace_back', 'pop_back', 'resize', 'swap', 'clear', 'begin', 'end', 'rbegin', 'rend','front', 'back','empty', 'size', 'max_size', 'reserve'],
        properties: ['data', 'get_allocator', 'capacity', 'shrink_to_fit', 'operator[]']
    },
    'queue': {
        functions: ['push', 'emplace', 'pop', 'swap', 'empty', 'size', 'front', 'back'],
        properties: []
    },
    'stack': {
        functions: ['push', 'emplace', 'pop', 'swap', 'empty', 'size', 'top'],
        properties: []
    },
    'set': {
        functions: ['find', 'count', 'lower_bound', 'upper_bound', 'equal_range', 'insert', 'emplace', 'emplace_hint', 'erase', 'clear', 'swap', 'extract', 'merge', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['key_comp', 'value_comp', 'get_allocator']
    },
    'multiset': {
        functions: ['find', 'count', 'lower_bound', 'upper_bound', 'equal_range', 'insert', 'emplace', 'emplace_hint', 'erase', 'clear', 'swap', 'extract', 'merge', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['key_comp', 'value_comp', 'get_allocator']
    },
    'map': {
        functions: ['at', 'insert', 'insert_or_assign', 'emplace', 'emplace_hint', 'try_emplace', 'erase', 'swap', 'extract', 'merge', 'count', 'find', 'contains', 'lower_bound', 'upper_bound', 'equal_range', 'begin', 'end', 'rbegin', 'rend', 'cbegin', 'cend', 'crbegin', 'crend', 'empty', 'size', 'max_size', 'clear'],
        properties: ['operator[]', 'key_comp', 'value_comp', 'get_allocator']
    },
    'multimap': {
        functions: ['empty', 'size', 'max_size', 'clear', 'insert', 'emplace', 'emplace_hint', 'erase', 'swap', 'extract', 'merge', 'count', 'find', 'contains', 'lower_bound', 'upper_bound', 'equal_range', 'begin', 'end', 'rbegin', 'rend', 'cbegin', 'cend', 'crbegin', 'crend'],
        properties: ['key_comp', 'value_comp', 'get_allocator']
    },
    'unordered_set': {
        functions: ['find', 'count', 'equal_range', 'insert', 'emplace', 'emplace_hint', 'insert_or_assign', 'try_emplace', 'erase', 'clear', 'swap', 'extract', 'merge', 'begin', 'end', 'cbegin', 'cend', 'empty', 'size', 'max_size'],
        properties: ['bucket_count', 'max_bucket_count', 'bucket_size', 'bucket', 'load_factor', 'max_load_factor', 'rehash', 'reserve', 'hash_function', 'key_eq', 'get_allocator', 'contains']
    },
    'unordered_map': {
        functions: ['at', 'insert', 'insert_or_assign', 'emplace', 'emplace_hint', 'try_emplace', 'erase', 'swap', 'extract', 'merge', 'count', 'find', 'contains', 'equal_range', 'begin', 'end', 'cbegin', 'cend', 'empty', 'size', 'max_size', 'clear'],
        properties: ['operator[]', 'bucket_count', 'max_bucket_count', 'bucket_size', 'bucket', 'load_factor', 'max_load_factor', 'rehash', 'reserve', 'hash_function', 'key_eq', 'get_allocator']
    },
    'priority_queue': {
        functions: ['push', 'emplace', 'pop', 'swap','empty', 'size', 'top'],
        properties: []
    },
    'deque': {
        functions: ['front', 'back', 'assign', 'at', 'insert', 'emplace', 'erase', 'push_back', 'emplace_back', 'pop_back', 'resize', 'swap', 'clear', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['operator[]', 'get_allocator', 'shrink_to_fit']
    },
    'list': {
        functions: ['front', 'back', 'assign', 'insert', 'emplace', 'erase', 'push_back', 'emplace_back', 'pop_back', 'push_front', 'emplace_front', 'pop_front', 'resize', 'swap', 'merge', 'splice', 'remove', 'remove_if', 'reverse', 'unique', 'sort', 'clear', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['get_allocator']
    },
    'array': {
        functions: ['at', 'swap', 'fill', 'begin', 'end', 'rbegin', 'rend', 'cbegin', 'cend', 'crbegin', 'crend', 'front', 'back', 'empty', 'size', 'max_size'],
        properties: ['operator[]', 'data']
    },
    'pair': {
        functions: [],
        properties: ['first', 'second']
    }
};

// Define C++ standard library functions for autocompletion
const cppFunctions = {
    // C-style I/O functions
    'cstdio': [
        'printf', 'scanf', 'fprintf', 'fscanf', 'sscanf', 'sprintf', 'snprintf',
        'getchar', 'putchar', 'gets', 'puts', 'fgets', 'fputs', 'fclose', 'fflush'
    ],
    // Standard library functions
    'cstdlib': [
        'malloc', 'calloc', 'realloc', 'free', 'abs', 'labs', 'llabs', 'atoi', 'atol', 'atoll',
        'atof', 'rand', 'srand', 'qsort', 'bsearch'
    ],
    // String functions
    'cstring': [
        'memcpy', 'memset', 'strcpy', 'strncpy', ' strcat', 'strncat',
        'memcmp', 'strcmp', 'strncmp', 'strlen', 'strchr', 'strstr'
    ],
    // Utility functions
    'utility': [
        'pair', 'make_pair', 'swap', 'forward', 'move'
    ],
    // Algorithm functions
    'algorithm': [
        'sort', 'reverse', 'lower_bound', 'upper_bound', 'find', 'count', 'max', 'min',
        'max_element', 'min_element', 'unique', 'remove', 'fill', 'next_permutation', 'prev_permutation'
    ],
    // Memory functions
    'memory': [
        'make_unique', 'make_shared', 'unique_ptr', 'shared_ptr', 'weak_ptr'
    ],
    'cmath': [
        'min', 'max', 'sqrt', 'pow'
    ],
};

// Define common C++ objects like cin/cout
const cppObjects = {
    'iostream': [
        'cin', 'cout', 'cerr', 'clog', 'endl', 'ws', 'flush'
    ],
    'iomanip': [
        'setw', 'setprecision', 'setfill', 'setbase', 'hex', 'dec', 'oct', 'fixed', 'scientific'
    ],
    'queue': [],
    'vector': [],
    'set': [],
    'map': [],
    'deque': [],
    'bits/stdc++.h': [],
};

// Function to extract variable names from code
function extractVariableNames(code) {
    const variables = new Set();
    let match;

    // Match variable declarations: type name or type name[N] or type name(...);
    // This regex looks for common patterns like: int varName, vector<int> varName, etc.
    // Updated to handle multiple variables in one declaration like: int a, b, c;
    const varDeclarationRegex = /\b(auto|int|float|double|char|bool|long|short|unsigned|signed|void|size_t|string|vector|array|queue|stack|set|map|unordered_map|unordered_set|list|deque|priority_queue|complex|pair|[\w:<>]+)\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)/g;

    while ((match = varDeclarationRegex.exec(code)) !== null) {
        // Extract all variable names from the declaration
        const varList = match[2]; // Get the variable name part
        const individualVars = varList.split(/\s*,\s*/); // Split by comma

        for (const varName of individualVars) {
            const trimmedVarName = varName.trim();
            if (trimmedVarName) {
                variables.add(trimmedVarName);
            }
        }
    }

    // Also match function parameters: function(type param1, type param2, ...)
    // Find function definitions and extract parameter names
    const functionRegex = /\b(?:[a-zA-Z_*&:<>]+\s+)+[a-zA-Z_][a-zA-Z0-9_]*\s*\(([^)]*)\)\s*(?:const\s+)?(?:\[[^\]]*\]\s*)*(?:noexcept\s*\(.*\)\s*)*(?:->\s*[\w_*:<>]+)?\s*{/gi;
    let functionMatch;
    while ((functionMatch = functionRegex.exec(code)) !== null) {
        const paramsStr = functionMatch[1]; // Parameters part
        if (paramsStr.trim()) {
            // Split parameters by comma and extract variable names
            const params = paramsStr.split(',');
            for (const param of params) {
                // Match the variable name in the parameter (last word that looks like a variable name)
                const varMatches = param.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g);
                if (varMatches) {
                    // Take the last match (which should be the variable name)
                    const varName = varMatches[varMatches.length - 1];
                    if (varName) {
                        variables.add(varName);
                    }
                }
            }
        }
    }

    // Also match pair declarations specifically: pair<type, type> varName
    const pairDeclarationRegex = /pair\s*<\s*[\w:<> ]+\s*,\s*[\w:<> ]+\s*>\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)/g;
    while ((match = pairDeclarationRegex.exec(code)) !== null) {
        const varList = match[1]; // Get the variable name part
        const individualVars = varList.split(/\s*,\s*/); // Split by comma

        for (const varName of individualVars) {
            const trimmedVarName = varName.trim();
            if (trimmedVarName) {
                variables.add(trimmedVarName);
            }
        }
    }

    // Also match assignments like varName = ...
    const assignmentRegex = /\b([a-zA-Z_]\w*)\s*=[^=]/g;
    while ((match = assignmentRegex.exec(code)) !== null) {
        // Avoid matching operators like ==, !=, >=, <=
        variables.add(match[1]);
    }

    // Also match function calls like varName.function()
    const functionCallRegex = /\b([a-zA-Z_]\w*)\s*\.\s*\w+/g;
    while ((match = functionCallRegex.exec(code)) !== null) {
        variables.add(match[1]);
    }

    // Also match array/index access like varName[index]
    const arrayAccessRegex = /\b([a-zA-Z_]\w*)\s*\[/g;
    while ((match = arrayAccessRegex.exec(code)) !== null) {
        variables.add(match[1]);
    }

    return Array.from(variables);
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

    // 根据设置决定是否注册代码补全提供程序
    if (cppAutocompleteEnabled) {
        registerCompletionProviders();
    }

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
                registerCompletionProviders();

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

    // 设置洛谷主题库插件的UI状态
    const luoguThemeEnabledCheckbox = document.getElementById('luogu-theme-enabled');

    if (luoguThemeEnabledCheckbox) {
        luoguThemeEnabledCheckbox.checked = luoguThemeEnabled;

        // 添加事件监听器
        luoguThemeEnabledCheckbox.addEventListener('change', function() {
            luoguThemeEnabled = this.checked;
            localStorage.setItem(LUOGU_THEME_ENABLED_KEY, luoguThemeEnabled);

            // 洛谷主题启用状态已更新，存储到本地
            // 实际的主题功能将在后续实现
            console.log('洛谷主题插件状态已更新:', luoguThemeEnabled);
        });
    }
}

// 初始化插件设置
initPluginSettings();


// 注册代码补全提供程序
function registerCompletionProviders() {
    // 如果代码补全被禁用，则不注册任何补全提供程序
    if (!cppAutocompleteEnabled) {
        return;
    }

    // Register completion items for C++ keywords and STL methods
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Get the text before the current position to detect if we're after a dot (.)
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);

            // Check if the text ends with a dot followed by the current word
            if (textBefore.endsWith('.')) {
                // Find the variable name before the dot
                const beforeDot = textBefore.substring(0, textBefore.lastIndexOf('.')).trim();

                // Extract the identifier before the dot (could be a member access chain)
                const parts = beforeDot.split(/[^\w\d_]/);
                const potentialContainerName = parts[parts.length - 1];

                // Get the full text to analyze what STL containers are actually used
                const fullText = model.getValue();

                // Find which STL containers are declared in the code
                const usedContainers = new Set();
                for (const containerName in stlContainers) {
                    // Look for declarations like: containerName<...> varName or containerName varName
                    const regex = new RegExp(`\\b${containerName}\\b\\s*(?:<[^>]*>)?\\s+[a-zA-Z_][a-zA-Z0-9_]*(?:\\s*,\\s*[a-zA-Z_][a-zA-Z0-9_]*)*`, 'g');
                    if (regex.test(fullText)) {
                        usedContainers.add(containerName);
                    }
                }

                // If we have a potential container name, check if it matches any used STL containers
                const suggestions = [];

                // Add suggestions only for containers that are actually used in the code
                for (const containerName of usedContainers) {
                    if (stlContainers[containerName]) {
                        // Add function suggestions with parentheses
                        if (stlContainers[containerName].functions) {
                            stlContainers[containerName].functions.forEach(method => {
                                const insertText = method + '($1)';

                                suggestions.push({
                                    label: method,
                                    kind: monaco.languages.CompletionItemKind.Method,
                                    insertText: insertText,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: `${containerName}::${method}()`,
                                    documentation: `STL ${containerName} container method (function)`,
                                    range: range
                                });
                            });
                        }

                        // Add property suggestions WITHOUT parentheses (for things like first, second, operator[])
                        if (stlContainers[containerName].properties) {
                            stlContainers[containerName].properties.forEach(property => {
                                suggestions.push({
                                    label: property,
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    insertText: property,
                                    detail: `${containerName}::${property}`,
                                    documentation: `STL ${containerName} container property`,
                                    range: range
                                });
                            });
                        }
                    }
                }

                // If we can identify the specific variable type, narrow down suggestions
                if (potentialContainerName) {
                    // Search for the declaration of this variable in the code
                    const declarationRegex = new RegExp(`\\b(${Object.keys(stlContainers).join('|')})\\b\\s*(?:<[^>]*>)?\\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\\s*,\\s*)*(${potentialContainerName})\\b`, 'g');
                    const matches = [...fullText.matchAll(declarationRegex)];

                    if (matches.length > 0) {
                        // Get the container type from the last match (most recent declaration)
                        const containerType = matches[matches.length - 1][1];

                        // Only suggest methods for this specific container type
                        if (stlContainers[containerType]) {
                            suggestions.length = 0; // Clear previous suggestions

                            // Add function suggestions with parentheses
                            if (stlContainers[containerType].functions) {
                                stlContainers[containerType].functions.forEach(method => {
                                    const insertText = method + '($1)';

                                    suggestions.push({
                                        label: method,
                                        kind: monaco.languages.CompletionItemKind.Method,
                                        insertText: insertText,
                                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                        detail: `${containerType}::${method}()`,
                                        documentation: `STL ${containerType} container method (function)`,
                                        range: range
                                    });
                                });
                            }

                            // Add property suggestions WITHOUT parentheses (for things like first, second, operator[])
                            if (stlContainers[containerType].properties) {
                                stlContainers[containerType].properties.forEach(property => {
                                    suggestions.push({
                                        label: property,
                                        kind: monaco.languages.CompletionItemKind.Property,
                                        insertText: property,
                                        detail: `${containerType}::${property}`,
                                        documentation: `STL ${containerType} container property`,
                                        range: range
                                    });
                                });
                            }
                        }
                    }
                }

                return {
                    suggestions: suggestions
                };
            } else {
                // For non-dot cases, return empty suggestions since other providers handle keywords and variables
                return {
                    suggestions: []
                };
            }
        },
        triggerCharacters: ['.']  // Trigger suggestion when '.' is typed
    });

    // Register completion provider for C++ keywords
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            const suggestions = [];

            // Add all C++ keywords
            for (const keyword of cppKeywords) {
                // For certain keywords that are functions, add parentheses
                const isFunctionKeyword = ['main', 'printf', 'scanf', 'cin', 'cout'].includes(keyword);
                let insertText = keyword;
                if (isFunctionKeyword) {
                    insertText = keyword + '($1)';
                }

                suggestions.push({
                    label: keyword,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: insertText,
                    insertTextRules: isFunctionKeyword ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range: range
                });
            }

            return {
                suggestions: suggestions
            };
        }
    });

    // Register completion provider for variable names
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Get all variable names from the current code
            const fullText = model.getValue();
            const variableNames = extractVariableNames(fullText);

            const suggestions = [];

            // Add variable name suggestions
            for (const varName of variableNames) {
                suggestions.push({
                    label: varName,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: varName,
                    detail: 'Variable or function parameter',
                    documentation: `Variable or function parameter defined in current code`,
                    range: range
                });
            }

            return {
                suggestions: suggestions
            };
        }
    });

    // Register completion provider for variable declarations to suggest STL containers
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Check if we're at a position where we might declare a variable
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);

            // If we're likely to be declaring a variable (after a space or tab, not after a dot)
            if (!textBefore.endsWith('.') && !textBefore.endsWith('>')) {
                const suggestions = [];

                // Add STL container suggestions
                for (const containerName in stlContainers) {
                    suggestions.push({
                        label: containerName,
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: containerName,
                        detail: `STL ${containerName} container`,
                        documentation: `Standard Template Library ${containerName} container`,
                        range: range
                    });
                }

                return {
                    suggestions: suggestions
                };
            }

            return {
                suggestions: []
            };
        }
    });

    // Register completion provider for C++ standard library functions and objects
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Check if we're at a position where we might include a header or use a function
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);

            // If we're likely to be including a header (after '#include')
            if (textBefore.trim().endsWith('#include')) {
                const suggestions = [];

                // Add C++ standard library header suggestions
                const allHeaders = new Set([
                    ...Object.keys(cppFunctions),
                    ...Object.keys(cppObjects)
                ]);

                for (const headerName of allHeaders) {
                    suggestions.push({
                        label: `<${headerName}>`,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: `<${headerName}>`,
                        detail: `C++ standard library header`,
                        documentation: `Include the ${headerName} header`,
                        range: range
                    });
                }

                return {
                    suggestions: suggestions
                };
            }
            // If we're not after a dot or in a template, suggest function names and objects
            else if (!textBefore.endsWith('.') && !textBefore.includes('<') || textBefore.endsWith('>')) {
                const suggestions = [];

                // Add all function suggestions from all headers
                for (const [headerName, functions] of Object.entries(cppFunctions)) {
                    functions.forEach(func => {
                        // Add parentheses to function names
                        const insertText = func + '($1)';

                        suggestions.push({
                            label: func,
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: insertText,
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: `${headerName}::${func}`,
                            documentation: `Function from ${headerName} header`,
                            range: range
                        });
                    });
                }

                // Add all object suggestions from all headers
                for (const [headerName, objects] of Object.entries(cppObjects)) {
                    objects.forEach(obj => {
                        // For some objects that behave like functions, add parentheses
                        const isFunctionLike = ['endl', 'flush', 'ws'].includes(obj);
                        let insertText = obj;
                        if (isFunctionLike) {
                            insertText = obj + '($1)';
                        }

                        suggestions.push({
                            label: obj,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: insertText,
                            insertTextRules: isFunctionLike ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                            detail: `${headerName}::${obj}`,
                            documentation: `Object from ${headerName} header`,
                            range: range
                        });
                    });
                }

                return {
                    suggestions: suggestions
                };
            }

            return {
                suggestions: []
            };
        }
    });

    // Register completion provider for directives when typing #
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Check if we're at a position right after '#'
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);

            // If we're likely to be typing after '#'
            if (textBefore.trim() === '#' || textBefore.trim().endsWith('#')) {
                const suggestions = [
                    {
                        label: 'include',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'include',
                        detail: 'C++ preprocessor directive',
                        documentation: 'Include a file at compilation time',
                        range: range
                    },
                    {
                        label: 'define',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'define',
                        detail: 'C++ preprocessor directive',
                        documentation: 'Define a macro',
                        range: range
                    },
                    {
                        label: 'ifdef',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'ifdef',
                        detail: 'C++ preprocessor directive',
                        documentation: 'Conditional compilation - if defined',
                        range: range
                    },
                    {
                        label: 'ifndef',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'ifndef',
                        detail: 'C++ preprocessor directive',
                        documentation: 'Conditional compilation - if not defined',
                        range: range
                    },
                    {
                        label: 'endif',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'endif',
                        detail: 'C++ preprocessor directive',
                        documentation: 'End conditional compilation block',
                        range: range
                    },
                    {
                        label: 'pragma',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'pragma',
                        detail: 'C++ preprocessor directive',
                        documentation: 'Implementation-specific commands',
                        range: range
                    }
                ];

                return {
                    suggestions: suggestions
                };
            }

            return {
                suggestions: []
            };
        },
        triggerCharacters: ['#']  // Trigger suggestion when '#' is typed
    });

    // Register completion provider for header files when typing <>
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Check if we're at a position right after '#include <'
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);

            // If we're likely to be typing inside #include <>
            if (textBefore.trim().endsWith('#include <') ||
                (/.*#include\s*<[^>]*$/.test(textBefore))) {
                const suggestions = [];

                // Add C++ standard library header suggestions
                const allHeaders = new Set([
                    ...Object.keys(cppFunctions),
                    ...Object.keys(cppObjects)
                ]);

                for (const headerName of allHeaders) {
                    suggestions.push({
                        label: headerName,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: `${headerName}>`,
                        detail: `C++ standard library header`,
                        documentation: `Standard library header: ${headerName}`,
                        range: range
                    });
                }

                return {
                    suggestions: suggestions
                };
            }

            return {
                suggestions: []
            };
        },
        triggerCharacters: ['<']  // Trigger suggestion when '<' is typed in include statements
    });

    // Register completion provider for variable names
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Get all variable names from the current code
            const fullText = model.getValue();
            const variableNames = extractVariableNames(fullText);

            const suggestions = [];

            // Add variable name suggestions
            for (const varName of variableNames) {
                // Check if the variable is a pair type
                const pairDeclarationRegex = new RegExp(`pair\\s*<[^>]*>\\s+${varName}\\b`);

                suggestions.push({
                    label: varName,
                    kind: pairDeclarationRegex.test(fullText)
                        ? monaco.languages.CompletionItemKind.Struct
                        : monaco.languages.CompletionItemKind.Variable,
                    insertText: varName,
                    detail: pairDeclarationRegex.test(fullText) ? 'pair variable' : 'Variable or function parameter',
                    documentation: `Variable or function parameter defined in current code`,
                    range: range
                });
            }

            return {
                suggestions: suggestions
            };
        }
    });
}

// 初始化洛谷题目功能
function initLuoguFeature() {
    // 根据插件设置决定是否显示洛谷按钮
    updateLuoguButtonVisibility();

    // 监听插件设置变化
    const luoguThemeEnabledCheckbox = document.getElementById('luogu-theme-enabled');
    if (luoguThemeEnabledCheckbox) {
        luoguThemeEnabledCheckbox.addEventListener('change', function() {
            luoguThemeEnabled = this.checked;
            localStorage.setItem(LUOGU_THEME_ENABLED_KEY, luoguThemeEnabled);
            updateLuoguButtonVisibility();

            // 洛谷主题启用状态已更新，存储到本地
            // 实际的主题功能将在后续实现
            console.log('洛谷主题插件状态已更新:', luoguThemeEnabled);
        });
    }
}

// 更新洛谷按钮可见性
function updateLuoguButtonVisibility() {
    // 创建或获取洛谷按钮容器
    let luoguContainer = document.getElementById('luogu-container');
    if (!luoguContainer) {
        // 创建容器
        luoguContainer = document.createElement('div');
        luoguContainer.id = 'luogu-container';
        luoguContainer.style.display = 'flex';
        luoguContainer.style.alignItems = 'center';

        // 插入到menu-bar-right中，放在run-btn前面
        const menuBarRight = document.getElementById('menu-bar-right');
        const runBtn = document.getElementById('run-btn');
        if (menuBarRight && runBtn) {
            menuBarRight.insertBefore(luoguContainer, runBtn);
        }
    }

    // 清空容器
    luoguContainer.innerHTML = '';

    // 如果启用了洛谷插件，则显示按钮
    if (luoguThemeEnabled) {
        // 创建洛谷按钮
        const luoguBtn = document.createElement('button');
        luoguBtn.id = 'luogu-btn';
        luoguBtn.className = 'tool-btn';
        luoguBtn.title = '洛谷题目';

        // 创建洛谷图标
        const luoguImg = document.createElement('img');
        luoguImg.src = '/static/Luogu.png';
        luoguImg.alt = 'Luogu';
        luoguImg.className = 'icon-btn';

        // 组装按钮
        luoguBtn.appendChild(luoguImg);
        luoguContainer.appendChild(luoguBtn);

        // 添加点击事件
        luoguBtn.addEventListener('click', showLuoguProblemDialog);
    }
}

// 显示洛谷题目对话框
function showLuoguProblemDialog() {
    // 创建模态框
    const modal = document.createElement('div');
    modal.id = 'luogu-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.zIndex = '200'; // 确保在其他元素之上

    // 创建模态框内容
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    // 检测是否为移动设备 - 使用 isFullMode 变量作为参考
    const isMobile = !isFullMode; // 非全屏模式视为移动设备

    if (isMobile) {
        // 移动端样式
        modalContent.style.width = '90%';
        modalContent.style.maxWidth = 'none';
        modalContent.style.margin = '20px';
        modalContent.style.maxHeight = '80vh';
    } else {
        // 桌面端样式
        modalContent.style.width = '80%';
        modalContent.style.maxWidth = '500px';
        modalContent.style.margin = 'auto';
    }

    // 创建头部
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';

    const headerTitle = document.createElement('h2');
    headerTitle.textContent = '洛谷题目查询';

    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function() {
        document.body.removeChild(modal);
    });

    modalHeader.appendChild(headerTitle);
    modalHeader.appendChild(closeBtn);

    // 创建主体
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.style.padding = '20px';

    // 在移动端增加最大高度和滚动
    if (isMobile) {
        modalBody.style.maxHeight = '60vh';
        modalBody.style.overflowY = 'auto';
    }

    // 创建输入提示
    const inputLabel = document.createElement('label');
    inputLabel.textContent = '请输入题号（例如：P1001 或 p1001）：';
    inputLabel.style.display = 'block';
    inputLabel.style.marginBottom = '10px';
    inputLabel.style.color = '#ccc';

    // 创建输入框
    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.placeholder = '例如：P1001';
    inputField.style.width = '100%';
    inputField.style.padding = '12px';
    inputField.style.marginBottom = '15px';
    inputField.style.backgroundColor = '#1e1e1e';
    inputField.style.color = '#d4d4d4';
    inputField.style.border = '1px solid #3c3c3c';
    inputField.style.borderRadius = '4px';
    inputField.style.fontSize = '16px'; // 移动端更大的字体

    // 在移动端增加触摸目标大小
    if (isMobile) {
        inputField.style.minHeight = '44px'; // 符合移动端触摸目标大小
    }

    // 从localStorage中恢复上次输入的题号
    const savedProblemId = localStorage.getItem('phoi_last_luogu_problem_id');
    if (savedProblemId) {
        inputField.value = savedProblemId;
    }

    // 创建确认按钮
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '查询';
    confirmBtn.className = 'modal-btn';
    confirmBtn.style.backgroundColor = '#0e639c';
    confirmBtn.style.float = 'right';
    confirmBtn.style.padding = '12px 24px';

    // 在移动端增加触摸目标大小
    if (isMobile) {
        confirmBtn.style.minHeight = '44px';
        confirmBtn.style.fontSize = '16px';
    }

    // 添加回车键支持
    inputField.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            confirmBtn.click();
        }
    });

    // 添加确认按钮点击事件
    confirmBtn.addEventListener('click', function() {
        const problemId = inputField.value.trim();
        if (problemId) {
            // 处理题号，统一转换为大写
            const normalizedId = problemId.toUpperCase();
            // 保存题号到localStorage
            localStorage.setItem('phoi_last_luogu_problem_id', problemId);
            loadLuoguProblem(normalizedId);
            document.body.removeChild(modal);
        }
    });

    // 组装模态框
    modalBody.appendChild(inputLabel);
    modalBody.appendChild(inputField);
    modalBody.appendChild(confirmBtn);

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // 聚焦到输入框
    inputField.focus();

    // 在移动端，确保输入框不会被虚拟键盘遮挡
    if (isMobile) {
        setTimeout(() => {
            inputField.scrollIntoView({behavior: 'smooth', block: 'center'});
        }, 300);
    }
}

// 加载洛谷题目
function loadLuoguProblem(problemId) {
    // 这里应该从数据文件中查找题目，但现在我们先显示一个加载提示
    console.log('正在加载题目:', problemId);

    // 创建题目显示区域
    createProblemDisplayArea();

    // 模拟加载过程
    const problemDisplay = document.getElementById('problem-display');
    if (problemDisplay) {
        // 检测是否为移动设备 - 使用键盘显示状态作为参考
        const keyboardContainer = document.getElementById('keyboard-container');
        const isMobile = !isFullMode; // 非全屏模式视为移动设备

        if (isMobile) {
            problemDisplay.innerHTML = '<div style="padding: 20px; color: #ccc; text-align: center;">正在加载题目...</div>';
        } else {
            problemDisplay.innerHTML = '<div style="padding: 20px; color: #ccc;">正在加载题目...</div>';
        }
        problemDisplay.style.display = 'block';

        // 异步加载题目数据
        fetchLuoguProblemData(problemId).then(problemData => {
            if (problemData) {
                displayLuoguProblem(problemData);
            } else {
                if (isMobile) {
                    problemDisplay.innerHTML = '<div style="padding: 20px; color: #f48771; text-align: center;">未找到题目: ' + problemId + '</div>';
                } else {
                    problemDisplay.innerHTML = '<div style="padding: 20px; color: #f48771;">未找到题目: ' + problemId + '</div>';
                }
            }
        }).catch(error => {
            if (isMobile) {
                problemDisplay.innerHTML = '<div style="padding: 20px; color: #f48771; text-align: center;">加载题目失败: ' + error.message + '</div>';
            } else {
                problemDisplay.innerHTML = '<div style="padding: 20px; color: #f48771;">加载题目失败: ' + error.message + '</div>';
            }
        });
    }
}

// 获取洛谷题目数据
// 获取洛谷题目数据（支持 P/B 分离 + 二分查找）
async function fetchLuoguProblemData(problemId) {
    const normalized = problemId.toUpperCase();
    const match = normalized.match(/^([BP])(\d+)$/);
    if (!match) return null;

    const type = match[1]; // 'P' 或 'B'
    const indexRes = await fetch('/static/luogu_index.json');
    if (!indexRes.ok) return null;
    const index = await indexRes.json();
    const chunks = index.types?.[type];
    if (!chunks || chunks.length === 0) return null;

    // 二分查找目标分片
    let low = 0, high = chunks.length - 1;
    let targetChunk = null;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const chunk = chunks[mid];
        const minNum = parseInt(chunk.min_pid.slice(1), 10);
        const maxNum = parseInt(chunk.max_pid.slice(1), 10);
        const targetNum = parseInt(match[2], 10);

        if (targetNum >= minNum && targetNum <= maxNum) {
            targetChunk = chunk;
            break;
        } else if (targetNum < minNum) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    if (!targetChunk) return null;

    // 加载目标分片
    const fileRes = await fetch(`/static/${targetChunk.file}`);
    if (!fileRes.ok) return null;
    const text = await fileRes.text();
    const lines = text.split('\n').filter(line => line.trim());
    for (const line of lines) {
        try {
            const data = JSON.parse(line);
            if (data.pid && data.pid.toUpperCase() === normalized) {
                return data;
            }
        } catch (e) {
            // 忽略解析错误
        }
    }
    return null; // 题目不存在于该分片中（可能缺失）
}
// 创建题目显示区域
function createProblemDisplayArea() {
    // 检查是否已经存在题目显示区域
    let problemDisplay = document.getElementById('problem-display');
    if (!problemDisplay) {
        // 创建题目显示区域
        problemDisplay = document.createElement('div');
        problemDisplay.id = 'problem-display';

        // 检测是否为移动设备 - 使用键盘显示状态作为参考
        const keyboardContainer = document.getElementById('keyboard-container');
        const isMobile = !isFullMode; // 非全屏模式视为移动设备

        if (isMobile) {
            // 移动设备上的样式
            problemDisplay.style.position = 'fixed';
            problemDisplay.style.top = '36px';
            problemDisplay.style.left = '0';
            problemDisplay.style.right = '0';
            problemDisplay.style.bottom = '0';
            problemDisplay.style.width = 'auto';
            problemDisplay.style.height = 'auto';
            problemDisplay.style.backgroundColor = '#1e1e1e';
            problemDisplay.style.zIndex = '100';
            problemDisplay.style.overflowY = 'hidden'; // 隐藏滚动条，使用按钮滚动
            problemDisplay.style.touchAction = 'none'; // 禁用触摸操作，使用按钮滚动
            problemDisplay.style.display = 'none';
            problemDisplay.style.boxShadow = '0 0 15px rgba(0,0,0,0.5)';
        } else {
            // 桌面设备上的样式
            problemDisplay.style.position = 'fixed';
            problemDisplay.style.top = '36px';
            problemDisplay.style.right = '0';
            problemDisplay.style.width = '400px';
            problemDisplay.style.height = 'calc(100vh - 36px)';
            problemDisplay.style.backgroundColor = '#1e1e1e';
            problemDisplay.style.borderLeft = '1px solid #333';
            problemDisplay.style.zIndex = '100';
            problemDisplay.style.overflowY = 'auto';
            problemDisplay.style.WebkitOverflowScrolling = 'touch'; // 启用硬件加速的滚动
            problemDisplay.style.display = 'none';
            problemDisplay.style.boxShadow = '-5px 0 15px rgba(0,0,0,0.5)';
        }

        // 添加关闭按钮
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '10px';
        closeBtn.style.right = '10px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.color = '#ccc';
        closeBtn.style.zIndex = '101';
        closeBtn.addEventListener('click', function() {
            problemDisplay.style.display = 'none';
        });

        problemDisplay.appendChild(closeBtn);
        document.body.appendChild(problemDisplay);
    }

    return problemDisplay;
}

// 显示洛谷题目
function displayLuoguProblem(problemData) {
    const problemDisplay = document.getElementById('problem-display');
    if (!problemDisplay) return;

    // 检测是否为移动设备 - 使用 isFullMode 变量作为参考
    const isMobile = !isFullMode; // 非全屏模式视为移动设备

    // 清空并显示题目区域
    problemDisplay.innerHTML = '';
    problemDisplay.style.display = 'block';

    // 创建滚动容器
    const scrollContainer = document.createElement('div');
    scrollContainer.style.height = '100%';
    scrollContainer.style.overflowY = 'auto'; // 启用滚动以便按钮可以控制
    scrollContainer.style.padding = '20px';
    scrollContainer.style.boxSizing = 'border-box';
    scrollContainer.style.touchAction = 'none'; // 禁用触摸操作，使用按钮滚动

    // 为移动端隐藏滚动条
    if (isMobile) {
        // 隐藏滚动条的样式
        scrollContainer.style.msOverflowStyle = 'none';  // IE 和 Edge
        scrollContainer.style.scrollbarWidth = 'none';  // Firefox

        // 为 Webkit 浏览器隐藏滚动条
        const style = document.createElement('style');
        style.textContent = `
            #problem-display [data-scroll-container]::-webkit-scrollbar {
                display: none;  /* Chrome, Safari, Opera*/
            }
        `;
        document.head.appendChild(style);
    }

    scrollContainer.setAttribute('data-scroll-container', 'true'); // 标记这个容器用于滚动

    // 难度标签
    const difficultyTag = document.createElement('div');
    difficultyTag.style.display = 'inline-block';
    difficultyTag.style.padding = '4px 8px';
    difficultyTag.style.borderRadius = '4px';
    difficultyTag.style.fontSize = '12px';
    difficultyTag.style.fontWeight = 'bold';
    difficultyTag.style.marginRight = '10px';
    difficultyTag.style.verticalAlign = 'middle';

    // 根据难度设置颜色
    switch(problemData.difficulty) {
        case 0: // 暂无评定
            difficultyTag.style.backgroundColor = '#666';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '暂无评定';
            break;
        case 1: // 入门
            difficultyTag.style.backgroundColor = '#ff4444';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '入门';
            break;
        case 2: // 普及-
            difficultyTag.style.backgroundColor = '#ff8800';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '普及-';
            break;
        case 3: // 普及/提高-
            difficultyTag.style.backgroundColor = '#ffbb00';
            difficultyTag.style.color = 'black';
            difficultyTag.textContent = '普及/提高-';
            break;
        case 4: // 普及+/提高
            difficultyTag.style.backgroundColor = '#00aa00';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '普及+/提高';
            break;
        case 5: // 提高+/省选-
            difficultyTag.style.backgroundColor = '#0066cc';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '提高+/省选-';
            break;
        case 6: // 省选/NOI-
            difficultyTag.style.backgroundColor = '#8800cc';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '省选/NOI-';
            break;
        case 7: // NOI/NOI+/CTSC
            difficultyTag.style.backgroundColor = '#220066';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = 'NOI/NOI+/CTSC';
            break;
        default:
            difficultyTag.style.backgroundColor = '#666';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '未知难度';
    }

    // 标题区域
    const titleContainer = document.createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.justifyContent = 'space-between';
    titleContainer.style.alignItems = 'center';
    titleContainer.style.marginTop = '30px';
    titleContainer.style.flexWrap = 'wrap';
    titleContainer.style.gap = '10px';

    const titleElement = document.createElement('h2');
    titleElement.style.color = '#ccc';
    titleElement.style.margin = '0';
    titleElement.style.flex = '1';
    titleElement.style.minWidth = '0';
    titleElement.style.display = 'flex';
    titleElement.style.alignItems = 'center';
    titleElement.appendChild(difficultyTag);

    const titleSpan = document.createElement('span');
    titleSpan.textContent = `${problemData.pid}. ${problemData.title}`;
    titleElement.appendChild(titleSpan);

    const linkButton = document.createElement('a');
    linkButton.href = `https://www.luogu.com.cn/problem/${problemData.pid}`;
    linkButton.target = '_blank';
    linkButton.style.backgroundColor = '#0e639c';
    linkButton.style.color = 'white';
    linkButton.style.padding = '8px 16px';
    linkButton.style.textDecoration = 'none';
    linkButton.style.borderRadius = '4px';
    linkButton.style.fontSize = '14px';
    linkButton.style.whiteSpace = 'nowrap';
    linkButton.textContent = '跳转到洛谷';

    titleContainer.appendChild(titleElement);
    titleContainer.appendChild(linkButton);
    scrollContainer.appendChild(titleContainer);

    // 题目描述
    const descSection = document.createElement('div');
    descSection.style.margin = '20px 0';

    const descHeading = document.createElement('h3');
    descHeading.style.color = '#569cd6';
    descHeading.textContent = '题目描述';

    const descContent = document.createElement('div');
    descContent.id = 'problem-description';
    descContent.style.color = '#ccc';
    descContent.style.lineHeight = '1.6';

    descSection.appendChild(descHeading);
    descSection.appendChild(descContent);
    scrollContainer.appendChild(descSection);

    // 输入格式
    const inputSection = document.createElement('div');
    inputSection.style.margin = '20px 0';

    const inputHeading = document.createElement('h3');
    inputHeading.style.color = '#569cd6';
    inputHeading.textContent = '输入格式';

    const inputContent = document.createElement('div');
    inputContent.id = 'problem-input-format';
    inputContent.style.color = '#ccc';
    inputContent.style.lineHeight = '1.6';

    inputSection.appendChild(inputHeading);
    inputSection.appendChild(inputContent);
    scrollContainer.appendChild(inputSection);

    // 输出格式
    const outputSection = document.createElement('div');
    outputSection.style.margin = '20px 0';

    const outputHeading = document.createElement('h3');
    outputHeading.style.color = '#569cd6';
    outputHeading.textContent = '输出格式';

    const outputContent = document.createElement('div');
    outputContent.id = 'problem-output-format';
    outputContent.style.color = '#ccc';
    outputContent.style.lineHeight = '1.6';

    outputSection.appendChild(outputHeading);
    outputSection.appendChild(outputContent);
    scrollContainer.appendChild(outputSection);

    // 样例
    if (problemData.samples && problemData.samples.length > 0) {
        const samplesSection = document.createElement('div');
        samplesSection.style.margin = '20px 0';

        const samplesHeading = document.createElement('h3');
        samplesHeading.style.color = '#569cd6';
        samplesHeading.textContent = '样例';

        samplesSection.appendChild(samplesHeading);

        problemData.samples.forEach((sample, index) => {
            const sampleContainer = document.createElement('div');
            sampleContainer.style.margin = '15px 0';
            sampleContainer.style.border = '1px solid #333';
            sampleContainer.style.borderRadius = '4px';
            sampleContainer.style.overflow = 'hidden';

            // 输入部分
            const inputBlock = document.createElement('div');
            inputBlock.style.padding = '10px';
            inputBlock.style.backgroundColor = '#1a1a1a';

            const inputLabel = document.createElement('div');
            inputLabel.style.color = '#6a9955';
            inputLabel.style.fontWeight = 'bold';
            inputLabel.style.marginBottom = '5px';
            inputLabel.textContent = `输入 #${index + 1}`;

            const inputPre = document.createElement('pre');
            inputPre.style.background = '#1e1e1e';
            inputPre.style.padding = '10px';
            inputPre.style.border = '1px solid #333';
            inputPre.style.color = '#ccc';
            inputPre.style.whiteSpace = 'pre-wrap';
            inputPre.style.margin = '0';
            inputPre.style.overflowX = 'auto';
            inputPre.style.webkitOverflowScrolling = 'touch';
            inputPre.textContent = sample[0];

            inputBlock.appendChild(inputLabel);
            inputBlock.appendChild(inputPre);

            // 输出部分
            const outputBlock = document.createElement('div');
            outputBlock.style.padding = '10px';
            outputBlock.style.backgroundColor = '#1a1a1a';

            const outputLabel = document.createElement('div');
            outputLabel.style.color = '#6a9955';
            outputLabel.style.fontWeight = 'bold';
            outputLabel.style.marginBottom = '5px';
            outputLabel.textContent = `输出 #${index + 1}`;

            const outputPre = document.createElement('pre');
            outputPre.style.background = '#1e1e1e';
            outputPre.style.padding = '10px';
            outputPre.style.border = '1px solid #333';
            outputPre.style.color = '#ccc';
            outputPre.style.whiteSpace = 'pre-wrap';
            outputPre.style.margin = '0';
            outputPre.style.overflowX = 'auto';
            outputPre.style.webkitOverflowScrolling = 'touch';
            outputPre.textContent = sample[1];

            outputBlock.appendChild(outputLabel);
            outputBlock.appendChild(outputPre);

            sampleContainer.appendChild(inputBlock);
            sampleContainer.appendChild(outputBlock);
            samplesSection.appendChild(sampleContainer);
        });

        scrollContainer.appendChild(samplesSection);
    }

    // 提示
    if (problemData.hint) {
        const hintSection = document.createElement('div');
        hintSection.style.margin = '20px 0';

        const hintHeading = document.createElement('h3');
        hintHeading.style.color = '#569cd6';
        hintHeading.textContent = '提示';

        const hintContent = document.createElement('div');
        hintContent.id = 'problem-hint';
        hintContent.style.color = '#ccc';
        hintContent.style.lineHeight = '1.6';

        hintSection.appendChild(hintHeading);
        hintSection.appendChild(hintContent);
        scrollContainer.appendChild(hintSection);
    }

    problemDisplay.appendChild(scrollContainer);

    // 在移动设备上，临时隐藏编辑器区域以显示题目详情
    if (isMobile) {
        const editorArea = document.getElementById('editor-area');
        if (editorArea) {
            editorArea.style.display = 'none';
        }

        // 添加一个返回编辑器的按钮
        const backButton = document.createElement('div');
        backButton.innerHTML = '返回编辑器';
        backButton.style.position = 'fixed';
        backButton.style.bottom = '20px';
        backButton.style.left = '50%';
        backButton.style.transform = 'translateX(-50%)';
        backButton.style.backgroundColor = '#0e639c';
        backButton.style.color = 'white';
        backButton.style.padding = '12px 24px';
        backButton.style.borderRadius = '30px';
        backButton.style.cursor = 'pointer';
        backButton.style.zIndex = '102';
        backButton.style.textAlign = 'center';
        backButton.style.fontSize = '16px';
        backButton.style.fontWeight = 'bold';
        backButton.style.boxSizing = 'border-box';
        backButton.id = 'back-to-editor-btn';

        backButton.addEventListener('click', function() {
            problemDisplay.style.display = 'none';
            const editorArea = document.getElementById('editor-area');
            if (editorArea) {
                editorArea.style.display = 'flex';
            }

            // 恢复背景页面滚动
            document.body.style.overflow = '';
        });

        problemDisplay.appendChild(backButton);

        // 确保在移动设备上可以滚动
        document.body.style.overflow = 'hidden';  // 防止背景页面滚动
    } else {
        // 在桌面设备上，确保滚动正常
        document.body.style.overflow = '';
    }

    // 渲染Markdown和LaTeX内容
    renderMarkdownAndLatex('problem-description', problemData.description || '');
    renderMarkdownAndLatex('problem-input-format', problemData.inputFormat || '');
    renderMarkdownAndLatex('problem-output-format', problemData.outputFormat || '');
    if (problemData.hint) {
        renderMarkdownAndLatex('problem-hint', problemData.hint);
    }

    // 添加关闭按钮
    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '10px';
    closeBtn.style.right = '10px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.color = '#ccc';
    closeBtn.style.zIndex = '101';
    closeBtn.addEventListener('click', function() {
        problemDisplay.style.display = 'none';

        // 在移动设备上，关闭题目显示后恢复编辑器显示
        if (isMobile) {
            const editorArea = document.getElementById('editor-area');
            if (editorArea) {
                editorArea.style.display = 'flex';

                // 检查当前是否为手机模式（通过检查lines-container的显示状态）
                const linesContainer = document.getElementById('lines-container');
                if (linesContainer && linesContainer.style.display !== 'none') {
                    // 当前是手机模式，确保3行预览区域可见
                    linesContainer.style.display = 'flex';

                    // 隐藏Monaco编辑器（在手机模式下）
                    const editorContainer = document.getElementById('editor-container');
                    if (editorContainer) {
                        editorContainer.style.display = 'none';
                    }
                }
            }

            // 移除返回编辑器按钮
            const backButton = document.getElementById('back-to-editor-btn');
            if (backButton && backButton.parentNode === problemDisplay) {
                backButton.parentNode.removeChild(backButton);
            }

            // 恢复背景页面滚动
            document.body.style.overflow = '';
        } else {
            // 在桌面设备上，确保滚动正常
            document.body.style.overflow = '';
        }
    });

    problemDisplay.appendChild(closeBtn);

    // 在移动端添加滚动按钮
    if (isMobile) {
        // 上移按钮
        const upBtn = document.createElement('div');
        upBtn.innerHTML = '↑';
        upBtn.className = 'up-btn-mobile';

        // 上移按钮点击事件
        let upBtnInterval;
        upBtn.addEventListener('mousedown', function() {
            scrollContainer.scrollTop -= 50;
            upBtnInterval = setInterval(() => {
                scrollContainer.scrollTop -= 50;
            }, 100);
        });

        upBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            scrollContainer.scrollTop -= 50;
            upBtnInterval = setInterval(() => {
                scrollContainer.scrollTop -= 50;
            }, 100);
        });

        upBtn.addEventListener('mouseup', function() {
            clearInterval(upBtnInterval);
        });

        upBtn.addEventListener('touchend', function() {
            clearInterval(upBtnInterval);
        });

        upBtn.addEventListener('mouseleave', function() {
            clearInterval(upBtnInterval);
        });

        problemDisplay.appendChild(upBtn);

        // 下移按钮
        const downBtn = document.createElement('div');
        downBtn.innerHTML = '↓';
        downBtn.className = 'down-btn-mobile';

        // 下移按钮点击事件
        let downBtnInterval;
        downBtn.addEventListener('mousedown', function() {
            scrollContainer.scrollTop += 50;
            downBtnInterval = setInterval(() => {
                scrollContainer.scrollTop += 50;
            }, 100);
        });

        downBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            scrollContainer.scrollTop += 50;
            downBtnInterval = setInterval(() => {
                scrollContainer.scrollTop += 50;
            }, 100);
        });

        downBtn.addEventListener('mouseup', function() {
            clearInterval(downBtnInterval);
        });

        downBtn.addEventListener('touchend', function() {
            clearInterval(downBtnInterval);
        });

        downBtn.addEventListener('mouseleave', function() {
            clearInterval(downBtnInterval);
        });

        problemDisplay.appendChild(downBtn);
    }
}

// 渲染Markdown和LaTeX内容
function renderMarkdownAndLatex(elementId, content) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // 使用Marked解析Markdown
    const markdownContent = marked.parse(content);

    // 设置HTML内容
    element.innerHTML = markdownContent;

    // 使用KaTeX渲染数学公式
    renderMathInElement(element, {
        delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false},
            {left: "\\(", right: "\\)", display: false},
            {left: "\\[", right: "\\]", display: true}
        ],
        throwOnError: false
    });
}

// 初始化虚拟文件系统
initializeVFS();
renderVFS();
updateCurrentFileNameDisplay();

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

// 初始化洛谷题目功能
initLuoguFeature();

// 监听窗口大小变化，调整题目显示区域样式
window.addEventListener('resize', function() {
    const problemDisplay = document.getElementById('problem-display');
    if (problemDisplay && problemDisplay.style.display !== 'none') {
        const keyboardContainer = document.getElementById('keyboard-container');
        const isMobile = !isFullMode; // 非全屏模式视为移动设备

        if (isMobile) {
            // 移动设备上的样式
            problemDisplay.style.position = 'fixed';
            problemDisplay.style.top = '36px';
            problemDisplay.style.left = '0';
            problemDisplay.style.right = '0';
            problemDisplay.style.bottom = '0';
            problemDisplay.style.width = 'auto';
            problemDisplay.style.height = 'auto';
        } else {
            // 桌面设备上的样式
            problemDisplay.style.position = 'fixed';
            problemDisplay.style.top = '36px';
            problemDisplay.style.right = '0';
            problemDisplay.style.width = '400px';
            problemDisplay.style.height = 'calc(100vh - 36px)';
            problemDisplay.style.borderLeft = '1px solid #333';
        }
    }
});

// 初始化虚拟文件系统
initializeVFS();
renderVFS();
updateCurrentFileNameDisplay();