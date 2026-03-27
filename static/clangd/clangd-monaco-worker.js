// clangd-monaco-worker.js - 用于 Monaco 内置 LSP 客户端的 clangd Worker
// 使用 JSON-RPC 消息格式与 Monaco 通信

console.log('[clangd-monaco-worker] Starting...');

// 导入 clangd.js
import ClangdModule from '/static/clangd/clangd.js';

console.log('[clangd-monaco-worker] ClangdModule imported:', typeof ClangdModule);

// JSON-RPC 消息处理
class JSONRPCProtocol {
    constructor() {
        this.requestId = 0;
        this.pendingRequests = new Map();
    }

    // 发送 JSON-RPC 请求
    createRequest(method, params) {
        const id = ++this.requestId;
        return {
            jsonrpc: '2.0',
            id,
            method,
            params
        };
    }

    // 发送通知（不需要响应）
    createNotification(method, params) {
        return {
            jsonrpc: '2.0',
            method,
            params
        };
    }
}

const protocol = new JSONRPCProtocol();
let clangdInstance = null;
let stdinChunks = [];
let currentStdinChunk = [];
const textEncoder = new TextEncoder();
let resolveStdinReady = () => {};

// stdin 实现
const stdin = () => {
    if (currentStdinChunk.length === 0) {
        if (stdinChunks.length === 0) {
            return null;
        }
        const nextChunk = stdinChunks.shift();
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

// stdout 实现 - 发送到 clangd
const stdout = (charCode) => {
    const char = String.fromCharCode(charCode);
    jsonStream.buffer += char;

    // 尝试解析完整的 JSON-RPC 消息
    while (true) {
        const headerEnd = jsonStream.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;

        const header = jsonStream.buffer.substring(0, headerEnd);
        const lengthMatch = header.match(/Content-Length: (\d+)/);
        if (!lengthMatch) {
            jsonStream.buffer = jsonStream.buffer.substring(headerEnd + 4);
            continue;
        }

        const contentLength = parseInt(lengthMatch[1]);
        const contentStart = headerEnd + 4;
        const contentEnd = contentStart + contentLength;

        if (jsonStream.buffer.length < contentEnd) break;

        const content = jsonStream.buffer.substring(contentStart, contentEnd);
        jsonStream.buffer = jsonStream.buffer.substring(contentEnd);

        try {
            const message = JSON.parse(content);
            // 发送到主线程
            self.postMessage({ type: 'lsp', message });
        } catch (e) {
            console.error('[clangd-monaco-worker] Failed to parse message:', e);
        }
    }
};

const jsonStream = {
    buffer: ''
};

// stderr 实现 - 收集完整行后输出
const stderrBuffer = {
    buffer: ''
};

const stderr = (charCode) => {
    const char = String.fromCharCode(charCode);
    if (char === '\n') {
        console.log('[clangd-monaco-worker] stderr:', stderrBuffer.buffer);
        stderrBuffer.buffer = '';
    } else {
        stderrBuffer.buffer += char;
    }
};

// 错误处理
let clangdStarted = false;

const onAbort = (code) => {
    console.error('[clangd-monaco-worker] Aborted with code:', code);
    if (!clangdStarted) {
        self.postMessage({ type: 'error', code });
    }
};

let sendToClangd = null;

// 初始化 clangd
async function initClangd(wasmUrl) {
    console.log('[clangd-monaco-worker] Initializing clangd...');

    const Module = await ClangdModule({
        locateFile: (path) => path === 'clangd.wasm' ? wasmUrl : path,
        thisProgram: '/usr/bin/clangd',
        stdinReady,
        stdin,
        stdout,
        stderr,
        onExit: onAbort,
        onAbort,
        INITIAL_MEMORY: 2 * 1024 * 1024 * 1024,
        MAXIMUM_MEMORY: 4 * 1024 * 1024 * 1024,
        ALLOW_MEMORY_GROWTH: true,
    });

    clangdInstance = Module;

    // clangd 编译参数
    const flags = [
        '--target=wasm32-wasi',
        '-isystem/usr/include/c++/v1',
        '-isystem/usr/include/wasm32-wasi/c++/v1',
        '-isystem/usr/include',
        '-isystem/usr/include/wasm32-wasi',
        '-xc++',
        '-std=c++14',
        '-pedantic-errors',
        '-Wall'
    ];

    // 创建虚拟文件系统
    try {
        Module.FS.createPath('/usr', 'include', true, true);
        Module.FS.createPath('/usr/include', 'bits', true, true);
        
        const stdcPlusPlusContent = `// bits/stdc++.h - Virtual header for clangd
#ifndef _GLIBCXX_BITS_STDCC_H
#define _GLIBCXX_BITS_STDCC_H

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
#include <valarray>
#include <complex>
#include <numeric>
#include <initializer_list>
#include <cfenv>
#include <cfloat>
#include <cinttypes>
#include <clocale>
#include <cstdarg>
#include <cstddef>
#include <cstdint>
#include <cwchar>
#include <cwctype>

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

#endif
`;
        Module.FS.writeFile('/usr/include/bits/stdc++.h', stdcPlusPlusContent);
        console.log('[clangd-monaco-worker] Created virtual bits/stdc++.h');
    } catch (e) {
        console.warn('[clangd-monaco-worker] Could not create bits/stdc++.h:', e);
    }

    Module.FS.writeFile('/home/web_user/.clangd', JSON.stringify({
        CompileFlags: { Add: flags }
    }));
    Module.FS.writeFile('/home/web_user/main.cpp', '');

    console.log('[clangd-monaco-worker] Starting clangd server...');

    sendToClangd = (data) => {
        const body = JSON.stringify(data);
        const header = `Content-Length: ${body.length}\r\n`;
        const delimiter = '\r\n';
        stdinChunks.push(header, delimiter, body);
        resolveStdinReady();
    };

    // 启动 clangd - 使用空参数列表
    // callMain 会阻塞直到 clangd 进入事件循环
    Module.callMain([]);

    // 如果 callMain 返回，说明启动成功（clangd 会后台运行）
    clangdStarted = true;
    console.log('[clangd-monaco-worker] Clangd started!');
    self.postMessage({ type: 'ready' });
}

// 处理来自主线程的消息
self.onmessage = async (e) => {
    const { type, message, wasmUrl } = e.data;

    if (type === 'init') {
        try {
            await initClangd(wasmUrl);
        } catch (error) {
            console.error('[clangd-monaco-worker] Init failed:', error);
            self.postMessage({ type: 'error', error: error.message });
        }
        return;
    }

    if (type === 'lsp' && sendToClangd) {
        sendToClangd(message);
    }
};

console.log('[clangd-monaco-worker] Waiting for init message...');
