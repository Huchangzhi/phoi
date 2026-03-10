// clangd-worker.js - clangd Web Worker 入口
// 使用完整的 LSP 协议与 clangd 通信

console.log('[clangd-worker] Starting...');

// 导入 clangd.js
import ClangdModule from '/static/clangd/clangd.js';

console.log('[clangd-worker] ClangdModule imported:', typeof ClangdModule);

// LSP 协议辅助类（Content-Length 协议解析）
class LSPProtocol {
    constructor() {
        this.buffer = '';
        this.contentLength = -1;
    }

    write(message) {
        const content = JSON.stringify(message);
        const header = `Content-Length: ${content.length}\r\n\r\n`;
        return header + content;
    }

    parse(chunk) {
        this.buffer += chunk;
        const messages = [];

        while (true) {
            if (this.contentLength === -1) {
                const headerEnd = this.buffer.indexOf('\r\n\r\n');
                if (headerEnd === -1) break;

                const header = this.buffer.substring(0, headerEnd);
                const lengthMatch = header.match(/Content-Length: (\d+)/);
                if (!lengthMatch) {
                    this.buffer = this.buffer.substring(headerEnd + 4);
                    continue;
                }

                this.contentLength = parseInt(lengthMatch[1]);
                this.buffer = this.buffer.substring(headerEnd + 4);
            }

            if (this.buffer.length >= this.contentLength) {
                const content = this.buffer.substring(0, this.contentLength);
                this.buffer = this.buffer.substring(this.contentLength);
                this.contentLength = -1;

                try {
                    messages.push(JSON.parse(content));
                } catch (e) {
                    console.error('[clangd-worker] Failed to parse LSP message:', e);
                }
            } else {
                break;
            }
        }

        return messages;
    }
}

const protocol = new LSPProtocol();
let clangdInstance = null;
let stdinChunks = [];
let currentStdinChunk = [];
const textEncoder = new TextEncoder();
let resolveStdinReady = () => {};

const stdin = () => {
    if (currentStdinChunk.length === 0) {
        if (stdinChunks.length === 0) {
            console.error('[clangd-worker] Try to fetch exhausted stdin');
            return null;
        }
        const nextChunk = stdinChunks.shift();
        currentStdinChunk.push(...textEncoder.encode(nextChunk), null);
    }
    return currentStdinChunk.shift();
};

const stdinReady = async () => {
    if (stdinChunks.length === 0) {
        return new Promise(resolve => resolveStdinReady = resolve);
    }
};

const jsonStream = {
    buffer: '',
    insert: (charCode) => {
        const char = String.fromCharCode(charCode);
        jsonStream.buffer += char;
        if (jsonStream.buffer.endsWith('\r\n\r\n')) {
            const headerEnd = jsonStream.buffer.indexOf('\r\n\r\n');
            const header = jsonStream.buffer.substring(0, headerEnd);
            const lengthMatch = header.match(/Content-Length: (\d+)/i);
            if (lengthMatch) {
                const contentLength = parseInt(lengthMatch[1]);
                const contentStart = headerEnd + 4;
                if (jsonStream.buffer.length >= contentStart + contentLength) {
                    const content = jsonStream.buffer.substring(contentStart, contentStart + contentLength);
                    jsonStream.buffer = jsonStream.buffer.substring(contentStart + contentLength);
                    try {
                        return JSON.parse(content);
                    } catch (e) {
                        console.error('[clangd-worker] Failed to parse JSON:', e);
                    }
                }
            }
        }
        return null;
    }
};

const stdout = (charCode) => {
    const msg = jsonStream.insert(charCode);
    if (msg) {
        console.log('[clangd-worker] LSP response:', msg.id ? 'Response #' + msg.id : msg.method, msg.result !== undefined ? 'result=' + JSON.stringify(msg.result).substring(0, 100) : '');
        self.postMessage({ type: 'lsp', message: msg });
    }
};

const stderr = (charCode) => {
    // 移除 stderr 输出到控制台
    // console.log('[clangd-worker] stderr:', String.fromCharCode(charCode));
};

const onAbort = () => {
    console.error('[clangd-worker] clangd aborted');
};

// 初始化 clangd
async function initClangd(wasmUrl) {
    console.log('[clangd-worker] Initializing clangd...');

    const Module = await ClangdModule({
        locateFile: (path) => path === 'clangd.wasm' ? wasmUrl : path,
        thisProgram: '/usr/bin/clangd',
        stdinReady,
        stdin,
        stdout,
        stderr,
        onExit: onAbort,
        onAbort,
        // 增加内存配置
        INITIAL_MEMORY: 2 * 1024 * 1024 * 1024, // 2GB 初始内存
        MAXIMUM_MEMORY: 4 * 1024 * 1024 * 1024, // 4GB 最大内存
        ALLOW_MEMORY_GROWTH: true,
    });

    clangdInstance = Module;

    // 设置 clangd 编译参数
    const flags = [
        '--target=wasm32-wasi',
        '-isystem/usr/include/c++/v1',
        '-isystem/usr/include/wasm32-wasi/c++/v1',
        '-isystem/usr/include',
        '-isystem/usr/include/wasm32-wasi',
        '-xc++',
        '-std=c++20',
        '-pedantic-errors',
        '-Wall'
    ];

    // 写入 .clangd 配置文件
    Module.FS.writeFile('/home/web_user/.clangd', JSON.stringify({
        CompileFlags: { Add: flags }
    }));

    // 写入空的主文件
    Module.FS.writeFile('/home/web_user/main.cpp', '');

    console.log('[clangd-worker] Starting clangd server...');

    // 启动 clangd
    Module.callMain([]);

    console.log('[clangd-worker] clangd started!');

    // 设置发送函数
    sendToClangd = (data) => {
        const content = protocol.write(data);
        stdinChunks.push(content);
        resolveStdinReady();
    };

    return Module;
}

let sendToClangd = null;

self.onmessage = async function(e) {
    const { type, wasmUrl, message } = e.data;

    if (type === 'init') {
        try {
            await initClangd(wasmUrl);
            self.postMessage({ type: 'ready' });
        } catch (err) {
            console.error('[clangd-worker] Init error:', err);
            self.postMessage({ type: 'error', error: err.message });
        }
    } else if (type === 'lsp' && sendToClangd) {
        console.log('[clangd-worker] Sending to clangd:', message.method || 'notification');
        sendToClangd(message);
    }
};
