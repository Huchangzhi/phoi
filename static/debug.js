/**
 * PH Code 调试功能模块
 * 使用 SSE (Server-Sent Events) 实现 GDB 调试器的前端控制
 * 集成断点管理功能
 */

(function() {
    'use strict';

    // 调试状态
    let debugState = {
        isDebugging: false,
        pairingCode: null,
        eventSource: null,
        isMinimized: false,
        isPanelVisible: false
    };

    // 断点状态
    let breakpointState = {
        breakpoints: new Map(),  // lineNumber -> breakpoint info
        hoverCollection: null,   // 悬停装饰集合（背景）
        activeCollection: null,  // 激活断点装饰集合
        gdbBreakpointIds: new Map()  // lineNumber -> gdb breakpoint id
    };

    // 装饰器选项
    const bpOption = {
        isWholeLine: true,
        linesDecorationsClassName: 'breakpoints',
        linesDecorationsTooltip: '点击添加断点'
    };

    const activeBpOption = {
        isWholeLine: true,
        linesDecorationsClassName: 'breakpoints-active',
        linesDecorationsTooltip: '点击移除断点'
    };

    // DOM 元素
    let elements = {};

    // 变量管理状态
    let variableWatchState = {
        variables: [],  // 监视的变量列表 [{name, value, fullValue, expanded}]
        selectedVarIndex: -1,  // 当前选中的变量索引
        gdbValueMap: new Map(),  // GDB $数字 -> 变量名的映射
        pendingVariables: new Map(),  // 正在等待GDB响应的变量 {变量名: {buffer, timer, isComplete}}
        isRefreshing: false,  // 是否正在刷新
        captureTimeout: 200  // 捕获超时时间（毫秒）
    };

    // 初始化
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onDOMReady);
        } else {
            onDOMReady();
        }
    }

    function onDOMReady() {
        elements.debugBtn = document.getElementById('debug-btn');
        // 使用新的终端面板结构
        elements.terminalPanel = document.getElementById('terminal-panel');
        elements.terminalTabs = document.querySelectorAll('.terminal-tab');
        elements.debugTerminalContent = document.getElementById('terminal-debug-content');
        elements.debugCommandInput = document.getElementById('debug-command-input');
        elements.debugInputLine = document.getElementById('debug-input-line');
        elements.terminalPairingCode = document.getElementById('terminal-pairing-code');
        elements.terminalStopDebugBtn = document.getElementById('terminal-stop-debug-btn');
        elements.terminalMinimizeBtn = document.getElementById('terminal-minimize-btn');
        elements.terminalCloseBtn = document.getElementById('terminal-close-btn');
        elements.debugStatusModal = document.getElementById('debug-status-modal');
        elements.debugStatusMessage = document.getElementById('debug-status-message');
        elements.debugStatusCancel = document.getElementById('debug-status-cancel');
        elements.debugStatusConfirm = document.getElementById('debug-status-confirm');
        elements.terminalResizer = document.getElementById('terminal-resizer');
        
        // 调试 UI 控制区元素
        elements.debugRunBtn = document.getElementById('debug-run-btn');
        elements.debugContinueBtn = document.getElementById('debug-continue-btn');
        elements.debugNextBtn = document.getElementById('debug-next-btn');
        elements.debugStepBtn = document.getElementById('debug-step-btn');
        elements.debugFinishBtn = document.getElementById('debug-finish-btn');
        elements.debugRefreshVarBtn = document.getElementById('debug-refresh-var-btn');
        elements.debugAddVarBtn = document.getElementById('debug-add-var-btn');
        elements.debugRemoveVarBtn = document.getElementById('debug-remove-var-btn');
        elements.debugVariablesList = document.getElementById('debug-variables-list');

        bindEvents();
        initBreakpointIntegration();
        console.log('[Debug] 调试模块已初始化');
    }

    // 初始化断点集成
    function initBreakpointIntegration() {
        // 等待 Monaco 编辑器初始化
        setTimeout(() => {
            if (typeof monacoEditor !== 'undefined' && monacoEditor) {
                // 创建装饰集合
                // 1. 悬停装饰集合 - 覆盖所有行，用于鼠标悬停时显示淡红色背景
                const hoverDecorations = [
                    {
                        range: new monaco.Range(1, 1, 99999, 1),
                        options: bpOption
                    }
                ];
                breakpointState.hoverCollection = monacoEditor.createDecorationsCollection(hoverDecorations);
                
                // 2. 激活断点装饰集合 - 初始为空
                breakpointState.activeCollection = monacoEditor.createDecorationsCollection([]);
                
                // 注册点击事件
                registerBreakpointClick();
                registerBreakpointContextMenu();
                
                // 监听编辑器内容变化，当行数变化时清除断点
                monacoEditor.onDidChangeModelContent(() => {
                    handleEditorContentChange();
                });
                
                console.log('[Debug] 断点功能已启用');
            } else {
                // 重试
                initBreakpointIntegration();
            }
        }, 500);
    }
    
    // 处理编辑器内容变化
    function handleEditorContentChange() {
        if (!monacoEditor || !breakpointState.breakpoints.size) return;
        
        const model = monacoEditor.getModel();
        if (!model) return;
        
        const lineCount = model.getLineCount();
        
        // 检查每个断点
        const invalidLines = [];
        for (const [lineNum] of breakpointState.breakpoints) {
            // 检查行号是否超过总行数，或者该行是否为空
            if (lineNum > lineCount) {
                invalidLines.push(lineNum);
            } else {
                // 检查该行是否为空行
                const lineContent = model.getLineContent(lineNum);
                if (!lineContent || lineContent.trim() === '') {
                    invalidLines.push(lineNum);
                }
            }
        }
        
        // 清除无效断点
        if (invalidLines.length > 0) {
            console.log('[Breakpoint] 检测到内容变化，清除无效断点:', invalidLines);
            for (const lineNum of invalidLines) {
                breakpointState.breakpoints.delete(lineNum);
                breakpointState.gdbBreakpointIds.delete(lineNum);
            }
            updateActiveBreakpoints();
        }
    }

    // 注册断点点击事件
    function registerBreakpointClick() {
        if (!monacoEditor) return;

        monacoEditor.onMouseDown((e) => {
            console.log('[Breakpoint] click target:', e.event.target, 'classList:', e.event.target.classList);
            
            let lineNum = null;
            
            // 尝试从点击目标或其父元素获取行号
            const target = e.event.target;
            if (target.classList.contains('breakpoints') || target.classList.contains('breakpoints-active')) {
                lineNum = parseInt(target.nextElementSibling?.innerHTML);
            }
            
            if (!lineNum) return;
            
            console.log('[Breakpoint] clicked line:', lineNum);
            
            // 切换断点
            if (breakpointState.breakpoints.has(lineNum)) {
                removeBreakpoint(lineNum);
            } else {
                addBreakpoint(lineNum);
            }
        });
    }

    // 注册右键菜单
    function registerBreakpointContextMenu() {
        if (!monacoEditor) return;

        monacoEditor.addAction({
            id: 'toggle-breakpoint',
            label: '切换断点',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1,
            run: (ed) => {
                const position = ed.getPosition();
                if (position) toggleBreakpoint(position.lineNumber);
            }
        });

        monacoEditor.addAction({
            id: 'remove-all-breakpoints',
            label: '删除所有断点',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 2,
            run: (ed) => {
                removeAllBreakpoints();
            }
        });
    }

    // 添加断点
    function addBreakpoint(lineNumber) {
        if (!monacoEditor || breakpointState.breakpoints.has(lineNumber)) return;

        // 记录断点
        breakpointState.breakpoints.set(lineNumber, {
            lineNumber: lineNumber,
            enabled: true,
            gdbId: null
        });

        // 更新激活断点装饰集合
        updateActiveBreakpoints();

        // 如果正在调试，同步到 GDB
        if (debugState.isDebugging) {
            syncBreakpointToGDB(lineNumber, true);
        }

        console.log(`[Breakpoint] 添加断点：行 ${lineNumber}`);
    }

    // 删除断点
    function removeBreakpoint(lineNumber) {
        if (!monacoEditor || !breakpointState.breakpoints.has(lineNumber)) return;

        const bp = breakpointState.breakpoints.get(lineNumber);

        console.log(`[Breakpoint] 准备删除断点：行 ${lineNumber}, gdbId: ${bp.gdbId}, isDebugging: ${debugState.isDebugging}`);

        // 如果正在调试，从 GDB 删除
        if (debugState.isDebugging) {
            // 优先使用 bp.gdbId，如果为 null 则从 gdbBreakpointIds 映射中查找
            let gdbId = bp.gdbId;
            if (gdbId === null) {
                gdbId = breakpointState.gdbBreakpointIds.get(lineNumber);
                console.log(`[Breakpoint] gdbId 为 null，从映射中查找：${gdbId}`);
            }
            
            if (gdbId !== null && gdbId !== undefined) {
                console.log(`[Breakpoint] 发送 GDB 删除命令：delete ${gdbId}`);
                deleteGDBBreakpoint(gdbId);
            } else {
                console.log(`[Breakpoint] 无法获取 gdbId，跳过 GDB 删除`);
            }
        }

        breakpointState.breakpoints.delete(lineNumber);
        breakpointState.gdbBreakpointIds.delete(lineNumber);

        // 更新激活断点装饰集合
        updateActiveBreakpoints();

        console.log(`[Breakpoint] 删除断点：行 ${lineNumber}`);
    }

    // 更新激活断点装饰集合
    function updateActiveBreakpoints() {
        if (!monacoEditor) return;

        const decorations = [];
        for (const [lineNumber, bp] of breakpointState.breakpoints) {
            if (bp.enabled) {
                decorations.push({
                    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                    options: activeBpOption
                });
            }
        }

        breakpointState.activeCollection.set(decorations);
    }

    // 删除所有断点
    function removeAllBreakpoints() {
        breakpointState.breakpoints.clear();
        updateActiveBreakpoints();
        console.log('[Breakpoint] 已删除所有断点');
    }

    // 切换断点（用于右键菜单）
    function toggleBreakpoint(lineNumber) {
        if (!monacoEditor) return;

        if (breakpointState.breakpoints.has(lineNumber)) {
            removeBreakpoint(lineNumber);
        } else {
            addBreakpoint(lineNumber);
        }
    }

    // 同步断点到 GDB
    function syncBreakpointToGDB(lineNumber, add) {
        if (add) {
            // 设置断点：break source.cpp:lineNumber
            const cmd = `break source.cpp:${lineNumber}`;
            sendCommand(cmd);
        }
    }

    // 删除 GDB 断点
    function deleteGDBBreakpoint(gdbId) {
        const cmd = `delete ${gdbId}`;
        sendCommand(cmd);
    }

    // 设置所有断点（调试启动时调用）
    function setAllBreakpoints() {
        if (!debugState.isDebugging) return;

        // 先清空 GDB 所有断点
        sendCommand('delete');
        
        // 重置所有断点的 gdbId
        for (const [lineNumber, bp] of breakpointState.breakpoints) {
            bp.gdbId = null;
        }
        breakpointState.gdbBreakpointIds.clear();

        // 重新设置所有断点
        setTimeout(() => {
            for (const [lineNumber, bp] of breakpointState.breakpoints) {
                if (bp.enabled) {
                    syncBreakpointToGDB(lineNumber, true);
                }
            }
        }, 300);
    }

    function bindEvents() {
        if (elements.debugBtn) {
            elements.debugBtn.addEventListener('click', handleDebugBtnClick);
        }
        if (elements.terminalMinimizeBtn) {
            elements.terminalMinimizeBtn.addEventListener('click', toggleMinimize);
        }
        if (elements.terminalCloseBtn) {
            elements.terminalCloseBtn.addEventListener('click', handleDebugClose);
        }
        if (elements.debugCommandInput) {
            elements.debugCommandInput.addEventListener('keydown', handleCommandKeydown);
        }
        if (elements.debugStatusCancel) {
            elements.debugStatusCancel.addEventListener('click', hideDebugStatusModal);
        }
        if (elements.debugStatusConfirm) {
            elements.debugStatusConfirm.addEventListener('click', handleDebugConfirm);
        }
        if (elements.terminalStopDebugBtn) {
            elements.terminalStopDebugBtn.addEventListener('click', stopDebug);
        }
        if (elements.terminalResizer) {
            bindResizerEvents();
        }
        
        // 调试 UI 控制区按钮事件
        if (elements.debugRunBtn) {
            elements.debugRunBtn.addEventListener('click', () => sendGDBCommand('run'));
        }
        if (elements.debugContinueBtn) {
            elements.debugContinueBtn.addEventListener('click', () => sendGDBCommand('continue'));
        }
        if (elements.debugNextBtn) {
            elements.debugNextBtn.addEventListener('click', () => sendGDBCommand('next'));
        }
        if (elements.debugStepBtn) {
            elements.debugStepBtn.addEventListener('click', () => sendGDBCommand('step'));
        }
        if (elements.debugFinishBtn) {
            elements.debugFinishBtn.addEventListener('click', () => sendGDBCommand('finish'));
        }
        if (elements.debugRefreshVarBtn) {
            elements.debugRefreshVarBtn.addEventListener('click', refreshAllVariables);
        }
        if (elements.debugAddVarBtn) {
            elements.debugAddVarBtn.addEventListener('click', showAddVariableDialog);
        }
        if (elements.debugRemoveVarBtn) {
            elements.debugRemoveVarBtn.addEventListener('click', removeSelectedVariable);
        }
    }

    function bindResizerEvents() {
        let isResizing = false;
        elements.terminalResizer.addEventListener('mousedown', (e) => {
            if (debugState.isMinimized) return;
            isResizing = true;
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const windowHeight = window.innerHeight;
            const newHeight = windowHeight - e.clientY;
            const clampedHeight = Math.max(200, Math.min(newHeight, windowHeight - 100));
            if (elements.terminalPanel) {
                elements.terminalPanel.style.height = `${clampedHeight}px`;
            }
        });
        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.body.style.cursor = '';
        });
    }

    async function handleDebugBtnClick() {
        if (debugState.isDebugging) {
            toggleDebugPanel();
        } else {
            await checkDebugStatus();
        }
    }

    async function checkDebugStatus() {
        try {
            const response = await fetch('/debug/status');
            const data = await response.json();

            if (data.status === 'unavailable') {
                showDebugStatusModal('该功能仅在本地版可用', false);
            } else if (data.status === 'busy') {
                showDebugStatusModal('调试接口繁忙，请稍后', false);
            } else if (data.status === 'compiling') {
                showDebugStatusModal('正在编译代码，请稍候...', false);
            } else {
                const pairingCode = generatePairingCode();
                debugState.pairingCode = pairingCode;
                showDebugStatusModal(
                    `准备启动 GDB 调试器<br><br>
                    <strong style="color: #4daafc;">配对码：${pairingCode}</strong><br><br>
                    <span style="color: #f48771; font-size: 12px;">
                    安全提示：调试功能允许执行任意代码，请确保代码来源可信。<br>
                    调试器将编译并运行您的代码，请确保代码不包含危险操作。
                    </span>`,
                    true,
                    pairingCode
                );
            }
        } catch (error) {
            console.error('[Debug] 检查状态失败:', error);
            showDebugStatusModal('该功能仅在离线版存在，运行在右上角', false);
        }
    }

    function generatePairingCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    function showDebugStatusModal(message, showConfirm, pairingCode) {
        if (elements.debugStatusMessage) {
            elements.debugStatusMessage.innerHTML = message;
        }
        if (elements.debugStatusConfirm) {
            elements.debugStatusConfirm.style.display = showConfirm ? 'block' : 'none';
            if (pairingCode) {
                elements.debugStatusConfirm.dataset.pairingCode = pairingCode;
            }
        }
        if (elements.debugStatusModal) {
            elements.debugStatusModal.style.display = 'flex';
        }
    }

    function hideDebugStatusModal() {
        if (elements.debugStatusModal) {
            elements.debugStatusModal.style.display = 'none';
        }
    }

    async function handleDebugConfirm() {
        const pairingCode = elements.debugStatusConfirm?.dataset.pairingCode;
        if (!pairingCode) return;

        let code = '';
        if (window.PhoiAPI && typeof window.PhoiAPI.getCurrentFileContent === 'function') {
            code = window.PhoiAPI.getCurrentFileContent();
        } else if (window.globalText) {
            code = window.globalText;
        }

        if (!code) {
            alert('没有可调试的代码');
            return;
        }

        hideDebugStatusModal();

        // 显示等待提示
        appendTerminalOutput('[系统] 正在等待后端确认...\n', 'info');

        try {
            const response = await fetch('/debug/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    pairing_code: pairingCode,
                    confirmed: false  // 后端会弹出确认对话框
                })
            });

            const data = await response.json();

            if (data.success) {
                startDebugSession(pairingCode);
            } else {
                appendTerminalOutput(`[错误] ${data.message}\n`, 'error');
                alert('启动调试失败：' + data.message);
            }
        } catch (error) {
            console.error('[Debug] 启动调试失败:', error);
            appendTerminalOutput(`[错误] 启动调试失败：${error.message}\n`, 'error');
        }
    }

    function startDebugSession(pairingCode) {
        debugState.isDebugging = true;
        debugState.pairingCode = pairingCode;
        debugState.isPanelVisible = true;
        debugState.isMinimized = false;

        // 重置变量状态
        resetVariableState();

        if (elements.debugBtn) {
            elements.debugBtn.classList.add('debug-active');
        }
        // 显示终端面板并切换到调试标签页
        if (elements.terminalPanel) {
            elements.terminalPanel.style.display = 'flex';
            elements.terminalPanel.classList.remove('minimized');
        }
        // 切换到调试终端标签页
        if (window.switchTerminalTab) {
            window.switchTerminalTab('debug');
        }
        if (elements.terminalPairingCode) {
            elements.terminalPairingCode.textContent = `配对码：${pairingCode}`;
            elements.terminalPairingCode.style.display = 'inline';
        }
        // 显示终止调试按钮
        if (elements.terminalStopDebugBtn) {
            elements.terminalStopDebugBtn.style.display = 'inline-block';
        }
        // 清空并显示初始消息
        if (elements.debugTerminalContent) {
            elements.debugTerminalContent.innerHTML = '<span class="debug-output-info">正在连接调试服务器...</span>\n';
        }
        // 显示调试输入行
        if (elements.debugInputLine) {
            elements.debugInputLine.style.display = 'flex';
        }

        connectSSE();
        focusCommandInput();
        
        // 设置所有断点
        setTimeout(() => {
            setAllBreakpoints();
        }, 500);
    }

    function connectSSE() {
        if (debugState.eventSource) {
            debugState.eventSource.close();
        }

        // 使用 SSE 连接
        debugState.eventSource = new EventSource('/debug/events');

        debugState.eventSource.onopen = () => {
            console.log('[Debug] 已连接到调试服务器');
            appendTerminalOutput('[系统] 已连接到调试服务器\n', 'info');
            // 自动设置 max-value-size 为无限制，避免大数据结构显示被截断
            sendSingleCommand('set max-value-size unlimited');
        };

        debugState.eventSource.onmessage = (event) => {
            // 解码 JSON 消息
            try {
                const data = JSON.parse(event.data);
                appendTerminalOutput(data);
                
                // 如果是 JSON 对象，提取 text 字段解析
                if (typeof data === 'string') {
                    parseGDBOutput(data);
                } else if (data.text) {
                    parseGDBOutput(data.text);
                }
            } catch (e) {
                // 如果不是 JSON，直接显示
                const text = event.data;
                appendTerminalOutput(text);

                // 解析 GDB 输出，检测断点命中和执行位置
                parseGDBOutput(text);
            }
        };

        debugState.eventSource.onerror = (error) => {
            console.error('[Debug] SSE 连接错误:', error);
            if (debugState.eventSource.readyState === EventSource.CLOSED) {
                appendTerminalOutput('\n[系统] 与调试服务器断开连接\n', 'error');
                if (debugState.isDebugging) {
                    checkDebugStatusAfterDisconnect();
                }
            }
        };
    }

    // 解析 GDB 输出，检测断点和执行位置
    function parseGDBOutput(text) {
        if (!monacoEditor) return;

        console.log('[GDB Output RAW]', JSON.stringify(text));

        // 跳过空行
        if (!text.trim()) return;

        // 跳过纯命令回显（但保留包含行号的行如 "(gdb) 6\t}" 和变量输出如 "(gdb) $1 = ..."）
        const trimmedText = text.trim();
        if (trimmedText.startsWith('(gdb)')) {
            // 检查是否是行号显示：(gdb) 6\t}
            const hasLineNumber = trimmedText.match(/\)\s+\d{1,5}(\t|\s{2,})/);
            // 检查是否是变量值输出：(gdb) $1 = ...
            const hasVarOutput = trimmedText.match(/\)\s*\$\d+\s*=/);
            // 检查是否是错误信息：(gdb) No symbol "xxx" in current context
            const hasError = trimmedText.match(/\)\s*No symbol/i);
            if (!hasLineNumber && !hasVarOutput && !hasError) {
                return;
            }
        }

        console.log('[GDB Output]', trimmedText);

        let lineNumber = null;

        // 格式 1: 断点命中后显示位置（单行）
        // Thread 1 hit Breakpoint 1, add (a=1, b=2) at C:\...\source.cpp:5
        const hitBreakMatch = text.match(/hit\s+Breakpoint\s+\d+.*?\s+at\s+([A-Z]:\\.*?\.cpp):(\d+)/i);
        if (hitBreakMatch) {
            lineNumber = parseInt(hitBreakMatch[2]);
            console.log(`[Execution] 断点命中 (单行): 行 ${lineNumber}`);
        }

        // 格式 2: 单步执行后显示位置（单行）
        // main () at C:\Users\...\source.cpp:10
        const stepMatch = text.match(/^\w+\s*\(.*\)\s+at\s+([A-Z]:\\.*?\.cpp):(\d+)/i);
        if (stepMatch && !lineNumber) {
            lineNumber = parseInt(stepMatch[2]);
            console.log(`[Execution] 单步执行 (单行): 行 ${lineNumber}`);
        }

        // 格式 3: 单独行号（前面有空格或 (gdb)，后面有制表符或至少 2 个空格）
        // 5		return a+b;
        // (gdb) 6	}
        const lineNumMatch1 = text.match(/^\s*(\d{1,5})(\t|\s{2,})/);
        const lineNumMatch2 = text.match(/\)\s+(\d{1,5})(\t|\s{2,})/);
        console.log(`[Execution] 行号正则 1: ${lineNumMatch1 ? lineNumMatch1[0] : 'null'}, 正则 2: ${lineNumMatch2 ? lineNumMatch2[0] : 'null'}`);

        if (lineNumMatch1 && !lineNumber) {
            lineNumber = parseInt(lineNumMatch1[1]);
            console.log(`[Execution] 行号显示 (正则 1): 行 ${lineNumber}`);
        }
        if (lineNumMatch2 && !lineNumber) {
            lineNumber = parseInt(lineNumMatch2[1]);
            console.log(`[Execution] 行号显示 (正则 2): 行 ${lineNumber}`);
        }

        // 格式 4: frame 格式 #0 ... at ...
        const frameMatch = text.match(/^#0\s+.*?\s+at\s+([A-Z]:\\.*?\.cpp):(\d+)/i);
        if (frameMatch && !lineNumber) {
            lineNumber = parseInt(frameMatch[2]);
            console.log(`[Execution] Frame 位置：行 ${lineNumber}`);
        }

        console.log(`[Execution] 最终 lineNumber=${lineNumber}`);

        if (lineNumber && lineNumber > 0) {
            highlightExecutionLine(lineNumber);
            
            // 程序停止时自动刷新变量
            console.log(`[Variable] 检查自动刷新: variables.length=${variableWatchState.variables.length}, isRefreshing=${variableWatchState.isRefreshing}, isDebugging=${debugState.isDebugging}`);
            if (variableWatchState.variables.length > 0 && !variableWatchState.isRefreshing) {
                console.log('[Variable] 程序停止，自动刷新变量');
                // 不使用 await，直接调用
                refreshAllVariables().catch(err => console.error('[Variable] 自动刷新失败:', err));
            }
        }

        // 检测 GDB 设置的断点信息
        // 格式：Breakpoint 1 at 0x1400013a9: file C:\...\source.cpp, line 8.
        // 或：(gdb) Breakpoint 1 at 0x1400013a9: file C:\...\source.cpp, line 8.
        const breakpointSetMatch = text.match(/Breakpoint\s+(\d+)\s+at[^:]*:\s*file\s+([A-Z]:\\.*?\.cpp),\s*line\s+(\d+)/i);
        if (breakpointSetMatch) {
            const gdbId = parseInt(breakpointSetMatch[1]);
            const filePath = breakpointSetMatch[2];
            const lineNum = parseInt(breakpointSetMatch[3]);

            console.log(`[Breakpoint] 解析到断点设置：ID=${gdbId}, 路径=${filePath}, 行=${lineNum}`);

            if (breakpointState.breakpoints.has(lineNum)) {
                const bp = breakpointState.breakpoints.get(lineNum);
                bp.gdbId = gdbId;
                breakpointState.gdbBreakpointIds.set(lineNum, gdbId);
                console.log(`[Breakpoint] GDB 确认断点：行 ${lineNum}, GDB ID: ${gdbId}`);
            } else {
                // 尝试从文件名匹配断点（可能是路径不同）
                console.log(`[Breakpoint] 行 ${lineNum} 不在断点列表中，尝试匹配文件...`);
                // 遍历所有断点，找到第一个没有 gdbId 的断点
                for (const [line, bp] of breakpointState.breakpoints) {
                    if (bp.gdbId === null) {
                        bp.gdbId = gdbId;
                        breakpointState.gdbBreakpointIds.set(line, gdbId);
                        console.log(`[Breakpoint] 将 GDB ID ${gdbId} 关联到行 ${line}`);
                        break;
                    }
                }
            }
        }

        // 检测 GDB 删除断点的响应
        // 格式：Deleted breakpoint 1
        const breakpointDeleteMatch = text.match(/Deleted\s+breakpoint\s+(\d+)/i);
        if (breakpointDeleteMatch) {
            const gdbId = parseInt(breakpointDeleteMatch[1]);
            console.log(`[Breakpoint] GDB 确认删除断点 ID=${gdbId}`);
            // 从映射中移除
            for (const [line, id] of breakpointState.gdbBreakpointIds) {
                if (id === gdbId) {
                    breakpointState.gdbBreakpointIds.delete(line);
                    console.log(`[Breakpoint] 从映射中移除行 ${line}`);
                    break;
                }
            }
        }

        // 检测变量值输出（print 命令结果）
        // 新策略：使用 GDB 的 $数字标识符来精确匹配变量
        
        // 检测变量不存在或错误的情况（优先检测）
        // 这些输出不包含 $数字 = 格式，但对应某个变量
        const errorMatch = text.match(/No symbol\s+"([^"]+)"\s+in current context/i);
        if (errorMatch) {
            console.log('[Variable] 检测到错误匹配，原始文本:', text);
            const errorVarName = errorMatch[1];
            console.log(`[Variable] 检测到变量不存在：${errorVarName}`);
            
            // 查找对应的变量（可能是变量名本身，也可能是第一个没有gdbId的变量）
            let varName = null;
            
            // 首先尝试精确匹配变量名
            for (const [name, pending] of variableWatchState.pendingVariables) {
                if (!pending.isComplete && !pending.gdbId && name === errorVarName) {
                    varName = name;
                    break;
                }
            }
            
            // 如果没有精确匹配，使用第一个没有gdbId的变量
            if (!varName) {
                for (const [name, pending] of variableWatchState.pendingVariables) {
                    if (!pending.isComplete && !pending.gdbId) {
                        varName = name;
                        console.log(`[Variable] 使用第一个未映射的变量：${varName}`);
                        break;
                    }
                }
            }
            
            if (varName) {
                // 标记为错误并完成
                const pending = variableWatchState.pendingVariables.get(varName);
                pending.buffer = text + '\n';
                console.log(`[Variable] 变量 ${varName} 标记为错误`);
                
                // 立即完成捕获
                completeVariableCapture(varName);
            }
            
            return;
        }

        // 检查是否是新的 print 命令开始（$数字 = 格式）
        const varValueMatch = text.match(/\$(\d+)\s*=\s*(.*)/);

        if (varValueMatch) {
            console.log('[Variable] 检测到 $数字= 匹配，原始文本:', text);
            const gdbId = varValueMatch[1];
            const initialValue = varValueMatch[2].trim();
            
            console.log(`[Variable] 检测到 GDB 输出：$${gdbId} = ${initialValue}`);
            
            // 查找对应的变量名（从pendingVariables中查找）
            let varName = null;
            for (const [name, pending] of variableWatchState.pendingVariables) {
                if (!pending.isComplete && !pending.gdbId) {
                    varName = name;
                    pending.gdbId = gdbId;
                    console.log(`[Variable] 将 $${gdbId} 映射到变量 ${varName}`);
                    break;
                }
            }
            
            if (varName) {
                // 建立映射
                variableWatchState.gdbValueMap.set(gdbId, varName);
                
                // 初始化捕获该变量的输出
                const pending = variableWatchState.pendingVariables.get(varName);
                pending.buffer = initialValue + '\n';
                console.log(`[Variable] 开始捕获变量 ${varName} 的输出`);
                
                // 设置超时定时器
                if (pending.timer) {
                    clearTimeout(pending.timer);
                }
                pending.timer = setTimeout(() => {
                    console.log(`[Variable] 变量 ${varName} 捕获超时，完成输出`);
                    completeVariableCapture(varName);
                }, variableWatchState.captureTimeout);
            } else {
                console.log(`[Variable] 警告：$${gdbId} 没有找到对应的变量名`);
            }
            
            return;
        }

        // 检查是否有正在捕获的变量，如果有则累积所有后续输出
        // 包括错误信息、空行等，所有内容都作为变量的值
        if (variableWatchState.pendingVariables.size > 0) {
            for (const [varName, pending] of variableWatchState.pendingVariables) {
                if (!pending.isComplete && pending.gdbId) {
                    // 累积所有后续行（包括错误信息）
                    pending.buffer += text + '\n';
                    console.log(`[Variable] 累积变量 ${varName} 的输出：${text.trim()}`);
                    
                    // 重置定时器
                    if (pending.timer) {
                        clearTimeout(pending.timer);
                    }
                    
                    // 设置超时定时器
                    pending.timer = setTimeout(() => {
                        console.log(`[Variable] 变量 ${varName} 捕获超时，完成输出`);
                        completeVariableCapture(varName);
                    }, variableWatchState.captureTimeout);
                    
                    break; // 只处理第一个正在捕获的变量
                }
            }
        }

        // 检测程序结束
        if (text.includes('exited normally') || text.includes('The program is not being run')) {
            console.log('[Execution] 程序已结束，清除高亮');
            clearExecutionLine();
        }
    }

    // 高亮当前执行行
    let executionLineDecoration = null;
    function highlightExecutionLine(lineNumber) {
        if (!monacoEditor) return;

        // 清除之前的执行行高亮
        if (executionLineDecoration) {
            monacoEditor.deltaDecorations(executionLineDecoration, []);
            executionLineDecoration = null;
        }

        // 添加新的执行行高亮（黄色背景）
        executionLineDecoration = monacoEditor.deltaDecorations([], [
            {
                range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                options: {
                    isWholeLine: true,
                    className: 'debug-execution-line',
                    inlineClassName: 'debug-execution-line-text'
                }
            }
        ]);

        // 滚动到执行行
        monacoEditor.revealLineInCenter(lineNumber);
    }

    // 清除执行行高亮
    function clearExecutionLine() {
        if (!monacoEditor) return;
        if (executionLineDecoration) {
            monacoEditor.deltaDecorations(executionLineDecoration, []);
            executionLineDecoration = null;
        }
    }

    async function checkDebugStatusAfterDisconnect() {
        try {
            const response = await fetch('/debug/status');
            const data = await response.json();
            if (data.status === 'idle') {
                endDebugSession();
            }
        } catch (error) {
            console.error('[Debug] 检查状态失败:', error);
        }
    }

    function appendTerminalOutput(text, type = '') {
        if (!elements.debugTerminalContent) return;

        const span = document.createElement('span');
        span.textContent = text;
        if (type) {
            span.className = `debug-output-${type}`;
        }
        elements.debugTerminalContent.appendChild(span);
        elements.debugTerminalContent.scrollTop = elements.debugTerminalContent.scrollHeight;
    }

    // 命令历史
    let commandHistory = [];
    let historyIndex = -1;
    let currentInput = ''; // 保存当前正在输入的内容

    function handleCommandKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            let command = e.target.value.trim();
            if (command) {
                // 添加到历史记录
                if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== command) {
                    commandHistory.push(command);
                }
                historyIndex = -1;
                currentInput = '';
                sendCommand(command);
                e.target.value = '';
            } else if (commandHistory.length > 0) {
                // 直接回车执行上一次的命令
                sendCommand(commandHistory[commandHistory.length - 1]);
            }
        } else if (e.key === 'ArrowUp') {
            // 上箭头：显示上一条命令（从最新的开始）
            e.preventDefault();
            if (commandHistory.length === 0) return;
            
            if (historyIndex === -1) {
                // 第一次按上箭头，保存当前输入，并指向最新的命令
                currentInput = e.target.value;
                historyIndex = commandHistory.length - 1;
            } else if (historyIndex > 0) {
                // 继续向上翻
                historyIndex--;
            }
            // 显示当前索引的命令
            e.target.value = commandHistory[historyIndex];
        } else if (e.key === 'ArrowDown') {
            // 下箭头：显示下一条命令（向更新的方向）
            e.preventDefault();
            if (commandHistory.length === 0) return;
            
            if (historyIndex === -1) {
                // 已经在最底部，无需操作
                return;
            }
            
            if (historyIndex < commandHistory.length - 1) {
                // 向下翻一条
                historyIndex++;
                e.target.value = commandHistory[historyIndex];
            } else {
                // 已经到最后一条，恢复当前输入
                historyIndex = -1;
                e.target.value = currentInput;
            }
        }
    }

    // 处理粘贴事件 - 支持多行文本
    if (elements.debugCommandInput) {
        elements.debugCommandInput.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteText = (e.clipboardData || window.clipboardData).getData('text');
            
            // 如果包含多行，逐行发送
            const lines = pasteText.split(/\r?\n/).filter(line => line.trim());
            if (lines.length > 1) {
                // 多行文本，逐行发送
                lines.forEach((line, index) => {
                    setTimeout(() => {
                        sendCommand(line.trim());
                    }, index * 50); // 每行间隔 50ms
                });
            } else {
                // 单行文本，直接插入
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const value = e.target.value;
                e.target.value = value.substring(0, start) + pasteText + value.substring(end);
                e.target.selectionStart = e.target.selectionEnd = start + pasteText.length;
            }
        });
    }

    async function sendCommand(command) {
        if (!debugState.isDebugging) {
            appendTerminalOutput('[错误] 调试未运行\n', 'error');
            return;
        }

        // 检查是否为多行命令（粘贴的多行）
        const lines = command.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length > 1) {
            // 多行命令，逐行发送
            lines.forEach((line, index) => {
                setTimeout(() => {
                    sendSingleCommand(line.trim());
                }, index * 50);
            });
        } else {
            sendSingleCommand(command);
        }
    }

    async function sendSingleCommand(command) {
        if (!debugState.isDebugging) {
            appendTerminalOutput('[错误] 调试未运行\n', 'error');
            return;
        }

        // 如果是 print 命令，记录变量名
        const printMatch = command.match(/^print\s+(.+)$/);
        if (printMatch) {
            const varName = printMatch[1].trim();
            console.log(`[Variable] 发送 print 命令：${varName}`);
            
            // 生成唯一的请求ID
            const requestId = Date.now() + Math.random();
            
            // 将变量名与请求ID关联
            variableWatchState.pendingVariables.set(varName, {
                requestId: requestId,
                buffer: '',
                timer: null,
                isComplete: false
            });
        }

        appendTerminalOutput(`(gdb) ${command}\n`);

        try {
            const response = await fetch('/debug/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: command,
                    pairing_code: debugState.pairingCode
                })
            });

            const data = await response.json();
            if (!data.success) {
                appendTerminalOutput(`[错误] ${data.message}\n`, 'error');
            }
        } catch (error) {
            appendTerminalOutput(`[错误] 发送命令失败：${error.message}\n`, 'error');
        }
    }

    // 完成变量捕获（正常情况）
    function completeVariableCapture(varName) {
        const pending = variableWatchState.pendingVariables.get(varName);
        if (!pending || pending.isComplete) return;

        // 清除定时器
        if (pending.timer) {
            clearTimeout(pending.timer);
        }

        let fullValue = pending.buffer.trim();
        console.log(`[Variable] 变量 ${varName} 捕获完成，完整值长度：${fullValue.length}`);

        const displayValue = fullValue.length > 50 ? fullValue.substring(0, 50) + '...' : fullValue;

        const variable = variableWatchState.variables.find(v => v.name === varName);
        if (variable) {
            variable.value = displayValue;
            variable.fullValue = fullValue;
            variable.expanded = false;
            refreshVariablesDisplay();
            console.log(`[Variable] 已更新变量 ${varName}`);
        }

        // 清理映射
        if (pending.gdbId) {
            variableWatchState.gdbValueMap.delete(pending.gdbId);
        }

        // 标记为完成并移除
        pending.isComplete = true;
        variableWatchState.pendingVariables.delete(varName);
    }

    function focusCommandInput() {
        if (elements.debugCommandInput) {
            elements.debugCommandInput.focus();
        }
    }

    function toggleDebugPanel() {
        if (!elements.terminalPanel) return;
        if (debugState.isPanelVisible) {
            elements.terminalPanel.style.display = 'none';
            debugState.isPanelVisible = false;
        } else {
            elements.terminalPanel.style.display = 'flex';
            debugState.isPanelVisible = true;
            if (!debugState.isDebugging) {
                // 调试未启动，显示提示
                if (window.switchTerminalTab) {
                    window.switchTerminalTab('debug');
                }
                if (elements.debugTerminalContent) {
                    elements.debugTerminalContent.innerHTML = '<span class="debug-output-warning">调试未启动，请重新启动调试</span>\n';
                }
            }
            focusCommandInput();
        }
    }

    function toggleMinimize() {
        if (!elements.terminalPanel) return;
        debugState.isMinimized = !debugState.isMinimized;
        if (debugState.isMinimized) {
            elements.terminalPanel.classList.add('minimized');
        } else {
            elements.terminalPanel.classList.remove('minimized');
            debugState.isPanelVisible = true;
            focusCommandInput();
        }
    }

    async function handleDebugClose() {
        if (!debugState.isDebugging) return;
        if (confirm('确定要退出调试吗，若不将保留调试进程？')) {
            await stopDebug();
        }
    }

    async function stopDebug() {
        try {
            await fetch('/debug/stop', { method: 'POST' });
        } catch (error) {
            console.error('[Debug] 停止调试失败:', error);
        }
        endDebugSession();
    }

    function endDebugSession() {
        debugState.isDebugging = false;
        debugState.pairingCode = null;

        if (debugState.eventSource) {
            debugState.eventSource.close();
            debugState.eventSource = null;
        }

        if (elements.debugBtn) {
            elements.debugBtn.classList.remove('debug-active');
        }
        if (elements.terminalPairingCode) {
            elements.terminalPairingCode.style.display = 'none';
        }
        // 隐藏终止调试按钮
        if (elements.terminalStopDebugBtn) {
            elements.terminalStopDebugBtn.style.display = 'none';
        }
        // 隐藏调试输入行
        if (elements.debugInputLine) {
            elements.debugInputLine.style.display = 'none';
        }
        if (elements.debugTerminalContent) {
            elements.debugTerminalContent.innerHTML = '';
        }
        if (elements.debugCommandInput) {
            elements.debugCommandInput.value = '';
        }

        // 清除执行行高亮
        clearExecutionLine();

        // 清空变量列表
        resetVariableState();

        debugState.isPanelVisible = false;
        debugState.isMinimized = false;
    }

    // ========== 调试 UI 控制区功能 ==========

    // 发送 GDB 命令（封装版）
    async function sendGDBCommand(command) {
        if (!debugState.isDebugging) {
            appendTerminalOutput('[错误] 调试未运行\n', 'error');
            return;
        }
        await sendSingleCommand(command);
    }

    // 显示添加变量对话框
    function showAddVariableDialog() {
        if (!debugState.isDebugging) {
            alert('请先启动调试会话');
            return;
        }

        const varName = prompt('请输入要监视的变量名：');
        if (varName && varName.trim()) {
            addVariable(varName.trim());
        }
    }

    // 添加变量
    async function addVariable(varName) {
        // 检查是否已存在
        if (variableWatchState.variables.some(v => v.name === varName)) {
            alert('该变量已在监视列表中');
            return;
        }

        // 添加到列表
        variableWatchState.variables.push({
            name: varName,
            value: 'Loading...',
            fullValue: 'Loading...',
            expanded: false
        });

        // 刷新显示
        refreshVariablesDisplay();

        // 获取变量值
        await refreshVariableValue(varName);
    }

    // 刷新变量值
    async function refreshVariableValue(varName) {
        if (!debugState.isDebugging) return;

        console.log(`[Variable] 准备获取变量值：${varName}`);

        try {
            // 使用 GDB 的 print 命令获取变量值
            await sendSingleCommand(`print ${varName}`);
        } catch (error) {
            console.error(`[Variable] 获取变量值失败:`, error);
            // 如果发送失败，标记为错误
            const variable = variableWatchState.variables.find(v => v.name === varName);
            if (variable) {
                variable.value = '<错误>';
                variable.fullValue = '发送命令失败';
                refreshVariablesDisplay();
            }
        }
    }

    // 刷新所有变量值（并发刷新）
    async function refreshAllVariables() {
        if (!debugState.isDebugging) {
            console.log('[Variable] 调试未运行，无法刷新');
            return;
        }
        
        if (variableWatchState.isRefreshing) {
            console.log('[Variable] 正在刷新中，请等待');
            return;
        }

        if (variableWatchState.variables.length === 0) {
            console.log('[Variable] 没有变量需要刷新');
            return;
        }

        variableWatchState.isRefreshing = true;
        console.log('[Variable] 开始刷新所有变量');

        // 并发发送所有 print 命令（新的映射机制可以正确处理）
        const refreshPromises = variableWatchState.variables.map(async (variable) => {
            variable.value = 'Loading...';
            refreshVariablesDisplay();
            await refreshVariableValue(variable.name);
        });

        await Promise.all(refreshPromises);

        variableWatchState.isRefreshing = false;
        console.log('[Variable] 刷新完成');
    }

    function refreshVariablesDisplay() {
        if (!elements.debugVariablesList) return;

        if (variableWatchState.variables.length === 0) {
            elements.debugVariablesList.innerHTML = '<div style="color: #666; font-size: 11px; padding: 5px;">暂无变量</div>';
            return;
        }

        let html = '';
        variableWatchState.variables.forEach((variable, index) => {
            const isSelected = index === variableWatchState.selectedVarIndex;
            const isExpanded = variable.expanded;
            html += `
                <div class="debug-variable-item ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}"
                     data-index="${index}"
                     data-name="${variable.name}"
                     title="点击展开/收起">
                    <span class="debug-var-name">${variable.name}</span>
                    <span class="debug-var-value">${isExpanded ? (variable.fullValue || variable.value) : variable.value}</span>
                </div>
            `;
        });

        elements.debugVariablesList.innerHTML = html;

        // 绑定点击事件 - 单击展开/收起
        elements.debugVariablesList.querySelectorAll('.debug-variable-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(item.dataset.index);
                const variable = variableWatchState.variables[index];
                variable.expanded = !variable.expanded;
                variableWatchState.selectedVarIndex = index;
                refreshVariablesDisplay();
            });
        });
    }

    // 移除选中的变量
    function removeSelectedVariable() {
        if (variableWatchState.selectedVarIndex === -1) {
            alert('请先选择要移除的变量');
            return;
        }

        variableWatchState.variables.splice(variableWatchState.selectedVarIndex, 1);
        if (variableWatchState.selectedVarIndex >= variableWatchState.variables.length) {
            variableWatchState.selectedVarIndex = variableWatchState.variables.length - 1;
        }
        refreshVariablesDisplay();
    }

    // 重置变量状态
    function resetVariableState() {
        // 清除所有定时器
        for (const [varName, pending] of variableWatchState.pendingVariables) {
            if (pending.timer) {
                clearTimeout(pending.timer);
            }
        }
        
        variableWatchState.variables = [];
        variableWatchState.selectedVarIndex = -1;
        variableWatchState.gdbValueMap.clear();
        variableWatchState.pendingVariables.clear();
        variableWatchState.isRefreshing = false;
        refreshVariablesDisplay();
    }

    // 暴露 debugState 到全局作用域，供 switchTerminalTab 使用
    window.debugState = debugState;

    // 暴露变量刷新函数到全局作用域，供 GDB 输出解析调用
    window.refreshVariablesDisplay = refreshVariablesDisplay;
    window.refreshAllVariables = refreshAllVariables;
    window.resetVariableState = resetVariableState;

    window.DebugModule = {
        init: init,
        startDebug: startDebugSession,
        stopDebug: stopDebug,
        sendCommand: sendCommand
    };

    init();
})();