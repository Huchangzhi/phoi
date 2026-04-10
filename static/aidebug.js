/**
 * AI 自动调试插件
 * 功能：通过 AI 帮助用户找到并修复代码中的问题
 */

(function() {
    'use strict';

    const AI_DEBUG_STORAGE_KEY = 'phoi_aidebug_config';

    class AIDebugPlugin {
        constructor() {
            this.config = this.loadConfig();
            this.state = {
                isRunning: false,
                virtualFileContent: '',
                originalContent: '',
                messages: [],
                currentFile: '',
                ended: false
            };
            this.monacoEditor = null;
            this.init();
        }

        loadConfig() {
            try {
                const saved = localStorage.getItem(AI_DEBUG_STORAGE_KEY);
                if (saved) {
                    return JSON.parse(saved);
                }
            } catch (e) {
                console.error('AI Debug: 加载配置失败', e);
            }
            return {
                baseUrl: 'https://api.openai.com/v1',
                apiKey: '',
                model: 'gpt-4'
            };
        }

        saveConfig() {
            try {
                localStorage.setItem(AI_DEBUG_STORAGE_KEY, JSON.stringify(this.config));
            } catch (e) {
                console.error('AI Debug: 保存配置失败', e);
            }
        }

        init() {
            const openBtn = document.getElementById('aidebug-open-btn');
            if (openBtn) {
                openBtn.addEventListener('click', () => this.showDebugPanel());
            }
        }

        showDebugPanel() {
            this.createDebugPanel();
            this.initMonacoEditor();
            this.loadCurrentCode();
        }

        createDebugPanel() {
            if (document.getElementById('aidebug-overlay')) return;

            const overlay = document.createElement('div');
            overlay.id = 'aidebug-overlay';
            overlay.innerHTML = `
                <div id="aidebug-container">
                    <div class="aidebug-header">
                        <span>🤖 AI 自动调试</span>
                        <button id="aidebug-close-btn" class="aidebug-close-btn">×</button>
                    </div>
                    <div class="aidebug-body">
                        <div class="aidebug-left-panel">
                            <div class="aidebug-panel-header">
                                <span>代码编辑器</span>
                                <span class="aidebug-code-status" id="aidebug-code-status">原始代码</span>
                            </div>
                            <div id="aidebug-editor" class="aidebug-editor"></div>
                            <div class="aidebug-editor-actions">
                                <button id="aidebug-apply-btn" class="aidebug-btn aidebug-btn-primary" disabled>✅ 应用修改</button>
                                <button id="aidebug-cancel-btn" class="aidebug-btn" disabled>❌ 取消修改</button>
                            </div>
                        </div>
                        <div class="aidebug-right-panel">
                            <div class="aidebug-panel-header">
                                <span>AI 对话</span>
                                <button id="aidebug-config-btn" class="aidebug-icon-btn">⚙️</button>
                            </div>
                            <div id="aidebug-config-panel" class="aidebug-config-panel" style="display: none;">
                                <div class="aidebug-config-form">
                                    <div class="aidebug-form-group">
                                        <label>Base URL:</label>
                                        <input type="text" id="aidebug-baseurl" value="${this.config.baseUrl}">
                                    </div>
                                    <div class="aidebug-form-group">
                                        <label>API Key:</label>
                                        <input type="password" id="aidebug-apikey" value="${this.config.apiKey}">
                                    </div>
                                    <div class="aidebug-form-group">
                                        <label>Model:</label>
                                        <input type="text" id="aidebug-model" value="${this.config.model}">
                                    </div>
                                    <button id="aidebug-save-config" class="aidebug-btn aidebug-btn-small">保存配置</button>
                                </div>
                            </div>
                            <div id="aidebug-problem-section" class="aidebug-problem-section">
                                <textarea id="aidebug-problem" placeholder="请输入题目描述..."></textarea>
                                <button id="aidebug-start-btn" class="aidebug-btn aidebug-btn-primary aidebug-btn-full">开始调试</button>
                            </div>
                            <div id="aidebug-chat-section" class="aidebug-chat-section" style="display: none;">
                                <div id="aidebug-messages" class="aidebug-messages"></div>
                                <div class="aidebug-input-area">
                                    <input type="text" id="aidebug-user-input" placeholder="继续询问 AI...">
                                    <button id="aidebug-send-btn" class="aidebug-btn">发送</button>
                                </div>
                                <div class="aidebug-actions">
                                    <button id="aidebug-end-btn" class="aidebug-btn aidebug-btn-small">结束调试</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            this.bindEvents();
        }

        bindEvents() {
            const closeBtn = document.getElementById('aidebug-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeDebugPanel());
            }

            const configBtn = document.getElementById('aidebug-config-btn');
            if (configBtn) {
                configBtn.addEventListener('click', () => this.toggleConfigPanel());
            }

            const saveConfigBtn = document.getElementById('aidebug-save-config');
            if (saveConfigBtn) {
                saveConfigBtn.addEventListener('click', () => this.saveConfigSettings());
            }

            const startBtn = document.getElementById('aidebug-start-btn');
            if (startBtn) {
                startBtn.addEventListener('click', () => this.startDebugging());
            }

            const sendBtn = document.getElementById('aidebug-send-btn');
            if (sendBtn) {
                sendBtn.addEventListener('click', () => this.sendUserMessage());
            }

            const userInput = document.getElementById('aidebug-user-input');
            if (userInput) {
                userInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.sendUserMessage();
                });
            }

            const endBtn = document.getElementById('aidebug-end-btn');
            if (endBtn) {
                endBtn.addEventListener('click', () => this.endDebugging());
            }

            const applyBtn = document.getElementById('aidebug-apply-btn');
            if (applyBtn) {
                applyBtn.addEventListener('click', () => this.applyChanges());
            }

            const cancelBtn = document.getElementById('aidebug-cancel-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.cancelChanges());
            }
        }

        initMonacoEditor() {
            if (!window.monaco) {
                console.error('Monaco Editor not loaded');
                return;
            }

            const editorContainer = document.getElementById('aidebug-editor');
            if (!editorContainer) return;

            this.monacoEditor = window.monaco.editor.create(editorContainer, {
                value: this.state.virtualFileContent || '',
                language: 'cpp',
                theme: (localStorage.getItem('phoi_color_theme') === 'light') ? 'vs' : 'vs-dark',
                automaticLayout: true,
                readOnly: false,
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false
            });
        }

        async loadCurrentCode() {
            try {
                if (window.PhoiAPI) {
                    this.state.currentFile = window.PhoiAPI.getCurrentFileName();
                    this.state.originalContent = await window.PhoiAPI.getCurrentFileContent();
                } else if (window.monacoEditor) {
                    this.state.originalContent = window.monacoEditor.getValue();
                }
                this.state.virtualFileContent = this.state.originalContent;

                if (this.monacoEditor) {
                    this.monacoEditor.setValue(this.state.virtualFileContent);
                }
            } catch (e) {
                console.error('AI Debug: 加载代码失败', e);
                this.state.originalContent = '';
                this.state.virtualFileContent = '';
            }
        }

        toggleConfigPanel() {
            const configPanel = document.getElementById('aidebug-config-panel');
            if (configPanel) {
                configPanel.style.display = configPanel.style.display === 'none' ? 'block' : 'none';
            }
        }

        saveConfigSettings() {
            const baseUrl = document.getElementById('aidebug-baseurl').value.trim();
            const apiKey = document.getElementById('aidebug-apikey').value.trim();
            const model = document.getElementById('aidebug-model').value.trim();

            if (!baseUrl || !apiKey || !model) {
                await PhoiDialog.alert('请填写完整的 API 配置');
                return;
            }

            this.config = { baseUrl, apiKey, model };
            this.saveConfig();
            await PhoiDialog.alert('配置已保存');
        }

        async startDebugging() {
            const problem = document.getElementById('aidebug-problem').value.trim();
            if (!problem) {
                await PhoiDialog.alert('请输入题目描述');
                return;
            }

            if (!this.config.apiKey) {
                await PhoiDialog.alert('请先配置 API Key');
                return;
            }

            await this.loadCurrentCode();

            this.state.isRunning = true;
            this.state.ended = false;
            this.state.messages = [];

            const systemPrompt = `你是一个专业的代码调试助手。你的任务是帮助用户找到并修复代码中的 bug，但不能重构代码，只能进行最小的修改来修复问题。

重要规则：
1. 你只能修改代码中确实存在 bug 的部分，不能进行代码重构
2. 你必须使用工具来查看代码、运行测试、执行修改
3. 你必须按照指定格式输出工具调用，不要输出其他内容
4. 如果需要修改代码，使用 edit 工具
5. 每次只使用一个工具，等待结果后再决定下一步

**你必须严格按照以下 JSON 格式输出工具调用：**

查看当前代码：{"name": "read", "parameters": {}}
运行代码测试：{"name": "run", "parameters": {"input": "测试输入"}}
修改代码（替换第一个匹配）：{"name": "edit", "parameters": {"oldStr": "要替换的原始代码", "newStr": "替换后的代码", "index": 1}}
修改代码（替换第 N 个匹配）：{"name": "edit", "parameters": {"oldStr": "要替换的原始代码", "newStr": "替换后的代码", "index": N}}
结束调试：{"name": "end", "parameters": {}}

注意：
- edit 中的 oldStr 必须是代码中真实存在的字符串
- 如果有多个相同的字符串，使用 index 指定是第几个
- 输出必须是有效的 JSON 格式，不要有其他文字
- 每次只能输出一个工具调用

请按照以下题目要求调试代码：
${problem}

当前代码内容：
${this.state.virtualFileContent}

请先使用 read 工具查看当前代码，然后根据题目分析可能的 bug。`;

            this.state.messages.push({
                role: 'system',
                content: systemPrompt
            });

            document.getElementById('aidebug-problem-section').style.display = 'none';
            document.getElementById('aidebug-chat-section').style.display = 'flex';
            document.getElementById('aidebug-messages').innerHTML = '';

            this.addMessage('system', '开始调试...');
            await this.callAI();
        }

        async callAI() {
            if (this.state.ended || !this.state.isRunning) {
                console.log('[AI Debug] 跳过调用：ended=', this.state.ended, 'isRunning=', this.state.isRunning);
                return;
            }

            try {
                // 添加加载状态提示
                const loadingMsgId = 'aidebug-loading-' + Date.now();
                this.addMessage('system', 'AI 思考中...', loadingMsgId);

                console.log('[AI Debug] 发送请求到:', `${this.config.baseUrl}/chat/completions`);
                console.log('[AI Debug] 消息历史:', this.state.messages.length, '条');

                const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.config.model,
                        messages: this.state.messages,
                        temperature: 0.7
                    })
                });

                // 移除加载提示
                this.removeMessage(loadingMsgId);

                console.log('[AI Debug] 响应状态:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[AI Debug] API 错误:', errorText);
                    throw new Error(`API 请求失败：${response.status} - ${errorText}`);
                }

                const data = await response.json();
                console.log('[AI Debug] API 响应:', data);

                // 处理不同的 API 响应格式
                let assistantMessage = '';
                if (data.choices && data.choices.length > 0 && data.choices[0]) {
                    assistantMessage = data.choices[0].message?.content || '';
                } else if (data.choices === null || (Array.isArray(data.choices) && data.choices.length === 0)) {
                    // choices 为空或 null，可能是 AI 认为任务已完成
                    console.log('[AI Debug] API 返回空 choices，可能 AI 认为任务已完成');
                    this.addMessage('system', 'AI 已完成任务或无法继续，请检查日志');
                    this.endDebugging();
                    return;
                } else if (data.result) {
                    // 某些 API 格式
                    assistantMessage = data.result;
                } else if (data.response) {
                    // 另一种 API 格式
                    assistantMessage = data.response;
                } else {
                    console.error('[AI Debug] 未知的 API 响应格式:', data);
                    throw new Error('API 返回了未知格式的响应');
                }

                if (!assistantMessage) {
                    console.warn('[AI Debug] AI 返回空消息');
                    this.addMessage('system', 'AI 返回空消息，请检查 API 配置');
                    this.state.isRunning = false;
                    return;
                }

                console.log('[AI Debug] AI 消息:', assistantMessage.substring(0, 200) + '...');

                this.state.messages.push({
                    role: 'assistant',
                    content: assistantMessage
                });

                this.addMessage('assistant', assistantMessage);

                const toolCalls = this.parseToolCalls(assistantMessage);
                console.log('[AI Debug] 解析到的工具调用:', toolCalls);

                if (toolCalls.length > 0) {
                    for (const toolCall of toolCalls) {
                        if (toolCall.name === 'end') {
                            console.log('[AI Debug] AI 请求结束调试');
                            this.endDebugging();
                            return;
                        }

                        console.log('[AI Debug] 执行工具:', toolCall.name);
                        await this.executeToolCall(toolCall);
                        
                        // 每次执行工具后检查是否应该结束
                        if (this.state.ended) {
                            console.log('[AI Debug] 调试已结束，停止调用');
                            return;
                        }
                    }

                    // 执行完所有工具后，继续调用 AI
                    if (!this.state.ended && this.state.isRunning) {
                        console.log('[AI Debug] 继续调用 AI...');
                        // 添加一个提示，让 AI 继续分析
                        this.state.messages.push({
                            role: 'user',
                            content: '请继续分析，如果需要继续修改请使用工具，如果已完成请使用 {"name": "end", "parameters": {}}'
                        });
                        await this.callAI();
                    }
                } else {
                    // 如果没有解析到工具调用，提示用户
                    console.log('[AI Debug] 未解析到工具调用');
                    this.addMessage('system', 'AI 未返回有效的工具调用，请检查 AI 响应格式或手动发送消息继续');
                    this.state.isRunning = false;
                }
            } catch (e) {
                console.error('[AI Debug] 错误:', e);
                this.addMessage('system', `错误：${e.message}`);
                this.state.isRunning = false;
            }
        }

        removeMessage(msgId) {
            const messagesContainer = document.getElementById('aidebug-messages');
            if (messagesContainer) {
                const loadingMsg = messagesContainer.querySelector(`[data-msg-id="${msgId}"]`);
                if (loadingMsg) {
                    loadingMsg.remove();
                }
            }
        }

        parseToolCalls(text) {
            const toolCalls = [];
            
            // 尝试匹配完整的 JSON 对象
            const jsonMatches = text.match(/\{[\s\S]*?"name"\s*:\s*"(edit|read|run|end)"[\s\S]*?\}/g);

            if (jsonMatches) {
                for (const jsonStr of jsonMatches) {
                    try {
                        // 尝试直接解析
                        const parsed = JSON.parse(jsonStr);
                        if (parsed.name) {
                            const params = parsed.parameters || {};
                            toolCalls.push({ name: parsed.name, params });
                        }
                    } catch (e) {
                        // 如果直接解析失败，尝试修复 JSON
                        const fixed = this.fixJsonString(jsonStr);
                        if (fixed) {
                            try {
                                const parsed = JSON.parse(fixed);
                                if (parsed.name) {
                                    const params = parsed.parameters || {};
                                    toolCalls.push({ name: parsed.name, params });
                                }
                            } catch (e2) {
                                console.log('Parse fixed JSON error:', e2, 'original:', jsonStr);
                            }
                        } else {
                            console.log('Parse tool call error:', e, 'json:', jsonStr);
                        }
                    }
                }
            }

            return toolCalls;
        }

        fixJsonString(jsonStr) {
            // 移除末尾可能缺失的部分
            let fixed = jsonStr.trim();
            
            // 统计括号数量
            const openBraces = (fixed.match(/\{/g) || []).length;
            const closeBraces = (fixed.match(/\}/g) || []).length;
            
            // 如果 { 比 } 多，补充缺少的 }
            if (openBraces > closeBraces) {
                fixed += '}'.repeat(openBraces - closeBraces);
            }
            
            // 修复可能缺失的逗号
            fixed = fixed.replace(/"(\s*)"}/g, '"$1"}');
            fixed = fixed.replace(/:\s*"([^"\\]*(\\.[^"\\]*)*)"\s*"/g, ':"$1","');
            
            return fixed;
        }

        async executeToolCall(toolCall) {
            const { name, params } = toolCall;
            let toolResult = '';

            switch (name) {
                case 'read':
                    try {
                        if (window.PhoiAPI) {
                            this.state.virtualFileContent = await window.PhoiAPI.getCurrentFileContent();
                        } else if (window.monacoEditor) {
                            this.state.virtualFileContent = window.monacoEditor.getValue();
                        }
                    } catch (e) {
                        this.state.virtualFileContent = this.state.originalContent;
                    }
                    toolResult = `文件内容已读取，当前代码：\n${this.state.virtualFileContent}`;
                    this.addMessage('system', toolResult);
                    this.state.messages.push({ role: 'tool', content: toolResult });
                    this.updateEditor();
                    break;

                case 'run':
                    this.addMessage('system', `正在运行代码，输入：${params.input || '(无)'}`);
                    try {
                        const runResult = await this.runCode(params.input || '');
                        toolResult = `运行结果：\n${runResult}`;
                        this.addMessage('system', toolResult);
                        this.state.messages.push({ role: 'tool', content: toolResult });
                    } catch (e) {
                        toolResult = `运行错误：${e.message}`;
                        this.addMessage('system', toolResult);
                        this.state.messages.push({ role: 'tool', content: toolResult });
                    }
                    break;

                case 'edit':
                    this.addMessage('system', `正在执行编辑...`);
                    try {
                        const oldStr = params.oldStr;
                        const newStr = params.newStr;
                        const index = params.index || 1;

                        const matches = [];
                        let pos = 0;
                        while ((pos = this.state.virtualFileContent.indexOf(oldStr, pos)) !== -1) {
                            matches.push(pos);
                            pos += 1;
                        }

                        if (matches.length === 0) {
                            toolResult = `错误：未找到要替换的字符串 "${oldStr.slice(0, 50)}..."`;
                            this.addMessage('system', toolResult);
                            this.state.messages.push({ role: 'tool', content: toolResult });
                        } else if (index > matches.length) {
                            toolResult = `错误：指定的第${index}个匹配不存在，共有${matches.length}个匹配`;
                            this.addMessage('system', toolResult);
                            this.state.messages.push({ role: 'tool', content: toolResult });
                        } else {
                            const targetPos = matches[index - 1];
                            const before = this.state.virtualFileContent.slice(0, targetPos);
                            const after = this.state.virtualFileContent.slice(targetPos + oldStr.length);
                            this.state.virtualFileContent = before + newStr + after;
                            toolResult = `成功替换第${index}个匹配，修改后的代码：\n${this.state.virtualFileContent}`;
                            this.addMessage('system', toolResult);
                            this.state.messages.push({ role: 'tool', content: toolResult });
                            this.updateEditor();
                        }
                    } catch (e) {
                        toolResult = `编辑错误：${e.message}`;
                        this.addMessage('system', toolResult);
                        this.state.messages.push({ role: 'tool', content: toolResult });
                    }
                    break;

                case 'end':
                    this.endDebugging();
                    return;
            }
        }

        runCode(input) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.open('POST', '/run', true);
                xhr.setRequestHeader('Content-Type', 'application/json');

                xhr.onload = function() {
                    if (xhr.status === 200) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response.Result || response.Error || JSON.stringify(response));
                        } catch (e) {
                            resolve(xhr.responseText);
                        }
                    } else {
                        reject(new Error('请求失败：' + xhr.status));
                    }
                };

                xhr.onerror = function() {
                    reject(new Error('网络错误'));
                };

                xhr.send(JSON.stringify({
                    language: 'c++',
                    code: this.state.virtualFileContent,
                    input: input
                }));
            });
        }

        addMessage(role, content, msgId) {
            const messagesContainer = document.getElementById('aidebug-messages');
            if (!messagesContainer) return;

            const messageDiv = document.createElement('div');
            messageDiv.className = `aidebug-message aidebug-message-${role}`;
            
            if (msgId) {
                messageDiv.setAttribute('data-msg-id', msgId);
            }

            const roleLabel = role === 'user' ? '👤 你' : role === 'assistant' ? '🤖 AI' : 'ℹ️ 系统';
            messageDiv.innerHTML = `<div class="aidebug-message-role">${roleLabel}</div><div class="aidebug-message-content">${this.formatContent(content)}</div>`;

            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        formatContent(content) {
            return content
                .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="aidebug-code-block">$2</code></pre>')
                .replace(/`([^`]+)`/g, '<code class="aidebug-inline-code">$1</code>')
                .replace(/\n/g, '<br>');
        }

        updateEditor() {
            if (this.monacoEditor) {
                this.monacoEditor.setValue(this.state.virtualFileContent);
            }
            this.updateCodeStatus();
        }

        updateCodeStatus() {
            const statusEl = document.getElementById('aidebug-code-status');
            const isModified = this.state.virtualFileContent !== this.state.originalContent;
            
            if (statusEl) {
                statusEl.textContent = isModified ? '已修改' : '原始代码';
                statusEl.className = isModified ? 'aidebug-code-status aidebug-code-status-modified' : 'aidebug-code-status';
            }

            const applyBtn = document.getElementById('aidebug-apply-btn');
            const cancelBtn = document.getElementById('aidebug-cancel-btn');
            if (applyBtn) applyBtn.disabled = !isModified;
            if (cancelBtn) cancelBtn.disabled = !isModified;
        }

        async sendUserMessage() {
            const input = document.getElementById('aidebug-user-input');
            const message = input.value.trim();
            if (!message) return;

            input.value = '';
            this.addMessage('user', message);
            this.state.messages.push({ role: 'user', content: message });

            await this.callAI();
        }

        endDebugging() {
            this.state.ended = true;
            this.addMessage('system', '调试已结束');
            this.showApplyCancelButtons();
        }

        showApplyCancelButtons() {
            this.updateCodeStatus();
        }

        async applyChanges() {
            if (window.PhoiAPI) {
                window.PhoiAPI.setCurrentFileContent(this.state.virtualFileContent);
                await PhoiDialog.alert('代码已应用到编辑器！');
                this.closeDebugPanel();
            } else if (window.monacoEditor) {
                window.monacoEditor.setValue(this.state.virtualFileContent);
                await PhoiDialog.alert('代码已应用到编辑器！');
                this.closeDebugPanel();
            }
        }

        async cancelChanges() {
            this.state.virtualFileContent = this.state.originalContent;
            this.updateEditor();
            await PhoiDialog.alert('已取消修改');
        }

        closeDebugPanel() {
            const overlay = document.getElementById('aidebug-overlay');
            if (overlay) {
                overlay.remove();
            }
            if (this.monacoEditor) {
                this.monacoEditor.dispose();
                this.monacoEditor = null;
            }
            this.state.isRunning = false;
            this.state.ended = false;
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        window.aidebugPlugin = new AIDebugPlugin();
    });
})();
