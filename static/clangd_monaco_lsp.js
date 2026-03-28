/**
 * Clangd LSP 集成模块 for PH code
 * 使用 Monaco Editor 内置的 LSP 客户端
 */

class MonacoClangdLSP {
    constructor() {
        this.initialized = false;
        this.failed = false;
        this.loading = false;
        this.statusCallback = null;
        this.clangdWorker = null;
        this.editor = null;
        this.usingFallback = false;
        this.documentUri = 'file:///home/web_user/main.cpp';
        this.documentVersion = 0;
        this.lspClient = null;
        this.disposables = [];
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.semanticTokensProvider = null;
        this.semanticTokensLegend = null;
        this.wasmObjectUrl = null;  // 保存 wasm Object URL，以便重启时重用
    }

    onStatusChange(callback) {
        this.statusCallback = callback;
    }

    updateStatus(status, progress = 0, max = 100) {
        if (this.statusCallback) {
            this.statusCallback(status, progress, max);
        }
        console.log(`[MonacoClangd] ${status} (${progress}/${max})`);
    }

    checkCrossOriginIsolation() {
        if (typeof SharedArrayBuffer === 'undefined') {
            console.warn('[MonacoClangd] SharedArrayBuffer not available, using fallback');
            return false;
        }
        if (!globalThis.crossOriginIsolated) {
            console.warn('[MonacoClangd] crossOriginIsolated is false, using fallback');
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
            console.log('[MonacoClangd] Decompressing wasm...');
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
            console.log(`[MonacoClangd] Decompressed: ${(wasmData.length / 1024 / 1024).toFixed(1)}MB`);

            const wasmBlob = new Blob([wasmData], { type: 'application/wasm' });
            const wasmUrl = URL.createObjectURL(wasmBlob);

            // 保存 wasm Object URL 以便重启时重用
            this.wasmObjectUrl = wasmUrl;

            // 3. 创建 clangd worker
            this.updateStatus('loading_module', 50, 100);
            await this.createWorker(wasmUrl);

            // 4. 使用 Monaco 内置 LSP 客户端连接到 worker
            this.updateStatus('initializing', 70, 100);
            await this.initializeLSP();

            // 5. 打开文档
            this.openCurrentDocument();

            // 6. 设置文档变更监听
            this.setupDocumentSync();

            this.updateStatus('ready', 100, 100);
            this.initialized = true;
            this.loading = false;
            console.log('[MonacoClangd] Ready!');
            return true;

        } catch (error) {
            console.error('[MonacoClangd] Failed:', error);
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
            const workerUrl = '/static/clangd/clangd-monaco-worker.js';

            try {
                this.clangdWorker = new Worker(workerUrl, { type: 'module' });
                console.log('[MonacoClangd] Created Module Worker');
            } catch (e) {
                console.error('[MonacoClangd] Module Worker not supported:', e);
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
                } else if (data.type === 'lsp') {
                    // LSP 消息来自 clangd
                    this.handleLSPMessage(data.message);
                }
            };

            this.clangdWorker.onerror = (e) => {
                reject(new Error(`Worker error: ${e.message}`));
            };

            this.clangdWorker.postMessage({ type: 'init', wasmUrl });
            console.log('[MonacoClangd] Sent init message to worker');

            setTimeout(() => {
                if (!resolved) {
                    reject(new Error('Worker initialization timeout (60s)'));
                }
            }, 60000);
        });
    }

    async initializeLSP() {
        if (!this.clangdWorker) return;

        console.log('[MonacoClangd] Initializing LSP client...');

        // 检查 Monaco 是否有内置 LSP 客户端（仅在 ESM 版本中可用）
        // 由于我们使用的是 AMD 版本，需要使用自定义 LSP 实现
        console.log('[MonacoClangd] Using custom LSP implementation');
        await this.initializeCustomLSP();
    }

    async initializeCustomLSP() {
        // 自定义 LSP 初始化
        console.log('[MonacoClangd] Custom LSP initialization...');

        const initParams = {
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
        };

        // 发送 initialize 请求
        const initResult = await this.sendRequest('initialize', initParams);

        if (!initResult) {
            throw new Error('clangd initialize timeout');
        }

        // 发送 initialized 通知
        this.sendToWorker({
            jsonrpc: '2.0',
            method: 'initialized',
            params: {}
        });

        // 注册 Monaco 提供器
        this.registerCompletionProvider();
        this.registerHoverProvider();
        this.registerSignatureHelpProvider();
        this.registerSemanticTokensProvider();

        console.log('[MonacoClangd] Custom LSP initialization completed');
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

        this.editor.onDidChangeModelContent((e) => {
            if (!this.initialized || !this.clangdWorker) return;

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

            // 文档变化后，触发语义高亮刷新
            this.triggerSemanticRefresh();
        });

        // 定期发送文档以获取诊断
        setInterval(() => {
            if (!this.initialized || !this.clangdWorker) return;

            const model = this.editor.getModel();
            if (!model) return;

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

            // 定期触发语义高亮刷新
            this.triggerSemanticRefresh();
        }, 5000);

        // 初始化完成后触发一次语义高亮
        setTimeout(() => this.triggerSemanticRefresh(), 1000);
    }

    // 触发语义高亮刷新
    triggerSemanticRefresh() {
        if (!this.editor || !monaco) return;
        
        // Monaco 会自动管理语义 tokens 的刷新
        // 不需要手动触发
        console.log('[MonacoClangd] Semantic refresh triggered');
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

            const pendingRequest = { resolve, reject, method, timeout: null };
            this.pendingRequests.set(id, pendingRequest);

            this.sendToWorker(request);
            console.log(`[MonacoClangd] Sent request: ${method} (id=${id})`);

            // 超时处理 - 60 秒
            const timeout = setTimeout(() => {
                const pending = this.pendingRequests.get(id);
                if (pending) {
                    this.pendingRequests.delete(id);
                    console.error(`[MonacoClangd] Request timeout after 60s: ${method} (id=${id})`);
                    pending.resolve(null);
                }
            }, 60000);

            pendingRequest.timeout = timeout;
        });
    }

    handleLSPMessage(message) {
        console.log('[MonacoClangd] Received LSP message:', JSON.stringify(message).substring(0, 200));

        if (message.id !== undefined) {
            // 响应消息
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    console.warn('[MonacoClangd] LSP error:', message.error);
                    pending.resolve(null);
                } else {
                    console.log(`[MonacoClangd] Request resolved: id=${message.id}`);
                    pending.resolve(message.result);
                }
            } else {
                console.warn(`[MonacoClangd] Received response for unknown request: id=${message.id}`);
            }
        } else if (message.method) {
            // 服务器通知
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
        console.log('[MonacoClangd] Using fallback autocomplete.js');
        this.usingFallback = true;

        // 启用 autocomplete.js
        if (typeof registerCompletionProviders === 'function') {
            registerCompletionProviders();
        }
    }

    // 注册代码补全提供器
    registerCompletionProvider() {
        if (!monaco) return;

        // 检查是否启用了 clangd 代码提示
        const clangdCompletionEnabled = localStorage.getItem('phoi_clangd_completion_enabled') === 'true';
        if (!clangdCompletionEnabled) {
            console.log('[MonacoClangd] Completion provider not registered (disabled in settings), using autocomplete.js');
            // 使用 fallback 的 autocomplete.js
            if (typeof registerCompletionProviders === 'function') {
                registerCompletionProviders();
            }
            return;
        }

        // 注册 clangd 的代码补全提供器
        const provider = monaco.languages.registerCompletionItemProvider('cpp', {
            triggerCharacters: ['.', '>', ':', '#', '(', ','],
            provideCompletionItems: async (model, position) => {
                if (!this.initialized || !this.clangdWorker) {
                    return { suggestions: [] };
                }

                try {
                    const items = await this.requestCompletion(model, position);
                    return {
                        suggestions: items,
                        incomplete: true  // 允许后续请求
                    };
                } catch (error) {
                    console.warn('[MonacoClangd] Completion error:', error);
                    return { suggestions: [] };
                }
            }
        });

        this.completionProvider = provider;
        console.log('[MonacoClangd] Completion provider registered');
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

        // 过滤 ANSI 控制字符和乱码
        const cleanLabel = this.cleanString(item.label);
        const cleanDetail = this.cleanString(item.detail || '');
        const cleanDocumentation = this.cleanString(
            item.documentation ?
                (typeof item.documentation === 'string' ? item.documentation : item.documentation.value) : ''
        );
        const cleanInsertText = this.cleanString(insertText);

        return {
            label: cleanLabel,
            kind: kindMap[item.kind] || monaco.languages.CompletionItemKind.Text,
            detail: cleanDetail,
            documentation: cleanDocumentation,
            insertText: cleanInsertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: item.sortText || item.label,
            filterText: item.filterText || item.label
        };
    }

    // 清理字符串中的 ANSI 控制字符和乱码
    cleanString(str) {
        if (!str) return '';

        // 移除 ANSI 转义序列
        let cleaned = str
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/\x1b\][0-9;]*\x07/g, '');

        // 移除控制字符，但保留换行符和制表符
        cleaned = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');

        // 只保留 ASCII 可打印字符、中文、换行符和制表符
        cleaned = cleaned.replace(/[^\x20-\x7E\u4e00-\u9fff\n\t\r]/g, '');

        return cleaned;
    }

    disposeCompletionProvider() {
        if (this.completionProvider) {
            this.completionProvider.dispose();
            this.completionProvider = null;
        }
    }

    // 注册悬停提示提供器
    registerHoverProvider() {
        if (!monaco) return;

        const provider = monaco.languages.registerHoverProvider('cpp', {
            provideHover: async (model, position, token) => {
                if (!this.initialized || !this.clangdWorker) {
                    return null;
                }

                try {
                    const result = await this.requestHover(model, position);
                    return result;
                } catch (error) {
                    console.warn('[MonacoClangd] Hover error:', error);
                    return null;
                }
            }
        });

        this.hoverProvider = provider;
        console.log('[MonacoClangd] Hover provider registered');
    }

    async requestHover(model, position) {
        const params = {
            textDocument: { uri: this.documentUri },
            position: { line: position.lineNumber - 1, character: position.column - 1 }
        };

        const result = await this.sendRequest('textDocument/hover', params);
        if (!result || !result.contents) return null;

        // 处理 LSP hover 结果
        let hoverContents = [];

        const processContent = (content) => {
            if (typeof content === 'string') {
                const cleaned = this.cleanString(content);
                if (cleaned) {
                    hoverContents.push({
                        value: cleaned.includes('```') ? cleaned : `\`\`\`text\n${cleaned}\n\`\`\``,
                        isTrusted: true,
                        supportHtml: false
                    });
                }
            } else if (content && typeof content === 'object') {
                if (content.kind === 'plaintext' && content.value) {
                    const cleaned = this.cleanString(content.value);
                    if (cleaned) {
                        hoverContents.push({
                            value: `\`\`\`text\n${cleaned}\n\`\`\``,
                            isTrusted: true,
                            supportHtml: false
                        });
                    }
                } else if (content.language && content.value) {
                    const cleaned = this.cleanString(content.value);
                    if (cleaned) {
                        hoverContents.push({
                            value: `\`\`\`${content.language}\n${cleaned}\n\`\`\``,
                            isTrusted: true,
                            supportHtml: false
                        });
                    }
                }
            }
        };

        if (Array.isArray(result.contents)) {
            result.contents.forEach(processContent);
        } else {
            processContent(result.contents);
        }

        if (hoverContents.length === 0) {
            return null;
        }

        return {
            range: result.range ? {
                startLineNumber: result.range.start.line + 1,
                startColumn: result.range.start.character + 1,
                endLineNumber: result.range.end.line + 1,
                endColumn: result.range.end.character + 1
            } : undefined,
            contents: hoverContents
        };
    }

    disposeHoverProvider() {
        if (this.hoverProvider) {
            this.hoverProvider.dispose();
            this.hoverProvider = null;
        }
    }

    // 注册函数提示标签提供器
    registerSignatureHelpProvider() {
        if (!monaco) return;

        const provider = monaco.languages.registerSignatureHelpProvider('cpp', {
            signatureHelpTriggerCharacters: ['(', ','],
            provideSignatureHelp: async (model, position, token, context) => {
                if (!this.initialized || !this.clangdWorker) {
                    return null;
                }

                // 检查是否在函数调用上下文中
                const lineContent = model.getLineContent(position.lineNumber);
                const beforeCursor = lineContent.substring(0, position.column - 1);
                const hasOpenParen = beforeCursor.lastIndexOf('(') > beforeCursor.lastIndexOf(')');
                const hasCloseParen = beforeCursor.lastIndexOf(')') > beforeCursor.lastIndexOf('(');

                if (!hasOpenParen || hasCloseParen) {
                    return null;
                }

                try {
                    const result = await this.requestSignatureHelp(model, position);
                    return result;
                } catch (error) {
                    console.warn('[MonacoClangd] Signature help error:', error);
                    return null;
                }
            }
        });

        this.signatureHelpProvider = provider;
        console.log('[MonacoClangd] Signature help provider registered');
    }

    async requestSignatureHelp(model, position) {
        const params = {
            textDocument: { uri: this.documentUri },
            position: { line: position.lineNumber - 1, character: position.column - 1 }
        };

        const result = await this.sendRequest('textDocument/signatureHelp', params);
        if (!result || !result.signatures || result.signatures.length === 0) {
            return null;
        }

        // 处理签名信息
        const signatures = result.signatures.map(sig => {
            let documentation = '';
            if (sig.documentation) {
                if (typeof sig.documentation === 'string') {
                    documentation = this.cleanString(sig.documentation);
                } else if (sig.documentation.value) {
                    documentation = this.cleanString(sig.documentation.value);
                }
            }

            return {
                label: this.cleanString(sig.label),
                documentation: documentation || undefined,
                parameters: sig.parameters ? sig.parameters.map(param => ({
                    label: param.label,
                    documentation: param.documentation ?
                        this.cleanString(typeof param.documentation === 'string' ? param.documentation : param.documentation.value) : undefined
                })) : []
            };
        });

        // 计算光标所在的参数索引
        const activeParameter = this.calculateActiveParameter(model, position);

        return {
            value: {
                signatures: signatures,
                activeSignature: result.activeSignature !== undefined ? result.activeSignature : 0,
                activeParameter: activeParameter
            },
            dispose: () => {}
        };
    }

    calculateActiveParameter(model, position) {
        try {
            const line = model.getLineContent(position.lineNumber);
            const cursorPos = position.column - 1;

            let parenStart = -1;
            let parenDepth = 0;

            for (let i = cursorPos - 1; i >= 0; i--) {
                if (line[i] === ')') {
                    parenDepth++;
                } else if (line[i] === '(') {
                    if (parenDepth === 0) {
                        parenStart = i;
                        break;
                    } else {
                        parenDepth--;
                    }
                }
            }

            if (parenStart === -1) {
                return 0;
            }

            let commaCount = 0;
            let inString = false;
            let stringChar = '';
            let depth = 0;

            for (let i = parenStart + 1; i < cursorPos; i++) {
                const char = line[i];

                if ((char === '"' || char === '\'') && (i === 0 || line[i - 1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        stringChar = char;
                    } else if (char === stringChar) {
                        inString = false;
                    }
                    continue;
                }

                if (inString) continue;

                if (char === '(' || char === '{' || char === '[') {
                    depth++;
                } else if (char === ')' || char === '}' || char === ']') {
                    depth--;
                }

                if (char === ',' && depth === 0) {
                    commaCount++;
                }
            }

            return commaCount;
        } catch (error) {
            console.warn('[MonacoClangd] Error calculating active parameter:', error);
            return 0;
        }
    }

    disposeSignatureHelpProvider() {
        if (this.signatureHelpProvider) {
            this.signatureHelpProvider.dispose();
            this.signatureHelpProvider = null;
        }
    }

    // 注册语义高亮提供器（使用 clangd 进行语法高亮）
    registerSemanticTokensProvider() {
        if (!monaco) return;

        // 检查是否启用了语义高亮
        const semanticEnabled = localStorage.getItem('phoi_clangd_semantic_enabled') === 'true';
        if (!semanticEnabled) {
            console.log('[MonacoClangd] Semantic tokens provider not registered (disabled in settings)');
            return;
        }

        console.log('[MonacoClangd] Registering semantic tokens provider...');

        // 定义语义高亮图例
        this.semanticTokensLegend = {
            tokenTypes: [
                'namespace',
                'type',
                'class',
                'enum',
                'interface',
                'struct',
                'typeParameter',
                'parameter',
                'variable',
                'property',
                'enumMember',
                'event',
                'function',
                'method',
                'macro',
                'keyword',
                'modifier',
                'comment',
                'string',
                'number',
                'regexp',
                'operator',
                'decorator'
            ],
            tokenModifiers: [
                'declaration',
                'definition',
                'readonly',
                'static',
                'deprecated',
                'abstract',
                'async',
                'modification',
                'documentation',
                'defaultLibrary'
            ]
        };

        // 注册语义高亮提供器
        const provider = {
            getLegend: () => {
                return this.semanticTokensLegend;
            },

            provideDocumentSemanticTokens: async (model, lastResultId, token) => {
                console.log('[MonacoClangd] Semantic tokens requested');
                if (!this.initialized || !this.clangdWorker) {
                    console.log('[MonacoClangd] Semantic tokens: not ready');
                    return null;
                }

                try {
                    const result = await this.requestSemanticTokens(model, token);
                    console.log('[MonacoClangd] Semantic tokens result:', result);
                    return result;
                } catch (error) {
                    console.warn('[MonacoClangd] Semantic tokens error:', error);
                    return null;
                }
            },

            releaseDocumentSemanticTokens: (resultId) => {
                // 清理语义 tokens 结果
            }
        };

        this.semanticTokensProvider = monaco.languages.registerDocumentSemanticTokensProvider('cpp', provider);
        console.log('[MonacoClangd] Semantic tokens provider registered');
        
        // 应用自定义语义 token 颜色
        this.applyCustomSemanticTokenColors();
    }

    applyCustomSemanticTokenColors() {
        // 使用 CSS 覆盖语义 token 颜色
        const style = document.createElement('style');
        style.id = 'clangd-semantic-token-colors';
        style.textContent = `
            /* 覆盖 function 和 method 的颜色为 #D0DCAA */
            .mtk1 { color: #D0DCAA !important; }
        `;
        
        // 移除旧的样式（如果存在）
        const oldStyle = document.getElementById('clangd-semantic-token-colors');
        if (oldStyle) {
            oldStyle.remove();
        }
        
        // 添加新样式
        document.head.appendChild(style);
        console.log('[MonacoClangd] Applied custom semantic token colors via CSS');
    }

    async requestSemanticTokens(model, token) {
        const params = {
            textDocument: { uri: this.documentUri },
            partialResultToken: null
        };

        console.log('[MonacoClangd] Requesting semantic tokens from clangd...');
        const result = await this.sendRequest('textDocument/semanticTokens/full', params);
        console.log('[MonacoClangd] Semantic tokens result from clangd:', result);
        
        if (!result || !result.data) {
            console.log('[MonacoClangd] No semantic tokens data returned');
            return null;
        }

        // 转换 LSP 语义 tokens 到 Monaco 格式
        const converted = this.convertSemanticTokens(result.data);
        console.log('[MonacoClangd] Converted semantic tokens:', converted.data.length);
        return converted;
    }

    convertSemanticTokens(lspData) {
        // LSP 语义 tokens 使用 delta 编码
        // Monaco 期望 Uint32Array 格式：[deltaLine, deltaChar, length, tokenType, tokenModifiers]
        const data = new Uint32Array(lspData);
        
        // 创建 Monaco 语义 tokens 对象
        return {
            data: data,
            resultId: null
        };
    }

    disposeSemanticTokensProvider() {
        if (this.semanticTokensProvider) {
            this.semanticTokensProvider.dispose();
            this.semanticTokensProvider = null;
        }
    }

    getStatus() {
        if (this.usingFallback) return 'fallback';
        if (this.failed) return 'failed';
        if (this.loading) return 'loading';
        if (this.initialized) return 'ready';
        return 'idle';
    }

    dispose() {
        // 清理所有 disposable
        for (const disposable of this.disposables) {
            if (disposable) disposable.dispose();
        }
        this.disposables = [];

        // 清理所有待处理的请求
        for (const [id, pending] of this.pendingRequests) {
            if (pending.timeout) {
                clearTimeout(pending.timeout);
            }
            pending.resolve(null);
        }
        this.pendingRequests.clear();

        // 清理代码补全提供器
        this.disposeCompletionProvider();

        // 清理悬停提示提供器
        this.disposeHoverProvider();

        // 清理签名帮助提供器
        this.disposeSignatureHelpProvider();

        // 清理语义高亮提供器
        this.disposeSemanticTokensProvider();

        // 清理 worker
        if (this.clangdWorker) {
            this.clangdWorker.terminate();
            this.clangdWorker = null;
        }

        // 释放 wasm Object URL
        if (this.wasmObjectUrl) {
            URL.revokeObjectURL(this.wasmObjectUrl);
            this.wasmObjectUrl = null;
        }

        // 清理 editor 引用
        this.editor = null;
        this.initialized = false;

        console.log('[MonacoClangd] Disposed');
    }

    isUsingMonacoLSP() {
        return this.initialized && !this.usingFallback && !!this.lspClient;
    }
}

// 导出单例
window.monacoClangdLSP = new MonacoClangdLSP();

async function initializeMonacoClangdIntegration() {
    const clangdEnabled = localStorage.getItem('phoi_clangd_enabled') === 'true';

    if (!clangdEnabled) {
        console.log('[MonacoClangd] Clangd 被禁用，跳过初始化');
        return;
    }

    console.log('[MonacoClangd] Starting initialization...');

    window.monacoClangdLSP.onStatusChange((status, progress, max) => {
        updateClangdStatus(status, progress, max);
    });

    try {
        await window.monacoClangdLSP.initialize(monacoEditor);
        console.log('[MonacoClangd] Initialization successful!');
    } catch (error) {
        console.error('[MonacoClangd] Initialization failed:', error.message);
    }
}

function updateClangdStatus(status, progress, max) {
    const statusElement = document.getElementById('clangd-status');
    if (statusElement) {
        const statusText = {
            'loading': '正在加载 clangd...或未启用 clangd',
            'downloading': `下载 wasm... ${Math.round(progress)}%`,
            'decompressing': `解压... ${Math.round(progress)}%`,
            'loading_module': '加载模块...',
            'initializing': '初始化 LSP...或未启用 clangd',
            'ready': '✓ clangd 已就绪',
            'failed': '✗ clangd 失败，使用备用方案',
            'fallback': '使用备用代码补全'
        }[status] || status;

        statusElement.textContent = statusText;
    }

    // 控制重启按钮的显示/隐藏
    const restartBtn = document.getElementById('restart-clangd-btn');
    if (restartBtn) {
        if (status === 'ready' || status === 'failed' || status === 'fallback') {
            restartBtn.style.display = 'inline-block';
        } else {
            restartBtn.style.display = 'none';
        }
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

    // 重启 clangd 按钮点击事件
    const restartBtn = document.getElementById('restart-clangd-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', async () => {
            if (!window.monacoClangdLSP) {
                console.warn('[MonacoClangd] MonacoClangdLSP instance not found');
                return;
            }

            const statusElement = document.getElementById('clangd-status');
            if (statusElement) {
                statusElement.textContent = '正在重启 clangd...';
            }
            restartBtn.style.display = 'none';

            try {
                // 保存 wasm Object URL
                const tempWasmObjectUrl = window.monacoClangdLSP.wasmObjectUrl;

                // 完全清理当前实例
                const lspInstance = window.monacoClangdLSP;

                // 清理所有 disposable
                for (const disposable of lspInstance.disposables) {
                    if (disposable) disposable.dispose();
                }
                lspInstance.disposables = [];

                // 清理所有待处理的请求
                for (const [id, pending] of lspInstance.pendingRequests) {
                    if (pending.timeout) clearTimeout(pending.timeout);
                    pending.resolve(null);
                }
                lspInstance.pendingRequests.clear();

                // 清理提供器
                lspInstance.disposeCompletionProvider();
                lspInstance.disposeHoverProvider();
                lspInstance.disposeSignatureHelpProvider();
                lspInstance.disposeSemanticTokensProvider();

                // 清理定时器
                if (lspInstance.semanticRefreshTimer) {
                    clearTimeout(lspInstance.semanticRefreshTimer);
                    lspInstance.semanticRefreshTimer = null;
                }
                if (lspInstance.documentSyncInterval) {
                    clearInterval(lspInstance.documentSyncInterval);
                    lspInstance.documentSyncInterval = null;
                }
                if (lspInstance.initTimeout) {
                    clearTimeout(lspInstance.initTimeout);
                    lspInstance.initTimeout = null;
                }

                // 清理 worker
                if (lspInstance.clangdWorker) {
                    lspInstance.clangdWorker.terminate();
                    lspInstance.clangdWorker = null;
                }

                // 重置状态
                lspInstance.initialized = false;
                lspInstance.failed = false;
                lspInstance.loading = false;
                lspInstance.usingFallback = false;
                lspInstance.isRestarting = false;
                lspInstance.restartCount = 0;
                lspInstance.lspClient = null;
                lspInstance.requestId = 0;
                lspInstance.semanticTokensProvider = null;
                lspInstance.semanticTokensLegend = null;

                // 重新设置 wasmObjectUrl
                lspInstance.wasmObjectUrl = tempWasmObjectUrl;

                // 重新初始化
                if (tempWasmObjectUrl) {
                    // 重新创建 worker
                    await lspInstance.createWorker(tempWasmObjectUrl);
                    lspInstance.updateStatus('initializing', 70, 100);
                    // 重新初始化 LSP
                    await lspInstance.initializeLSP();
                    // 重新打开文档
                    lspInstance.openCurrentDocument();
                    // 重新设置文档同步
                    lspInstance.setupDocumentSync();
                    lspInstance.initialized = true;
                    lspInstance.updateStatus('ready', 100, 100);
                } else {
                    // 没有 wasm Object URL，完整初始化
                    await lspInstance.initialize(monacoEditor);
                }
                console.log('[MonacoClangd] Restart successful!');
            } catch (error) {
                console.error('[MonacoClangd] Restart failed:', error);
                if (statusElement) {
                    statusElement.textContent = '✗ clangd 重启失败';
                }
                restartBtn.style.display = 'inline-block';
            }
        });
    }

    window.addEventListener('beforeunload', () => {
        if (window.monacoClangdLSP) {
            window.monacoClangdLSP.dispose();
        }
    });
});
