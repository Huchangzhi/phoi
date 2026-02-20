/**
 * Light Model - 轻量级代码补全 AI 模型
 * 使用 n-gram 统计和逻辑回归进行智能打分
 */

class LightModel {
    constructor() {
        this.ngramTable = null;
        this.loaded = false;
        this.loadPromise = null;
        
        // 自动加载
        this.load();
    }

    /**
     * 加载模型数据
     */
    async load() {
        if (this.loadPromise) return this.loadPromise;
        
        this.loadPromise = (async () => {
            try {
                // 尝试加载压缩版本
                const response = await fetch('/static/models/ngram_table.json.gz');
                if (!response.ok) throw new Error('Failed to load ngram table');
                
                // 解压 gzip 数据
                const compressed = await response.arrayBuffer();
                const decompressed = await this.decompressGzip(compressed);
                this.ngramTable = JSON.parse(decompressed);

                this.loaded = true;
            } catch (error) {
                console.warn('[LightModel] 加载失败，使用备用方案:', error);
                // 加载未压缩版本
                try {
                    const response = await fetch('/static/models/ngram_table.json');
                    if (response.ok) {
                        this.ngramTable = await response.json();
                        this.loaded = true;
                        console.log('[LightModel] 模型已加载（未压缩版本）');
                    }
                } catch (e) {
                    console.warn('[LightModel] 使用内置默认模型');
                    this.ngramTable = this.getDefaultModel();
                    this.loaded = true;
                }
            }
        })();
        
        return this.loadPromise;
    }

    /**
     * 解压 gzip 数据
     */
    async decompressGzip(arrayBuffer) {
        // 使用 DecompressionStream API（现代浏览器支持）
        try {
            const blob = new Blob([arrayBuffer]);
            const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
            const text = await new Response(stream).text();
            return text;
        } catch (e) {
            // 降级方案：假设数据未压缩
            return new TextDecoder().decode(arrayBuffer);
        }
    }

    /**
     * 获取默认模型（当加载失败时使用）
     */
    getDefaultModel() {
        return {
            unigram: {
                'i': 5000, 'j': 2000, 'n': 3000, 'm': 1500,
                'int': 2000, 'for': 1500, 'if': 1800, 'else': 1000,
                'return': 1200, 'cin': 800, 'cout': 800,
                'vector': 600, 'string': 500, 'map': 400, 'set': 300
            },
            includes: {
                'iostream': 500, 'cstdio': 300, 'cstring': 200,
                'cmath': 250, 'algorithm': 400, 'vector': 350,
                'string': 300, 'map': 250, 'set': 200
            },
            for_vars: {
                'i': 1366, 'j': 357, 'k': 70
            }
        };
    }

    /**
     * 获取 n-gram 概率
     */
    getNGramProb(tokens, n = 3) {
        if (!this.ngramTable) return 0;
        
        const key = tokens.join(' ');
        const tableKey = n === 3 ? 'trigram' : n === 2 ? 'bigram' : 'unigram';
        const table = this.ngramTable[tableKey];
        
        if (!table || !table[key]) {
            // 回退到更低阶的 n-gram
            if (n > 1) {
                return this.getNGramProb(tokens.slice(1), n - 1);
            }
            return 0.01; // 平滑值
        }
        
        // 计算概率（归一化）
        const counts = Object.values(table[key]);
        const total = counts.reduce((a, b) => a + b, 0);
        return counts[0] / total;
    }

    /**
     * 获取头文件概率
     */
    getIncludeProb(header) {
        if (!this.ngramTable || !this.ngramTable.includes) {
            return 0;
        }

        const count = this.ngramTable.includes[header] || 0;
        const total = Object.values(this.ngramTable.includes).reduce((a, b) => a + b, 0);
        return count / total;
    }

    /**
     * 获取 for 循环变量概率
     */
    getForVarProb(varName) {
        if (!this.ngramTable || !this.ngramTable.for_vars) return 0;
        
        const count = this.ngramTable.for_vars[varName] || 0;
        const total = Object.values(this.ngramTable.for_vars).reduce((a, b) => a + b, 0);
        return count / total;
    }

    /**
     * 获取 unigram 频率
     */
    getUnigramFreq(token) {
        if (!this.ngramTable || !this.ngramTable.unigram) return 0;
        
        return this.ngramTable.unigram[token] || 0;
    }

    /**
     * 对建议进行 AI 打分
     * @param {Array} suggestions - 建议列表
     * @param {Object} features - 特征对象（来自 CodeFeatures）
     * @returns {Array} 带 AI 分数的建议列表
     */
    scoreSuggestions(suggestions, features) {
        if (!this.loaded || !this.ngramTable) {
            // 模型未加载，返回默认分数
            return suggestions.map(s => ({
                ...s,
                _aiScore: 0,
                _aiFactors: { ngram: 0, context: 0, frequency: 0 }
            }));
        }

        return suggestions.map(suggestion => {
            const label = suggestion.label;
            const cleanLabel = label.replace(/[()<>]/g, '').split(/[<\(]/)[0];
            
            let score = 0;
            const factors = {
                ngram: 0,
                context: 0,
                frequency: 0
            };

            // 1. n-gram 概率分数（最高 300 分）
            if (features.prevTokens && features.prevTokens.length >= 2) {
                const tokens3 = [...features.prevTokens.slice(-2), cleanLabel];
                const tokens2 = [...features.prevTokens.slice(-1), cleanLabel];
                
                const prob3 = this.getNGramProb(tokens3, 3);
                const prob2 = this.getNGramProb(tokens2, 2);
                
                // 使用 trigram 和 bigram 的加权平均
                factors.ngram = (prob3 * 300 + prob2 * 200) * 1000;
            }

            // 2. 上下文匹配分数（最高 500 分）
            if (features.isInInclude) {
                // 头文件上下文
                factors.context = this.getIncludeProb(cleanLabel) * 5000;
            } else if (features.isForLoop) {
                // for 循环上下文
                factors.context = this.getForVarProb(cleanLabel) * 3000;
            } else if (features.isAfterDot) {
                // 成员访问上下文 - 检查是否是常用方法
                const commonMethods = ['push_back', 'size', 'begin', 'end', 'clear', 'empty', 'insert', 'erase'];
                if (commonMethods.includes(cleanLabel)) {
                    factors.context = 200;
                }
            } else if (features.isDeclaration) {
                // 声明上下文 - STL 容器优先
                if (features.variableType !== 'unknown') {
                    factors.context = 150;
                }
            }

            // 3. 频率分数（最高 200 分）
            const freq = this.getUnigramFreq(cleanLabel);
            factors.frequency = Math.min(200, Math.log10(freq + 1) * 50);

            // 总分
            score = factors.ngram + factors.context + factors.frequency;

            return {
                ...suggestion,
                _aiScore: score,
                _aiFactors: factors
            };
        });
    }

    /**
     * 获取建议的 AI 分数
     */
    getScore(suggestion, features) {
        if (!this.loaded || !this.ngramTable) return 0;
        
        const scored = this.scoreSuggestions([suggestion], features);
        return scored[0]._aiScore || 0;
    }

    /**
     * 直接获取上下文相关分数（更快，用于实时排序）
     */
    getContextScore(label, features) {
        if (!this.loaded || !this.ngramTable) {
            return 0;
        }
        
        const cleanLabel = label.replace(/[()<>]/g, '').split(/[<\(]/)[0];
        let score = 0;

        // 1. 头文件上下文
        if (features.isInInclude) {
            const prob = this.getIncludeProb(cleanLabel);
            score += prob * 10000;
        }

        // 2. for 循环上下文
        if (features.isForLoop) {
            const prob = this.getForVarProb(cleanLabel);
            score += prob * 5000;
        }

        // 3. 频率分数
        const freq = this.getUnigramFreq(cleanLabel);
        score += Math.min(300, Math.log10(freq + 1) * 80);

        return score;
    }

    /**
     * 获取模型统计信息
     */
    getStats() {
        if (!this.ngramTable) return null;
        
        return {
            unigramCount: Object.keys(this.ngramTable.unigram || {}).length,
            bigramCount: Object.keys(this.ngramTable.bigram || {}).length,
            trigramCount: Object.keys(this.ngramTable.trigram || {}).length,
            includeCount: Object.keys(this.ngramTable.includes || {}).length,
            forVarCount: Object.keys(this.ngramTable.for_vars || {}).length
        };
    }
}

// 创建全局实例（自动加载模型）
window.LightModel = new LightModel();

// 导出类以便调试
window.LightModelClass = LightModel;
