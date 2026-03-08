// 用户习惯追踪器 - 轻量级机器学习模块
// 用于记录和分析用户的代码补全习惯，优化提示排序

const HabitTracker = {
    // 存储键名
    STORAGE_KEY: 'phoi_userHabits',
    
    // 数据结构
    data: {
        // 每个建议被选中的次数 { label: count }
        selectionCounts: {},
        // 上下文关联 { "prefix->label": count }
        contextPairs: {},
        // 用户常用头文件列表
        preferredHeaders: [],
        // 最后更新时间
        lastUpdated: null
    },
    
    // 初始化
    init() {
        this.loadFromStorage();
        
        // 监听 Monaco 编辑器的建议接受事件
        this.setupMonacoListener();
    },
    
    // 设置 Monaco 编辑器监听器，记录用户选择的建议
    setupMonacoListener() {
        // 等待 Monaco 编辑器初始化
        const setup = () => {
            if (typeof monacoEditor !== 'undefined' && monacoEditor) {
                let prefixBeforeChange = null;
                
                // 方法 1：监听键盘事件，在 Tab/Enter 前记录前缀
                monacoEditor.onKeyDown((e) => {
                    const keyCode = e.keyCode;
                    // Tab = 2, Enter = 3
                    if (keyCode === 2 || keyCode === 3) {
                        const model = monacoEditor.getModel();
                        const position = monacoEditor.getPosition();
                        const word = model.getWordUntilPosition(position);
                        if (word && word.word && word.word.length >= 1) {
                            prefixBeforeChange = word.word;
                            // 200ms 后清除，避免误用
                            setTimeout(() => { prefixBeforeChange = null; }, 200);
                        }
                    }
                });
                
                // 方法 2：监听编辑器内容变化，检测建议接受
                monacoEditor.onDidChangeModelContent((e) => {
                    const model = monacoEditor.getModel();
                    const position = monacoEditor.getPosition();
                    const word = model.getWordUntilPosition(position);
                    const currentWord = word ? word.word : '';
                    
                    for (const change of e.changes) {
                        const text = change.text;
                        const rangeLength = change.rangeLength || 0;
                        
                        // 检测建议接受的条件：
                        // 1. 插入的净长度至少为 2 个字符
                        // 2. 插入的文本长度至少为 3
                        // 3. 有前缀（从键盘事件或当前单词获取）
                        // 4. 插入的文本以前缀开头
                        const netInsertLength = text.length - rangeLength;
                        
                        // 使用前缀：优先使用键盘事件记录的，否则使用当前单词
                        const prefix = prefixBeforeChange || (currentWord && currentWord.length >= 1 ? currentWord : null);
                        
                        if (netInsertLength >= 2 && text.length >= 3 && prefix && text.startsWith(prefix)) {
                            this.recordSelection(text, prefix, 'completion_accept');
                            prefixBeforeChange = null; // 清除前缀，避免重复使用
                        }
                    }
                });
                
                // 方法 3：监听光标选择变化，检测建议接受
                monacoEditor.onDidChangeCursorSelection((e) => {
                    // 检查是否是因为接受建议导致的光标变化
                    if (e.source === 'acceptSuggestion') {
                        const model = monacoEditor.getModel();
                        const position = e.selection.getPosition();
                        const word = model.getWordUntilPosition(position);
                        // 使用之前记录的前缀
                        const prefix = prefixBeforeChange || '';
                        if (word && word.word && word.word.length >= 2) {
                            this.recordSelection(word.word, prefix, 'suggestion_accepted');
                        }
                    }
                });
            } else {
                setTimeout(setup, 500);
            }
        };

        setTimeout(setup, 1000);
    },
    
    // 记录建议被展示（用于曝光加权）- 已禁用，因为会污染数据
    recordExposure(label, prefix = '', rank = 100) {
        // 这个方法已禁用，不再使用曝光数据
        // 只记录用户实际选择的建议
    },
    
    // 从 localStorage 加载数据
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.data = JSON.parse(stored);
            }
        } catch (e) {
            console.error('[HabitTracker] 加载数据失败:', e);
            this.data = {
                selectionCounts: {},
                contextPairs: {},
                preferredHeaders: [],
                lastUpdated: null
            };
        }
    },
    
    // 保存到 localStorage
    saveToStorage() {
        try {
            this.data.lastUpdated = Date.now();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('[HabitTracker] 保存数据失败:', e);
        }
    },
    
    // 记录用户选择了一个建议
    recordSelection(label, prefix = '', context = '') {
        // 去掉标签末尾的括号，使其与 Monaco 编辑器的建议格式一致
        // 例如：reverse() -> reverse, printf() -> printf
        const normalizedLabel = label.replace(/\(\)$/, '');
        
        // 增加选择计数
        if (!this.data.selectionCounts[normalizedLabel]) {
            this.data.selectionCounts[normalizedLabel] = 0;
        }
        this.data.selectionCounts[normalizedLabel]++;

        // 记录上下文关联
        if (prefix) {
            const contextKey = `${prefix}->${normalizedLabel}`;
            if (!this.data.contextPairs[contextKey]) {
                this.data.contextPairs[contextKey] = 0;
            }
            this.data.contextPairs[contextKey]++;
        }

        // 如果是头文件，添加到常用列表
        if (label.includes('.') || label.startsWith('<') || label.endsWith('>')) {
            const headerName = label.replace(/[<>]/g, '');
            if (!this.data.preferredHeaders.includes(headerName)) {
                this.data.preferredHeaders.push(headerName);
            }
        }

        // 保存数据
        this.saveToStorage();
    },

    // 获取建议的分数（用于排序）
    getScore(label, prefix = '') {
        let score = 0;

        // 基础分数：被选中的次数越多，分数越高（使用对数增长，避免无限增长）
        const selectionCount = this.data.selectionCounts[label] || 0;
        score += Math.log10(selectionCount + 1) * 1000;

        // 上下文匹配：如果当前前缀下这个建议经常被选择，给予更高权重
        const contextKey = `${prefix}->${label}`;
        const contextCount = this.data.contextPairs[contextKey] || 0;
        score += Math.log10(contextCount + 1) * 2000;

        // 流行度加成：常用头文件有额外加成
        const headerName = label.replace(/[<>]/g, '');
        if (this.data.preferredHeaders.includes(headerName)) {
            score += 500;
        }

        return score;
    },

    // 对建议列表进行排序（混合打分：用户习惯 + AI 模型）
    sortSuggestions(suggestions, prefix = '', code = '', cursorPos = 0) {
        // 提取代码特征（如果提供了代码和光标位置）
        let features = null;
        if (typeof CodeFeatures !== 'undefined' && code && typeof cursorPos === 'number') {
            const featureExtractor = new CodeFeatures();
            features = featureExtractor.extract(code, cursorPos, prefix);
        }

        // 检查 LightModel 是否可用
        const lm = window.LightModel;
        const hasLightModel = typeof lm !== 'undefined';
        const modelLoaded = lm ? lm.loaded : false;

        // 为每个建议计算分数（混合打分：50% 习惯 + 50% AI）
        const scored = suggestions.map((s) => {
            // 1. 用户习惯分数
            const habitScore = this.getScore(s.label, prefix);

            // 2. AI 模型分数（0-1000 分）
            let aiScore = 0;

            if (features && hasLightModel && modelLoaded) {
                aiScore = lm.getContextScore(s.label, features);
            }

            // 3. 混合分数：50% 习惯 + 50% AI
            const totalScore = habitScore * 0.5 + aiScore * 0.5;

            // 设置 sortText 来控制 Monaco 的排序
            // 分数越高，sortText 越靠前（字母顺序越前，即字母越小）
            // 使用 4 个字符的分级，支持更大的分数范围
            const score1 = Math.min(25, Math.floor(totalScore / 400));
            const score2 = Math.min(25, Math.floor((totalScore % 400) / 16));
            const score3 = Math.min(25, Math.floor((totalScore % 16) / 1.5));
            const score4 = Math.min(25, Math.floor((totalScore % 1.5) * 15));

            const sortPrefix = String.fromCharCode(122 - score1) +
                              String.fromCharCode(122 - score2) +
                              String.fromCharCode(122 - score3) +
                              String.fromCharCode(122 - score4);

            return {
                ...s,
                _score: totalScore,
                _habitScore: habitScore,
                _aiScore: aiScore,
                sortText: sortPrefix + (s.sortText || s.label)
            };
        });

        const sorted = scored.sort((a, b) => {
            // 分数高的排前面
            if (a._score !== b._score) {
                return b._score - a._score;
            }
            // 分数相同时，按原有顺序
            return 0;
        });

        return sorted;
    },
    
    // 获取用户最常用的头文件
    getTopHeaders(limit = 10) {
        return this.data.preferredHeaders.slice(0, limit);
    },
    
    // 获取统计信息（用于调试）
    getStats() {
        return {
            totalSelections: Object.values(this.data.selectionCounts).reduce((a, b) => a + b, 0),
            uniqueLabels: Object.keys(this.data.selectionCounts).length,
            contextPairs: Object.keys(this.data.contextPairs).length,
            preferredHeaders: this.data.preferredHeaders.length,
            lastUpdated: this.data.lastUpdated ? new Date(this.data.lastUpdated).toLocaleString() : '从未'
        };
    },
    
    // 清除用户数据
    clearData() {
        this.data = {
            selectionCounts: {},
            contextPairs: {},
            preferredHeaders: [],
            lastUpdated: null
        };
        this.saveToStorage();
        console.log('[HabitTracker] 已清除用户数据');
    },
    
    // 导出调试命令到全局
    debug() {
        console.log('=== HabitTracker 调试信息 ===');
        console.log('统计信息:', this.getStats());
        console.log('选择次数前 20:', Object.entries(this.data.selectionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
        );
        console.log('常用头文件:', this.getTopHeaders(20));
        console.log('上下文关联前 10:', Object.entries(this.data.contextPairs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
        );
        return this.getStats();
    },

    // 检查 localStorage 中是否有数据
    checkStorage() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) {
            console.log('[HabitTracker] localStorage 中没有数据，键名:', this.STORAGE_KEY);
            return null;
        }
        try {
            const data = JSON.parse(stored);
            console.log('[HabitTracker] localStorage 中的数据:');
            console.log('  - 选择计数:', Object.keys(data.selectionCounts || {}).length, '项');
            console.log('  - 上下文关联:', Object.keys(data.contextPairs || {}).length, '项');
            console.log('  - 常用头文件:', (data.preferredHeaders || []).length, '项');
            console.log('  - 最后更新:', data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '无');
            return data;
        } catch (e) {
            console.error('[HabitTracker] 解析 localStorage 数据失败:', e);
            return null;
        }
    },

    // 手动测试记录功能
    testRecord() {
        console.log('[HabitTracker] 测试记录功能...');
        this.recordSelection('vector', 'vec', 'test');
        this.recordSelection('iostream', '', 'test');
        this.saveToStorage();
        console.log('[HabitTracker] 测试完成！请检查 localStorage 中是否有 phoi_userHabits 数据');
        return this.debug();
    },

    // 清除所有数据并重新开始
    reset() {
        this.clearData();
        console.log('[HabitTracker] 已重置，可以开始重新学习你的习惯');
    }
};

// 自动初始化
HabitTracker.init();

// 导出到全局以便调试
window.HabitTracker = HabitTracker;

// 添加全局调试命令
console.log('[HabitTracker] 已加载，使用 HabitTracker.checkStorage() 检查数据，HabitTracker.debug() 查看详细信息');
