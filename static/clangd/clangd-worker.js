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
        // 添加 null 终止符，这是 Emscripten 期望的格式
        currentStdinChunk.push(...textEncoder.encode(nextChunk), null);
    }
    return currentStdinChunk.shift();
};

const stdinReady = async () => {
    if (stdinChunks.length === 0) {
        return new Promise(resolve => {
            resolveStdinReady = resolve;
        });
    }
};

const jsonStream = {
    buffer: '',
    insert: (charCode) => {
        const char = String.fromCharCode(charCode);
        jsonStream.buffer += char;
        
        // 循环解析所有完整的消息
        while (true) {
            const headerEnd = jsonStream.buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1) {
                return null;
            }
            
            const header = jsonStream.buffer.substring(0, headerEnd);
            const lengthMatch = header.match(/Content-Length: (\d+)/i);
            
            if (!lengthMatch) {
                // 无效的头部，清空缓冲
                console.warn('[clangd-worker] Invalid LSP header:', header.substring(0, 100));
                jsonStream.buffer = jsonStream.buffer.substring(headerEnd + 4);
                continue;
            }
            
            const contentLength = parseInt(lengthMatch[1]);
            const contentStart = headerEnd + 4;
            
            if (jsonStream.buffer.length < contentStart + contentLength) {
                // 数据不完整，等待更多
                return null;
            }
            
            const content = jsonStream.buffer.substring(contentStart, contentStart + contentLength);
            jsonStream.buffer = jsonStream.buffer.substring(contentStart + contentLength);
            
            try {
                const msg = JSON.parse(content);
                console.log('[clangd-worker] Parsed LSP message:', msg.id ? 'Response #' + msg.id : msg.method);
                return msg;
            } catch (e) {
                console.error('[clangd-worker] Failed to parse JSON:', e, 'Content:', content.substring(0, 100));
                return null;
            }
        }
    }
};

const stdout = async (charCode) => {
    const msg = jsonStream.insert(charCode);
    if (msg) {
        console.log('[clangd-worker] LSP response:', msg.id ? 'Response #' + msg.id : msg.method);
        self.postMessage({ type: 'lsp', message: msg });
    }
};

const stderr = async (charCode) => {
    // 静默处理 stderr
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

    // 创建 bits/stdc++.h 虚拟文件
    // 注意：移除 csetjmp/setjmp.h 等需要异常处理的头文件
    // 这些头文件在 WASM 环境中需要 -mllvm -wasm-enable-sjlj 支持
    const stdcPlusPlusContent = `// bits/stdc++.h - Virtual header for clangd
// This file is used to satisfy clangd's dependency resolution
// 注意：移除了需要 WASM 异常处理支持的头文件
#ifndef _GLIBCXX_BITS_STDCC_H
#define _GLIBCXX_BITS_STDCC_H

// C++ 标准库头文件
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <deque>
#include <unordered_map>
#include <unordered_set>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <climits>
#include <cctype>
#include <cassert>
#include <iomanip>
#include <fstream>
#include <sstream>
#include <bitset>
#include <list>
#include <array>
#include <tuple>
#include <utility>
#include <memory>
#include <functional>
#include <iterator>
#include <stdexcept>
#include <exception>
#include <new>
#include <typeinfo>
#include <type_traits>
#include <chrono>
#include <random>
#include <regex>
#include <atomic>
// #include <mutex>              // 需要线程支持
// #include <thread>             // 需要线程支持
// #include <condition_variable> // 需要线程支持
// #include <future>             // 需要线程支持
#include <valarray>
#include <complex>
#include <numeric>
#include <initializer_list>
#include <cfenv>
#include <cfloat>
#include <cinttypes>
#include <clocale>
// #include <csetjmp>            // 需要异常处理支持，已移除
// #include <csignal>            // 可能有问题，已移除
#include <cstdarg>
#include <cstddef>
#include <cstdint>
#include <cwchar>
#include <cwctype>
// #include <tgmath.h>           // 可能有问题，已移除

// C 标准库头文件（WASM 兼容的）
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <limits.h>
#include <ctype.h>
#include <math.h>
#include <float.h>
#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>

#endif // _GLIBCXX_BITS_STDCC_H
`;

    // 写入虚拟的 bits/stdc++.h 文件
    try {
        Module.FS.createPath('/usr', 'include', true, true);
        Module.FS.createPath('/usr/include', 'bits', true, true);
        Module.FS.writeFile('/usr/include/bits/stdc++.h', stdcPlusPlusContent);
        console.log('[clangd-worker] Created virtual bits/stdc++.h');
    } catch (e) {
        console.warn('[clangd-worker] Could not create bits/stdc++.h:', e);
    }

    // 写入 .clangd 配置文件
    Module.FS.writeFile('/home/web_user/.clangd', JSON.stringify({
        CompileFlags: { Add: flags }
    }));

    // 写入空的主文件
    Module.FS.writeFile('/home/web_user/main.cpp', '');

    console.log('[clangd-worker] Starting clangd server...');

    // 设置发送函数 - 必须在 callMain 之前设置
    sendToClangd = (data) => {
        // 按照 TypeFox 的方式，分三部分 push
        const body = JSON.stringify(data);
        const header = `Content-Length: ${body.length}\r\n`;
        const delimiter = '\r\n';
        stdinChunks.push(header, delimiter, body);
        resolveStdinReady();
    };

    // 启动 clangd - 这会阻塞直到 clangd 进入事件循环
    // Emscripten 的 Asyncify 会在 clangd 等待 stdin 时暂停执行
    // 让 JavaScript 事件循环继续运行
    Module.callMain([]);
    
    console.log('[clangd-worker] clangd started!');

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
        sendToClangd(message);
    }
};
