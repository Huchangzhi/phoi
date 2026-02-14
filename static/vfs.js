// --- 虚拟文件系统 (VFS) 实现 ---

// 虚拟文件系统相关变量
let vfsStructure = null;
const VFS_STORAGE_KEY = 'phoi_vfs_structure';
let currentFileName = localStorage.getItem('phoi_currentFileName') || 'new.cpp'; // 当前正在编辑的文件名

// 初始化 VFS 模块
function initVFSModule() {
    // 初始化虚拟文件系统
    initializeVFS();
    renderVFS();
    setupEventListeners();
    updateCurrentFileNameDisplay();
}

// 初始化虚拟文件系统
function initializeVFS() {
    // 尝试从本地存储加载虚拟文件系统
    const savedVFS = localStorage.getItem(VFS_STORAGE_KEY);

    if (savedVFS) {
        // 如果已有虚拟文件系统，则加载它
        vfsStructure = JSON.parse(savedVFS);
    } else {
        // 否则初始化一个新的虚拟文件系统
        vfsStructure = {
            '/': {
                type: 'folder',
                name: 'root',
                children: {}
            }
        };

        // 保存到本地存储
        localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(vfsStructure));
    }
}

// 保存虚拟文件系统到本地存储
function saveVFS() {
    localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(vfsStructure));
}

// 渲染虚拟文件系统
function renderVFS() {
    if (!window.vfsContent) return; // 如果元素不存在则返回

    // 清空内容
    window.vfsContent.innerHTML = '';

    // 创建操作按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.style.padding = '10px';
    buttonContainer.style.borderBottom = '1px solid #444';

    const newFileButton = document.createElement('button');
    newFileButton.textContent = '+ 文件';
    newFileButton.onclick = newFile;

    buttonContainer.appendChild(newFileButton);
    window.vfsContent.appendChild(buttonContainer);

    // 创建根目录项
    const rootDiv = document.createElement('div');
    rootDiv.className = 'vfs-folder';
    rootDiv.textContent = '根目录';
    rootDiv.dataset.path = '/';
    // 为根目录添加点击事件
    rootDiv.addEventListener('click', function() {
        console.log('展开根目录');
    });
    window.vfsContent.appendChild(rootDiv);

    // 渲染根目录下的所有子项
    renderVFSDirectory('/', window.vfsContent);
}

// 打开文件
function openFile(filePath) {
    // 从虚拟文件系统中获取文件内容
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];

    if (vfsStructure['/'].children[fileName] && vfsStructure['/'].children[fileName].type === 'file') {
        // 通知主应用打开文件
        if (window.PhoiAPI && typeof window.PhoiAPI.openFile === 'function') {
            const success = window.PhoiAPI.openFile(fileName);
            
            if (success) {
                // 关闭虚拟文件系统面板
                if (window.vfsPanel) {
                    window.vfsPanel.style.display = 'none';
                }
                if (window.sidebarToggle) {
                    window.sidebarToggle.classList.remove('vfs-open');
                }
            }
            
            return success;
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
    if (window.PhoiAPI && window.PhoiAPI.getCurrentFileName && fileName === window.PhoiAPI.getCurrentFileName()) {
        alert(`无法删除当前正在使用的文件 "${fileName}"`);
        return;
    }

    if (confirm(`确定要删除文件 "${fileName}" 吗？`)) {
        // 从虚拟文件系统中删除文件
        delete vfsStructure['/'].children[fileName];

        saveVFS();
        renderVFS();

        // 发送消息
        if (typeof showMessage === 'function') {
            showMessage(`文件 "${fileName}" 已删除`, 'user');
        } else {
            console.log(`文件 "${fileName}" 已删除`);
        }
    }
}

// 切换虚拟文件系统面板显示状态
function toggleVFSPanel() {
    if (!window.vfsPanel || !window.sidebarToggle) return; // 如果元素不存在则返回

    if (window.vfsPanel.style.display === 'none' || window.vfsPanel.style.display === '') {
        window.vfsPanel.style.display = 'flex';
        // 添加CSS类来表示面板打开状态
        window.sidebarToggle.classList.add('vfs-open');
    } else {
        window.vfsPanel.style.display = 'none';
        // 移除CSS类来表示面板关闭状态
        window.sidebarToggle.classList.remove('vfs-open');
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
    if (window.PhoiAPI && window.PhoiAPI.getCurrentFileContent && window.PhoiAPI.getCurrentFileName) {
        const content = window.PhoiAPI.getCurrentFileContent();
        const fileName = window.PhoiAPI.getCurrentFileName() || 'current.cpp';

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
}

// 另存为当前文件
function saveCurrentFileAs() {
    if (!window.PhoiAPI || !window.PhoiAPI.getCurrentFileContent) {
        console.error('PhoiAPI未正确初始化');
        return;
    }

    const currentContent = window.PhoiAPI.getCurrentFileContent();
    const fileName = prompt('请输入文件名:', 'new_file.cpp');
    if (!fileName) return;

    // 将当前代码保存为新文件
    vfsStructure['/'].children[fileName] = {
        type: 'file',
        name: fileName,
        content: currentContent
    };

    saveVFS();
    renderVFS();

    // 通知主应用更新当前文件名
    if (window.PhoiAPI.setCurrentFileName) {
        window.PhoiAPI.setCurrentFileName(fileName);
    }

    // 发送消息
    if (typeof showMessage === 'function') {
        showMessage(`文件已另存为: ${fileName}`, 'user');
    } else {
        console.log(`文件已另存为: ${fileName}`);
    }
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

    // 获取当前的默认代码（可能是用户自定义的）
    const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`;

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


// 保存文件到虚拟文件系统
function saveFileToVFS(fileName, content) {
    if (!vfsStructure || !fileName) return;

    if (!vfsStructure['/'].children[fileName]) {
        // 如果文件不存在，创建新文件
        vfsStructure['/'].children[fileName] = {
            type: 'file',
            name: fileName,
            content: content
        };
    } else {
        // 更新现有文件内容
        vfsStructure['/'].children[fileName].content = content;
    }
    saveVFS();
}

// 获取文件内容
function getFileContent(fileName) {
    if (vfsStructure && vfsStructure['/'].children[fileName] && vfsStructure['/'].children[fileName].type === 'file') {
        return vfsStructure['/'].children[fileName].content;
    }
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
        
        return fileContent;
    }
    
    return null;
}

// 创建新文件
function createNewFile(fileName, content = '') {
    // 检查文件是否已存在
    if (vfsStructure['/'].children[fileName]) {
        console.warn(`文件 ${fileName} 已存在`);
        return false;
    }

    // 使用提供的内容或默认代码创建文件
    const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`;
    const fileContent = content || defaultCode;

    // 创建新文件
    vfsStructure['/'].children[fileName] = {
        type: 'file',
        name: fileName,
        content: fileContent
    };

    saveVFS();
    renderVFS();

    // 自动打开新创建的文件
    return openFile(fileName);
}

// 获取所有文件列表
function getFileList() {
    if (!vfsStructure) return [];
    return Object.keys(vfsStructure['/'].children).filter(key => {
        return vfsStructure['/'].children[key].type === 'file';
    });
}

// 更新顶部菜单栏中显示的当前文件名
function updateCurrentFileNameDisplay() {
    const currentFileNameElement = document.getElementById('current-file-name');
    if (currentFileNameElement) {
        currentFileNameElement.textContent = currentFileName;
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 虚拟文件系统关闭按钮 - 需要检查元素是否存在
    if (window.vfsCloseBtn) {
        window.vfsCloseBtn.addEventListener('click', function() {
            if (window.vfsPanel) {
                window.vfsPanel.style.display = 'none';
            }
            if (window.sidebarToggle) {
                // 移除CSS类来表示面板关闭状态，而不是修改文本内容
                window.sidebarToggle.classList.remove('vfs-open');
            }
        });
    }
    
    // 为侧边栏切换按钮添加事件监听器
    if (window.sidebarToggle) {
        window.sidebarToggle.addEventListener('click', toggleVFSPanel);
    }
}

// 导出函数以供外部使用
if (typeof window !== 'undefined') {
    // 在浏览器环境中，将函数附加到window对象
    window.vfsModule = {
        initVFSModule,
        initializeVFS,
        saveVFS,
        renderVFS,
        openFile,
        deleteFile,
        toggleVFSPanel,
        uploadFile,
        downloadCurrentFile,
        saveCurrentFileAs,
        newFile,
        saveFileToVFS,
        getFileContent,
        createNewFile,
        getFileList,
        getCurrentFileName: function() {
            return currentFileName;
        },
        setCurrentFileName: function(fileName) {
            currentFileName = fileName;
            localStorage.setItem('phoi_currentFileName', currentFileName);
            updateCurrentFileNameDisplay();
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initVFSModule,
        initializeVFS,
        saveVFS,
        renderVFS,
        openFile,
        deleteFile,
        toggleVFSPanel,
        uploadFile,
        downloadCurrentFile,
        saveCurrentFileAs,
        newFile,
        saveFileToVFS,
        getFileContent,
        createNewFile,
        getFileList
    };
}