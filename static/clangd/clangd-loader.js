// clangd-loader.js - clangd.js 的兼容加载器
// 用于在不支持 import.meta 的环境中加载 clangd

(function() {
    // 模拟 import.meta.url
    const originalImportMeta = typeof import !== 'undefined' ? import.meta : undefined;
    
    // 创建 Module 的全局访问
    var Module = {};
    
    // 保存原始的 Module
    if (typeof window !== 'undefined' && window.Module) {
        Module = window.Module;
    }
    
    // 导出到全局
    window.ClangdModule = Module;
    
    // 加载 clangd.js
    const script = document.createElement('script');
    script.src = '/static/clangd/clangd.js';
    script.onload = function() {
        console.log('[ClangdLoader] clangd.js loaded');
    };
    script.onerror = function() {
        console.error('[ClangdLoader] Failed to load clangd.js');
    };
    document.head.appendChild(script);
})();
