/**
 * Clangd LSP 集成模块 for PH code
 * 简化的 LSP 实现，不依赖 monaco-languageclient
 */

class ClangdLSP {
    constructor() {
        this.initialized = false;
        this.failed = false;
        this.loading = false;
        this.statusCallback = null;
        this.clangdWorker = null;
        this.editor = null;
        this.usingFallback = false;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.documentVersion = 0;
        this.documentUri = 'file:///home/web_user/main.cpp';
        this.completionCache = null;
        this.diagnosticTimer = null;
    }

    onStatusChange(callback) {
        this.statusCallback = callback;
    }

    updateStatus(status, progress = 0, max = 100) {
        if (this.statusCallback) {
            this.statusCallback(status, progress, max);
        }
        console.log(`[Clangd] ${status} (${progress}/${max})`);
    }

    checkCrossOriginIsolation() {
        if (typeof SharedArrayBuffer === 'undefined') {
            console.warn('[Clangd] SharedArrayBuffer not available, using fallback');
            return false;
        }
        if (!globalThis.crossOriginIsolated) {
            console.warn('[Clangd] crossOriginIsolated is false, using fallback');
            return false;
        }
        return true;
    }

    async initialize(editorInstance) {
        if (this.initialized) return true;
        if (this.failed) return false;
        if (this.loading) {
            return new Promise(resolve => {
                const check = () => {
                    if (this.initialized || this.failed) resolve(this.initialized);
                    else setTimeout(check, 100);
                };
                check();
            });
        }

        this.loading = true;
        this.editor = editorInstance;

        try {
            if (!this.checkCrossOriginIsolation()) {
                throw new Error('Cross-origin isolation not enabled');
            }

            this.updateStatus('loading', 5, 100);

            // 1. 下载压缩的 wasm 文件
            this.updateStatus('downloading', 10, 100);
            const response = await fetch('/static/clangd/clangd.wasm.compressed');
            if (!response.ok) {
                throw new Error(`Failed to download: ${response.status}`);
            }

            const gzData = await response.arrayBuffer();

            // 2. 解压 wasm 文件
            this.updateStatus('decompressing', 40, 100);
            console.log('[Clangd] Decompressing wasm...');
            let wasmData;
            try {
                wasmData = window.pako.inflate(gzData);
                if (wasmData instanceof Promise) {
                    wasmData = await wasmData;
                }
            } catch (e) {
                if (typeof DecompressionStream !== 'undefined') {
                    wasmData = new Uint8Array(await new Response(
                        new Blob([gzData]).stream().pipeThrough(new DecompressionStream('gzip'))
                    ).arrayBuffer());
                } else {
                    throw e;
                }
            }
            console.log(`[Clangd] Decompressed: ${(wasmData.length / 1024 / 1024).toFixed(1)}MB`);

            const wasmBlob = new Blob([wasmData], { type: 'application/wasm' });
            const wasmUrl = URL.createObjectURL(wasmBlob);

            // 3. 创建 clangd worker
            this.updateStatus('loading_module', 50, 100);
            await this.createWorker(wasmUrl);

            // 4. 初始化 LSP
            this.updateStatus('initializing', 70, 100);
            await this.initializeLSP();

            // 5. 注册 Monaco 补全提供器
            this.registerCompletionProvider();

            this.updateStatus('ready', 100, 100);
            this.initialized = true;
            this.loading = false;
            console.log('[Clangd] Ready!');
            return true;

        } catch (error) {
            console.error('[Clangd] Failed:', error);
            this.failed = true;
            this.loading = false;
            this.updateStatus('failed', 0, 100);
            await this.useFallback();
            throw error;
        }
    }

    async createWorker(wasmUrl) {
        return new Promise((resolve, reject) => {
            let resolved = false;
            const workerUrl = new URL('/static/clangd/clangd-worker.js', window.location.origin).href;

            try {
                this.clangdWorker = new Worker(workerUrl, { type: 'module' });
                console.log('[Clangd] Created Module Worker');
            } catch (e) {
                console.error('[Clangd] Module Worker not supported:', e);
                reject(new Error('Module Worker not supported: ' + e.message));
                return;
            }

            this.clangdWorker.onmessage = (e) => {
                const data = e.data;
                if (data.type === 'ready') {
                    resolved = true;
                    resolve();
                } else if (data.type === 'error') {
                    resolved = true;
                    reject(new Error(data.error));
                } else if (data.type === 'abort') {
                    resolved = true;
                    reject(new Error('clangd aborted: ' + data.error));
                } else if (data.type === 'lsp') {
                    this.handleLSPMessage(data.message);
                }
            };

            this.clangdWorker.onerror = (e) => {
                reject(new Error(`Worker error: ${e.message}`));
            };

            this.clangdWorker.postMessage({ type: 'init', wasmUrl });
            console.log('[Clangd] Sent init message to worker');

            setTimeout(() => {
                if (!resolved) {
                    reject(new Error('Worker initialization timeout (60s)'));
                }
            }, 60000);
        });
    }

    async initializeLSP() {
        if (!this.clangdWorker) return;

        console.log('[Clangd] LSP initialization...');

        const initRequest = {
            jsonrpc: '2.0',
            id: ++this.requestId,
            method: 'initialize',
            params: {
                processId: null,
                rootUri: null,
                capabilities: {
                    textDocument: {
                        publishDiagnostics: { relatedInformation: true },
                        completion: {
                            completionItem: {
                                snippetSupport: true,
                                commitCharactersSupport: true,
                                documentationFormat: ['plaintext', 'markdown']
                            }
                        },
                        hover: { contentFormat: ['plaintext', 'markdown'] },
                        signatureHelp: { signatureInformation: { documentationFormat: ['plaintext'] } }
                    }
                }
            }
        };

        // 发送 initialize 请求
        this.sendToWorker(initRequest);

        // 等待响应
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 发送 initialized 通知
        this.sendToWorker({
            jsonrpc: '2.0',
            method: 'initialized',
            params: {}
        });

        // 打开当前文档
        this.openCurrentDocument();

        // 设置文档变更监听
        this.setupDocumentSync();
    }

    sendToWorker(message) {
        if (!this.clangdWorker) return;
        this.clangdWorker.postMessage({ type: 'lsp', message });
    }

    openCurrentDocument() {
        if (!this.editor) return;
        const model = this.editor.getModel();
        if (!model) return;

        this.documentVersion++;
        this.sendToWorker({
            jsonrpc: '2.0',
            method: 'textDocument/didOpen',
            params: {
                textDocument: {
                    uri: this.documentUri,
                    languageId: 'cpp',
                    version: this.documentVersion,
                    text: model.getValue()
                }
            }
        });
    }

    setupDocumentSync() {
        if (!this.editor) return;

        // 每 5 秒请求一次诊断
        this.diagnosticTimer = setInterval(() => {
            if (!this.initialized) return;
            
            const model = this.editor.getModel();
            if (!model) return;
            
            // 请求重新分析文档
            this.sendToWorker({
                jsonrpc: '2.0',
                method: 'textDocument/didOpen',
                params: {
                    textDocument: {
                        uri: this.documentUri,
                        languageId: 'cpp',
                        version: ++this.documentVersion,
                        text: model.getValue()
                    }
                }
            });
        }, 5000);

        // 仍然需要同步文档变化，但不立即请求诊断
        this.editor.onDidChangeModelContent((e) => {
            if (!this.initialized) return;

            const model = this.editor.getModel();
            if (!model) return;

            this.documentVersion++;

            const changes = e.changes.map(change => ({
                range: {
                    start: { line: change.range.startLineNumber - 1, character: change.range.startColumn - 1 },
                    end: { line: change.range.endLineNumber - 1, character: change.range.endColumn - 1 }
                },
                rangeLength: change.rangeLength,
                text: change.text
            }));

            this.sendToWorker({
                jsonrpc: '2.0',
                method: 'textDocument/didChange',
                params: {
                    textDocument: {
                        uri: this.documentUri,
                        version: this.documentVersion
                    },
                    contentChanges: changes
                }
            });
        });
    }

    registerCompletionProvider() {
        if (!monaco) return;

        // 仅注册错误诊断，不注册代码补全、悬停、签名帮助
        // clangd 会通过 textDocument/publishDiagnostics 发送错误/警告
        console.log('[Clangd] Diagnostic provider registered');
    }

    async requestCompletion(model, position) {
        const params = {
            textDocument: { uri: this.documentUri },
            position: { line: position.lineNumber - 1, character: position.column - 1 },
            context: { triggerKind: 1 }
        };

        const result = await this.sendRequest('textDocument/completion', params);
        if (!result || !result.items) return [];

        return result.items.map(item => this.convertCompletionItem(item));
    }

    convertCompletionItem(item) {
        const kindMap = {
            1: monaco.languages.CompletionItemKind.Text,
            2: monaco.languages.CompletionItemKind.Method,
            3: monaco.languages.CompletionItemKind.Function,
            4: monaco.languages.CompletionItemKind.Constructor,
            5: monaco.languages.CompletionItemKind.Field,
            6: monaco.languages.CompletionItemKind.Variable,
            7: monaco.languages.CompletionItemKind.Class,
            8: monaco.languages.CompletionItemKind.Interface,
            9: monaco.languages.CompletionItemKind.Module,
            10: monaco.languages.CompletionItemKind.Property,
            11: monaco.languages.CompletionItemKind.Unit,
            12: monaco.languages.CompletionItemKind.Value,
            13: monaco.languages.CompletionItemKind.Enum,
            14: monaco.languages.CompletionItemKind.Keyword,
            15: monaco.languages.CompletionItemKind.Snippet,
            16: monaco.languages.CompletionItemKind.Color,
            17: monaco.languages.CompletionItemKind.File,
            18: monaco.languages.CompletionItemKind.Reference,
            19: monaco.languages.CompletionItemKind.Folder,
            20: monaco.languages.CompletionItemKind.EnumMember,
            21: monaco.languages.CompletionItemKind.Constant,
            22: monaco.languages.CompletionItemKind.Struct,
            23: monaco.languages.CompletionItemKind.Event,
            24: monaco.languages.CompletionItemKind.Operator,
            25: monaco.languages.CompletionItemKind.TypeParameter
        };

        let insertText = item.label;
        if (item.textEdit) {
            insertText = item.textEdit.newText || item.textEdit;
        } else if (item.insertText) {
            insertText = item.insertText;
        }

        return {
            label: item.label,
            kind: kindMap[item.kind] || monaco.languages.CompletionItemKind.Text,
            detail: item.detail || '',
            documentation: item.documentation ? 
                (typeof item.documentation === 'string' ? item.documentation : item.documentation.value) : '',
            insertText: insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: item.sortText || item.label,
            filterText: item.filterText || item.label
        };
    }

    async requestHover(model, position) {
        const params = {
            textDocument: { uri: this.documentUri },
            position: { line: position.lineNumber - 1, character: position.column - 1 }
        };

        const result = await this.sendRequest('textDocument/hover', params);
        if (!result || !result.contents) return null;

        let contents = '';
        if (typeof result.contents === 'string') {
            contents = result.contents;
        } else if (result.contents.value) {
            contents = result.contents.value;
        } else if (result.contents.language) {
            contents = result.contents.value;
        }

        return {
            contents: [
                { value: '```cpp\n' + contents + '\n```' }
            ]
        };
    }

    async requestSignatureHelp(model, position) {
        const params = {
            textDocument: { uri: this.documentUri },
            position: { line: position.lineNumber - 1, character: position.column - 1 }
        };

        const result = await this.sendRequest('textDocument/signatureHelp', params);
        if (!result || !result.signatures) return null;

        return {
            value: result,
            signatures: result.signatures.map(sig => ({
                label: sig.label,
                documentation: sig.documentation ? 
                    (typeof sig.documentation === 'string' ? sig.documentation : sig.documentation.value) : ''
            }))
        };
    }

    async sendRequest(method, params) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            const request = {
                jsonrpc: '2.0',
                id,
                method,
                params
            };

            this.pendingRequests.set(id, { resolve, reject, method, timeout: null });

            this.sendToWorker(request);

            // 超时处理
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    resolve(null);
                }
            }, 5000);

            this.pendingRequests.get(id).timeout = timeout;
        });
    }

    handleLSPMessage(message) {
        if (message.id !== undefined) {
            // 这是响应消息
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    console.warn('[Clangd] LSP error:', message.error);
                    pending.resolve(null);
                } else {
                    pending.resolve(message.result);
                }
            }
        } else if (message.method) {
            // 这是服务器通知
            if (message.method === 'textDocument/publishDiagnostics') {
                this.handleDiagnostics(message.params);
            }
        }
    }

    handleDiagnostics(params) {
        if (!this.editor || !monaco) return;

        const model = this.editor.getModel();
        if (!model) return;

        const diagnostics = (params.diagnostics || []).map(d => ({
            severity: d.severity === 1 ? monaco.MarkerSeverity.Error :
                     d.severity === 2 ? monaco.MarkerSeverity.Warning :
                     d.severity === 3 ? monaco.MarkerSeverity.Info :
                     monaco.MarkerSeverity.Warning,
            startLineNumber: d.range.start.line + 1,
            startColumn: d.range.start.character + 1,
            endLineNumber: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
            message: d.message,
            source: d.source || 'clangd'
        }));

        monaco.editor.setModelMarkers(model, 'clangd', diagnostics);
    }

    async useFallback() {
        console.log('[Clangd] Using fallback autocomplete.js');
        this.usingFallback = true;
    }

    getStatus() {
        if (this.usingFallback) return 'fallback';
        if (this.failed) return 'failed';
        if (this.loading) return 'loading';
        if (this.initialized) return 'ready';
        return 'idle';
    }

    dispose() {
        if (this.diagnosticTimer) {
            clearInterval(this.diagnosticTimer);
            this.diagnosticTimer = null;
        }
        if (this.clangdWorker) {
            this.clangdWorker.terminate();
        }
    }

    isUsingClangd() {
        return this.initialized && !this.usingFallback;
    }

    // 格式化文档（4空格缩进）
    async formatDocument() {
        if (!this.editor || !this.initialized) return false;

        const model = this.editor.getModel();
        if (!model) return false;

        const params = {
            textDocument: { uri: this.documentUri },
            options: {
                tabSize: 4,
                insertSpaces: true
            }
        };

        try {
            const result = await this.sendRequest('textDocument/formatting', params);
            if (result && result.length > 0) {
                // 应用格式化编辑
                const edits = result.map(edit => ({
                    range: {
                        startLineNumber: edit.range.start.line + 1,
                        startColumn: edit.range.start.character + 1,
                        endLineNumber: edit.range.end.line + 1,
                        endColumn: edit.range.end.character + 1
                    },
                    text: edit.newText
                }));

                model.applyEdits(edits);
                console.log('[Clangd] Document formatted');
                return true;
            }
        } catch (error) {
            console.error('[Clangd] Format error:', error);
        }
        return false;
    }

    // 转到定义
    async goToDefinition(position) {
        if (!this.editor || !this.initialized) return null;

        const model = this.editor.getModel();
        if (!model) return null;

        const params = {
            textDocument: { uri: this.documentUri },
            position: { line: position.lineNumber - 1, character: position.column - 1 }
        };

        try {
            const result = await this.sendRequest('textDocument/definition', params);
            if (result && result.length > 0) {
                const location = result[0];
                return {
                    uri: location.uri,
                    range: {
                        startLineNumber: location.range.start.line + 1,
                        startColumn: location.range.start.character + 1,
                        endLineNumber: location.range.end.line + 1,
                        endColumn: location.range.end.character + 1
                    }
                };
            }
        } catch (error) {
            console.error('[Clangd] Go to definition error:', error);
        }
        return null;
    }

    // 转到类型定义
    async goToTypeDefinition(position) {
        if (!this.editor || !this.initialized) return null;

        const model = this.editor.getModel();
        if (!model) return null;

        const params = {
            textDocument: { uri: this.documentUri },
            position: { line: position.lineNumber - 1, character: position.column - 1 }
        };

        try {
            const result = await this.sendRequest('textDocument/typeDefinition', params);
            if (result && result.length > 0) {
                const location = result[0];
                return {
                    uri: location.uri,
                    range: {
                        startLineNumber: location.range.start.line + 1,
                        startColumn: location.range.start.character + 1,
                        endLineNumber: location.range.end.line + 1,
                        endColumn: location.range.end.character + 1
                    }
                };
            }
        } catch (error) {
            console.error('[Clangd] Go to type definition error:', error);
        }
        return null;
    }

    // 转到定义（全部引用）
    async goToDefinitionAll(position) {
        if (!this.editor || !this.initialized) return null;

        const model = this.editor.getModel();
        if (!model) return null;

        const params = {
            textDocument: { uri: this.documentUri },
            position: { line: position.lineNumber - 1, character: position.column - 1 }
        };

        try {
            const result = await this.sendRequest('textDocument/definition', params);
            if (result && result.length > 0) {
                const locations = result.map(location => ({
                    uri: location.uri,
                    range: {
                        startLineNumber: location.range.start.line + 1,
                        startColumn: location.range.start.character + 1,
                        endLineNumber: location.range.end.line + 1,
                        endColumn: location.range.end.character + 1
                    }
                }));
                return locations;
            }
        } catch (error) {
            console.error('[Clangd] Go to definition all error:', error);
        }
        return null;
    }
}

// 导出单例
window.clangdLSP = new ClangdLSP();

async function initializeClangdIntegration() {
    // 检查 clangd 是否启用
    const clangdEnabled = localStorage.getItem('phoi_clangd_enabled') === 'true';
    
    if (!clangdEnabled) {
        console.log('[Clangd] Clangd 被禁用，跳过初始化');
        return;
    }
    
    console.log('[Clangd] Starting initialization...');

    window.clangdLSP.onStatusChange((status, progress, max) => {
        updateClangdStatus(status, progress, max);
    });

    try {
        await window.clangdLSP.initialize(monacoEditor);
        console.log('[Clangd] Initialization successful!');
    } catch (error) {
        console.error('[Clangd] Initialization failed:', error.message);
    }
}

function updateClangdStatus(status, progress, max) {
    const statusElement = document.getElementById('clangd-status');
    if (statusElement) {
        const statusText = {
            'loading': '正在加载 clangd...或未启用clangd',
            'downloading': `下载 wasm... ${Math.round(progress)}%`,
            'decompressing': `解压... ${Math.round(progress)}%`,
            'loading_module': '加载模块...',
            'initializing': '初始化 LSP...或未启用clangd',
            'ready': '✓ clangd 已就绪 初始化可能还要一会',
            'failed': '✗ clangd 失败，使用备用方案',
            'fallback': '使用备用代码补全'
        }[status] || status;

        statusElement.textContent = statusText;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const terminalInfoContent = document.getElementById('terminal-info-content');
    if (terminalInfoContent && !document.getElementById('clangd-status')) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'clangd-status';
        statusDiv.style.cssText = 'padding: 10px; color: #4daafc; font-size: 13px;';
        statusDiv.textContent = 'clangd: 等待初始化...';
        terminalInfoContent.appendChild(statusDiv);
    }
});
