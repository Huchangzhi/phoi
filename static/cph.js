/**
 * CPH (Contest Problem Helper) 插件
 * 功能: 当前文件的测试用例管理与运行
 */

// 插件状态管理
const CPH_STORAGE_KEY_PREFIX = 'phoi_cph_testcases_';

class CPHPlugin {
    constructor() {
        this.currentFile = localStorage.getItem('phoi_currentFileName') || 'new.cpp';
        this.testCases = this.loadTestCases();
        this.bindEvents();
        this.initSidebarButton();
    }

    // 从localStorage加载当前文件的测试用例
    loadTestCases() {
        try {
            const storageKey = CPH_STORAGE_KEY_PREFIX + this.currentFile;
            const savedTestCases = localStorage.getItem(storageKey);
            return savedTestCases ? JSON.parse(savedTestCases) : [];
        } catch (e) {
            console.error('CPH: 加载测试用例失败', e);
            return [];
        }
    }

    // 保存测试用例到localStorage
    saveTestCases() {
        try {
            const storageKey = CPH_STORAGE_KEY_PREFIX + this.currentFile;
            localStorage.setItem(storageKey, JSON.stringify(this.testCases));
        } catch (e) {
            console.error('CPH: 保存测试用例失败', e);
        }
    }

    // 当前文件改变时更新
    updateCurrentFile() {
        const newFile = localStorage.getItem('phoi_currentFileName') || 'new.cpp';
        if (newFile !== this.currentFile) {
            // 保存当前文件的测试用例
            this.saveTestCases();
            // 切换到新文件
            this.currentFile = newFile;
            // 加载新文件的测试用例
            this.testCases = this.loadTestCases();
            // 更新UI
            this.renderTestCases();
            this.renderTestCasesMain();
        }
    }

    // 初始化侧边栏按钮
    initSidebarButton() {
        const cphToggleBtn = document.getElementById('cph-plugin-toggle');
        if (!cphToggleBtn) return;

        // 创建CPH面板
        this.createCPHPanel();

        // 绑定侧边栏按钮点击事件
        cphToggleBtn.addEventListener('click', () => {
            this.updateCurrentFile(); // 检查是否切换了文件
            this.toggleCPHPanel();
        });
    }

    // 创建CPH面板
    createCPHPanel() {
        // 检查面板是否已存在
        if (document.getElementById('cph-panel')) return;

        const cphPanel = document.createElement('div');
        cphPanel.id = 'cph-panel';
        cphPanel.className = 'vfs-panel';
        cphPanel.style.display = 'none';
        cphPanel.innerHTML = `
            <div class="vfs-header">
                <span>CPH - 测试用例管理</span>
                <button id="cph-close-btn" class="vfs-close-btn">×</button>
            </div>
            <div id="cph-content" class="vfs-content">
                <div class="cph-controls">
                    <button id="cph-add-test-case-main" class="btn-small">+ 新建测试点</button>
                    <button id="cph-manage-files-btn" class="btn-small">管理所有题目</button>
                </div>
                <div id="cph-test-cases-container-main" class="cph-test-cases-container">
                    <!-- 测试用例列表将动态生成 -->
                </div>
                <div id="cph-all-files-container" class="cph-all-files-container" style="display: none;">
                    <div class="cph-all-files-header">
                        <h3>所有题目</h3>
                        <button id="cph-back-to-current-btn" class="btn-small">返回当前题目</button>
                    </div>
                    <div id="cph-all-files-list" class="cph-all-files-list">
                        <!-- 所有题目列表将动态生成 -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(cphPanel);

        // 绑定关闭按钮事件
        const closeBtn = document.getElementById('cph-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideCPHPanel();
            });
        }

        // 绑定新建测试用例按钮事件
        const addTestCaseBtn = document.getElementById('cph-add-test-case-main');
        if (addTestCaseBtn) {
            addTestCaseBtn.addEventListener('click', () => {
                this.addTestCase();
            });
        }

        // 绑定管理所有题目按钮事件
        const manageFilesBtn = document.getElementById('cph-manage-files-btn');
        if (manageFilesBtn) {
            manageFilesBtn.addEventListener('click', () => {
                this.showManageFilesView();
            });
        }

        // 绑定返回当前题目按钮事件
        const backToCurrentBtn = document.getElementById('cph-back-to-current-btn');
        if (backToCurrentBtn) {
            backToCurrentBtn.addEventListener('click', () => {
                this.showTestCaseView();
            });
        }
    }

    // 显示CPH面板
    showCPHPanel() {
        this.updateCurrentFile(); // 检查是否切换了文件
        
        const panel = document.getElementById('cph-panel');
        if (panel) {
            panel.style.display = 'flex';
            // 更新侧边栏按钮状态
            const cphToggleBtn = document.getElementById('cph-plugin-toggle');
            if (cphToggleBtn) {
                cphToggleBtn.classList.add('active', 'cph-open');
            }
            // 渲染内容
            this.renderTestCasesMain();
        }
    }

    // 隐藏CPH面板
    hideCPHPanel() {
        const panel = document.getElementById('cph-panel');
        if (panel) {
            panel.style.display = 'none';
            // 更新侧边栏按钮状态
            const cphToggleBtn = document.getElementById('cph-plugin-toggle');
            if (cphToggleBtn) {
                cphToggleBtn.classList.remove('active', 'cph-open');
            }
        }
    }

    // 切换CPH面板显示状态
    toggleCPHPanel() {
        const panel = document.getElementById('cph-panel');
        if (panel) {
            if (panel.style.display === 'none' || panel.style.display === '') {
                this.showCPHPanel();
            } else {
                this.hideCPHPanel();
            }
        }
    }

    // 显示管理所有题目视图
    showManageFilesView() {
        const testCaseContainer = document.getElementById('cph-test-cases-container-main');
        const allFilesContainer = document.getElementById('cph-all-files-container');
        const addTestCaseBtn = document.getElementById('cph-add-test-case-main');
        
        if (testCaseContainer) testCaseContainer.style.display = 'none';
        if (allFilesContainer) allFilesContainer.style.display = 'block';
        if (addTestCaseBtn) addTestCaseBtn.style.display = 'none';
        
        this.renderAllFilesList();
    }

    // 显示测试用例视图
    showTestCaseView() {
        const testCaseContainer = document.getElementById('cph-test-cases-container-main');
        const allFilesContainer = document.getElementById('cph-all-files-container');
        const addTestCaseBtn = document.getElementById('cph-add-test-case-main');
        
        if (testCaseContainer) testCaseContainer.style.display = 'block';
        if (allFilesContainer) allFilesContainer.style.display = 'none';
        if (addTestCaseBtn) addTestCaseBtn.style.display = 'block';
        
        this.renderTestCasesMain();
    }

    // 获取所有存储的题目
    getAllStoredFiles() {
        const files = [];
        const prefix = CPH_STORAGE_KEY_PREFIX;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                const fileName = key.substring(prefix.length);
                files.push({
                    key: key,
                    fileName: fileName,
                    testCases: JSON.parse(localStorage.getItem(key) || '[]')
                });
            }
        }
        
        return files;
    }

    // 渲染所有题目列表
    renderAllFilesList() {
        const container = document.getElementById('cph-all-files-list');
        if (!container) return;

        const files = this.getAllStoredFiles();
        
        if (files.length === 0) {
            container.innerHTML = '<div class="cph-empty-state">暂无存储的题目</div>';
            return;
        }

        container.innerHTML = '';
        
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'cph-file-item';
            fileItem.innerHTML = `
                <div class="cph-file-header">
                    <span class="cph-file-name">${file.fileName}</span>
                    <div class="cph-file-actions">
                        <button class="cph-view-file-btn btn-small" data-filename="${file.fileName}">查看</button>
                        <button class="cph-delete-file-btn btn-small" data-filename="${file.fileName}">×</button>
                    </div>
                </div>
                <div class="cph-file-info">
                    包含 ${file.testCases.length} 个测试用例
                </div>
            `;
            
            container.appendChild(fileItem);
        });

        // 绑定查看文件按钮事件
        const viewButtons = container.querySelectorAll('.cph-view-file-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileName = e.target.dataset.filename;
                this.viewFileTestCases(fileName);
            });
        });

        // 绑定删除文件按钮事件
        const deleteButtons = container.querySelectorAll('.cph-delete-file-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileName = e.target.dataset.filename;
                this.deleteFileTestCases(fileName);
            });
        });
    }

    // 查看指定文件的测试用例
    viewFileTestCases(fileName) {
        // 切换回测试用例视图
        this.showTestCaseView();
        
        // 更新当前文件
        this.currentFile = fileName;
        // 加载该文件的测试用例
        this.testCases = this.loadTestCasesForFile(fileName);
        // 重新渲染测试用例
        this.renderTestCasesMain();
    }

    // 为指定文件加载测试用例
    loadTestCasesForFile(fileName) {
        try {
            const storageKey = CPH_STORAGE_KEY_PREFIX + fileName;
            const savedTestCases = localStorage.getItem(storageKey);
            return savedTestCases ? JSON.parse(savedTestCases) : [];
        } catch (e) {
            console.error('CPH: 加载测试用例失败', e);
            return [];
        }
    }

    // 删除指定文件的测试用例
    deleteFileTestCases(fileName) {
        if (confirm(`确定要删除 "${fileName}" 的所有测试用例吗？`)) {
            try {
                const storageKey = CPH_STORAGE_KEY_PREFIX + fileName;
                localStorage.removeItem(storageKey);
                
                // 如果删除的是当前文件的测试用例，刷新当前视图
                if (this.currentFile === fileName) {
                    this.testCases = [];
                    this.renderTestCasesMain();
                }
                
                // 重新渲染所有文件列表
                this.renderAllFilesList();
            } catch (e) {
                console.error('CPH: 删除测试用例失败', e);
            }
        }
    }


    // 绑定事件
    bindEvents() {
        // 运行所有测试点按钮
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('cph-run-all-btn')) {
                this.runAllTests();
            }
        });

        // 删除测试点按钮
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('cph-delete-test-case-btn')) {
                const testCaseIndex = parseInt(e.target.dataset.testCaseIndex);
                this.deleteTestCase(testCaseIndex);
            }
        });
        
        // 监听localStorage变化，以响应来自其他插件（如luogu）的文件切换请求
        window.addEventListener('storage', (e) => {
            if (e.key === 'phoi_currentFileName') {
                this.updateCurrentFile();
            }
        });
    }

    // 添加新测试用例
    addTestCase() {
        const newTestCase = {
            stdin: '',
            stdout: '',
            name: `测试点 ${this.testCases.length + 1}`
        };

        this.testCases.push(newTestCase);
        this.saveTestCases();
        this.renderTestCases();
        this.renderTestCasesMain(); // 更新主面板
    }

    // 渲染测试用例列表 (插件中心)
    renderTestCases() {
        const container = document.getElementById('cph-test-cases-container');
        if (!container) return;

        container.innerHTML = '';

        if (this.testCases.length === 0) {
            container.innerHTML = '<div class="cph-empty-state">暂无测试用例，请点击"新建测试点"创建</div>';
            return;
        }

        this.testCases.forEach((testCase, index) => {
            const testCaseDiv = document.createElement('div');
            testCaseDiv.className = 'cph-test-case';
            testCaseDiv.innerHTML = `
                <div class="cph-test-case-header">
                    <span class="cph-test-case-name">${testCase.name}</span>
                    <div class="cph-test-case-actions">
                        <button class="cph-delete-test-case-btn btn-small" 
                                data-test-case-index="${index}">×</button>
                    </div>
                </div>
                <div class="cph-test-case-content">
                    <div class="cph-test-case-input">
                        <label>标准输入 (stdin):</label>
                        <textarea class="cph-test-case-textarea" 
                                  data-test-case-index="${index}"
                                  data-type="stdin">${testCase.stdin || ''}</textarea>
                    </div>
                    <div class="cph-test-case-output">
                        <label>标准输出 (stdout):</label>
                        <textarea class="cph-test-case-textarea" 
                                  data-test-case-index="${index}"
                                  data-type="stdout">${testCase.stdout || ''}</textarea>
                    </div>
                </div>
            `;

            container.appendChild(testCaseDiv);

            // 绑定文本框变化事件
            const textareas = testCaseDiv.querySelectorAll('.cph-test-case-textarea');
            textareas.forEach(textarea => {
                textarea.addEventListener('input', (e) => {
                    const testCaseIndex = parseInt(e.target.dataset.testCaseIndex);
                    const type = e.target.dataset.type;
                    
                    if (this.testCases[testCaseIndex]) {
                        this.testCases[testCaseIndex][type] = e.target.value;
                        this.saveTestCases();
                    }
                });
            });
        });

        // 添加运行全部按钮
        const runAllDiv = document.createElement('div');
        runAllDiv.className = 'cph-test-case-actions-bottom';
        runAllDiv.innerHTML = `<button class="cph-run-all-btn btn-small">▶ 运行全部测试点</button>`;
        container.appendChild(runAllDiv);
    }

    // 渲染测试用例列表 (主面板)
    renderTestCasesMain() {
        const container = document.getElementById('cph-test-cases-container-main');
        if (!container) return;

        container.innerHTML = '';

        if (this.testCases.length === 0) {
            container.innerHTML = '<div class="cph-empty-state">暂无测试用例，请点击"新建测试点"创建</div>';
            return;
        }

        this.testCases.forEach((testCase, index) => {
            const testCaseDiv = document.createElement('div');
            testCaseDiv.className = 'cph-test-case';
            testCaseDiv.innerHTML = `
                <div class="cph-test-case-header">
                    <span class="cph-test-case-name">${testCase.name}</span>
                    <div class="cph-test-case-actions">
                        <button class="cph-delete-test-case-btn btn-small" 
                                data-test-case-index="${index}">×</button>
                    </div>
                </div>
                <div class="cph-test-case-content">
                    <div class="cph-test-case-input">
                        <label>标准输入 (stdin):</label>
                        <textarea class="cph-test-case-textarea-main" 
                                  data-test-case-index="${index}"
                                  data-type="stdin">${testCase.stdin || ''}</textarea>
                    </div>
                    <div class="cph-test-case-output">
                        <label>标准输出 (stdout):</label>
                        <textarea class="cph-test-case-textarea-main" 
                                  data-test-case-index="${index}"
                                  data-type="stdout">${testCase.stdout || ''}</textarea>
                    </div>
                </div>
            `;

            container.appendChild(testCaseDiv);

            // 绑定文本框变化事件 (主面板)
            const textareas = testCaseDiv.querySelectorAll('.cph-test-case-textarea-main');
            textareas.forEach(textarea => {
                textarea.addEventListener('input', (e) => {
                    const testCaseIndex = parseInt(e.target.dataset.testCaseIndex);
                    const type = e.target.dataset.type;
                    
                    if (this.testCases[testCaseIndex]) {
                        this.testCases[testCaseIndex][type] = e.target.value;
                        this.saveTestCases();
                    }
                });
            });
        });

        // 添加运行全部按钮
        const runAllDiv = document.createElement('div');
        runAllDiv.className = 'cph-test-case-actions-bottom';
        runAllDiv.innerHTML = `<button class="cph-run-all-btn btn-small">▶ 运行全部测试点</button>`;
        container.appendChild(runAllDiv);
    }

    // 删除测试用例
    deleteTestCase(testCaseIndex) {
        if (confirm(`确定要删除${this.testCases[testCaseIndex].name}吗？`)) {
            this.testCases.splice(testCaseIndex, 1);
            // 更新剩余测试点的名称
            for (let i = testCaseIndex; i < this.testCases.length; i++) {
                this.testCases[i].name = `测试点 ${i + 1}`;
            }
            this.saveTestCases();
            this.renderTestCases();
            this.renderTestCasesMain(); // 更新主面板
        }
    }

    // 运行所有测试点
    async runAllTests() {
        if (this.testCases.length === 0) {
            showMessage('请先添加测试用例！', 'system');
            return;
        }

        // 获取当前编辑器中的代码
        let code = '';
        if (typeof monacoEditor !== 'undefined' && monacoEditor) {
            code = monacoEditor.getValue();
        } else {
            // 如果没有monaco编辑器，尝试从全局变量获取
            code = globalText || '';
        }

        if (!code.trim()) {
            showMessage('请先编写代码！', 'system');
            return;
        }

        // 显示运行状态
        const outputPanel = document.getElementById('output-panel');
        const outputContent = document.getElementById('output-content');
        if (outputPanel) {
            outputPanel.style.display = 'flex';
        }

        // 清空输出内容
        if (outputContent) {
            outputContent.innerHTML = `<div class="debug-message system"><strong>系统:</strong> 开始运行 ${this.testCases.length} 个测试点...</div>`;
        }

        let allPassed = true;

        // 运行每个测试点
        for (let i = 0; i < this.testCases.length; i++) {
            const testCase = this.testCases[i];
            const stdin = testCase.stdin || '';
            
            // 显示当前测试点信息
            if (outputContent) {
                outputContent.innerHTML += `<div class="debug-message system"><strong>系统:</strong> 正在运行 ${testCase.name}...</div>`;
                outputContent.scrollTop = outputContent.scrollHeight;
            }

            try {
                // 调用后端API运行代码
                const response = await fetch('/run', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        code: code,
                        input: stdin
                    })
                });

                const result = await response.json();

                // 检查结果
                let status = '✅ 通过';
                let message = '';
                
                if (result.Errors) {
                    status = '❌ 编译错误';
                    message = result.Errors;
                    allPassed = false;
                } else if (result.Result) {
                    // 检查输出是否匹配预期
                    // 忽略每行末尾的空格以及整体首尾空格
                    const normalizeWhitespace = (str) => {
                        return str.split('\n').map(line => line.replace(/\s+$/, '')).join('\n').trim();
                    };
                    
                    const actualOutput = normalizeWhitespace(result.Result);
                    const expectedOutput = normalizeWhitespace(testCase.stdout || '');

                    if (actualOutput === expectedOutput) {
                        status = '✅ 通过';
                    } else {
                        status = '❌ 输出不匹配';
                        message = `期望: "${expectedOutput}"\n实际: "${actualOutput}"`;
                        allPassed = false;
                    }
                } else {
                    status = '⚠️ 无输出';
                    allPassed = false;
                }

                // 显示结果
                if (outputContent) {
                    const resultDiv = document.createElement('div');
                    resultDiv.className = `debug-message ${status.includes('✅') && message === '' ? 'success' : status.includes('❌') ? 'error' : 'warning'}`;
                    resultDiv.innerHTML = `<strong>${testCase.name}:</strong> ${status}${message ? `<br>${message}` : ''}`;
                    outputContent.appendChild(resultDiv);
                    outputContent.scrollTop = outputContent.scrollHeight;
                }

                // 等待一小段时间，让用户看到结果
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                allPassed = false;
                if (outputContent) {
                    outputContent.innerHTML += `<div class="debug-message error"><strong>系统:</strong> ${testCase.name} 运行出错: ${error.message}</div>`;
                    outputContent.scrollTop = outputContent.scrollHeight;
                }
            }
        }

        // 完成运行
        if (outputContent) {
            const summary = allPassed ? '🎉 全部通过！' : '❌ 存在未通过的测试点';
            outputContent.innerHTML += `<div class="debug-message system"><strong>系统:</strong> 所有测试点运行完成！${summary}</div>`;
            outputContent.scrollTop = outputContent.scrollHeight;
        }
    }
}

// 全局函数，用于在其他地方调用
function initCPHPlugin() {
    if (typeof window.cphPlugin === 'undefined') {
        window.cphPlugin = new CPHPlugin();
    }
    
    // 绑定插件开关事件
    const pluginSwitch = document.getElementById('cph-plugin-enabled');
    if (pluginSwitch) {
        // 检查本地存储中的插件状态
        const savedState = localStorage.getItem('cph_plugin_enabled');
        if (savedState !== null) {
            // 使用本地存储的状态
            pluginSwitch.checked = savedState === 'true';
        } else {
            // 默认为关闭状态
            pluginSwitch.checked = false;
        }
        
        pluginSwitch.addEventListener('change', function() {
            // 保存插件状态到本地存储
            localStorage.setItem('cph_plugin_enabled', this.checked);
            
            if (this.checked) {
                // 插件启用，确保侧边栏按钮可见
                const cphButton = document.getElementById('cph-plugin-toggle');
                if (cphButton) {
                    cphButton.style.display = 'flex';
                }
            } else {
                // 插件禁用，隐藏侧边栏按钮并关闭面板
                const cphButton = document.getElementById('cph-plugin-toggle');
                const cphPanel = document.getElementById('cph-panel');
                if (cphButton) {
                    cphButton.style.display = 'none';
                }
                if (cphPanel) {
                    cphPanel.style.display = 'none';
                }
            }
        });
        
        // 根据开关状态初始化UI
        if (!pluginSwitch.checked) {
            const cphButton = document.getElementById('cph-plugin-toggle');
            if (cphButton) {
                cphButton.style.display = 'none';
            }
        }
    }
}

// 如果页面已加载完成，初始化插件
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCPHPlugin);
} else {
    initCPHPlugin();
}