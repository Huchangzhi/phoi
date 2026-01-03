// DOM Elements
const editorWrapper = document.getElementById('editor-wrapper');
const fullEditor = document.getElementById('full-editor');
const highlightLayer = document.getElementById('highlight-layer');
const gutter = document.getElementById('gutter');

const keyboardContainer = document.getElementById('keyboard-container');
const toggleBtn = document.getElementById('mode-toggle-btn');
const runBtn = document.getElementById('run-btn');
const copyBtn = document.getElementById('copy-btn');
const debugBtn = document.getElementById('debug-btn');
const outputPanel = document.getElementById('output-panel');
const outputContent = document.getElementById('output-content');
const closeOutputBtn = document.getElementById('close-output');
const linesContainer = document.getElementById('lines-container');

// 3行模式的元素
const linePrev = document.getElementById('line-prev');
const lineCurr = document.getElementById('line-curr');
const lineNext = document.getElementById('line-next');
const lnPrev = document.getElementById('ln-prev');
const lnCurr = document.getElementById('ln-curr');
const lnNext = document.getElementById('ln-next');

const keys = document.querySelectorAll('.key');
const shiftKeys = document.querySelectorAll('.shift-key');
const ctrlKeys = document.querySelectorAll('.ctrl-key');

const inputModal = document.getElementById('input-modal');
const modalTextarea = document.getElementById('modal-textarea');
const modalRun = document.getElementById('modal-run');
const modalCancel = document.getElementById('modal-cancel');

// AI调试模态框元素
const aiDebugModal = document.getElementById('ai-debug-modal');
const closeAiDebug = document.getElementById('close-ai-debug');
const debugStep = document.getElementById('debug-step');
const configSection = document.getElementById('config-section');
const problemSection = document.getElementById('problem-section');
const debuggingSection = document.getElementById('debugging-section');
const apiBaseUrlInput = document.getElementById('api-base-url');
const apiKeyInput = document.getElementById('api-key');
const apiModelInput = document.getElementById('api-model');
const saveConfigBtn = document.getElementById('save-config-btn');
const problemDescInput = document.getElementById('problem-desc');
const sampleInputInput = document.getElementById('sample-input');
const sampleOutputInput = document.getElementById('sample-output');
const aiCodeOutput = document.getElementById('ai-code-output');
const replaceCodeBtn = document.getElementById('replace-code-btn');
const userQueryInput = document.getElementById('user-query');
const sendQueryBtn = document.getElementById('send-query-btn');
const aiResponseBox = document.getElementById('ai-response');
const prevProblemBtn = document.getElementById('prev-problem-btn');
const startDebugBtn = document.getElementById('start-debug-btn');
const usePublicApiBtn = document.getElementById('use-public-api-btn');
const debugOutput = document.getElementById('debug-messages');
const debugLoading = document.getElementById('debug-loading');
const stopDebugBtn = document.getElementById('stop-debug-btn');
const finishDebugBtn = document.getElementById('finish-debug-btn');

// --- 恢复保存的代码 ---
const defaultCode = `#include <iostream>\n#include <vector>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello" << endl;\n\treturn 0;\n};`;
// 如果本地没有保存过，才使用默认代码
let globalText = localStorage.getItem('phoi_savedCode') || defaultCode;
let globalCursorPos = globalText.length;

// --- 恢复保存的模式 ---
let isFullMode = localStorage.getItem('phoi_isFullMode') === 'true';

// --- AI调试相关变量 ---
let currentDebugStep = 1; // 1: 配置, 2: 问题输入, 3: 调试中
let aiConfig = JSON.parse(localStorage.getItem('aiDebugConfig') || '{"baseUrl": "", "apiKey": "", "model": "gpt-3.5-turbo"}');
let debugAttempts = 0;
let maxDebugAttempts = 5;
let isDebugging = false;

let isShiftActive = false;
let isShiftHeld = false;
let shiftUsageFlag = false;
let isCtrlActive = false;
let keyRepeatTimer = null, keyDelayTimer = null;
let saveTimer = null; // 用于防抖保存

// --- [优化] 防抖保存代码到本地 ---
// 避免每次按键都写入硬盘造成卡顿，延迟 500ms 保存
function triggerSaveCode() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        localStorage.setItem('phoi_savedCode', globalText);
    }, 500);
}

// --- 恢复保存的输入数据 ---
modalTextarea.value = localStorage.getItem('phoi_savedStdin') || "";
modalTextarea.addEventListener('input', () => {
    localStorage.setItem('phoi_savedStdin', modalTextarea.value);
});

// Run & Copy
runBtn.addEventListener('click', () => { 
    inputModal.style.display = 'flex'; 
    modalTextarea.focus(); 
});
modalCancel.addEventListener('click', () => { inputModal.style.display = 'none'; });
modalRun.addEventListener('click', () => { 
    inputModal.style.display = 'none'; 
    executeRunCode(modalTextarea.value); 
});

async function executeRunCode(stdin) {
    outputPanel.style.display = 'flex';
    outputContent.innerHTML = '<span style="color:#888;">Compiling and running...</span>';
    try {
        const response = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: globalText, input: stdin })
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        let html = "";
        if(data.Warnings) html += `<div class="out-section"><span class="out-title out-warn">WARNINGS:</span><div class="out-warn">${escapeHtml(data.Warnings)}</div></div>`;
        if(data.Errors) html += `<div class="out-section"><span class="out-title out-err">ERRORS:</span><div class="out-err">${escapeHtml(data.Errors)}</div></div>`;
        if(data.Result) html += `<div class="out-section"><span class="out-title">OUTPUT:</span><div class="out-res">${escapeHtml(data.Result)}</div></div>`;
        else if(!data.Errors) html += `<div class="out-section"><span class="out-title">OUTPUT:</span><div class="out-res" style="color:#666">(No output)</div></div>`;
        if(data.Stats) html += `<div class="out-stat">${escapeHtml(data.Stats)}</div>`;
        outputContent.innerHTML = html;
    } catch (e) {
        outputContent.innerHTML = `<span class="out-err">Server Connection Error: ${e.message}<br>请确定网络状态良好并稍后再试</span>`;
    }
}

function copyCode() {
    const t = document.createElement('textarea'); t.value = globalText; document.body.appendChild(t); t.select();
    try { if(document.execCommand('copy')){ if(navigator.vibrate)navigator.vibrate(50); } else alert('Fail'); } catch(e){}
    document.body.removeChild(t);
}
copyBtn.addEventListener('click', copyCode);
closeOutputBtn.addEventListener('click', () => outputPanel.style.display='none');

// AI调试按钮事件
debugBtn.addEventListener('click', () => {
    aiDebugModal.style.display = 'flex';
    loadAiConfig();
    // 如果已配置API，直接跳转到调试界面，否则先配置
    if (aiConfig.apiKey && aiConfig.baseUrl) {
        currentDebugStep = 1; // 回到配置界面，让用户选择从哪里开始
        showDebugStep(currentDebugStep);
    } else {
        currentDebugStep = 1; // 回到配置界面
        showDebugStep(currentDebugStep);
    }
});

// 关闭AI调试模态框
closeAiDebug.addEventListener('click', () => {
    aiDebugModal.style.display = 'none';
    isDebugging = false;
});

// 使用公共API
usePublicApiBtn.addEventListener('click', () => {
    apiBaseUrlInput.value = 'https://api.suanli.cn/v1';
    apiKeyInput.value = 'sk-W0rpStc95T7JVYVwDYc29IyirjtpPPby6SozFMQr17m8KWeo';
    apiModelInput.value = 'free:Qwen3-30B-A3B';
    showMessage('已填入公共API信息', 'user');
});

// 保存API配置
saveConfigBtn.addEventListener('click', () => {
    aiConfig = {
        baseUrl: apiBaseUrlInput.value,
        apiKey: apiKeyInput.value,
        model: apiModelInput.value
    };
    localStorage.setItem('aiDebugConfig', JSON.stringify(aiConfig));
    showMessage('配置已保存', 'user');
    setTimeout(() => {
        currentDebugStep = 2;
        showDebugStep(currentDebugStep);
    }, 1000);
});

// 上一步按钮
prevProblemBtn.addEventListener('click', () => {
    currentDebugStep = 1;
    showDebugStep(currentDebugStep);
});

// 开始调试按钮
startDebugBtn.addEventListener('click', startAiDebug);

// 停止调试按钮
stopDebugBtn.addEventListener('click', () => {
    isDebugging = false;
    showMessage('调试已停止', 'user');
});

// 完成调试按钮
finishDebugBtn.addEventListener('click', () => {
    aiDebugModal.style.display = 'none';
    isDebugging = false;
});

// 用户与AI交互功能
sendQueryBtn.addEventListener('click', sendUserQuery);

// 代码替换功能
replaceCodeBtn.addEventListener('click', () => {
    if (aiCodeOutput.textContent.trim()) {
        globalText = aiCodeOutput.textContent;
        syncState();
        showMessage('代码已替换到编辑器中', 'user');
    } else {
        showMessage('没有可替换的代码', 'user');
    }
});

// Core Helpers
function escapeHtml(t) { return (t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// 加载AI配置到输入框
function loadAiConfig() {
    apiBaseUrlInput.value = aiConfig.baseUrl || '';
    apiKeyInput.value = aiConfig.apiKey || '';
    apiModelInput.value = aiConfig.model || 'gpt-3.5-turbo';
}

// 显示当前调试步骤
function showDebugStep(step) {
    currentDebugStep = step;

    // 隐藏所有section
    configSection.style.display = 'none';
    problemSection.style.display = 'none';
    debuggingSection.style.display = 'none';

    // 显示当前步骤的section
    if (step === 1) {
        configSection.style.display = 'block';
        debugStep.textContent = '步骤 1/3';
    } else if (step === 2) {
        problemSection.style.display = 'block';
        debugStep.textContent = '步骤 2/3';
    } else if (step === 3) {
        debuggingSection.style.display = 'block';
        debugStep.textContent = '步骤 3/3';
    }
}

// 显示调试消息
function showMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `debug-message ${sender}`;
    messageDiv.innerHTML = `<strong>${sender === 'user' ? '用户:' : 'AI:'}</strong> ${content}`;
    debugOutput.appendChild(messageDiv);
    debugOutput.scrollTop = debugOutput.scrollHeight;
}

// 发送用户查询到AI
async function sendUserQuery() {
    const query = userQueryInput.value.trim();
    if (!query) {
        showMessage('请输入您的问题', 'user');
        return;
    }

    if (!aiConfig.apiKey || !aiConfig.baseUrl) {
        showMessage('请先配置API信息', 'user');
        return;
    }

    try {
        // 显示用户问题
        showMessage(query, 'user');

        // 显示加载动画
        debugLoading.style.display = 'block';

        // 构造提示词，包含当前代码和题目信息
        let prompt = `当前代码：\n${globalText}\n\n`;

        // 如果有题目信息，也包含进去
        if (problemDescInput.value || sampleInputInput.value || sampleOutputInput.value) {
            prompt += `题目描述：\n${problemDescInput.value}\n\n`;
            prompt += `样例输入：\n${sampleInputInput.value}\n\n`;
            prompt += `样例输出：\n${sampleOutputInput.value}\n\n`;
        }

        prompt += `用户问题：${query}\n\n请回答用户的问题，并提供必要的代码修改建议。保持原有码风和变量名，做最少修改。`;

        // 创建一个用于显示流式输出的元素
        const uniqueId = 'ai-query-response-' + Date.now() + Math.floor(Math.random() * 1000);
        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'debug-message ai';
        aiMessageDiv.innerHTML = '<strong>AI:</strong> <span id="' + uniqueId + '"></span>';
        debugOutput.appendChild(aiMessageDiv);
        debugOutput.scrollTop = debugOutput.scrollHeight;

        const contentSpan = document.getElementById(uniqueId);

        // 调用AI API
        const aiResponse = await callOpenAIApiForQueryWithDisplay(prompt, contentSpan);

        // 隐藏加载动画
        debugLoading.style.display = 'none';

        if (!aiResponse) {
            showMessage('AI响应为空', 'user');
            return;
        }

        // 提取代码并显示在代码查看框中
        const extractedCode = extractCodeFromResponse(aiResponse);
        if (extractedCode) {
            aiCodeOutput.textContent = extractedCode;
        }
    } catch (error) {
        debugLoading.style.display = 'none';
        showMessage(`AI交互出错: ${error.message}`, 'user');
        console.error('AI Query Error:', error);
    }
}

// 调用OpenAI API进行查询并实时显示（流式输出）
async function callOpenAIApiForQueryWithDisplay(prompt, contentSpan) {
    const response = await fetch(aiConfig.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
            model: aiConfig.model,
            messages: [{ role: 'user', content: prompt }],
            stream: true  // 使用流式输出
        })
    });

    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiResponse = '';

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6); // 移除 'data: ' 前缀

                    if (data === '[DONE]') {
                        return aiResponse;
                    }

                    try {
                        const parsed = JSON.parse(data);

                        if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                            const content = parsed.choices[0].delta.content;

                            if (content) {
                                aiResponse += content;
                                // 更新显示的内容
                                contentSpan.textContent = aiResponse;
                                debugOutput.scrollTop = debugOutput.scrollHeight;
                            }
                        }
                    } catch (e) {
                        // 忽略解析错误，但如果是正常的数据格式则继续
                        if (data.trim() !== '') {
                            console.warn('无法解析数据:', data, e);
                        }
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    return aiResponse;
}

// 调用OpenAI API进行查询（流式输出）
async function callOpenAIApiForQuery(prompt) {
    const response = await fetch(aiConfig.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
            model: aiConfig.model,
            messages: [{ role: 'user', content: prompt }],
            stream: true  // 使用流式输出
        })
    });

    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiResponse = '';

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6); // 移除 'data: ' 前缀

                    if (data === '[DONE]') {
                        return aiResponse;
                    }

                    try {
                        const parsed = JSON.parse(data);

                        if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                            const content = parsed.choices[0].delta.content;

                            if (content) {
                                aiResponse += content;
                            }
                        }
                    } catch (e) {
                        // 忽略解析错误，但如果是正常的数据格式则继续
                        if (data.trim() !== '') {
                            console.warn('无法解析数据:', data, e);
                        }
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    return aiResponse;
}

// 开始AI调试
async function startAiDebug() {
    if (!aiConfig.apiKey || !aiConfig.baseUrl) {
        showMessage('请先配置API信息', 'user');
        return;
    }

    if (!problemDescInput.value || !sampleInputInput.value || !sampleOutputInput.value) {
        showMessage('请填写完整的题目信息和样例', 'user');
        return;
    }

    currentDebugStep = 3;
    showDebugStep(currentDebugStep);

    // 清空调试输出
    debugOutput.innerHTML = '';

    // 清空代码查看框
    aiCodeOutput.textContent = '';

    // 开始调试过程
    isDebugging = true;
    debugAttempts = 0;

    // 初始调试，不传递错误信息
    await performDebugIteration();
}

// 执行一次调试迭代
async function performDebugIteration(lastError = null) {
    if (!isDebugging || debugAttempts >= maxDebugAttempts) {
        if (debugAttempts >= maxDebugAttempts) {
            showMessage(`已达到最大调试次数 (${maxDebugAttempts})，调试结束`, 'user');
        }
        return;
    }

    debugAttempts++;
    showMessage(`开始第 ${debugAttempts} 次调试...`, 'user');

    try {
        // 显示加载动画
        debugLoading.style.display = 'block';

        // 构造提示词，包含上次错误信息
        const prompt = generateDebugPrompt(lastError);

        // 调用AI API - 现在callOpenAIApi会直接处理流式输出和显示
        const aiResponse = await callOpenAIApi(prompt);

        // 隐藏加载动画
        debugLoading.style.display = 'none';

        if (!aiResponse) {
            showMessage('AI响应为空，调试结束', 'user');
            return;
        }

        // 从AI响应中提取代码
        const extractedCode = extractCodeFromResponse(aiResponse);

        if (!extractedCode) {
            showMessage('未能从AI响应中提取到代码', 'user');
            return;
        }

        // 更新代码查看框
        aiCodeOutput.textContent = extractedCode;

        // 测试提取的代码
        const testResult = await testCodeWithSample(extractedCode);

        if (testResult.success) {
            showMessage('代码通过样例测试！调试完成。', 'user');
            // 询问用户是否使用AI生成的代码
            const useCode = confirm('AI生成的代码已通过测试！是否替换当前编辑器中的代码？');
            if (useCode) {
                globalText = extractedCode;
                syncState();
                showMessage('代码已更新到编辑器中', 'user');
            } else {
                showMessage('保留当前代码不变', 'user');
            }
        } else {
            const errorMessage = testResult.error || '输出不匹配';
            showMessage(`样例测试失败: ${errorMessage}`, 'user');

            // 准备下一次迭代，传递错误信息
            if (isDebugging && debugAttempts < maxDebugAttempts) {
                setTimeout(() => {
                    performDebugIteration(errorMessage); // 传递错误信息给下一次迭代
                }, 1000);
            }
        }
    } catch (error) {
        debugLoading.style.display = 'none';
        showMessage(`调试出错: ${error.message}`, 'user');
        console.error('AI Debug Error:', error);
    }
}

// 生成调试提示词
function generateDebugPrompt(lastError = null) {
    let prompt = `当前代码：\n${globalText}\n\n`;

    if (problemDescInput.value) {
        prompt += `题目描述：\n${problemDescInput.value}\n\n`;
    }

    if (sampleInputInput.value) {
        prompt += `样例输入：\n${sampleInputInput.value}\n\n`;
    }

    if (sampleOutputInput.value) {
        prompt += `样例输出：\n${sampleOutputInput.value}\n\n`;
    }

    if (lastError) {
        prompt += `上次运行错误：\n${lastError}\n\n`;
    }

    prompt += `请根据题目要求和样例，修改当前代码，保持原有码风和变量名，做最少修改，最后用begin:->和<-end标记包裹完整代码，标记内只放代码，不要有其他说明。例如：\n\nbegin:->\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello World" << endl;\n    return 0;\n}\n<-end`;

    return prompt;
}

// 调用OpenAI API（流式输出）
async function callOpenAIApi(prompt) {
    const response = await fetch(aiConfig.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
            model: aiConfig.model,
            messages: [{ role: 'user', content: prompt }],
            stream: true
        })
    });

    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiResponse = '';

    // 创建一个用于显示流式输出的元素，使用唯一的ID避免冲突
    const uniqueId = 'ai-response-content-' + Date.now() + Math.floor(Math.random() * 1000);
    const aiMessageDiv = document.createElement('div');
    aiMessageDiv.className = 'debug-message ai';
    aiMessageDiv.innerHTML = '<strong>AI:</strong> <span id="' + uniqueId + '"></span>';
    debugOutput.appendChild(aiMessageDiv);
    debugOutput.scrollTop = debugOutput.scrollHeight;

    const contentSpan = document.getElementById(uniqueId);

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6); // 移除 'data: ' 前缀

                    if (data === '[DONE]') {
                        return aiResponse;
                    }

                    try {
                        const parsed = JSON.parse(data);

                        if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                            const content = parsed.choices[0].delta.content;

                            if (content) {
                                aiResponse += content;
                                // 更新显示的内容
                                contentSpan.textContent = aiResponse;
                                debugOutput.scrollTop = debugOutput.scrollHeight;
                            }
                        }
                    } catch (e) {
                        // 忽略解析错误，但如果是正常的数据格式则继续
                        if (data.trim() !== '') {
                            console.warn('无法解析数据:', data, e);
                        }
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    return aiResponse;
}

// 从AI响应中提取代码
function extractCodeFromResponse(response) {
    if (!response) return '';

    // 首先尝试匹配新的标记格式 begin:-> 和 <-end
    const newFormatRegex = /begin:->\s*\n([\s\S]*?)\n<-end/;
    const newMatch = response.match(newFormatRegex);

    if (newMatch && newMatch[1]) {
        return newMatch[1].trim();
    }

    // 备用：查找代码块标记（为了兼容性）
    const codeBlockRegex = /```(?:cpp|c\+\+)?\n([\s\S]*?)\n```/;
    const match = response.match(codeBlockRegex);

    if (match && match[1]) {
        return match[1].trim();
    }

    // 再次尝试匹配没有语言标识的代码块
    const plainCodeBlockRegex = /```\n([\s\S]*?)\n```/;
    const plainMatch = response.match(plainCodeBlockRegex);

    if (plainMatch && plainMatch[1]) {
        return plainMatch[1].trim();
    }

    // 如果没有找到代码块，从后往前查找main函数作为代码开始的标志
    const lines = response.split('\n');
    let mainIndex = -1;

    // 从后往前查找main函数
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('int main') || lines[i].includes('void main')) {
            mainIndex = i;
            break;
        }
    }

    // 如果找到了main函数，从那里开始提取代码
    if (mainIndex !== -1) {
        const extractedCode = lines.slice(mainIndex).join('\n');
        return extractedCode.trim();
    }

    // 如果没有找到main函数，返回整个响应（可能AI没有使用代码块格式）
    return response.trim();
}

// 使用样例测试代码
async function testCodeWithSample(code) {
    try {
        const response = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                input: sampleInputInput.value
            })
        });

        if (!response.ok) {
            throw new Error(`运行请求失败: ${response.status}`);
        }

        const data = await response.json();

        // 检查是否有错误
        if (data.Errors) {
            return { success: false, error: data.Errors };
        }

        if (data.Result) {
            // 比较输出是否与期望输出匹配
            const actualOutput = data.Result.trim();
            const expectedOutput = sampleOutputInput.value.trim();

            // 简单的字符串比较（可根据需要调整比较逻辑）
            if (actualOutput === expectedOutput) {
                return { success: true };
            } else {
                return {
                    success: false,
                    error: `输出不匹配。期望: "${expectedOutput}", 实际: "${actualOutput}"`
                };
            }
        } else {
            return { success: false, error: '代码没有输出' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function highlight(code) {
    let pMap = {}, pIdx = 0;
    // --- [修正] 正则表达式修复 ---
    // 之前是 ".?" (0或1个字符)，导致长字符串不高亮。改为 "[^"]*" (非引号的任意字符序列)
    // 同时也修复了注释匹配
    let safe = code.replace(/("[^"]*"|'[^']*'|\/\/.*$)/gm, (m) => { 
        const k = `___P${pIdx++}_`; 
        pMap[k]=m; 
        return k; 
    });
    
    safe = escapeHtml(safe);
    
    // 关键词高亮
    safe = safe.replace(/\b(int|float|double|char|void|if|else|for|while|do|return|class|struct|public|private|protected|virtual|static|const|namespace|using|template|typename|bool|true|false|new|delete|std|cin|cout|endl)\b/g, '<span class="hl-kw">$1</span>');
    // 数字高亮
    safe = safe.replace(/\b(\d+)\b/g, '<span class="hl-num">$1</span>');
    // 预处理指令高亮
    safe = safe.replace(/^(#\w+)(.*)$/gm, (m,d,r) => `<span class="hl-dir">${d}</span>${r}`);
    
    // 还原字符串和注释
    Object.keys(pMap).forEach(k => {
        let o = pMap[k], r = '';
        if(o.startsWith('"')||o.startsWith("'")) r = `<span class="hl-str">${escapeHtml(o)}</span>`;
        else if(o.startsWith('//')) r = `<span class="hl-com">${escapeHtml(o)}</span>`;
        safe = safe.replace(k, r);
    });
    return safe;
}

function updateHighlight() {
    const txt = fullEditor.value;
    // 确保最后一行也有换行符处理，防止正则漏掉
    highlightLayer.innerHTML = highlight(txt.endsWith('\n')?txt+' ':txt);
    updateGutter(); 
}

function updateGutter() {
    const lineCount = fullEditor.value.split('\n').length;
    gutter.innerText = Array.from({length: lineCount}, (_, i) => i + 1).join('\n');
}

function syncScroll() {
    highlightLayer.scrollTop = fullEditor.scrollTop;
    highlightLayer.scrollLeft = fullEditor.scrollLeft;
    gutter.scrollTop = fullEditor.scrollTop; 
}

fullEditor.addEventListener('input', () => { 
    updateHighlight(); 
    globalText = fullEditor.value; 
    globalCursorPos = fullEditor.selectionStart;
    // 触发防抖保存
    triggerSaveCode();
});
fullEditor.addEventListener('scroll', syncScroll);

// Editor Logic
function toggleLineComment() {
    let start = globalText.lastIndexOf('\n', globalCursorPos - 1) + 1;
    let end = globalText.indexOf('\n', globalCursorPos);
    if (end === -1) end = globalText.length;
    const line = globalText.substring(start, end);
    let newLine = "", offset = 0;
    if (line.trim().startsWith('//')) { newLine = line.replace('//', ''); offset = -2; }
    else { newLine = '//' + line; offset = 2; }
    globalText = globalText.substring(0, start) + newLine + globalText.substring(end);
    globalCursorPos += offset;
    syncState();
}

function handleEnter() {
    const prevChar = globalText[globalCursorPos-1];
    const nextChar = globalText[globalCursorPos];
    const lastNL = globalText.lastIndexOf('\n', globalCursorPos - 1);
    const lineStart = lastNL === -1 ? 0 : lastNL + 1;
    const currentLine = globalText.substring(lineStart, globalCursorPos);
    const indentMatch = currentLine.match(/^(\t*)/);
    let indent = indentMatch ? indentMatch[1] : "";
    
    if (prevChar === '{' && nextChar === '}') {
        insertTextAtCursor('\n' + indent + '\t' + '\n' + indent, 1 + indent.length); 
        return;
    } 
    if (prevChar === '{') indent += '\t';
    insertTextAtCursor('\n' + indent);
}

function handleAutoPair(char) {
    const pairs = {'(':')', '{':'}', '[':']', '"':'"', "'":"'"};
    if (pairs[char]) insertTextAtCursor(char + pairs[char], 1);
    else insertTextAtCursor(char);
}

function renderThreeLines() {
    if(isFullMode) return;
    const lines = globalText.split('\n');
    let accum = 0, idx = 0, start = 0;
    for(let i=0; i<lines.length; i++) {
        if(globalCursorPos >= accum && globalCursorPos <= accum + lines[i].length) { idx=i; start=accum; break; }
        accum += lines[i].length + 1;
    }
    
    lnPrev.textContent = (idx > 0) ? (idx) : "";
    lnCurr.textContent = idx + 1;
    lnNext.textContent = (idx < lines.length - 1) ? (idx + 2) : "";

    linePrev.textContent = lines[idx-1]||(idx===0?"-- TOP --":"");
    lineNext.textContent = lines[idx+1]||(idx===lines.length-1?"-- END --":"");
    const cT = lines[idx]; const rC = globalCursorPos - start;
    lineCurr.innerHTML = escapeHtml(cT.substring(0, rC)) + '<span class="cursor"></span>' + escapeHtml(cT.substring(rC));
    setTimeout(() => {
        const c = lineCurr.querySelector('.cursor');
        if(c) c.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
    }, 0);
}

function insertTextAtCursor(t, back=0) {
    globalText = globalText.slice(0, globalCursorPos) + t + globalText.slice(globalCursorPos);
    globalCursorPos += t.length - back;
    syncState();
}
function deleteText(fw) {
    if(fw) { if(globalCursorPos<globalText.length) globalText = globalText.slice(0,globalCursorPos)+globalText.slice(globalCursorPos+1); }
    else { if(globalCursorPos>0) { globalText = globalText.slice(0,globalCursorPos-1)+globalText.slice(globalCursorPos); globalCursorPos--; } }
    syncState();
}
function moveCursor(d) {
    if(d==='left'&&globalCursorPos>0)globalCursorPos--;
    else if(d==='right'&&globalCursorPos<globalText.length)globalCursorPos++;
    else if(d==='up'||d==='down'){
        const ls=[]; let a=0; globalText.split('\n').forEach(l=>{ls.push({s:a,l:l.length});a+=l.length+1});
        const ci=ls.findIndex(l=>globalCursorPos>=l.s&&globalCursorPos<=l.s+l.l);
        if(ci!==-1){ const ti=d==='up'?ci-1:ci+1; if(ti>=0&&ti<ls.length)globalCursorPos=ls[ti].s+Math.min(globalCursorPos-ls[ci].s,ls[ti].l); }
    }
    syncState();
}

function syncState() {
    // 触发防抖保存
    triggerSaveCode();

    if(isFullMode) {
        fullEditor.value=globalText;
        fullEditor.setSelectionRange(globalCursorPos, globalCursorPos);
        updateHighlight(); 
    }
    else renderThreeLines();
}

function handleKeyInput(keyEl) {
    const rawKey = keyEl.getAttribute('data-key');
    if (rawKey === 'Shift') return;
    if (rawKey === 'Control') { isCtrlActive = !isCtrlActive; updateKeyboardVisuals(); return; }
    
    if (isCtrlActive) {
        if (rawKey === '/') { toggleLineComment(); isCtrlActive = false; updateKeyboardVisuals(); return; }
        isCtrlActive = false; updateKeyboardVisuals();
    }

    let char = null;
    if (isShiftActive) {
        const shiftAttr = keyEl.getAttribute('data-shift');
        if (shiftAttr) char = shiftAttr;
        else if (rawKey.length === 1 && /[a-z]/i.test(rawKey)) char = rawKey.toUpperCase();
        shiftUsageFlag = true;
        if (!isShiftHeld) { isShiftActive = false; updateKeyboardVisuals(); }
    } else {
        char = (rawKey.length === 1 && /[a-z]/i.test(rawKey)) ? rawKey.toLowerCase() : (rawKey.length === 1 ? rawKey : null);
    }

    if (char && ['(', '{', '[', '"', "'"].includes(char)) { handleAutoPair(char); return; }
    if (char) insertTextAtCursor(char);
    else {
        switch(rawKey){
            case 'Enter': handleEnter(); break;
            case 'Backspace': deleteText(false); break;
            case 'Delete': deleteText(true); break;
            case 'Space': insertTextAtCursor(' '); break;
            case 'Tab': insertTextAtCursor('\t'); break;
            case 'ArrowLeft': moveCursor('left'); break;
            case 'ArrowRight': moveCursor('right'); break;
            case 'ArrowUp': moveCursor('up'); break;
            case 'ArrowDown': moveCursor('down'); break;
            case 'Home': globalCursorPos=globalText.lastIndexOf('\n',globalCursorPos-1)+1; syncState(); break;
            case 'End': const n=globalText.indexOf('\n',globalCursorPos); globalCursorPos=n===-1?globalText.length:n; syncState(); break;
            case 'PageUp': for(let i=0;i<5;i++)moveCursor('up'); break;
            case 'PageDown': for(let i=0;i<5;i++)moveCursor('down'); break;
        }
    }
}

fullEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '\t'); }
    else if (e.key === 'Enter') {
        e.preventDefault();
        const val = fullEditor.value; const pos = fullEditor.selectionStart;
        const prev = val[pos-1]; const next = val[pos];
        const lastNL = val.lastIndexOf('\n', pos - 1);
        const lineStart = lastNL === -1 ? 0 : lastNL + 1;
        const currentLine = val.substring(lineStart, pos);
        const indentMatch = currentLine.match(/^(\t*)/);
        let indent = indentMatch ? indentMatch[1] : "";
        if (prev === '{' && next === '}') {
            document.execCommand('insertText', false, '\n' + indent + '\t' + '\n' + indent);
            fullEditor.selectionStart = fullEditor.selectionEnd = pos + 1 + indent.length + 1;
        } else {
            if (prev === '{') indent += '\t';
            document.execCommand('insertText', false, '\n' + indent);
        }
    }
    else if (['(','{','[','"',"'"].includes(e.key)) {
        e.preventDefault();
        const pairs = {'(':')', '{':'}', '[':']', '"':'"', "'":"'"};
        document.execCommand('insertText', false, e.key + pairs[e.key]);
        fullEditor.selectionStart = fullEditor.selectionEnd = fullEditor.selectionStart - 1;
    }
    else if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        globalText = fullEditor.value; globalCursorPos = fullEditor.selectionStart;
        toggleLineComment();
        fullEditor.value = globalText; fullEditor.setSelectionRange(globalCursorPos, globalCursorPos); updateHighlight();
    }
});

keys.forEach(k => {
    if(k.getAttribute('data-key')==='Shift'||k.getAttribute('data-key')==='Control'||k.classList.contains('spacer'))return;
    const rep = k.classList.contains('repeat-key');
    const tr=(e)=>{e.preventDefault();k.classList.add('active');if(navigator.vibrate)navigator.vibrate(10);handleKeyInput(k);
    if(rep){keyDelayTimer=setTimeout(()=>{keyRepeatTimer=setInterval(()=>{if(navigator.vibrate)navigator.vibrate(5);handleKeyInput(k);},50)},400);}};
    const rl=(e)=>{e.preventDefault();k.classList.remove('active');clearTimeout(keyDelayTimer);clearInterval(keyRepeatTimer);};
    k.addEventListener('touchstart',tr,{passive:false}); k.addEventListener('touchend',rl);
    k.addEventListener('mousedown',tr); k.addEventListener('mouseup',rl); k.addEventListener('mouseleave',rl);
});

function updateKeyboardVisuals() {
    keys.forEach(k => {
        const sVal = k.getAttribute('data-shift');
        const dKey = k.getAttribute('data-key');
        if(dKey==='Shift') k.classList.toggle('shift-hold', isShiftActive);
        if(dKey==='Control') k.classList.toggle('ctrl-hold', isCtrlActive);
        if(k.classList.contains('alpha-key')) k.innerText=isShiftActive?dKey.toUpperCase():dKey.toUpperCase();
        else if(sVal){ const sup=k.querySelector('.sup');const main=k.querySelector('.main'); if(sup&&main) k.classList.toggle('shifted', isShiftActive); }
    });
}
shiftKeys.forEach(k=>{
    const s=(e)=>{e.preventDefault();isShiftHeld=true;shiftUsageFlag=false;isShiftActive=true;updateKeyboardVisuals();if(navigator.vibrate)navigator.vibrate(10);};
    const e=(e)=>{e.preventDefault();isShiftHeld=false;if(shiftUsageFlag)isShiftActive=false;updateKeyboardVisuals();};
    k.addEventListener('touchstart',s,{passive:false});k.addEventListener('touchend',e);
    k.addEventListener('mousedown',s);k.addEventListener('mouseup',e);
});
ctrlKeys.forEach(k=>{
    const s=(e)=>{e.preventDefault();k.classList.add('active');if(navigator.vibrate)navigator.vibrate(10);handleKeyInput(k);};
    const e=(e)=>{e.preventDefault();k.classList.remove('active');};
    k.addEventListener('touchstart',s,{passive:false});k.addEventListener('touchend',e);
    k.addEventListener('mousedown',s);k.addEventListener('mouseup',e);
});

toggleBtn.addEventListener('click', () => {
    isFullMode = !isFullMode;
    localStorage.setItem('phoi_isFullMode', isFullMode);
    
    if (isFullMode) {
        keyboardContainer.classList.add('hide-keyboard');
        document.getElementById('lines-container').style.display = 'none';
        editorWrapper.style.display = 'flex'; 
        fullEditor.value=globalText; fullEditor.focus(); fullEditor.setSelectionRange(globalCursorPos, globalCursorPos);
        updateHighlight();
        syncScroll();
        toggleBtn.textContent = '▲';
    } else {
        globalText=fullEditor.value; globalCursorPos=fullEditor.selectionStart;
        keyboardContainer.classList.remove('hide-keyboard');
        document.getElementById('lines-container').style.display = 'flex';
        editorWrapper.style.display = 'none';
        toggleBtn.textContent = '▼';
        renderThreeLines();
    }
});

// 初始化：根据保存的模式直接应用布局
if (isFullMode) {
    keyboardContainer.classList.add('hide-keyboard');
    document.getElementById('lines-container').style.display = 'none';
    editorWrapper.style.display = 'flex';
    toggleBtn.textContent = '▲';
    fullEditor.value = globalText;
    updateHighlight();
} else {
    updateGutter();
    renderThreeLines();
}
updateKeyboardVisuals();