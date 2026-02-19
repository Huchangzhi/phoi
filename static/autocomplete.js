// Define C++ keywords for autocompletion
const cppKeywords = [
    // Control Flow
    'if', 'else', 'switch', 'case', 'default', 'break', 'continue', 'goto',
    // Loops
    'while', 'do', 'for',
    // Functions
    'return', 'extern', 'inline',
    // Data Types
    'void', 'bool', 'char', 'wchar_t', 'char8_t', 'char16_t', 'char32_t', 'short', 'int', 'long', 'float', 'double',
    'signed', 'unsigned', 'typedef',
    // Modifiers
    'const', 'volatile', 'static', 'auto', 'register', 'mutable',
    // Classes & Objects
    'class', 'struct', 'union', 'enum', 'public', 'private', 'protected', 'friend', 'virtual', 'override', 'final',
    'this', 'explicit', 'constexpr', 'consteval', 'constinit',
    // Inheritance
    'public', 'private', 'protected', 'virtual', 'override',
    // Storage Classes
    'static', 'extern', 'register', 'mutable',
    // Operators
    'new', 'delete', 'sizeof', 'typeid', 'dynamic_cast', 'static_cast', 'reinterpret_cast', 'const_cast',
    // Namespace
    'namespace', 'using',
    // Templates
    'template', 'typename', 'decltype', 'concept', 'requires',
    // Exception Handling
    'try', 'catch', 'throw', 'noexcept',
    // Others
    'true', 'false', 'nullptr', 'asm', 'thread_local', 'alignas', 'alignof'
];

// 智能排序辅助函数 - 根据用户习惯和上下文优化建议顺序
function sortSuggestionsByIntelligence(suggestions, prefix = '') {
    if (!suggestions || suggestions.length === 0) return suggestions;
    
    // 如果 HabitTracker 可用，使用它进行排序
    if (typeof HabitTracker !== 'undefined' && HabitTracker.sortSuggestions) {
        return HabitTracker.sortSuggestions(suggestions, prefix);
    }
    
    // 否则使用基础智能排序
    const priorityOrder = {
        // 最高优先级：用户定义的变量
        'Variable': 0,
        'Function': 1,
        'Method': 2,
        // 中等优先级：类型和类
        'Class': 3,
        'Struct': 4,
        'Interface': 5,
        // 较低优先级：关键字
        'Keyword': 10,
        'Snippet': 11,
        // 最低优先级：其他
        'Module': 20,
        'Property': 21,
        'Field': 22
    };
    
    return suggestions.sort((a, b) => {
        // 首先按类型优先级排序
        const kindA = monaco.languages.CompletionItemKind[a.kind] || a.kind;
        const kindB = monaco.languages.CompletionItemKind[b.kind] || b.kind;
        const priorityA = priorityOrder[kindA] ?? 100;
        const priorityB = priorityOrder[kindB] ?? 100;
        
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        
        // 同类型时，优先匹配前缀（前缀匹配度高的排前面）
        if (prefix) {
            const labelA = a.label.toLowerCase();
            const labelB = b.label.toLowerCase();
            const prefixLower = prefix.toLowerCase();
            
            // 完全匹配前缀的排前面
            const startsWithA = labelA.startsWith(prefixLower);
            const startsWithB = labelB.startsWith(prefixLower);
            
            if (startsWithA && !startsWithB) return -1;
            if (!startsWithA && startsWithB) return 1;
            
            // 都匹配或都不匹配时，按长度排序（短的排前面）
            return labelA.length - labelB.length;
        }
        
        // 默认按标签字母顺序
        return a.label.localeCompare(b.label);
    });
}

// 记录用户选择并更新建议
function recordAndSortSuggestions(suggestions, prefix = '', context = '') {
    if (typeof HabitTracker !== 'undefined' && HabitTracker.recordSelection) {
        // 记录用户最可能选择的前 3 个建议
        const topSuggestions = suggestions.slice(0, 3);
        topSuggestions.forEach(s => {
            HabitTracker.recordSelection(s.label, prefix, context);
        });
    }
    return sortSuggestionsByIntelligence(suggestions, prefix);
}

// Define C++ STL containers and their methods for autocompletion
const stlContainers = {
    'vector': {
        functions: ['assign', 'at', 'insert', 'emplace', 'erase', 'push_back', 'emplace_back', 'pop_back', 'resize', 'swap', 'clear', 'begin', 'end', 'rbegin', 'rend','front', 'back','empty', 'size', 'max_size', 'reserve'],
        properties: ['data', 'get_allocator', 'capacity', 'shrink_to_fit', 'operator[]']
    },
    'queue': {
        functions: ['push', 'emplace', 'pop', 'swap', 'empty', 'size', 'front', 'back'],
        properties: []
    },
    'stack': {
        functions: ['push', 'emplace', 'pop', 'swap', 'empty', 'size', 'top'],
        properties: []
    },
    'set': {
        functions: ['find', 'count', 'lower_bound', 'upper_bound', 'equal_range', 'insert', 'emplace', 'emplace_hint', 'erase', 'clear', 'swap', 'extract', 'merge', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['key_comp', 'value_comp', 'get_allocator']
    },
    'multiset': {
        functions: ['find', 'count', 'lower_bound', 'upper_bound', 'equal_range', 'insert', 'emplace', 'emplace_hint', 'erase', 'clear', 'swap', 'extract', 'merge', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['key_comp', 'value_comp', 'get_allocator']
    },
    'map': {
        functions: ['at', 'insert', 'insert_or_assign', 'emplace', 'emplace_hint', 'try_emplace', 'erase', 'swap', 'extract', 'merge', 'count', 'find', 'contains', 'lower_bound', 'upper_bound', 'equal_range', 'begin', 'end', 'rbegin', 'rend', 'cbegin', 'cend', 'crbegin', 'crend', 'empty', 'size', 'max_size', 'clear'],
        properties: ['operator[]', 'key_comp', 'value_comp', 'get_allocator']
    },
    'multimap': {
        functions: ['empty', 'size', 'max_size', 'clear', 'insert', 'emplace', 'emplace_hint', 'erase', 'swap', 'extract', 'merge', 'count', 'find', 'contains', 'lower_bound', 'upper_bound', 'equal_range', 'begin', 'end', 'rbegin', 'rend', 'cbegin', 'cend', 'crbegin', 'crend'],
        properties: ['key_comp', 'value_comp', 'get_allocator']
    },
    'unordered_set': {
        functions: ['find', 'count', 'equal_range', 'insert', 'emplace', 'emplace_hint', 'insert_or_assign', 'try_emplace', 'erase', 'clear', 'swap', 'extract', 'merge', 'begin', 'end', 'cbegin', 'cend', 'empty', 'size', 'max_size'],
        properties: ['bucket_count', 'max_bucket_count', 'bucket_size', 'bucket', 'load_factor', 'max_load_factor', 'rehash', 'reserve', 'hash_function', 'key_eq', 'get_allocator', 'contains']
    },
    'unordered_map': {
        functions: ['at', 'insert', 'insert_or_assign', 'emplace', 'emplace_hint', 'try_emplace', 'erase', 'swap', 'extract', 'merge', 'count', 'find', 'contains', 'equal_range', 'begin', 'end', 'cbegin', 'cend', 'empty', 'size', 'max_size', 'clear'],
        properties: ['operator[]', 'bucket_count', 'max_bucket_count', 'bucket_size', 'bucket', 'load_factor', 'max_load_factor', 'rehash', 'reserve', 'hash_function', 'key_eq', 'get_allocator']
    },
    'priority_queue': {
        functions: ['push', 'emplace', 'pop', 'swap','empty', 'size', 'top'],
        properties: []
    },
    'deque': {
        functions: ['front', 'back', 'assign', 'at', 'insert', 'emplace', 'erase', 'push_back', 'emplace_back', 'pop_back', 'resize', 'swap', 'clear', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['operator[]', 'get_allocator', 'shrink_to_fit']
    },
    'list': {
        functions: ['front', 'back', 'assign', 'insert', 'emplace', 'erase', 'push_front', 'emplace_front', 'pop_front', 'resize', 'swap', 'merge', 'splice', 'remove', 'remove_if', 'reverse', 'unique', 'sort', 'clear', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size'],
        properties: ['get_allocator']
    },
    'array': {
        functions: ['at', 'swap', 'fill', 'begin', 'end', 'rbegin', 'rend', 'cbegin', 'cend', 'crbegin', 'crend', 'front', 'back', 'empty', 'size', 'max_size'],
        properties: ['operator[]', 'data']
    },
    'pair': {
        functions: [],
        properties: ['first', 'second']
    }
};

// Define C++ standard library functions for autocompletion
const cppFunctions = {
    // C-style I/O functions
    'cstdio': [
        'printf', 'scanf', 'fprintf', 'fscanf', 'sscanf', 'sprintf', 'snprintf',
        'getchar', 'putchar', 'gets', 'puts', 'fgets', 'fputs', 'fclose', 'fflush'
    ],
    // Standard library functions
    'cstdlib': [
        'malloc', 'calloc', 'realloc', 'free', 'abs', 'labs', 'llabs', 'atoi', 'atol', 'atoll',
        'atof', 'rand', 'srand', 'qsort', 'bsearch'
    ],
    // String functions
    'cstring': [
        'memcpy', 'memset', 'strcpy', 'strncpy', ' strcat', 'strncat',
        'memcmp', 'strcmp', 'strncmp', 'strlen', 'strchr', 'strstr'
    ],
    // Utility functions
    'utility': [
        'pair', 'make_pair', 'swap', 'forward', 'move'
    ],
    // Algorithm functions
    'algorithm': [
        'sort', 'reverse', 'lower_bound', 'upper_bound', 'find', 'count', 'max', 'min',
        'max_element', 'min_element', 'unique', 'remove', 'fill', 'next_permutation', 'prev_permutation'
    ],
    // Memory functions
    'memory': [
        'make_unique', 'make_shared', 'unique_ptr', 'shared_ptr', 'weak_ptr'
    ],
    'cmath': [
        'min', 'max', 'sqrt', 'pow'
    ],
};

// Define common C++ objects like cin/cout
const cppObjects = {
    'iostream': [
        'cin', 'cout', 'cerr', 'clog', 'endl', 'ws', 'flush'
    ],
    'iomanip': [
        'setw', 'setprecision', 'setfill', 'setbase', 'hex', 'dec', 'oct', 'fixed', 'scientific'
    ],
    'queue': [],
    'vector': [],
    'set': [],
    'map': [],
    'deque': [],
    'bits/stdc++.h': [],
};

// Function to extract variable names from code
function extractVariableNames(code) {
    const variables = new Set();
    let match;

    // Match variable declarations: type name or type name[N] or type name(...);
    // This regex looks for common patterns like: int varName, vector<int> varName, etc.
    // Updated to handle multiple variables in one declaration like: int a, b, c;
    const varDeclarationRegex = /\b(auto|int|float|double|char|bool|long|short|unsigned|signed|void|size_t|string|vector|array|queue|stack|set|map|unordered_map|unordered_set|list|deque|priority_queue|complex|pair|[\w:<>]+)\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)/g;

    while ((match = varDeclarationRegex.exec(code)) !== null) {
        // Extract all variable names from the declaration
        const varList = match[2]; // Get the variable name part
        const individualVars = varList.split(/\s*,\s*/); // Split by comma

        for (const varName of individualVars) {
            const trimmedVarName = varName.trim();
            if (trimmedVarName) {
                variables.add(trimmedVarName);
            }
        }
    }

    // Also match function parameters: function(type param1, type param2, ...)
    // Find function definitions and extract parameter names
    const functionRegex = /\b(?:[a-zA-Z_*&:<>]+\s+)+[a-zA-Z_][a-zA-Z0-9_]*\s*\(([^)]*)\)\s*(?:const\s+)?(?:\[[^\]]*\]\s*)*(?:noexcept\s*\(.*\)\s*)*(?:->\s*[\w_*:<>]+)?\s*{/gi;
    let functionMatch;
    while ((functionMatch = functionRegex.exec(code)) !== null) {
        const paramsStr = functionMatch[1]; // Parameters part
        if (paramsStr.trim()) {
            // Split parameters by comma and extract variable names
            const params = paramsStr.split(',');
            for (const param of params) {
                // Match the variable name in the parameter (last word that looks like a variable name)
                const varMatches = param.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g);
                if (varMatches) {
                    // Take the last match (which should be the variable name)
                    const varName = varMatches[varMatches.length - 1];
                    if (varName) {
                        variables.add(varName);
                    }
                }
            }
        }
    }

    // Also match pair declarations specifically: pair<type, type> varName
    const pairDeclarationRegex = /pair\s*<\s*[\w:<> ]+\s*,\s*[\w:<> ]+\s*>\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)/g;
    while ((match = pairDeclarationRegex.exec(code)) !== null) {
        const varList = match[1]; // Get the variable name part
        const individualVars = varList.split(/\s*,\s*/); // Split by comma

        for (const varName of individualVars) {
            const trimmedVarName = varName.trim();
            if (trimmedVarName) {
                variables.add(trimmedVarName);
            }
        }
    }

    // Also match assignments like varName = ...
    const assignmentRegex = /\b([a-zA-Z_]\w*)\s*=[^=]/g;
    while ((match = assignmentRegex.exec(code)) !== null) {
        variables.add(match[1]);
    }

    // Also match function calls like varName.function()
    const functionCallRegex = /\b([a-zA-Z_]\w*)\s*\.\s*\w+/g;
    while ((match = functionCallRegex.exec(code)) !== null) {
        variables.add(match[1]);
    }

    // Also match array/index access like varName[index]
    const arrayAccessRegex = /\b([a-zA-Z_]\w*)\s*\[/g;
    while ((match = arrayAccessRegex.exec(code)) !== null) {
        variables.add(match[1]);
    }

    return Array.from(variables);
}

// Register completion providers for C++
function registerCompletionProviders() {
    // 统一的 Completion Provider - 整合所有建议来源
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };
            
            const prefix = word.word;
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);
            const fullText = model.getValue();
            
            const allSuggestions = [];
            
            // ========== 1. 处理 #include <> 情况 ==========
            if (textBefore.trim().endsWith('#include <') || /.*#include\s*<[^>]*$/.test(textBefore)) {
                const allHeaders = new Set([...Object.keys(cppFunctions), ...Object.keys(cppObjects)]);
                for (const headerName of allHeaders) {
                    allSuggestions.push({
                        label: headerName,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: `${headerName}>`,
                        detail: `C++ standard library header`,
                        documentation: `Standard library header: ${headerName}`,
                        range: range
                    });
                }
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix) };
            }
            
            // ========== 2. 处理 # 预处理器指令 ==========
            if (textBefore.trim() === '#' || textBefore.trim().endsWith('#')) {
                const directives = ['include', 'define', 'ifdef', 'ifndef', 'endif', 'pragma'];
                for (const dir of directives) {
                    allSuggestions.push({
                        label: dir,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: dir,
                        detail: 'C++ preprocessor directive',
                        documentation: `C++ preprocessor directive: ${dir}`,
                        range: range
                    });
                }
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix) };
            }
            
            // ========== 3. 处理 . 成员访问 ==========
            if (textBefore.endsWith('.')) {
                const beforeDot = textBefore.substring(0, textBefore.lastIndexOf('.')).trim();
                const parts = beforeDot.split(/[^\w\d_]/);
                const potentialContainerName = parts[parts.length - 1];
                
                // 查找代码中使用的 STL 容器
                const usedContainers = new Set();
                for (const containerName in stlContainers) {
                    const regex = new RegExp(`\\b${containerName}\\b\\s*(?:<[^>]*>)?\\s+[a-zA-Z_][a-zA-Z0-9_]*`, 'g');
                    if (regex.test(fullText)) {
                        usedContainers.add(containerName);
                    }
                }
                
                // 识别具体变量类型
                let specificContainer = null;
                if (potentialContainerName) {
                    for (const containerName of usedContainers) {
                        const declRegex = new RegExp(`\\b${containerName}\\b\\s*(?:<[^>]*>)?\\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\\s*,\\s*)*${potentialContainerName}\\b`);
                        if (declRegex.test(fullText)) {
                            specificContainer = containerName;
                            break;
                        }
                    }
                }
                
                // 添加容器方法建议
                const containersToSuggest = specificContainer ? [specificContainer] : Array.from(usedContainers);
                for (const containerName of containersToSuggest) {
                    if (stlContainers[containerName]) {
                        if (stlContainers[containerName].functions) {
                            stlContainers[containerName].functions.forEach(method => {
                                allSuggestions.push({
                                    label: method,
                                    kind: monaco.languages.CompletionItemKind.Method,
                                    insertText: method + '($1)',
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: `${containerName}::${method}()`,
                                    documentation: `STL ${containerName} container method`,
                                    range: range
                                });
                            });
                        }
                        if (stlContainers[containerName].properties) {
                            stlContainers[containerName].properties.forEach(property => {
                                allSuggestions.push({
                                    label: property,
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    insertText: property,
                                    detail: `${containerName}::${property}`,
                                    documentation: `STL ${containerName} container property`,
                                    range: range
                                });
                            });
                        }
                    }
                }
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix) };
            }
            
            // ========== 4. 常规情况：合并所有建议 ==========
            
            // 4.1 关键字
            for (const keyword of cppKeywords) {
                const isFunctionKeyword = ['main', 'printf', 'scanf', 'cin', 'cout'].includes(keyword);
                allSuggestions.push({
                    label: keyword,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: isFunctionKeyword ? keyword + '($1)' : keyword,
                    insertTextRules: isFunctionKeyword ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range: range
                });
            }
            
            // 4.2 变量名
            const variableNames = extractVariableNames(fullText);
            for (const varName of variableNames) {
                const isPair = new RegExp(`pair\\s*<[^>]*>\\s+${varName}\\b`).test(fullText);
                allSuggestions.push({
                    label: varName,
                    kind: isPair ? monaco.languages.CompletionItemKind.Struct : monaco.languages.CompletionItemKind.Variable,
                    insertText: varName,
                    detail: isPair ? 'pair variable' : 'Variable or function parameter',
                    documentation: 'Variable or function parameter defined in current code',
                    range: range
                });
            }
            
            // 4.3 STL 容器（声明变量时）
            for (const containerName in stlContainers) {
                allSuggestions.push({
                    label: containerName,
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: containerName,
                    detail: `STL ${containerName} container`,
                    documentation: `Standard Template Library ${containerName} container`,
                    range: range
                });
            }
            
            // 4.4 标准库函数
            for (const [headerName, functions] of Object.entries(cppFunctions)) {
                for (const func of functions) {
                    allSuggestions.push({
                        label: func,
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: func + '($1)',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: `${headerName}::${func}`,
                        documentation: `Function from ${headerName} header`,
                        range: range
                    });
                }
            }
            
            // 4.5 标准库对象
            for (const [headerName, objects] of Object.entries(cppObjects)) {
                for (const obj of objects) {
                    const isFunctionLike = ['endl', 'flush', 'ws'].includes(obj);
                    allSuggestions.push({
                        label: obj,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        insertText: isFunctionLike ? obj + '($1)' : obj,
                        insertTextRules: isFunctionLike ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                        detail: `${headerName}::${obj}`,
                        documentation: `Object from ${headerName} header`,
                        range: range
                    });
                }
            }
            
            // 统一排序所有建议
            return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix) };
        },
        triggerCharacters: ['.', '<', '#']
    });
}