/**
 * PH Code 调试功能模块
 * 使用 SSE (Server-Sent Events) 实现 GDB 调试器的前端控制
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

    // DOM 元素
    let elements = {};

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
        elements.debugPanel = document.getElementById('debug-panel');
        elements.debugHeader = document.getElementById('debug-header');
        elements.debugTerminalContent = document.getElementById('debug-terminal-content');
        elements.debugCommandInput = document.getElementById('debug-command-input');
        elements.debugPairingCode = document.getElementById('debug-pairing-code');
        elements.debugMinimizeBtn = document.getElementById('debug-minimize-btn');
        elements.debugCloseBtn = document.getElementById('debug-close-btn');
        elements.debugStatusModal = document.getElementById('debug-status-modal');
        elements.debugStatusMessage = document.getElementById('debug-status-message');
        elements.debugStatusCancel = document.getElementById('debug-status-cancel');
        elements.debugStatusConfirm = document.getElementById('debug-status-confirm');
        elements.debugResizer = document.getElementById('debug-resizer');

        bindEvents();
        console.log('[Debug] 调试模块已初始化');
    }

    function bindEvents() {
        if (elements.debugBtn) {
            elements.debugBtn.addEventListener('click', handleDebugBtnClick);
        }
        if (elements.debugMinimizeBtn) {
            elements.debugMinimizeBtn.addEventListener('click', toggleMinimize);
        }
        if (elements.debugCloseBtn) {
            elements.debugCloseBtn.addEventListener('click', handleDebugClose);
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
        if (elements.debugResizer) {
            bindResizerEvents();
        }
        if (elements.debugHeader) {
            elements.debugHeader.addEventListener('dblclick', toggleMinimize);
        }
    }

    function bindResizerEvents() {
        let isResizing = false;
        elements.debugResizer.addEventListener('mousedown', (e) => {
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
            if (elements.debugPanel) {
                elements.debugPanel.style.height = `${clampedHeight}px`;
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
            showDebugStatusModal('无法连接到调试服务器，请确保服务已启动', false);
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

        if (elements.debugBtn) {
            elements.debugBtn.classList.add('debug-active');
        }
        if (elements.debugPanel) {
            elements.debugPanel.style.display = 'flex';
            elements.debugPanel.classList.remove('minimized');
        }
        if (elements.debugPairingCode) {
            elements.debugPairingCode.textContent = `配对码：${pairingCode}`;
        }
        if (elements.debugTerminalContent) {
            elements.debugTerminalContent.innerHTML = '<span class="debug-output-info">正在连接调试服务器...</span>\n';
        }

        connectSSE();
        focusCommandInput();
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
        };

        debugState.eventSource.onmessage = (event) => {
            // 解码 JSON 消息
            try {
                const data = JSON.parse(event.data);
                appendTerminalOutput(data);
            } catch (e) {
                // 如果不是 JSON，直接显示
                appendTerminalOutput(event.data);
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
    let lastCommand = '';

    function handleCommandKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            let command = e.target.value.trim();
            if (command) {
                sendCommand(command);
                lastCommand = command;
                e.target.value = '';
            } else if (lastCommand) {
                // 直接回车执行上一次的命令
                sendCommand(lastCommand);
            }
        } else if (e.key === 'ArrowUp') {
            // 上箭头：显示上一条命令
            if (commandHistory.length > 0) {
                historyIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
                e.target.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            // 下箭头：显示下一条命令
            if (historyIndex > 0) {
                historyIndex--;
                e.target.value = commandHistory[historyIndex];
            } else {
                historyIndex = -1;
                e.target.value = '';
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

        // 禁止使用 ! 命令（shell 逃逸）
        if (command.startsWith('!')) {
            appendTerminalOutput('[错误] 禁止使用 shell 逃逸命令 (!)\n', 'error');
            return;
        }

        // 添加到历史记录
        if (command && (!commandHistory.length || commandHistory[commandHistory.length - 1] !== command)) {
            commandHistory.push(command);
        }
        historyIndex = -1;

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

    function focusCommandInput() {
        if (elements.debugCommandInput) {
            elements.debugCommandInput.focus();
        }
    }

    function toggleDebugPanel() {
        if (!elements.debugPanel) return;
        if (debugState.isPanelVisible) {
            elements.debugPanel.style.display = 'none';
            debugState.isPanelVisible = false;
        } else {
            elements.debugPanel.style.display = 'flex';
            debugState.isPanelVisible = true;
            focusCommandInput();
        }
    }

    function toggleMinimize() {
        if (!elements.debugPanel) return;
        debugState.isMinimized = !debugState.isMinimized;
        if (debugState.isMinimized) {
            elements.debugPanel.classList.add('minimized');
        } else {
            elements.debugPanel.classList.remove('minimized');
            debugState.isPanelVisible = true;
            focusCommandInput();
        }
    }

    async function handleDebugClose() {
        if (!debugState.isDebugging) return;
        if (confirm('确定要退出调试吗？')) {
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
        if (elements.debugPanel) {
            elements.debugPanel.style.display = 'none';
            elements.debugPanel.classList.remove('minimized');
        }
        if (elements.debugTerminalContent) {
            elements.debugTerminalContent.innerHTML = '';
        }
        if (elements.debugCommandInput) {
            elements.debugCommandInput.value = '';
        }

        debugState.isPanelVisible = false;
        debugState.isMinimized = false;
    }

    window.DebugModule = {
        init: init,
        startDebug: startDebugSession,
        stopDebug: stopDebug,
        sendCommand: sendCommand
    };

    init();
})();
