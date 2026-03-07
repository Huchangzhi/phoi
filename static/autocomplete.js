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
function sortSuggestionsByIntelligence(suggestions, prefix = '', code = '', cursorPos = 0) {
    if (!suggestions || suggestions.length === 0) return suggestions;

    // 如果 HabitTracker 可用，使用它进行排序（带 AI 模型）
    if (typeof HabitTracker !== 'undefined' && HabitTracker.sortSuggestions) {
        return HabitTracker.sortSuggestions(suggestions, prefix, code, cursorPos);
    }

    // 否则使用基础智能排序
    // Monaco CompletionItemKind 枚举值：
    // Method=0, Function=1, Constructor=2, Field=3, Variable=4, Class=5, 
    // Struct=6, Interface=7, Module=8, Property=9, Keyword=17, Snippet=18
    const priorityOrder = {
        // 最高优先级：用户定义的 struct 成员
        'Field': 0,
        3: 0,  // Field
        'Method': 1,
        0: 1,  // Method
        // 高优先级：用户定义的变量
        'Variable': 2,
        4: 2,  // Variable
        'Struct': 3,
        6: 3,  // Struct
        // 中等优先级：类型和类
        'Class': 4,
        5: 4,  // Class
        'Interface': 5,
        7: 5,  // Interface
        // 较低优先级：关键字
        'Keyword': 10,
        17: 10,  // Keyword
        'Snippet': 11,
        18: 11,  // Snippet
        // 最低优先级：其他
        'Module': 20,
        8: 20,  // Module
        'Property': 21,
        9: 21,  // Property
        'Function': 22,
        1: 22,  // Function
        2: 22,  // Constructor
        10: 22,  // Unit
        11: 22,  // Value
        12: 22,  // Constant
        13: 22,  // Enum
        14: 22,  // EnumMember
        15: 22,  // Event
        16: 22,  // Operator
        19: 22,  // Color
        20: 22,  // File
        21: 22,  // Reference
        22: 22,  // Folder
        23: 22,  // TypeParameter
        24: 22,  // User
        25: 22,  // Issue
        100: 100  // 默认
    };

    return suggestions.sort((a, b) => {
        // 首先按类型优先级排序
        // a.kind 可能是数字（Monaco 内部使用）或字符串（我们自定义的）
        let kindA = a.kind;
        let kindB = b.kind;
        
        // 如果是数字，直接使用；如果是字符串，尝试转换为对应的优先级
        const priorityA = priorityOrder[kindA] ?? priorityOrder[String(kindA)] ?? 100;
        const priorityB = priorityOrder[kindB] ?? priorityOrder[String(kindB)] ?? 100;

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
function recordAndSortSuggestions(suggestions, prefix = '', context = '', code = '', cursorPos = 0) {
    if (typeof HabitTracker !== 'undefined' && HabitTracker.recordSelection) {
        // 记录用户最可能选择的前 3 个建议
        const topSuggestions = suggestions.slice(0, 3);
        topSuggestions.forEach(s => {
            HabitTracker.recordSelection(s.label, prefix, context);
        });
    }
    return sortSuggestionsByIntelligence(suggestions, prefix, code, cursorPos);
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
        functions: ['front', 'back', 'assign', 'at', 'insert', 'emplace', 'erase', 'push_back', 'emplace_back', 'pop_back', 'resize', 'swap', 'clear', 'begin', 'end', 'rbegin', 'rend', 'empty', 'size', 'max_size', 'push_front', 'pop_front'],
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
    'stack': [],
    'bits/stdc++.h': [],
};

// ========== Struct 成员补全功能 ==========

// 存储所有 struct 定义及其成员
const structDefinitions = {};

// 解析代码中的 struct 定义
function parseStructDefinitions(code) {
    const structDefs = {};

    // 匹配 struct 定义：struct StructName { members... }; 或 struct StructName { members... } var1, var2[100], *ptr;
    // 支持数组声明如 c, sz[123]，也支持指针声明如 *root, *ptr
    const structRegex = /\bstruct\s+([a-zA-Z_]\w*)\s*\{([^}]*)\}\s*([a-zA-Z_]\w*(?:\s*\[\s*\d+\s*\])?(?:\s*,\s*(?:[*&]\s*)?[a-zA-Z_]\w*(?:\s*\[\s*\d+\s*\])?)*)?\s*;/g;
    let match;

    while ((match = structRegex.exec(code)) !== null) {
        const structName = match[1];
        const membersStr = match[2];
        const members = parseStructMembers(membersStr);

        structDefs[structName] = {
            name: structName,
            members: members,
            startPos: match.index,
            endPos: match.index + match[0].length,
            instanceVars: [],
            pointerVars: []
        };

        // 如果 struct 定义时同时声明了变量（如 struct node{...}c, *root;），也记录这些变量
        if (match[3]) {
            const varList = match[3];
            const individualVars = varList.split(/\s*,\s*/);
            for (const varNameWithArray of individualVars) {
                const trimmed = varNameWithArray.trim();
                
                // 检查是否是指针声明（如 *root）
                const ptrMatch = trimmed.match(/^\s*[*&]\s*([a-zA-Z_]\w*)/);
                if (ptrMatch) {
                    // 指针变量
                    const ptrVarName = ptrMatch[1];
                    structDefs[structName].pointerVars.push(ptrVarName);
                } else {
                    // 普通变量或数组变量
                    const arrayMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*\[\s*\d+\s*\]/);
                    const varName = arrayMatch ? arrayMatch[1] : trimmed;
                    if (varName && /^[a-zA-Z_]\w*$/.test(varName)) {
                        structDefs[structName].instanceVars.push(varName);
                    }
                }
            }
        }
    }

    return structDefs;
}

// 解析 struct 成员
function parseStructMembers(membersStr) {
    const members = [];
    const lines = membersStr.split(';');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // 先提取类型（第一个单词）
        const typeMatch = trimmed.match(/^([a-zA-Z_]\w*)/);
        if (!typeMatch) continue;
        
        const baseType = typeMatch[1];
        // 去掉类型部分，获取剩余的成员名部分
        let rest = trimmed.slice(typeMatch[0].length).trim();
        
        // 处理逗号分隔的多个成员
        const parts = rest.split(',');
        
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i].trim();
            if (!p) continue;
            
            // 匹配成员名，可能带有指针、引用
            const nameMatch = p.match(/^([*&]?\s*[a-zA-Z_]\w*)/);
            if (!nameMatch) continue;
            
            let memberName = nameMatch[1].trim();
            let memberType = baseType;
            
            // 检查是否有额外的指针或引用
            if (memberName.startsWith('*')) {
                memberType = baseType + '*';
                memberName = memberName.replace(/^\*+/, '').trim();
            } else if (memberName.startsWith('&')) {
                memberType = baseType + '&';
                memberName = memberName.replace(/^&+/, '').trim();
            }
            
            // 检查是否是数组，去掉数组部分 [N]
            const arrayMatch = memberName.match(/^([a-zA-Z_]\w*)/);
            if (arrayMatch) {
                memberName = arrayMatch[1];
            }
            
            if (['public', 'private', 'protected', 'static', 'const', 'virtual'].includes(memberName)) {
                continue;
            }
            
            members.push({
                name: memberName,
                type: memberType,
                isFunction: false
            });
        }
        
        // 匹配成员函数：returnType funcName(params) { body } 或 returnType funcName(params);
        const funcRegex = /\b([a-zA-Z_]\w*(?:\s*[*&])?\s*(?:<[^>]*>)?)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*(?:const\s*)?(?:=\s*0)?\s*;?/g;
        let funcMatch;
        
        while ((funcMatch = funcRegex.exec(trimmed)) !== null) {
            const returnType = funcMatch[1].trim();
            const funcName = funcMatch[2];
            const params = funcMatch[3].trim();
            
            // 跳过构造函数、析构函数等
            if (['public', 'private', 'protected', 'static', 'const', 'virtual', 'explicit', 'friend'].includes(funcName)) {
                continue;
            }
            
            members.push({
                name: funcName,
                type: returnType,
                isFunction: true,
                params: params
            });
        }
    }
    
    return members;
}

// 推断变量的类型
function inferVariableTypes(code, structDefs) {
    const varTypes = {};
    let match;

    // 首先处理 struct 定义时声明的变量（如 struct node{...}c, *root;）
    for (const structName in structDefs) {
        const structDef = structDefs[structName];

        // 处理普通变量和数组变量
        if (structDef.instanceVars && structDef.instanceVars.length > 0) {
            for (const varName of structDef.instanceVars) {
                varTypes[varName] = {
                    type: structName,
                    isStruct: true,
                    isPointer: false,
                    isArray: true
                };
            }
        }

        // 处理指针变量（如 *root）
        if (structDef.pointerVars && structDef.pointerVars.length > 0) {
            for (const varName of structDef.pointerVars) {
                varTypes[varName] = {
                    type: structName,
                    isStruct: true,
                    isPointer: true,
                    isArray: false
                };
            }
        }
        
        // 匹配：struct StructName varName 或 StructName varName（包括数组声明）
        const declRegex = new RegExp(`\\b(?:struct\\s+)?${structName}\\s+([a-zA-Z_]\\w*(?:\\s*\\[\\s*\\d+\\s*\\])?(?:\\s*,\\s*[a-zA-Z_]\\w*(?:\\s*\\[\\s*\\d+\\s*\\])?)*)`, 'g');
        while ((match = declRegex.exec(code)) !== null) {
            const varList = match[1];
            const individualVars = varList.split(/\s*,\s*/);
            for (const varNameWithArray of individualVars) {
                // 检查是否是数组（如 sz[123]）
                const arrayMatch = varNameWithArray.trim().match(/^([a-zA-Z_]\w*)\s*\[\s*\d+\s*\]/);
                const varName = arrayMatch ? arrayMatch[1] : varNameWithArray.trim();
                if (varName) {
                    varTypes[varName] = {
                        type: structName,
                        isStruct: true,
                        isPointer: false,
                        isArray: !!arrayMatch
                    };
                }
            }
        }
        
        // 匹配指针声明：struct StructName* varName 或 StructName* varName 或 Type *varName
        // 匹配两种格式：Type* varName 和 Type *varName
        const ptrDeclRegex1 = new RegExp(`\\b(?:struct\\s+)?${structName}\\s*\\*\\s*([a-zA-Z_]\\w*(?:\\s*,\\s*[a-zA-Z_]\\w*)*)`, 'g');
        while ((match = ptrDeclRegex1.exec(code)) !== null) {
            const varList = match[1];
            const individualVars = varList.split(/\s*,\s*/);
            for (const varName of individualVars) {
                const trimmedVarName = varName.trim();
                if (trimmedVarName) {
                    varTypes[trimmedVarName] = {
                        type: structName,
                        isStruct: true,
                        isPointer: true,
                        isArray: false
                    };
                }
            }
        }
        
        // 匹配 Type *varName 格式（星号紧贴变量名）
        const ptrDeclRegex2 = new RegExp(`\\b(?:struct\\s+)?${structName}\\s+\\*([a-zA-Z_]\\w*(?:\\s*,\\s*\\*[a-zA-Z_]\\w*)*)`, 'g');
        while ((match = ptrDeclRegex2.exec(code)) !== null) {
            const varList = match[1];
            const individualVars = varList.split(/\s*,\s*\*/);
            for (let i = 0; i < individualVars.length; i++) {
                const trimmedVarName = individualVars[i].trim();
                if (trimmedVarName && /^[a-zA-Z_]\w*$/.test(trimmedVarName)) {
                    varTypes[trimmedVarName] = {
                        type: structName,
                        isStruct: true,
                        isPointer: true,
                        isArray: false
                    };
                }
            }
        }
    }
    
    // 匹配普通变量声明（包括数组）
    const varDeclarationRegex = /\b(?!struct\b)(auto|int|float|double|char|bool|long|short|unsigned|signed|void|size_t|string|vector|array|queue|stack|set|map|unordered_map|unordered_set|list|deque|priority_queue|complex|pair|[\w:<>]+)\s+([a-zA-Z_]\w*(?:\s*\[\s*\d+\s*\])?(?:\s*,\s*[a-zA-Z_]\w*(?:\s*\[\s*\d+\s*\])?)*)/g;
    while ((match = varDeclarationRegex.exec(code)) !== null) {
        const varType = match[1];
        const varList = match[2];
        const individualVars = varList.split(/\s*,\s*/);
        
        for (const varNameWithArray of individualVars) {
            const trimmedVarName = varNameWithArray.trim();
            // 检查是否是数组
            const arrayMatch = trimmedVarName.match(/^([a-zA-Z_]\w*)\s*\[\s*\d+\s*\]/);
            const varName = arrayMatch ? arrayMatch[1] : trimmedVarName;
            
            if (varName && !varTypes[varName]) {
                varTypes[varName] = {
                    type: varType,
                    isStruct: structDefs.hasOwnProperty(varType),
                    isPointer: false,
                    isArray: !!arrayMatch
                };
            }
        }
    }
    
    // 匹配函数参数
    const functionRegex = /\b(?:[a-zA-Z_*&:<>]+\s+)+[a-zA-Z_][a-zA-Z0-9_]*\s*\(([^)]*)\)\s*(?:const\s+)?(?:\[[^\]]*\]\s*)*(?:noexcept\s*\(.*\)\s*)*(?:->\s*[\w_*:<>]+)?\s*{/gi;
    let functionMatch;
    while ((functionMatch = functionRegex.exec(code)) !== null) {
        const paramsStr = functionMatch[1];
        if (paramsStr.trim()) {
            const params = paramsStr.split(',');
            for (const param of params) {
                const varMatches = param.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g);
                if (varMatches) {
                    const varName = varMatches[varMatches.length - 1];
                    if (varName && !varTypes[varName]) {
                        // 尝试推断参数类型
                        const typeMatch = param.match(/\b([\w:*&<>]+)\s+/);
                        const paramType = typeMatch ? typeMatch[1].trim() : 'unknown';
                        varTypes[varName] = {
                            type: paramType,
                            isStruct: structDefs.hasOwnProperty(paramType.replace(/[*&]/g, '')),
                            isPointer: paramType.includes('*'),
                            isArray: false
                        };
                    }
                }
            }
        }
    }
    
    return varTypes;
}

// 获取变量对应的 struct 成员
function getStructMembersForVariable(varName, code, structDefs, varTypes) {
    // 首先确保我们有最新的变量类型信息
    if (Object.keys(varTypes).length === 0) {
        varTypes = inferVariableTypes(code, structDefs);
    }
    
    const varInfo = varTypes[varName];
    if (!varInfo || !varInfo.isStruct) {
        return null;
    }
    
    const structName = varInfo.type;
    const structDef = structDefs[structName];
    
    if (!structDef) {
        return null;
    }
    
    return {
        structName: structName,
        members: structDef.members,
        isPointer: varInfo.isPointer,
        isArray: varInfo.isArray
    };
}

// ========== 原有的变量提取功能（增强版） ==========

function extractVariableNames(code) {
    const variables = new Set();
    let match;

    // 首先解析 struct 定义
    const structDefs = parseStructDefinitions(code);
    
    // 匹配变量声明
    const varDeclarationRegex = /\b(?!struct\b)(auto|int|float|double|char|bool|long|short|unsigned|signed|void|size_t|string|vector|array|queue|stack|set|map|unordered_map|unordered_set|list|deque|priority_queue|complex|pair|[\w:<>]+)\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)/g;

    while ((match = varDeclarationRegex.exec(code)) !== null) {
        const varList = match[2];
        const individualVars = varList.split(/\s*,\s*/);

        for (const varName of individualVars) {
            const trimmedVarName = varName.trim();
            if (trimmedVarName) {
                variables.add(trimmedVarName);
            }
        }
    }

    // 匹配函数参数
    const functionRegex = /\b(?:[a-zA-Z_*&:<>]+\s+)+[a-zA-Z_][a-zA-Z0-9_]*\s*\(([^)]*)\)\s*(?:const\s+)?(?:\[[^\]]*\]\s*)*(?:noexcept\s*\(.*\)\s*)*(?:->\s*[\w_*:<>]+)?\s*{/gi;
    let functionMatch;
    while ((functionMatch = functionRegex.exec(code)) !== null) {
        const paramsStr = functionMatch[1];
        if (paramsStr.trim()) {
            const params = paramsStr.split(',');
            for (const param of params) {
                const varMatches = param.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g);
                if (varMatches) {
                    const varName = varMatches[varMatches.length - 1];
                    if (varName) {
                        variables.add(varName);
                    }
                }
            }
        }
    }

    // 匹配 pair 声明
    const pairDeclarationRegex = /pair\s*<\s*[\w:<> ]+\s*,\s*[\w:<> ]+\s*>\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)/g;
    while ((match = pairDeclarationRegex.exec(code)) !== null) {
        const varList = match[1];
        const individualVars = varList.split(/\s*,\s*/);

        for (const varName of individualVars) {
            const trimmedVarName = varName.trim();
            if (trimmedVarName) {
                variables.add(trimmedVarName);
            }
        }
    }

    // 匹配 struct 变量声明
    for (const structName in structDefs) {
        const structDeclRegex = new RegExp(`\\b(?:struct\\s+)?${structName}\\s+([a-zA-Z_]\\w*(?:\\s*,\\s*[a-zA-Z_]\\w*)*)`, 'g');
        while ((match = structDeclRegex.exec(code)) !== null) {
            const varList = match[1];
            const individualVars = varList.split(/\s*,\s*/);
            for (const varName of individualVars) {
                const trimmedVarName = varName.trim();
                if (trimmedVarName) {
                    variables.add(trimmedVarName);
                }
            }
        }
    }

    // 匹配赋值
    const assignmentRegex = /\b([a-zA-Z_]\w*)\s*=[^=]/g;
    while ((match = assignmentRegex.exec(code)) !== null) {
        variables.add(match[1]);
    }

    // 匹配函数调用
    const functionCallRegex = /\b([a-zA-Z_]\w*)\s*\.\s*\w+/g;
    while ((match = functionCallRegex.exec(code)) !== null) {
        variables.add(match[1]);
    }

    // 匹配数组访问
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
            const cursorPos = model.getOffsetAt(position);

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
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) };
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
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) };
            }
            
            // ========== 3. 处理 . 成员访问 ==========
            if (textBefore.endsWith('.')) {
                const beforeDot = textBefore.substring(0, textBefore.lastIndexOf('.')).trim();

                // 支持数组访问（如 sz[1].）和指针访问（如 ptr->.）
                // 提取变量名：支持 sz[1], sz[1].next, ptr->next 等情况
                let potentialContainerName = '';

                // 先尝试匹配数组访问（如 sz[1]）
                const arrayMatch = beforeDot.match(/([a-zA-Z_]\w*)\s*\[\s*[^\]]+\s*\]\s*$/);
                if (arrayMatch) {
                    potentialContainerName = arrayMatch[1];
                } else {
                    // 否则按普通方式提取
                    const parts = beforeDot.split(/[^\w\d_]/);
                    potentialContainerName = parts[parts.length - 1];
                }

                // 如果是 ->. 的情况（即用户输入了 ->.），去掉 -> 部分
                const arrowDotMatch = potentialContainerName.match(/^(.*)->$/);
                if (arrowDotMatch) {
                    potentialContainerName = arrowDotMatch[1].trim();
                }

                // ========== 3.1 处理 struct 成员补全 ==========
                const currentStructDefs = parseStructDefinitions(fullText);
                const currentVarTypes = inferVariableTypes(fullText, currentStructDefs);



                // 尝试查找 struct 变量
                let foundStructMembers = false;
                if (potentialContainerName && currentVarTypes[potentialContainerName]) {
                    const varInfo = currentVarTypes[potentialContainerName];
                    if (varInfo.isStruct) {
                        const structDef = currentStructDefs[varInfo.type];
                        if (structDef) {
                            // 添加 struct 成员建议
                            for (const member of structDef.members) {
                                if (member.isFunction) {
                                    allSuggestions.push({
                                        label: member.name,
                                        kind: monaco.languages.CompletionItemKind.Method,
                                        insertText: member.name + '($1)',
                                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                        detail: `${member.type} ${member.name}(${member.params || ''})`,
                                        documentation: `Member function of struct ${structDef.name}`,
                                        range: range
                                    });
                                } else {
                                    allSuggestions.push({
                                        label: member.name,
                                        kind: monaco.languages.CompletionItemKind.Field,
                                        insertText: member.name,
                                        detail: `${member.type} ${member.name}`,
                                        documentation: `Member variable of struct ${structDef.name}`,
                                        range: range
                                    });
                                }
                            }
                            foundStructMembers = allSuggestions.length > 0;
                        }
                    }
                }
                
                // 如果没有找到 struct 成员，继续搜索其他类型的成员（如 STL 容器）

                // ========== 3.2 处理 STL 容器补全 ==========
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
                
                // 只有在找到了 struct 成员的情况下才返回，否则继续处理 STL 容器
                if (foundStructMembers) {
                    return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) };
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
                
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) };
            }

            // ========== 3.5 处理 -> 指针成员访问（检测输入 > 时前面是否有 -） ==========
            // 只在输入 > 且前面是 - 时触发（即输入了 ->）
            // 注意：这里检测的是当前位置前面的文本，如果用户输入了 >，textBefore 已经包含了 ->
            if (textBefore.endsWith('->')) {
                const beforeArrow = textBefore.substring(0, textBefore.length - 2).trim();
                
                // 如果 -> 前面没有内容，不触发（如单独的 ->）
                if (!beforeArrow) {
                    return { suggestions: [] };
                }
                
                // 提取变量名：支持 sz[1]->, ptr->next-> 等情况
                let potentialContainerName = '';
                
                // 先尝试匹配数组访问（如 sz[1]->）
                const arrayMatch = beforeArrow.match(/([a-zA-Z_]\w*)\s*\[\s*[^\]]+\s*\]\s*$/);
                if (arrayMatch) {
                    potentialContainerName = arrayMatch[1];
                } else {
                    // 否则按普通方式提取
                    const parts = beforeArrow.split(/[^\w\d_]/);
                    potentialContainerName = parts[parts.length - 1];
                }
                
                // 如果没有提取到变量名，不触发
                if (!potentialContainerName) {
                    return { suggestions: [] };
                }
                
                // ========== 3.5.1 处理 struct 成员补全 ==========
                const currentStructDefs = parseStructDefinitions(fullText);
                const currentVarTypes = inferVariableTypes(fullText, currentStructDefs);

                // 尝试查找 struct 变量
                let foundStructMembers = false;
                if (potentialContainerName && currentVarTypes[potentialContainerName]) {
                    const varInfo = currentVarTypes[potentialContainerName];
                    if (varInfo.isStruct) {
                        const structDef = currentStructDefs[varInfo.type];
                        if (structDef) {
                            // 添加 struct 成员建议
                            for (const member of structDef.members) {
                                if (member.isFunction) {
                                    allSuggestions.push({
                                        label: member.name,
                                        kind: monaco.languages.CompletionItemKind.Method,
                                        insertText: member.name + '($1)',
                                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                        detail: `${member.type} ${member.name}(${member.params || ''})`,
                                        documentation: `Member function of struct ${structDef.name}`,
                                        range: range
                                    });
                                } else {
                                    allSuggestions.push({
                                        label: member.name,
                                        kind: monaco.languages.CompletionItemKind.Field,
                                        insertText: member.name,
                                        detail: `${member.type} ${member.name}`,
                                        documentation: `Member variable of struct ${structDef.name}`,
                                        range: range
                                    });
                                }
                            }
                            foundStructMembers = allSuggestions.length > 0;
                        }
                    }
                }
                
                // 如果没有找到 struct 成员，继续搜索其他类型的成员（如 STL 容器）
                
                // ========== 3.5.2 处理 STL 容器补全 ==========
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
                
                // 只有在找到了 struct 成员的情况下才返回，否则继续处理 STL 容器
                if (foundStructMembers) {
                    return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) };
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
                
                return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) };
            }

            // ========== 4. 常规情况：合并所有建议 ==========
            // 使用 Set 记录已添加的 label，避免重复
            const addedLabels = new Set();

            // 辅助函数：添加建议（自动去重）
            function addSuggestion(label, item) {
                if (!addedLabels.has(label)) {
                    addedLabels.add(label);
                    allSuggestions.push(item);
                }
            }

            // 4.1 关键字
            for (const keyword of cppKeywords) {
                const isFunctionKeyword = ['main', 'printf', 'scanf', 'cin', 'cout'].includes(keyword);
                addSuggestion(keyword, {
                    label: keyword,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: isFunctionKeyword ? keyword + '($1)' : keyword,
                    insertTextRules: isFunctionKeyword ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range: range
                });
            }

            // 4.2 变量名
            const variableNames = extractVariableNames(fullText);
            const currentStructDefs = parseStructDefinitions(fullText);
            const currentVarTypes = inferVariableTypes(fullText, currentStructDefs);
            
            for (const varName of variableNames) {
                const varInfo = currentVarTypes[varName];
                
                // 确定变量类型
                let kind = monaco.languages.CompletionItemKind.Variable;
                let detail = 'Variable or function parameter';
                let documentation = 'Variable or function parameter defined in current code';
                
                if (varInfo && varInfo.isStruct) {
                    kind = monaco.languages.CompletionItemKind.Struct;
                    detail = `struct ${varInfo.type}${varInfo.isPointer ? '*' : ''}`;
                    documentation = `Struct variable of type ${varInfo.type}`;
                } else if (new RegExp(`pair\\s*<[^>]*>\\s+${varName}\\b`).test(fullText)) {
                    kind = monaco.languages.CompletionItemKind.Struct;
                    detail = 'pair variable';
                    documentation = 'STL pair variable';
                }
                
                addSuggestion(varName, {
                    label: varName,
                    kind: kind,
                    insertText: varName,
                    detail: detail,
                    documentation: documentation,
                    range: range
                });
            }

            // 4.3 STL 容器和 struct 类型（声明变量时）
            for (const containerName in stlContainers) {
                addSuggestion(containerName, {
                    label: containerName,
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: containerName,
                    detail: `STL ${containerName} container`,
                    documentation: `Standard Template Library ${containerName} container`,
                    range: range
                });
            }
            
            // 添加已定义的 struct 类型建议（使用 4.2 中已声明的 currentStructDefs）
            for (const structName in currentStructDefs) {
                addSuggestion(structName, {
                    label: structName,
                    kind: monaco.languages.CompletionItemKind.Struct,
                    insertText: structName,
                    detail: `struct ${structName}`,
                    documentation: `User-defined struct type`,
                    range: range
                });
            }

            // 4.4 标准库函数
            for (const [headerName, functions] of Object.entries(cppFunctions)) {
                for (const func of functions) {
                    addSuggestion(func, {
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
                    addSuggestion(obj, {
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
            return { suggestions: sortSuggestionsByIntelligence(allSuggestions, prefix, fullText, cursorPos) };
        },
        triggerCharacters: ['.', '<', '#', '>']
    });
}