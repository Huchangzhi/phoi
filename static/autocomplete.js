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
    // Register completion items for C++ keywords and STL methods
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Get the text before the current position to detect if we're after a dot (.)
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);

            // Check if the text ends with a dot followed by the current word
            if (textBefore.endsWith('.')) {
                // Find the variable name before the dot
                const beforeDot = textBefore.substring(0, textBefore.lastIndexOf('.')).trim();

                // Extract the identifier before the dot (could be a member access chain)
                const parts = beforeDot.split(/[^\w\d_]/);
                const potentialContainerName = parts[parts.length - 1];

                // Get the full text to analyze what STL containers are actually used
                const fullText = model.getValue();

                // Find which STL containers are declared in the code
                const usedContainers = new Set();
                for (const containerName in stlContainers) {
                    // Look for declarations like: containerName<...> varName or containerName varName
                    const regex = new RegExp(`\\b${containerName}\\b\\s*(?:<[^>]*>)?\\s+[a-zA-Z_][a-zA-Z0-9_]*(?:\\s*,\\s*[a-zA-Z_][a-zA-Z0-9_]*)*`, 'g');
                    if (regex.test(fullText)) {
                        usedContainers.add(containerName);
                    }
                }

                // If we have a potential container name, check if it matches any used STL containers
                const suggestions = [];

                // Add suggestions only for containers that are actually used in the code
                for (const containerName of usedContainers) {
                    if (stlContainers[containerName]) {
                        // Add function suggestions with parentheses
                        if (stlContainers[containerName].functions) {
                            stlContainers[containerName].functions.forEach(method => {
                                const insertText = method + '($1)';

                                suggestions.push({
                                    label: method,
                                    kind: monaco.languages.CompletionItemKind.Method,
                                    insertText: insertText,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: `${containerName}::${method}()`,
                                    documentation: `STL ${containerName} container method (function)`,
                                    range: range
                                });
                            });
                        }

                        // Add property suggestions WITHOUT parentheses (for things like first, second, operator[])
                        if (stlContainers[containerName].properties) {
                            stlContainers[containerName].properties.forEach(property => {
                                suggestions.push({
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

                // If we can identify the specific variable type, narrow down suggestions
                if (potentialContainerName) {
                    // Search for the declaration of this variable in the code
                    const declarationRegex = new RegExp(`\\b(${Object.keys(stlContainers).join('|')})\\b\\s*(?:<[^>]*>)?\\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\\s*,\\s*)*(${potentialContainerName})\\b`, 'g');
                    const matches = [...fullText.matchAll(declarationRegex)];

                    if (matches.length > 0) {
                        // Get the container type from the last match (most recent declaration)
                        const containerType = matches[matches.length - 1][1];

                        // Only suggest methods for this specific container type
                        if (stlContainers[containerType]) {
                            suggestions.length = 0; // Clear previous suggestions

                            // Add function suggestions with parentheses
                            if (stlContainers[containerType].functions) {
                                stlContainers[containerType].functions.forEach(method => {
                                    const insertText = method + '($1)';

                                    suggestions.push({
                                        label: method,
                                        kind: monaco.languages.CompletionItemKind.Method,
                                        insertText: insertText,
                                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                        detail: `${containerType}::${method}()`,
                                        documentation: `STL ${containerType} container method (function)`,
                                        range: range
                                    });
                                });
                            }

                            // Add property suggestions WITHOUT parentheses (for things like first, second, operator[])
                            if (stlContainers[containerType].properties) {
                                stlContainers[containerType].properties.forEach(property => {
                                    suggestions.push({
                                        label: property,
                                        kind: monaco.languages.CompletionItemKind.Property,
                                        insertText: property,
                                        detail: `${containerType}::${property}`,
                                        documentation: `STL ${containerType} container property`,
                                        range: range
                                    });
                                });
                            }
                        }
                    }
                }

                return {
                    suggestions: suggestions
                };
            } else {
                // For non-dot cases, return empty suggestions since other providers handle keywords and variables
                return {
                    suggestions: []
                };
            }
        },
        triggerCharacters: ['.']  // Trigger suggestion when '.' is typed
    });

    // Register completion provider for C++ keywords
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            const suggestions = [];

            // Add all C++ keywords
            for (const keyword of cppKeywords) {
                // For certain keywords that are functions, add parentheses
                const isFunctionKeyword = ['main', 'printf', 'scanf', 'cin', 'cout'].includes(keyword);
                let insertText = keyword;
                if (isFunctionKeyword) {
                    insertText = keyword + '($1)';
                }

                suggestions.push({
                    label: keyword,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: insertText,
                    insertTextRules: isFunctionKeyword ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range: range
                });
            }

            return {
                suggestions: suggestions
            };
        }
    });

    // Register completion provider for variable names
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Get all variable names from the current code
            const fullText = model.getValue();
            const variableNames = extractVariableNames(fullText);

            const suggestions = [];

            // Add variable name suggestions
            for (const varName of variableNames) {
                // Check if the variable is a pair type
                const pairDeclarationRegex = new RegExp(`pair\\s*<[^>]*>\\s+${varName}\\b`);

                suggestions.push({
                    label: varName,
                    kind: pairDeclarationRegex.test(fullText)
                        ? monaco.languages.CompletionItemKind.Struct
                        : monaco.languages.CompletionItemKind.Variable,
                    insertText: varName,
                    detail: pairDeclarationRegex.test(fullText) ? 'pair variable' : 'Variable or function parameter',
                    documentation: `Variable or function parameter defined in current code`,
                    range: range
                });
            }

            return {
                suggestions: suggestions
            };
        }
    });

    // Register completion provider for variable declarations to suggest STL containers
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Check if we're at a position where we might declare a variable
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);

            // If we're likely to be declaring a variable (after a space or tab, not after a dot)
            if (!textBefore.endsWith('.') && !textBefore.endsWith('>')) {
                const suggestions = [];

                // Add STL container suggestions
                for (const containerName in stlContainers) {
                    suggestions.push({
                        label: containerName,
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: containerName,
                        detail: `STL ${containerName} container`,
                        documentation: `Standard Template Library ${containerName} container`,
                        range: range
                    });
                }

                return {
                    suggestions: suggestions
                };
            }

            return {
                suggestions: []
            };
        }
    });

    // Register completion provider for C++ standard library functions and objects
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Check if we're at a position where we might include a header or use a function
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);

            // If we're likely to be including a header (after '#include')
            if (textBefore.trim().endsWith('#include')) {
                const suggestions = [];

                // Add C++ standard library header suggestions
                const allHeaders = new Set([
                    ...Object.keys(cppFunctions),
                    ...Object.keys(cppObjects)
                ]);

                for (const headerName of allHeaders) {
                    suggestions.push({
                        label: `<${headerName}>`,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: `<${headerName}>`,
                        detail: `C++ standard library header`,
                        documentation: `Include the ${headerName} header`,
                        range: range
                    });
                }

                return {
                    suggestions: suggestions
                };
            }
            // If we're not after a dot or in a template, suggest function names and objects
            else if (!textBefore.endsWith('.') && !textBefore.includes('<') || textBefore.endsWith('>')) {
                const suggestions = [];

                // Add all function suggestions from all headers
                for (const [headerName, functions] of Object.entries(cppFunctions)) {
                    functions.forEach(func => {
                        // Add parentheses to function names
                        const insertText = func + '($1)';

                        suggestions.push({
                            label: func,
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: insertText,
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: `${headerName}::${func}`,
                            documentation: `Function from ${headerName} header`,
                            range: range
                        });
                    });
                }

                // Add all object suggestions from all headers
                for (const [headerName, objects] of Object.entries(cppObjects)) {
                    objects.forEach(obj => {
                        // For some objects that behave like functions, add parentheses
                        const isFunctionLike = ['endl', 'flush', 'ws'].includes(obj);
                        let insertText = obj;
                        if (isFunctionLike) {
                            insertText = obj + '($1)';
                        }

                        suggestions.push({
                            label: obj,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: insertText,
                            insertTextRules: isFunctionLike ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                            detail: `${headerName}::${obj}`,
                            documentation: `Object from ${headerName} header`,
                            range: range
                        });
                    });
                }

                return {
                    suggestions: suggestions
                };
            }

            return {
                suggestions: []
            };
        }
    });

    // Register completion provider for directives when typing #
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Check if we're at a position right after '#'
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);

            // If we're likely to be typing after '#'
            if (textBefore.trim() === '#' || textBefore.trim().endsWith('#')) {
                const suggestions = [
                    {
                        label: 'include',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'include',
                        detail: 'C++ preprocessor directive',
                        documentation: 'Include a file at compilation time',
                        range: range
                    },
                    {
                        label: 'define',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'define',
                        detail: 'C++ preprocessor directive',
                        documentation: 'Define a macro',
                        range: range
                    },
                    {
                        label: 'ifdef',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'ifdef',
                        detail: 'C++ preprocessor directive',
                        documentation: 'Conditional compilation - if defined',
                        range: range
                    },
                    {
                        label: 'ifndef',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'ifndef',
                        detail: 'C++ preprocessor directive',
                        documentation: 'Conditional compilation - if not defined',
                        range: range
                    },
                    {
                        label: 'endif',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'endif',
                        detail: 'C++ preprocessor directive',
                        documentation: 'End conditional compilation block',
                        range: range
                    },
                    {
                        label: 'pragma',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'pragma',
                        detail: 'C++ preprocessor directive',
                        documentation: 'Implementation-specific commands',
                        range: range
                    }
                ];

                return {
                    suggestions: suggestions
                };
            }

            return {
                suggestions: []
            };
        },
        triggerCharacters: ['#']  // Trigger suggestion when '#' is typed
    });

    // Register completion provider for header files when typing <>
    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // Check if we're at a position right after '#include <'
            const currentLine = model.getLineContent(position.lineNumber);
            const textBefore = currentLine.substring(0, position.column - 1);

            // If we're likely to be typing inside #include <>
            if (textBefore.trim().endsWith('#include <') ||
                (/.*#include\s*<[^>]*$/.test(textBefore))) {
                const suggestions = [];

                // Add C++ standard library header suggestions
                const allHeaders = new Set([
                    ...Object.keys(cppFunctions),
                    ...Object.keys(cppObjects)
                ]);

                for (const headerName of allHeaders) {
                    suggestions.push({
                        label: headerName,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: `${headerName}>`,
                        detail: `C++ standard library header`,
                        documentation: `Standard library header: ${headerName}`,
                        range: range
                    });
                }

                return {
                    suggestions: suggestions
                };
            }

            return {
                suggestions: []
            };
        },
        triggerCharacters: ['<']  // Trigger suggestion when '<' is typed in include statements
    });
}