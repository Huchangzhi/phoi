/**
 * Code Features - 代码特征提取模块
 * 用于 AI 模型打分的特征输入
 */

class CodeFeatures {
    constructor() {
        // C++ 关键字
        this.keywords = new Set([
            'int', 'void', 'double', 'float', 'char', 'bool', 'long', 'short',
            'unsigned', 'signed', 'const', 'static', 'extern', 'register',
            'if', 'else', 'switch', 'case', 'default', 'break', 'continue',
            'for', 'while', 'do', 'return', 'goto',
            'struct', 'class', 'union', 'enum', 'namespace', 'using',
            'public', 'private', 'protected', 'virtual', 'friend',
            'try', 'catch', 'throw', 'new', 'delete',
            'true', 'false', 'nullptr', 'this',
            'auto', 'decltype', 'constexpr', 'template', 'typename',
            'include', 'define', 'ifdef', 'ifndef', 'endif', 'pragma'
        ]);

        // OI 常用变量名
        this.commonVars = new Set([
            'n', 'm', 'k', 'x', 'y', 'z', 'a', 'b', 'c', 'd',
            'i', 'j', 't', 'cnt', 'ans', 'sum', 'max', 'min',
            'vis', 'dp', 'dfs', 'bfs', 'lca', 'gcd', 'lcm'
        ]);

        // STL 容器
        this.stlContainers = new Set([
            'vector', 'string', 'map', 'set', 'queue', 'stack',
            'deque', 'list', 'array', 'priority_queue',
            'unordered_map', 'unordered_set', 'multiset', 'multimap'
        ]);

        // 常用头文件
        this.commonHeaders = new Set([
            'iostream', 'cstdio', 'cstring', 'cmath', 'algorithm',
            'vector', 'string', 'map', 'set', 'queue', 'stack',
            'cstdlib', 'climits', 'cctype', 'iomanip', 'fstream'
        ]);
    }

    /**
     * 提取代码特征
     * @param {string} code - 完整代码
     * @param {number} cursorPos - 光标位置
     * @param {string} prefix - 当前输入的前缀
     * @returns {Object} 特征对象
     */
    extract(code, cursorPos, prefix = '') {
        const textBefore = code.substring(0, cursorPos);
        const lines = textBefore.split('\n');
        const currentLine = lines[lines.length - 1] || '';

        return {
            // 基础特征
            prefix: prefix,
            prefixLength: prefix.length,
            
            // 上下文特征
            isInInclude: this.checkInIncludeContext(textBefore, currentLine),
            isAfterDot: currentLine.trimEnd().endsWith('.'),
            isAfterHash: currentLine.trimEnd().endsWith('#'),
            isForLoop: this.checkInForLoop(textBefore, currentLine),
            isDeclaration: this.checkInDeclaration(textBefore, currentLine),
            
            // 语法特征
            nestingLevel: this.getNestingLevel(textBefore),
            tokenType: this.getTokenType(prefix, textBefore),
            
            // 前序 token
            prevTokens: this.getPreviousTokens(textBefore, 3),
            
            // 变量类型推断
            variableType: this.inferVariableType(textBefore, prefix),
            
            // OI 特定特征
            isCommonVar: this.commonVars.has(prefix),
            isKeyword: this.keywords.has(prefix),
            isSTL: this.stlContainers.has(prefix),
            
            // 头文件特征
            includedHeaders: this.getIncludedHeaders(code)
        };
    }

    /**
     * 检查是否在 #include 上下文中
     */
    checkInIncludeContext(textBefore, currentLine) {
        return /#include\s*</.test(currentLine) || 
               /#include\s*$/.test(currentLine) ||
               /#include\s+[^<"]*$/.test(currentLine);
    }

    /**
     * 检查是否在 for 循环上下文中
     */
    checkInForLoop(textBefore, currentLine) {
        return /\bfor\s*\([^)]*$/.test(currentLine) ||
               /\bfor\s*$/.test(currentLine);
    }

    /**
     * 检查是否在声明语句中
     */
    checkInDeclaration(textBefore, currentLine) {
        // 匹配类型声明
        return /^\s*(int|long|double|float|char|bool|auto|void|const|unsigned|signed)\s+\w*$/.test(currentLine) ||
               /^\s*(vector|string|map|set|queue|stack)\s*<[^>]*>\s+\w*$/.test(currentLine) ||
               /^\s*(vector|string|map|set|queue|stack)\s+\w*$/.test(currentLine);
    }

    /**
     * 获取嵌套层数
     */
    getNestingLevel(textBefore) {
        const openBraces = (textBefore.match(/\{/g) || []).length;
        const closeBraces = (textBefore.match(/\}/g) || []).length;
        return Math.max(0, openBraces - closeBraces);
    }

    /**
     * 获取 token 类型
     */
    getTokenType(token, textBefore) {
        if (!token) return 'empty';
        if (this.keywords.has(token)) return 'keyword';
        if (this.commonVars.has(token)) return 'common_var';
        if (this.stlContainers.has(token)) return 'stl';
        if (/^[A-Z]/.test(token)) return 'type';
        if (/^\d/.test(token)) return 'number';
        return 'identifier';
    }

    /**
     * 获取前 N 个 token
     */
    getPreviousTokens(textBefore, count = 3) {
        // 移除注释
        const cleanText = textBefore.replace(/\/\/.*$/gm, '');
        // 提取 token
        const tokens = cleanText.match(/[a-zA-Z_]\w*|[+\-*/%=<>!&|^~?:;,.()\[\]{}]/g) || [];
        // 返回最后 N 个
        return tokens.slice(-count);
    }

    /**
     * 推断变量类型
     */
    inferVariableType(textBefore, varName) {
        if (!varName) return 'unknown';
        
        // 查找变量声明
        const declPatterns = [
            new RegExp(`\\b(int|long|long\\s+long|double|float|char|bool)\\s+${varName}\\b`, 'g'),
            new RegExp(`\\b(vector|string|map|set|queue|stack)\\s*(?:<[^>]*>)?\\s+${varName}\\b`, 'g'),
            new RegExp(`\\b(auto)\\s+${varName}\\s*=\\s*([^;]+)`, 'g')
        ];
        
        for (const pattern of declPatterns) {
            const match = pattern.exec(textBefore);
            if (match) {
                return match[1];
            }
        }
        
        return 'unknown';
    }

    /**
     * 获取已包含的头文件
     */
    getIncludedHeaders(code) {
        const headers = new Set();
        const matches = code.matchAll(/#include\s*<([^>]+)>/g);
        for (const match of matches) {
            headers.add(match[1]);
        }
        return headers;
    }

    /**
     * 将特征转换为数值向量（用于模型推理）
     */
    toVector(features) {
        const vector = [];
        
        // 数值特征
        vector.push(features.prefixLength);
        vector.push(features.nestingLevel);
        
        // 布尔特征（转换为 0/1）
        vector.push(features.isInInclude ? 1 : 0);
        vector.push(features.isAfterDot ? 1 : 0);
        vector.push(features.isAfterHash ? 1 : 0);
        vector.push(features.isForLoop ? 1 : 0);
        vector.push(features.isDeclaration ? 1 : 0);
        vector.push(features.isCommonVar ? 1 : 0);
        vector.push(features.isKeyword ? 1 : 0);
        vector.push(features.isSTL ? 1 : 0);
        
        // token 类型编码
        const tokenTypeMap = {
            'empty': 0, 'keyword': 1, 'common_var': 2, 'stl': 3,
            'type': 4, 'number': 5, 'identifier': 6
        };
        vector.push(tokenTypeMap[features.tokenType] || 0);
        
        // 变量类型编码
        const varTypeMap = {
            'unknown': 0, 'int': 1, 'long': 2, 'double': 3,
            'float': 4, 'char': 5, 'bool': 6, 'vector': 7,
            'string': 8, 'map': 9, 'set': 10, 'auto': 11
        };
        vector.push(varTypeMap[features.variableType] || 0);
        
        return vector;
    }
}

// 导出到全局
window.CodeFeatures = CodeFeatures;
