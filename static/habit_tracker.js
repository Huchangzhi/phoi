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
                // 监听编辑器内容变化
                monacoEditor.onDidChangeModelContent((e) => {
                    const changes = e.changes;
                    const model = monacoEditor.getModel();
                    const position = monacoEditor.getPosition();
                    
                    for (const change of changes) {
                        const text = change.text;
                        
                        // 如果插入的文本长度 >= 2 且不是普通输入
                        if (text.length >= 2) {
                            const word = model.getWordUntilPosition(position);
                            const prefix = word ? word.word : '';
                            
                            // 如果插入的文本和前面的单词匹配，可能是建议
                            if (prefix && text.startsWith(prefix) && text.length > prefix.length) {
                                this.recordSelection(text, prefix, 'completion_accept');
                            }
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
        // 增加选择计数
        if (!this.data.selectionCounts[label]) {
            this.data.selectionCounts[label] = 0;
        }
        this.data.selectionCounts[label]++;
        
        // 记录上下文关联
        if (prefix) {
            const contextKey = `${prefix}->${label}`;
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

        // 基础分数：被选中的次数越多，分数越高（权重加大）
        const selectionCount = this.data.selectionCounts[label] || 0;
        score += selectionCount * 100;  // 从 10 改为 100

        // 上下文匹配：如果当前前缀下这个建议经常被选择（权重加大）
        const contextKey = `${prefix}->${label}`;
        const contextCount = this.data.contextPairs[contextKey] || 0;
        score += contextCount * 200;  // 从 20 改为 200

        // 流行度加成：常用头文件有额外加成
        const headerName = label.replace(/[<>]/g, '');
        if (this.data.preferredHeaders.includes(headerName)) {
            score += 500;  // 从 50 改为 500
        }

        return score;
    },

    // 对建议列表进行排序
    sortSuggestions(suggestions, prefix = '') {
        // 为每个建议计算分数
        const scored = suggestions.map((s) => {
            const score = this.getScore(s.label, prefix);
            // 设置 sortText 来控制 Monaco 的排序
            // 分数越高，sortText 越靠前（字母顺序越前，即字母越小）
            const scorePrefix = Math.floor(score / 100);
            const c1 = String.fromCharCode(122 - Math.min(25, Math.floor(scorePrefix / 26)));
            const c2 = String.fromCharCode(122 - Math.min(25, scorePrefix % 26));
            const c3 = String.fromCharCode(122 - Math.min(25, Math.floor(score / 10)));
            
            return {
                ...s,
                _score: score,
                sortText: c1 + c2 + c3 + (s.sortText || s.label)
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
