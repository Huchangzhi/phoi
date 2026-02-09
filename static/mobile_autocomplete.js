/**
 * Mobile Autocomplete - 为软键盘提供代码补全功能
 * 实现类似手机输入法的补全提示，显示在软键盘上方
 */

class MobileAutocomplete {
    constructor(editorContainer, keyboardContainer) {
        this.editorContainer = editorContainer;  // 通常是全局的globalText变量
        this.keyboardContainer = keyboardContainer;
        this.suggestionsContainer = null;
        this.currentSuggestions = [];
        this.globalText = ''; // 与script.js中的globalText同步
        this.globalCursorPos = 0; // 与script.js中的globalCursorPos同步
        
        // 从autocomplete.js提取的关键字列表
        this.cppKeywords = [
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
        
        // C++标准库函数
        this.cppFunctions = [
            // C-style I/O functions
            'printf', 'scanf', 'fprintf', 'fscanf', 'sscanf', 'sprintf', 'snprintf',
            'getchar', 'putchar', 'gets', 'puts', 'fgets', 'fputs', 'fclose', 'fflush',
            // Standard library functions
            'malloc', 'calloc', 'realloc', 'free', 'abs', 'labs', 'llabs', 'atoi', 'atol', 'atoll',
            'atof', 'rand', 'srand', 'qsort', 'bsearch',
            // String functions
            'memcpy', 'memset', 'strcpy', 'strncpy', ' strcat', 'strncat',
            'memcmp', 'strcmp', 'strncmp', 'strlen', 'strchr', 'strstr',
            // Utility functions
            'make_pair', 'swap', 'forward', 'move',
            // Algorithm functions
            'sort', 'reverse', 'lower_bound', 'upper_bound', 'find', 'count', 'max', 'min',
            'max_element', 'min_element', 'unique', 'remove', 'fill', 'next_permutation', 'prev_permutation',
            // Memory functions
            'make_unique', 'make_shared', 'unique_ptr', 'shared_ptr', 'weak_ptr',
            'min', 'max', 'sqrt', 'pow'
        ];

        // C++标准对象
        this.cppObjects = [
            'cin', 'cout', 'cerr', 'clog', 'endl', 'ws', 'flush',
            'setw', 'setprecision', 'setfill', 'setbase', 'hex', 'dec', 'oct', 'fixed', 'scientific'
        ];

        // STL容器
        this.stlContainers = [
            'vector', 'queue', 'stack', 'set', 'multiset', 'map', 'multimap',
            'unordered_set', 'unordered_map', 'priority_queue', 'deque', 'list',
            'array', 'pair', 'string'
        ];

        // C++标准库头文件
        this.cppHeaders = [
            'bits/stdc++.h', 'iostream', 'ostream', 'istream', 'fstream', 'sstream',  // I/O
            'vector', 'list', 'deque', 'array', 'forward_list', 'queue', 'stack',  // Containers
            'map', 'set', 'unordered_map', 'unordered_set', 'multimap', 'multiset',  // Associative containers
            'string', 'cstring', 'string_view',  // Strings
            'algorithm', 'iterator', 'functional', 'utility',  // Algorithms and utilities
            'memory', 'memory_resource',  // Memory management
            'chrono', 'ratio', 'time',  // Time/date
            'random', 'numeric', 'complex', 'valarray',  // Math
            'exception', 'stdexcept', 'system_error',  // Error handling
            'locale', 'codecvt',  // Localization
            'regex', 'filesystem',  // Regex and filesystem
            'atomic', 'thread', 'mutex', 'shared_mutex', 'future',  // Concurrency
            'iostream', 'iomanip', 'iosfwd',  // I/O manipulation
            'cstdio', 'cstdlib', 'cctype', 'cstring', 'cmath', 'ctime',
            'cassert', 'cerrno', 'cfloat', 'ciso646', 'climits', 'clocale',
            'cmplx', 'csignal', 'csetjmp', 'cstdarg', 'cstdbool', 'cstddef',
            'cstdint', 'ctgmath', 'cuchar', 'cwchar', 'cwctype'
        ];

        // 预处理指令
        this.preprocessorDirectives = [
            'include', 'define', 'undef', 'ifdef', 'ifndef', 'if', 'elif', 'else', 'endif',
            'pragma', 'error', 'line'
        ];
        
        this.init();
    }
    
    /**
     * 初始化补全功能
     */
    init() {
        this.createSuggestionsContainer();
        this.bindEvents();
    }
    
    /**
     * 创建补全建议容器
     */
    createSuggestionsContainer() {
        // 使用页面上已存在的容器
        this.suggestionsContainer = document.getElementById('mobile-autocomplete-container');
        if (!this.suggestionsContainer) {
            console.error('Mobile autocomplete container not found!');
            return;
        }
        
        // 监听键盘显示/隐藏事件，调整补全框位置
        this.setupKeyboardObserver();
    }
    
    /**
     * 设置键盘观察器，监听键盘显示/隐藏
     */
    setupKeyboardObserver() {
        // 监听模式切换按钮，调整补全框显示
        const toggleBtn = document.getElementById('mode-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                setTimeout(() => {
                    this.adjustVisibility();
                }, 100); // 延迟执行，确保模式切换完成
            });
        }
        
        // 初始化时根据当前模式设置补全框可见性
        this.adjustVisibility();
    }
    
    /**
     * 根据当前模式调整补全框可见性
     */
    adjustVisibility() {
        // 使用全局的isFullMode变量来判断当前模式
        if (typeof window.isFullMode !== 'undefined') {
            if (window.isFullMode) {
                // 在电脑模式下，隐藏补全框
                if (this.suggestionsContainer) {
                    this.suggestionsContainer.style.display = 'none';
                }
            } else {
                // 在手机模式下，显示补全框
                if (this.suggestionsContainer) {
                    this.suggestionsContainer.style.display = 'flex';
                }
            }
        } else {
            // 如果无法获取模式信息，根据键盘容器的显示状态来判断
            const keyboardContainer = document.getElementById('keyboard-container');
            if (keyboardContainer && this.suggestionsContainer) {
                // 如果键盘被隐藏（在电脑模式下），也隐藏补全框
                if (keyboardContainer.classList.contains('hide-keyboard')) {
                    this.suggestionsContainer.style.display = 'none';
                } else {
                    this.suggestionsContainer.style.display = 'flex';
                }
            }
        }
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 监听代码变化事件
        window.addEventListener('codeUpdated', (e) => {
            this.updateAutocomplete();
        });
        
        // 监听键盘输入事件
        // 由于软键盘是通过script.js中的handleKeyInput函数处理的，
        // 我们需要在适当的地方调用更新函数
    }
    
    /**
     * 更新补全建议
     */
    updateAutocomplete() {
        // 从全局变量获取最新的代码和光标位置
        if (typeof globalText !== 'undefined') {
            this.globalText = globalText;
        }
        if (typeof globalCursorPos !== 'undefined') {
            this.globalCursorPos = globalCursorPos;
        }
        
        // 计算补全建议
        const suggestions = this.calculateSuggestions();
        
        // 显示补全建议
        this.showSuggestions(suggestions);
    }
    
    /**
     * 计算补全建议
     */
    calculateSuggestions() {
        // 获取光标前的文本，用于判断补全上下文
        const textBeforeCursor = this.globalText.substring(0, this.globalCursorPos);
        
        // 检查是否在预处理指令上下文中
        if (textBeforeCursor.trim().endsWith('#')) {
            // 提供预处理指令补全
            return this.preprocessorDirectives.slice(0, 10);
        }
        
        // 检查是否在#include语句中
        if (/#include\s*$/.test(textBeforeCursor.trim())) {
            // 提供头文件补全
            return this.cppHeaders.map(header => `<${header}>`).slice(0, 10);
        }
        
        // 检查是否在#include <...>中
        if (/#include\s*<[^>]*$/.test(textBeforeCursor)) {
            // 提取当前输入的部分
            const match = textBeforeCursor.match(/#include\s*<([^>]*)$/);
            if (match) {
                const currentInput = match[1];
                if (currentInput) {
                    // 过滤出以当前输入开头的头文件
                    return this.cppHeaders
                        .filter(header => header.toLowerCase().startsWith(currentInput.toLowerCase()))
                        .map(header => `<${header}>`)
                        .slice(0, 10);
                } else {
                    return this.cppHeaders.map(header => `<${header}>`).slice(0, 10);
                }
            }
        }
        
        const lastWordMatch = textBeforeCursor.match(/[\w]+$/);
        const lastChar = textBeforeCursor.slice(-1);

        // 如果当前输入的是字母或下划线，提供补全建议
        if (/[a-zA-Z_]/.test(lastChar)) {
            const currentWord = lastWordMatch ? lastWordMatch[0] : '';

            // 根据上下文提供不同的补全建议
            let suggestions = [];

            // 如果是在点号后面，提供成员函数/属性补全
            if (textBeforeCursor.endsWith('.')) {
                suggestions = this.getMemberSuggestions(textBeforeCursor);
            } else {
                // 普通补全：关键字、函数、对象、容器等
                suggestions = this.getGeneralSuggestions(currentWord);
            }

            // 过滤出以当前输入开头的建议
            if (currentWord) {
                suggestions = suggestions.filter(suggestion => 
                    suggestion.toLowerCase().startsWith(currentWord.toLowerCase())
                ).slice(0, 10); // 限制最多10个建议
            } else {
                // 如果还没有输入字母，只显示最常用的几个
                suggestions = suggestions.slice(0, 5);
            }
            
            return suggestions;
        }
        
        // 如果当前输入的不是字母，返回空建议，但仍显示空白条
        return [];
    }
    
    /**
     * 获取普通补全建议
     */
    getGeneralSuggestions(currentWord) {
        let suggestions = [];

        // 获取光标前的文本，用于判断上下文
        const textBeforeCursor = this.globalText.substring(0, this.globalCursorPos);
        
        // 检查是否在#include语句中
        if (textBeforeCursor.trim().endsWith('#include')) {
            // 提供头文件补全
            suggestions = suggestions.concat(this.cppHeaders.map(header => `<${header}>`));
        }
        // 检查是否在预处理指令中
        else if (textBeforeCursor.trim().endsWith('#')) {
            // 提供预处理指令补全
            suggestions = suggestions.concat(this.preprocessorDirectives);
        }
        else {
            // 添加关键字
            suggestions = suggestions.concat(this.cppKeywords);

            // 添加标准库函数
            suggestions = suggestions.concat(this.cppFunctions.map(fn => fn + '()'));

            // 添加标准对象
            suggestions = suggestions.concat(this.cppObjects);

            // 添加STL容器
            suggestions = suggestions.concat(this.stlContainers);

            // 从当前代码中提取变量名和函数名
            const codeSuggestions = this.extractIdentifiersFromCode();
            suggestions = suggestions.concat(codeSuggestions);
        }

        // 去重并按长度排序
        suggestions = [...new Set(suggestions)];

        return suggestions;
    }
    
    /**
     * 获取成员补全建议（点号后的补全）
     */
    getMemberSuggestions(textBeforeCursor) {
        // 简单实现：获取点号前的标识符
        const beforeDot = textBeforeCursor.slice(0, -1); // 移除最后的点号
        const identifierMatch = beforeDot.match(/[\w]+$/);
        
        if (identifierMatch) {
            const identifier = identifierMatch[0];
            
            // 根据标识符类型提供相应的成员
            if (this.stlContainers.includes(identifier)) {
                // 如果是STL容器，提供相应的方法
                return this.getSTLMethodSuggestions(identifier);
            } else {
                // 否则提供通用成员
                return ['begin()', 'end()', 'size()', 'empty()', 'clear()'];
            }
        }
        
        return [];
    }
    
    /**
     * 获取STL容器方法补全建议
     */
    getSTLMethodSuggestions(containerType) {
        const methodMap = {
            'vector': ['begin()', 'end()', 'rbegin()', 'rend()', 'size()', 'max_size()', 'resize()', 'empty()', 'reserve()', 'capacity()', 'shrink_to_fit()', 'clear()', 'insert()', 'erase()', 'push_back()', 'pop_back()', 'resize()', 'swap()', 'at()', 'front()', 'back()', 'data()', 'assign()', 'emplace()', 'emplace_back()', 'operator[]'],
            'queue': ['push()', 'pop()', 'front()', 'back()', 'empty()', 'size()'],
            'stack': ['push()', 'pop()', 'top()', 'empty()', 'size()'],
            'set': ['begin()', 'end()', 'rbegin()', 'rend()', 'find()', 'count()', 'lower_bound()', 'upper_bound()', 'equal_range()', 'insert()', 'erase()', 'clear()', 'swap()', 'size()', 'max_size()', 'empty()'],
            'map': ['begin()', 'end()', 'rbegin()', 'rend()', 'find()', 'count()', 'lower_bound()', 'upper_bound()', 'equal_range()', 'insert()', 'emplace()', 'erase()', 'clear()', 'swap()', 'at()', 'operator[]', 'size()', 'max_size()', 'empty()'],
            'string': ['begin()', 'end()', 'rbegin()', 'rend()', 'size()', 'length()', 'max_size()', 'resize()', 'capacity()', 'reserve()', 'clear()', 'empty()', 'shrink_to_fit()', 'operator[]', 'at()', 'back()', 'front()', 'c_str()', 'data()', 'substr()', 'copy()', 'compare()', 'find()', 'rfind()', 'find_first_of()', 'find_last_of()', 'find_first_not_of()', 'find_last_not_of()', 'append()', 'operator+=', 'push_back()', 'assign()', 'insert()', 'erase()', 'replace()', 'swap()', 'getline()'],
            'pair': ['first', 'second']
        };
        
        return methodMap[containerType] || ['begin()', 'end()', 'size()', 'empty()', 'clear()'];
    }
    
    /**
     * 从代码中提取标识符（变量名、函数名等）
     */
    extractIdentifiersFromCode() {
        const identifiers = [];
        const code = this.globalText;
        
        // 匹配变量声明: type name 或 type name[N] 或 type name(...);
        const varDeclarationRegex = /\b(auto|int|float|double|char|bool|long|short|unsigned|signed|void|size_t|string|vector|array|queue|stack|set|map|unordered_map|unordered_set|list|deque|priority_queue|complex|pair|[\w:<>]+)\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)/g;
        let match;
        
        while ((match = varDeclarationRegex.exec(code)) !== null) {
            const varList = match[2]; // 获取变量名部分
            const individualVars = varList.split(/\s*,\s*/); // 按逗号分割
            
            for (const varName of individualVars) {
                const trimmedVarName = varName.trim();
                if (trimmedVarName) {
                    identifiers.push(trimmedVarName);
                }
            }
        }
        
        // 匹配函数定义: returnType functionName(params)
        const functionRegex = /\b([\w_:*&:<>]+)\s+([a-zA-Z_]\w*)\s*\([^)]*\)\s*[{;]/g;
        while ((match = functionRegex.exec(code)) !== null) {
            const functionName = match[2];
            if (functionName) {
                identifiers.push(functionName);
            }
        }
        
        return identifiers;
    }
    
    /**
     * 显示补全建议
     */
    showSuggestions(suggestions) {
        // 清空容器
        this.suggestionsContainer.innerHTML = '';

        if (suggestions.length > 0) {
            // 创建建议项容器
            const suggestionsWrapper = document.createElement('div');
            suggestionsWrapper.className = 'mobile-autocomplete-suggestions-wrapper';
            suggestionsWrapper.style.cssText = 'display: flex; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; white-space: nowrap; height: 100%; scrollbar-width: none; -ms-overflow-style: none;';
            
            // 隐藏滚动条的样式
            suggestionsWrapper.style.msOverflowStyle = 'none';  // IE 和 Edge
            suggestionsWrapper.style.scrollbarWidth = 'none';  // Firefox

            suggestions.forEach((suggestion, index) => {
                const suggestionElement = document.createElement('span');
                suggestionElement.className = 'mobile-autocomplete-item';
                suggestionElement.textContent = suggestion;

                // 添加点击事件
                suggestionElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleSuggestionClick(suggestion);
                });

                // 如果不是最后一项，添加分隔空格
                if (index < suggestions.length - 1) {
                    suggestionsWrapper.appendChild(suggestionElement);

                    // 添加两个空格作为分隔
                    const spacer = document.createElement('span');
                    spacer.innerHTML = '&nbsp;&nbsp;';
                    suggestionsWrapper.appendChild(spacer);
                } else {
                    suggestionsWrapper.appendChild(suggestionElement);
                }
            });

            // 创建左侧滚动按钮
            const leftScrollBtn = document.createElement('span');
            leftScrollBtn.className = 'mobile-autocomplete-scroll-btn';
            leftScrollBtn.innerHTML = '&#8592;'; // ←
            leftScrollBtn.style.cssText = 'margin: 0 5px; cursor: pointer; user-select: none; color: #888; font-weight: bold;';
            leftScrollBtn.addEventListener('click', () => {
                this.scrollSuggestions(-100); // 向左滚动100像素
            });

            // 创建右侧滚动按钮
            const rightScrollBtn = document.createElement('span');
            rightScrollBtn.className = 'mobile-autocomplete-scroll-btn';
            rightScrollBtn.innerHTML = '&#8594;'; // →
            rightScrollBtn.style.cssText = 'margin: 0 5px; cursor: pointer; user-select: none; color: #888; font-weight: bold;';
            rightScrollBtn.addEventListener('click', () => {
                this.scrollSuggestions(100); // 向右滚动100像素
            });

            // 添加滚动按钮和建议项容器到主容器
            this.suggestionsContainer.appendChild(leftScrollBtn);
            this.suggestionsContainer.appendChild(suggestionsWrapper);
            this.suggestionsContainer.appendChild(rightScrollBtn);

            // 检查是否需要显示滚动按钮
            setTimeout(() => {
                this.updateScrollButtonsVisibility(suggestionsWrapper, leftScrollBtn, rightScrollBtn);
            }, 0);
        } else {
            // 即使没有建议，也要保持容器的高度，显示空白条
            this.suggestionsContainer.style.height = '40px';
        }

        // 保存当前建议
        this.currentSuggestions = suggestions;
    }
    
    /**
     * 滚动建议列表
     */
    scrollSuggestions(offset) {
        const suggestionsWrapper = this.suggestionsContainer.querySelector('.mobile-autocomplete-suggestions-wrapper');
        if (suggestionsWrapper) {
            suggestionsWrapper.scrollBy({ left: offset, behavior: 'smooth' });
            
            // 滚动后更新按钮可见性
            setTimeout(() => {
                const leftScrollBtn = this.suggestionsContainer.querySelector('.mobile-autocomplete-scroll-btn:first-child');
                const rightScrollBtn = this.suggestionsContainer.querySelector('.mobile-autocomplete-scroll-btn:last-child');
                if (leftScrollBtn && rightScrollBtn) {
                    this.updateScrollButtonsVisibility(suggestionsWrapper, leftScrollBtn, rightScrollBtn);
                }
            }, 300); // 等待滚动动画完成
        }
    }
    
    /**
     * 更新滚动按钮的可见性
     */
    updateScrollButtonsVisibility(suggestionsWrapper, leftBtn, rightBtn) {
        if (suggestionsWrapper && leftBtn && rightBtn) {
            // 检查是否可以向左滚动
            if (suggestionsWrapper.scrollLeft > 0) {
                leftBtn.style.visibility = 'visible';
                leftBtn.style.opacity = '1';
            } else {
                leftBtn.style.visibility = 'hidden';
                leftBtn.style.opacity = '0';
            }
            
            // 检查是否可以向右滚动
            const maxScroll = suggestionsWrapper.scrollWidth - suggestionsWrapper.clientWidth;
            if (suggestionsWrapper.scrollLeft < maxScroll) {
                rightBtn.style.visibility = 'visible';
                rightBtn.style.opacity = '1';
            } else {
                rightBtn.style.visibility = 'hidden';
                rightBtn.style.opacity = '0';
            }
        }
    }
    
    /**
     * 处理建议点击事件
     */
    handleSuggestionClick(suggestion) {
        // 获取当前光标前后的文本
        const textBeforeCursor = this.globalText.substring(0, this.globalCursorPos);
        const textAfterCursor = this.globalText.substring(this.globalCursorPos);

        let newText = this.globalText;
        let newCursorPos = this.globalCursorPos;

        // 检查是否是预处理指令上下文，如 #include 或其他以 # 开头的
        // 三种情况：
        // 1. #include 后面直接跟内容：#include|
        // 2. #include 后有空格：#include |
        // 3. #include <...> 中：#include <iostream|
        const includeMatch = textBeforeCursor.match(/(#include\s*<?)[^<>\s]*$/);
        const preprocessorMatch = textBeforeCursor.match(/(#)[\w]*$/);
        
        if (includeMatch) {
            // 处理 #include 语境
            const prefix = includeMatch[1]; // '#include' 或 '#include ' 或 '#include <'
            const wordStartPos = this.globalCursorPos - includeMatch[0].length;
            
            // 构建新文本
            newText = this.globalText.substring(0, wordStartPos) +
                     prefix + suggestion +
                     textAfterCursor;

            // 更新光标位置
            newCursorPos = wordStartPos + prefix.length + suggestion.length;
        } else if (textBeforeCursor.endsWith('#include')) {
            // 特殊处理：光标在 #include 后面，没有空格或 <>
            const prefix = '#include ';
            const wordStartPos = this.globalCursorPos - '#include'.length;
            
            // 构建新文本
            newText = this.globalText.substring(0, wordStartPos) +
                     prefix + suggestion +
                     textAfterCursor;

            // 更新光标位置
            newCursorPos = wordStartPos + prefix.length + suggestion.length;
        } else if (preprocessorMatch) {
            // 处理其他预处理指令语境
            const prefix = preprocessorMatch[1]; // '#'
            const wordStartPos = this.globalCursorPos - preprocessorMatch[0].length;
            
            // 构建新文本
            newText = this.globalText.substring(0, wordStartPos) +
                     prefix + suggestion +
                     textAfterCursor;

            // 更新光标位置
            newCursorPos = wordStartPos + prefix.length + suggestion.length;
        } else {
            // 找到最后一个单词
            const lastWordMatch = textBeforeCursor.match(/[\w]+$/);

            if (lastWordMatch) {
                // 替换最后一个单词为选中的建议
                const lastWord = lastWordMatch[0];
                const wordStartPos = this.globalCursorPos - lastWord.length;

                // 构建新文本
                newText = this.globalText.substring(0, wordStartPos) +
                         suggestion +
                         textAfterCursor;

                // 更新光标位置
                newCursorPos = wordStartPos + suggestion.length;
            } else {
                // 如果没有找到单词，直接在当前位置插入
                newText = textBeforeCursor + suggestion + textAfterCursor;
                newCursorPos = this.globalCursorPos + suggestion.length;
            }
        }

        // 更新全局文本和光标位置（直接更新全局变量）
        globalText = newText;
        globalCursorPos = newCursorPos;

        // 同步更新实例变量
        this.globalText = newText;
        this.globalCursorPos = newCursorPos;

        // 在手机模式下，立即刷新3行预览以确保用户看到更新
        if (typeof window.renderThreeLines === 'function') {
            // 重新渲染3行预览
            window.renderThreeLines();
        }

        // 然后更新其他编辑器组件
        this.updateEditorDisplay();

        // 清空建议
        this.showSuggestions([]);

        // 确保界面同步更新
        // 直接调用syncState来确保所有界面组件同步更新
        setTimeout(() => {
            if (typeof window.syncState === 'function') {
                window.syncState();
            }
        }, 10); // 稍微延迟以确保其他更新已完成
    }
    
    /**
     * 更新编辑器显示
     */
    updateEditorDisplay() {
        // 使用全局变量值
        const currentText = typeof globalText !== 'undefined' ? globalText : this.globalText;
        const currentCursorPos = typeof globalCursorPos !== 'undefined' ? globalCursorPos : this.globalCursorPos;

        // 更新Monaco编辑器（如果存在）
        if (window.monacoEditor) {
            // 设置标志以避免触发内容变化事件
            window.isUpdatingProgrammatically = true;
            window.monacoEditor.setValue(currentText);
            if (typeof currentCursorPos !== 'undefined') {
                const position = window.monacoEditor.getModel().getPositionAt(currentCursorPos);
                window.monacoEditor.setPosition(position);
            }
        }

        // 更新全屏编辑器（如果存在）
        const fullEditor = document.getElementById('full-editor');
        if (fullEditor) {
            fullEditor.value = currentText;
            fullEditor.setSelectionRange(currentCursorPos, currentCursorPos);
        }

        // 更新3行预览（如果在手机模式下）
        if (window.isFullMode === false && typeof window.renderThreeLines === 'function') {
            window.renderThreeLines();
        }
        
        // 触发代码更新事件，但不调用syncState以避免循环
        window.dispatchEvent(new CustomEvent('codeUpdated'));
        
        // 强制更新界面
        setTimeout(() => {
            // 如果在手机模式下，确保3行预览被更新
            if (window.isFullMode === false && typeof window.renderThreeLines === 'function') {
                window.renderThreeLines();
            }
            
            // 强制重绘界面
            const container = document.getElementById('lines-container');
            if (container) {
                container.style.display = 'none';
                setTimeout(() => {
                    container.style.display = 'flex';
                }, 10);
            }
        }, 0);
    }
    
    /**
     * 获取当前编辑器内容
     */
    getCurrentContent() {
        return {
            text: (typeof window.globalText !== 'undefined') ? window.globalText : this.globalText,
            cursorPos: (typeof window.globalCursorPos !== 'undefined') ? window.globalCursorPos : this.globalCursorPos
        };
    }
    
    /**
     * 手动触发补全更新
     */
    triggerUpdate() {
        this.updateAutocomplete();
    }
}

// 初始化函数
function initMobileAutocomplete() {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupMobileAutocomplete();
        });
    } else {
        setupMobileAutocomplete();
    }
}

// 设置移动补全功能
function setupMobileAutocomplete() {
    const keyboardContainer = document.getElementById('keyboard-container');
    
    if (keyboardContainer) {
        // 创建移动补全实例
        window.mobileAutocomplete = new MobileAutocomplete(null, keyboardContainer);
        
        // 监听软键盘输入事件
        // 由于script.js中的handleKeyInput函数处理软键盘输入，
        // 我们需要在全局范围内提供一个接口来更新补全
        window.updateMobileAutocomplete = function() {
            if (window.mobileAutocomplete) {
                window.mobileAutocomplete.triggerUpdate();
            }
        };
    }
}

// 页面加载完成后初始化
initMobileAutocomplete();