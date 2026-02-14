// --- 虚拟文件系统 (VFS) 实现 ---

// 虚拟文件系统相关变量
let vfsStructure = null;
const VFS_STORAGE_KEY = 'phoi_vfs_structure';
let currentFileName = localStorage.getItem('phoi_currentFileName') || 'new.cpp'; // 当前正在编辑的文件名

// 文件系统管理模式
let useNativeFS = localStorage.getItem('phoi_useNativeFS') === 'true';

// 文件系统管理器类
class FileSystemManager {
  constructor() {
    this.rootDir = null;
    this.fileHandles = new Map();
  }

  async requestDirectoryAccess() {
    // 检查是否已有保存的权限
    const savedHandles = await this.restoreHandles();

    if (savedHandles && savedHandles.length > 0) {
      // 尝试获取已保存的目录句柄
      try {
        // 使用showDirectoryPicker来获取之前保存的目录句柄
        // 注意：这仍需要用户手势，所以我们直接请求新权限
        this.rootDir = await window.showDirectoryPicker();
        console.log('已获取文件夹访问权限');
      } catch (error) {
        // 如果无法获取权限，可能是用户撤销了权限或目录不存在
        console.error('用户拒绝了文件夹访问权限或无法获取权限:', error);
        // 检查错误类型，如果是权限相关错误，则自动回退
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          fallbackToVirtualFS(error.message);
        }
        throw error; // 重新抛出错误，让调用者处理
      }
    } else {
      // 首次访问，请求用户授权
      try {
        this.rootDir = await window.showDirectoryPicker();
        await this.persistHandle(this.rootDir);
        console.log('已获取文件夹访问权限');
      } catch (error) {
        console.error('用户拒绝了文件夹访问权限:', error);
        // 检查错误类型，如果是权限相关错误，则自动回退
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          fallbackToVirtualFS(error.message);
        }
        throw error; // 重新抛出错误，让调用者处理
      }
    }

    // 加载文件列表
    await this.loadFiles();
  }

  async restoreHandles() {
    if (!('showDirectoryPicker' in window)) {
      console.log('File System Access API not supported');
      return null;
    }

    try {
      const handles = JSON.parse(localStorage.getItem('phoi_dirHandles') || '[]');
      if (handles.length > 0) {
        // 只返回存储的信息，不尝试获取句柄，因为这需要用户手势
        return handles; // 返回存储的句柄信息
      }
    } catch (error) {
      console.error('Error restoring handles:', error);
    }
    return null;
  }

  async persistHandle(handle) {
    if (!('showDirectoryPicker' in window)) {
      console.log('File System Access API not supported');
      return;
    }

    try {
      // 使用FileSystemHandle的特性来持久化权限
      if ('requestPermission' in handle) {
        const permission = await handle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          console.warn('未能获得持久化权限');
          return;
        }
      }

      // 存储句柄信息
      const serializedHandle = {
        id: handle.name, // 使用目录名称作为ID
        kind: handle.kind
      };
      localStorage.setItem('phoi_dirHandles', JSON.stringify([serializedHandle]));
    } catch (error) {
      console.error('Error persisting handle:', error);
    }
  }

  async loadFiles() {
    if (!this.rootDir) return;
    
    this.fileHandles.clear();
    for await (const entry of this.rootDir.values()) {
      if (entry.kind === 'file') {
        this.fileHandles.set(entry.name, entry);
      }
    }
  }

  async getFileContent(fileName) {
    if (!this.rootDir) return null;
    
    const fileHandle = this.fileHandles.get(fileName);
    if (!fileHandle) return null;
    
    const file = await fileHandle.getFile();
    return await file.text();
  }

  async saveFile(fileName, content) {
    if (!this.rootDir) return false;
    
    let fileHandle = this.fileHandles.get(fileName);
    
    if (!fileHandle) {
      // 如果文件不存在，创建新文件
      fileHandle = await this.rootDir.getFileHandle(fileName, { create: true });
      this.fileHandles.set(fileName, fileHandle);
    }
    
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    
    return true;
  }

  async deleteFile(fileName) {
    if (!this.rootDir) return false;
    
    const fileHandle = this.fileHandles.get(fileName);
    if (!fileHandle) return false;
    
    await this.rootDir.removeEntry(fileName);
    this.fileHandles.delete(fileName);
    
    return true;
  }

  getFileList() {
    return Array.from(this.fileHandles.keys());
  }

  async createFile(fileName, content = '') {
    if (!this.rootDir) return false;
    
    const fileHandle = await this.rootDir.getFileHandle(fileName, { create: true });
    this.fileHandles.set(fileName, fileHandle);
    
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    
    return true;
  }
}

// 实例化文件系统管理器
const fsManager = new FileSystemManager();

// 初始化 VFS 模块
async function initVFSModule() {
    // 检查是否启用了本地文件系统但没有权限
    if (useNativeFS && 'showDirectoryPicker' in window && !fsManager.rootDir) {
        // 显示权限请求弹窗
        showPermissionRequestModal();
    } else {
        // 初始化虚拟文件系统
        initializeVFS();
        renderVFS();
        setupEventListeners();
        updateCurrentFileNameDisplay();
    }
}


// 显示权限请求弹窗
function showPermissionRequestModal() {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'permission-request-overlay';
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
    modal.id = 'permission-request-modal';
    modal.style.backgroundColor = '#252526';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    modal.style.textAlign = 'center';
    modal.style.maxWidth = '400px';
    modal.style.width = '80%';
    modal.style.color = '#cccccc';

    // 添加标题
    const title = document.createElement('h3');
    title.textContent = '本地文件系统权限';
    title.style.color = '#ffffff';
    title.style.marginTop = '0';
    modal.appendChild(title);

    // 添加说明文字
    const message = document.createElement('p');
    message.textContent = '您已启用本地文件系统功能，但尚未授权访问权限。请选择：';
    message.style.marginBottom = '20px';
    message.style.lineHeight = '1.5';
    modal.appendChild(message);

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexDirection = 'column';
    buttonContainer.style.gap = '10px';

    // 授权按钮
    const grantPermissionBtn = document.createElement('button');
    grantPermissionBtn.textContent = '授权本地文件访问';
    grantPermissionBtn.style.backgroundColor = '#0e639c';
    grantPermissionBtn.style.color = 'white';
    grantPermissionBtn.style.border = 'none';
    grantPermissionBtn.style.padding = '10px 20px';
    grantPermissionBtn.style.borderRadius = '4px';
    grantPermissionBtn.style.cursor = 'pointer';
    grantPermissionBtn.style.fontSize = '14px';
    grantPermissionBtn.onclick = function() {
        // 使用setTimeout确保弹窗关闭操作在下一个事件循环执行
        setTimeout(() => {
            // 关闭弹窗
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            
            // 然后异步尝试获取权限
            requestNativeFSPermission()
                .then(() => {
                    // 成功获取权限后，重新初始化文件系统
                    initializeVFS();
                    renderVFS();
                    setupEventListeners();
                    updateCurrentFileNameDisplay();
                })
                .catch(error => {
                    console.error('获取本地文件系统权限失败:', error);
                    alert('获取文件访问权限失败: ' + error.message);
                    
                    // 即使失败也要确保界面更新
                    initializeVFS();
                    renderVFS();
                    setupEventListeners();
                    updateCurrentFileNameDisplay();
                });
        }, 0);
    };

    // 返回虚拟文件系统按钮
    const useVirtualFSBtn = document.createElement('button');
    useVirtualFSBtn.textContent = '返回虚拟文件系统';
    useVirtualFSBtn.style.backgroundColor = '#3c3c3c';
    useVirtualFSBtn.style.color = 'white';
    useVirtualFSBtn.style.border = 'none';
    useVirtualFSBtn.style.padding = '10px 20px';
    useVirtualFSBtn.style.borderRadius = '4px';
    useVirtualFSBtn.style.cursor = 'pointer';
    useVirtualFSBtn.style.fontSize = '14px';
    useVirtualFSBtn.onclick = function() {
        // 禁用本地文件系统，使用虚拟文件系统
        useNativeFS = false;
        localStorage.setItem('phoi_useNativeFS', 'false');
        // 关闭弹窗并初始化虚拟文件系统
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
        initializeVFS();
        renderVFS();
        setupEventListeners();
        updateCurrentFileNameDisplay();
    };

    buttonContainer.appendChild(grantPermissionBtn);
    buttonContainer.appendChild(useVirtualFSBtn);
    modal.appendChild(buttonContainer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
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
async function renderVFS() {
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
    await renderVFSDirectory('/', window.vfsContent);
}

// 打开文件
async function openFile(filePath) {
    // 从虚拟文件系统中获取文件内容
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];

    // 检查文件是否存在
    let fileExists = false;
    
    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 检查本地文件系统
        try {
            if (!fsManager.rootDir) {
                // 注意：在打开文件时不能请求目录访问，因为这需要用户手势
                // 我们只在实际需要访问文件时才请求
                console.log('本地文件系统尚未初始化，请先执行文件操作以授权访问');
                fileExists = false;
            } else {
                const fileList = await fsManager.getFileList();
                fileExists = fileList.includes(fileName);
            }
        } catch (error) {
            console.error('检查本地文件存在性失败:', error);
        }
    } else {
        // 检查虚拟文件系统
        fileExists = vfsStructure['/'].children[fileName] && vfsStructure['/'].children[fileName].type === 'file';
    }

    if (fileExists) {
        // 通知主应用打开文件
        if (window.PhoiAPI && typeof window.PhoiAPI.openFile === 'function') {
            const success = await window.PhoiAPI.openFile(fileName);
            
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
async function renderVFSDirectory(path, parentElement) {
    if (!parentElement) return; // 如果父元素不存在则返回

    let files = [];
    
    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                // 显示提示信息，但不提供点击授权功能
                const container = document.createElement('div');
                container.className = 'vfs-subfolder';
                container.style.paddingLeft = '16px';

                const permissionItem = document.createElement('div');
                permissionItem.className = 'vfs-file';
                permissionItem.style.color = '#ffcc00'; // 使用黄色表示提醒
                permissionItem.style.display = 'flex';
                permissionItem.style.justifyContent = 'space-between';
                permissionItem.style.alignItems = 'center';
                permissionItem.style.padding = '5px';
                permissionItem.style.cursor = 'default'; // 不可点击
                permissionItem.style.fontStyle = 'italic';

                const permissionText = document.createElement('span');
                permissionText.textContent = '（暂无权限，请在设置中启用）';
                permissionText.style.flexGrow = '1';
                permissionItem.appendChild(permissionText);

                container.appendChild(permissionItem);
                parentElement.appendChild(container);
                return; // 提前返回，不继续渲染其他内容
            } else {
                files = await fsManager.getFileList();
            }
        } catch (error) {
            console.error('获取本地文件列表失败:', error);
        }
    } else {
        // 使用虚拟文件系统
        const folder = vfsStructure[path];
        if (!folder || folder.type !== 'folder') return;
        
        for (const itemName in folder.children) {
            const item = folder.children[itemName];
            if (item.type === 'file') {
                files.push(item);
            }
        }
    }

    const container = document.createElement('div');
    container.className = 'vfs-subfolder';
    container.style.paddingLeft = '16px';

    for (const item of files) {
        // 处理文件对象（来自虚拟文件系统）或文件名（来自本地文件系统）
        const itemName = typeof item === 'string' ? item : item.name;
        
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
        fileNameSpan.textContent = itemName;
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
            deleteFile(itemName);
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

    parentElement.appendChild(container);
}

// 删除文件
async function deleteFile(fileName) {
    // 检查是否是当前正在使用的文件
    if (window.PhoiAPI && window.PhoiAPI.getCurrentFileName && fileName === window.PhoiAPI.getCurrentFileName()) {
        alert(`无法删除当前正在使用的文件 "${fileName}"`);
        return;
    }

    if (confirm(`确定要删除文件 "${fileName}" 吗？`)) {
        if (useNativeFS && 'showDirectoryPicker' in window) {
            // 使用本地文件系统
            try {
                if (!fsManager.rootDir) {
                    await fsManager.requestDirectoryAccess();
                }
                await fsManager.deleteFile(fileName);
                renderVFS(); // 重新渲染文件列表
                
                // 发送消息
                if (typeof showMessage === 'function') {
                    showMessage(`文件 "${fileName}" 已删除`, 'user');
                } else {
                    console.log(`文件 "${fileName}" 已删除`);
                }
            } catch (error) {
                console.error('删除本地文件失败:', error);
            }
        } else {
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
async function newFile() {
    const fileName = prompt('请输入文件名:', 'new.cpp');
    if (!fileName) return;

    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                await fsManager.requestDirectoryAccess();
            }
            // 检查文件是否已存在
            const fileList = await fsManager.getFileList();
            if (fileList.includes(fileName)) {
                alert('文件已存在！');
                return;
            }

            // 获取当前的默认代码（可能是用户自定义的）
            const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`;

            // 创建新文件
            await fsManager.createFile(fileName, defaultCode);

            renderVFS(); // 重新渲染文件列表

            // 自动打开新创建的文件
            openFile(fileName);
        } catch (error) {
            console.error('在本地文件系统中创建文件失败:', error);
        }
    } else {
        // 使用虚拟文件系统
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
}


// 保存文件到虚拟文件系统
async function saveFileToVFS(fileName, content) {
    if (!fileName) return;

    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                await fsManager.requestDirectoryAccess();
            }
            await fsManager.saveFile(fileName, content);
        } catch (error) {
            console.error('保存到本地文件系统失败:', error);
            // 如果是权限错误，自动回退到虚拟文件系统
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                fallbackToVirtualFS(error.message);
                // 并使用虚拟文件系统保存
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
        }
    } else {
        // 使用虚拟文件系统
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
}

// 获取文件内容
async function getFileContent(fileName) {
    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                await fsManager.requestDirectoryAccess();
            }
            const content = await fsManager.getFileContent(fileName);
            if (content !== null) {
                return content;
            }
        } catch (error) {
            console.error('从本地文件系统读取失败:', error);
            // 如果是权限错误，自动回退到虚拟文件系统
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                fallbackToVirtualFS(error.message);
                // 并使用虚拟文件系统读取
                useNativeFS = false; // 临时禁用本地文件系统标志
            }
        }
        return null;
    }
    
    // 使用虚拟文件系统
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
async function createNewFile(fileName, content = '') {
    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                await fsManager.requestDirectoryAccess();
            }
            const defaultCode = localStorage.getItem('phoi_defaultCode') || `#include <iostream>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello Ph Code" << endl;\n\treturn 0;\n}`;
            const fileContent = content || defaultCode;

            await fsManager.createFile(fileName, fileContent);
            return openFile(fileName);
        } catch (error) {
            console.error('在本地文件系统中创建文件失败:', error);
            // 如果是权限错误，自动回退到虚拟文件系统
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                fallbackToVirtualFS(error.message);
                // 并使用虚拟文件系统创建文件
                useNativeFS = false; // 临时禁用本地文件系统标志
            } else {
                // 其他错误，回退到虚拟文件系统
                console.log('由于错误，回退到虚拟文件系统');
                useNativeFS = false;
                localStorage.setItem('phoi_useNativeFS', 'false');
            }
        }
    }

    // 使用虚拟文件系统
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
async function getFileList() {
    if (useNativeFS && 'showDirectoryPicker' in window) {
        // 使用本地文件系统
        try {
            if (!fsManager.rootDir) {
                await fsManager.requestDirectoryAccess();
            }
            return fsManager.getFileList();
        } catch (error) {
            console.error('获取本地文件列表失败:', error);
            // 回退到虚拟文件系统
        }
    }
    
    // 使用虚拟文件系统
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

// 请求本地文件系统权限
async function requestNativeFSPermission() {
    try {
        // 尝试获取目录访问权限
        await fsManager.requestDirectoryAccess();

        // 尝试创建一个测试文件
        await fsManager.createFile('!phcode.test', 'This is a test file for phcode permissions.');

        // 立即删除测试文件
        await fsManager.deleteFile('!phcode.test');

        // 检查是否存在权限请求弹窗，如果有则关闭它
        const permissionOverlay = document.getElementById('permission-request-overlay');
        if (permissionOverlay && document.body.contains(permissionOverlay)) {
            document.body.removeChild(permissionOverlay);
        }

        console.log('本地文件系统权限已成功获取');
    } catch (error) {
        console.error('请求本地文件系统权限失败:', error);
        // 自动回退到虚拟文件系统并显示通知
        fallbackToVirtualFS(error.message);
        throw error;
    }
}

// 自动回退到虚拟文件系统
function fallbackToVirtualFS(errorMessage = '') {
    // 禁用本地文件系统，使用虚拟文件系统
    useNativeFS = false;
    localStorage.setItem('phoi_useNativeFS', 'false');
    
    // 显示通知给用户
    showFallbackNotification(errorMessage);
    
    // 重新初始化文件系统
    if (typeof initializeVFS === 'function') {
        initializeVFS();
    }
    if (typeof renderVFS === 'function') {
        renderVFS();
    }
    if (typeof setupEventListeners === 'function') {
        setupEventListeners();
    }
    if (typeof updateCurrentFileNameDisplay === 'function') {
        updateCurrentFileNameDisplay();
    }
}

// 显示回退通知
function showFallbackNotification(errorMessage = '') {
    // 创建通知弹窗
    const notification = document.createElement('div');
    notification.id = 'fallback-notification';
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = '#ff4444';
    notification.style.color = 'white';
    notification.style.padding = '15px 20px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '10001';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    notification.style.maxWidth = '400px';
    notification.style.wordWrap = 'break-word';
    notification.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold;">本地文件系统授权问题</div>
        <div>已自动回退到虚拟文件系统</div>
        ${errorMessage ? `<div style="margin-top: 8px; font-size: 0.9em; opacity: 0.8;">错误: ${errorMessage}</div>` : ''}
    `;
    
    // 添加关闭按钮
    const closeButton = document.createElement('span');
    closeButton.innerHTML = '&times;';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '5px';
    closeButton.style.right = '10px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '20px';
    closeButton.onclick = function() {
        document.body.removeChild(notification);
    };
    
    notification.appendChild(closeButton);
    document.body.appendChild(notification);
    
    // 3秒后自动隐藏
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 5000);
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