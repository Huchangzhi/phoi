// 洛谷插件相关代码

// 初始化洛谷插件设置变量
window.luoguThemeEnabled = localStorage.getItem('phoi_luogu_theme_enabled') === 'true'; // 默认为false

// 初始化洛谷题目功能
function initLuoguFeature() {
    // 从localStorage获取洛谷插件状态，如果不存在则默认为false
    window.luoguThemeEnabled = localStorage.getItem('phoi_luogu_theme_enabled') === 'true';
    
    // 根据插件设置决定是否显示洛谷按钮
    updateLuoguButtonVisibility();

    // 监听插件设置变化
    const luoguThemeEnabledCheckbox = document.getElementById('luogu-theme-enabled');
    if (luoguThemeEnabledCheckbox) {
        // 初始化时设置开关状态
        luoguThemeEnabledCheckbox.checked = window.luoguThemeEnabled;
        
        luoguThemeEnabledCheckbox.addEventListener('change', function() {
            // 更新全局变量
            window.luoguThemeEnabled = this.checked;
            localStorage.setItem('phoi_luogu_theme_enabled', this.checked);
            updateLuoguButtonVisibility();

            // 洛谷主题启用状态已更新，存储到本地
            // 实际的主题功能将在后续实现
            console.log('洛谷主题插件状态已更新:', this.checked);
        });
    }
}

// 更新洛谷按钮可见性
function updateLuoguButtonVisibility() {
    // 创建或获取洛谷按钮容器
    let luoguContainer = document.getElementById('luogu-container');
    if (!luoguContainer) {
        // 创建容器
        luoguContainer = document.createElement('div');
        luoguContainer.id = 'luogu-container';
        luoguContainer.style.display = 'flex';
        luoguContainer.style.alignItems = 'center';

        // 插入到menu-bar-right中，放在run-btn前面
        const menuBarRight = document.getElementById('menu-bar-right');
        const runBtn = document.getElementById('run-btn');
        if (menuBarRight && runBtn) {
            menuBarRight.insertBefore(luoguContainer, runBtn);
        }
    }

    // 清空容器
    luoguContainer.innerHTML = '';

    // 如果启用了洛谷插件，则显示按钮
    if (window.luoguThemeEnabled) {
        // 创建洛谷按钮
        const luoguBtn = document.createElement('button');
        luoguBtn.id = 'luogu-btn';
        luoguBtn.className = 'tool-btn';
        luoguBtn.title = '洛谷题目';

        // 创建洛谷图标
        const luoguImg = document.createElement('img');
        luoguImg.src = '/static/Luogu.png';
        luoguImg.alt = 'Luogu';
        luoguImg.className = 'icon-btn';

        // 组装按钮
        luoguBtn.appendChild(luoguImg);
        luoguContainer.appendChild(luoguBtn);

        // 添加点击事件
        luoguBtn.addEventListener('click', showLuoguProblemDialog);
    }
}

// 显示洛谷题目对话框
function showLuoguProblemDialog() {
    // 创建模态框
    const modal = document.createElement('div');
    modal.id = 'luogu-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.zIndex = '200'; // 确保在其他元素之上

    // 创建模态框内容
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    // 检测是否为移动设备 - 使用 isFullMode 变量作为参考
    const isMobile = !isFullMode; // 非全屏模式视为移动设备

    if (isMobile) {
        // 移动端样式
        modalContent.style.width = '90%';
        modalContent.style.maxWidth = 'none';
        modalContent.style.margin = '20px';
        modalContent.style.maxHeight = '80vh';
    } else {
        // 桌面端样式
        modalContent.style.width = '80%';
        modalContent.style.maxWidth = '500px';
        modalContent.style.margin = 'auto';
    }

    // 创建头部
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';

    const headerTitle = document.createElement('h2');
    headerTitle.textContent = '洛谷题目查询';

    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function() {
        document.body.removeChild(modal);
    });

    modalHeader.appendChild(headerTitle);
    modalHeader.appendChild(closeBtn);

    // 创建主体
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.style.padding = '20px';

    // 在移动端增加最大高度和滚动
    if (isMobile) {
        modalBody.style.maxHeight = '60vh';
        modalBody.style.overflowY = 'auto';
    }

    // 创建输入提示
    const inputLabel = document.createElement('label');
    inputLabel.textContent = '请输入题号（例如：P1001 或 p1001）：';
    inputLabel.style.display = 'block';
    inputLabel.style.marginBottom = '10px';
    inputLabel.style.color = '#ccc';

    // 创建输入框
    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.placeholder = '例如：P1001';
    inputField.style.width = '100%';
    inputField.style.padding = '12px';
    inputField.style.marginBottom = '15px';
    inputField.style.backgroundColor = '#1e1e1e';
    inputField.style.color = '#d4d4d4';
    inputField.style.border = '1px solid #3c3c3c';
    inputField.style.borderRadius = '4px';
    inputField.style.fontSize = '16px'; // 移动端更大的字体

    // 在移动端增加触摸目标大小
    if (isMobile) {
        inputField.style.minHeight = '44px'; // 符合移动端触摸目标大小
    }

    // 从localStorage中恢复上次输入的题号
    const savedProblemId = localStorage.getItem('phoi_last_luogu_problem_id');
    if (savedProblemId) {
        inputField.value = savedProblemId;
    }

    // 创建确认按钮
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '查询';
    confirmBtn.className = 'modal-btn';
    confirmBtn.style.backgroundColor = '#0e639c';
    confirmBtn.style.float = 'right';
    confirmBtn.style.padding = '12px 24px';

    // 在移动端增加触摸目标大小
    if (isMobile) {
        confirmBtn.style.minHeight = '44px';
        confirmBtn.style.fontSize = '16px';
    }

    // 添加回车键支持
    inputField.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            confirmBtn.click();
        }
    });

    // 添加确认按钮点击事件
    confirmBtn.addEventListener('click', function() {
        const problemId = inputField.value.trim();
        if (problemId) {
            // 处理题号，统一转换为大写
            const normalizedId = problemId.toUpperCase();
            // 保存题号到localStorage
            localStorage.setItem('phoi_last_luogu_problem_id', problemId);
            loadLuoguProblem(normalizedId);
            document.body.removeChild(modal);
        }
    });

    // 组装模态框
    modalBody.appendChild(inputLabel);
    modalBody.appendChild(inputField);
    modalBody.appendChild(confirmBtn);

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // 聚焦到输入框
    inputField.focus();

    // 在移动端，确保输入框不会被虚拟键盘遮挡
    if (isMobile) {
        setTimeout(() => {
            inputField.scrollIntoView({behavior: 'smooth', block: 'center'});
        }, 300);
    }
}

// 加载洛谷题目
function loadLuoguProblem(problemId) {
    // 这里应该从数据文件中查找题目，但现在我们先显示一个加载提示
    console.log('正在加载题目:', problemId);

    // 创建题目显示区域
    createProblemDisplayArea();

    // 模拟加载过程
    const problemDisplay = document.getElementById('problem-display');
    if (problemDisplay) {
        // 检测是否为移动设备 - 使用键盘显示状态作为参考
        const keyboardContainer = document.getElementById('keyboard-container');
        const isMobile = !isFullMode; // 非全屏模式视为移动设备

        if (isMobile) {
            problemDisplay.innerHTML = '<div style="padding: 20px; color: #ccc; text-align: center;">正在加载题目...</div>';
        } else {
            problemDisplay.innerHTML = '<div style="padding: 20px; color: #ccc;">正在加载题目...</div>';
        }
        problemDisplay.style.display = 'block';

        // 异步加载题目数据
        fetchLuoguProblemData(problemId).then(problemData => {
            if (problemData) {
                displayLuoguProblem(problemData);
            } else {
                if (isMobile) {
                    problemDisplay.innerHTML = '<div style="padding: 20px; color: #f48771; text-align: center;">未找到题目: ' + problemId + '</div>';
                } else {
                    problemDisplay.innerHTML = '<div style="padding: 20px; color: #f48771;">未找到题目: ' + problemId + '</div>';
                }
            }
        }).catch(error => {
            if (isMobile) {
                problemDisplay.innerHTML = '<div style="padding: 20px; color: #f48771; text-align: center;">加载题目失败: ' + error.message + '</div>';
            } else {
                problemDisplay.innerHTML = '<div style="padding: 20px; color: #f48771;">加载题目失败: ' + error.message + '</div>';
            }
        });
    }
}

// 获取洛谷题目数据（支持 P/B 分离 + 二分查找）
async function fetchLuoguProblemData(problemId) {
    const normalized = problemId.toUpperCase();
    const match = normalized.match(/^([BP])(\d+)$/);
    if (!match) return null;

    const type = match[1]; // 'P' 或 'B'
    const indexRes = await fetch('/static/data/luogu_index.json');
    if (!indexRes.ok) return null;
    const index = await indexRes.json();
    const chunks = index.types?.[type];
    if (!chunks || chunks.length === 0) return null;

    // 二分查找目标分片
    let low = 0, high = chunks.length - 1;
    let targetChunk = null;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const chunk = chunks[mid];
        const minNum = parseInt(chunk.min_pid.slice(1), 10);
        const maxNum = parseInt(chunk.max_pid.slice(1), 10);
        const targetNum = parseInt(match[2], 10);

        if (targetNum >= minNum && targetNum <= maxNum) {
            targetChunk = chunk;
            break;
        } else if (targetNum < minNum) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    if (!targetChunk) return null;

    // 加载目标分片
    const fileRes = await fetch(`/static/data/${targetChunk.file}`);
    if (!fileRes.ok) return null;
    const text = await fileRes.text();
    const lines = text.split('\n').filter(line => line.trim());
    for (const line of lines) {
        try {
            const data = JSON.parse(line);
            if (data.pid && data.pid.toUpperCase() === normalized) {
                return data;
            }
        } catch (e) {
            // 忽略解析错误
        }
    }
    return null; // 题目不存在于该分片中（可能缺失）
}

// 创建题目显示区域
function createProblemDisplayArea() {
    // 检查是否已经存在题目显示区域
    let problemDisplay = document.getElementById('problem-display');
    if (!problemDisplay) {
        // 创建题目显示区域
        problemDisplay = document.createElement('div');
        problemDisplay.id = 'problem-display';

        // 检测是否为移动设备 - 使用键盘显示状态作为参考
        const keyboardContainer = document.getElementById('keyboard-container');
        const isMobile = !isFullMode; // 非全屏模式视为移动设备

        if (isMobile) {
            // 移动设备上的样式
            problemDisplay.style.position = 'fixed';
            problemDisplay.style.top = '36px';
            problemDisplay.style.left = '0';
            problemDisplay.style.right = '0';
            problemDisplay.style.bottom = '0';
            problemDisplay.style.width = 'auto';
            problemDisplay.style.height = 'auto';
            problemDisplay.style.backgroundColor = '#1e1e1e';
            problemDisplay.style.zIndex = '100';
            problemDisplay.style.overflowY = 'hidden'; // 隐藏滚动条，使用按钮滚动
            problemDisplay.style.touchAction = 'none'; // 禁用触摸操作，使用按钮滚动
            problemDisplay.style.display = 'none';
            problemDisplay.style.boxShadow = '0 0 15px rgba(0,0,0,0.5)';
        } else {
            // 桌面设备上的样式
            problemDisplay.style.position = 'fixed';
            problemDisplay.style.top = '36px';
            problemDisplay.style.right = '0';
            problemDisplay.style.width = '400px';
            problemDisplay.style.height = 'calc(100vh - 36px)';
            problemDisplay.style.backgroundColor = '#1e1e1e';
            problemDisplay.style.borderLeft = '1px solid #333';
            problemDisplay.style.zIndex = '100';
            problemDisplay.style.overflowY = 'auto';
            problemDisplay.style.WebkitOverflowScrolling = 'touch'; // 启用硬件加速的滚动
            problemDisplay.style.display = 'none';
            problemDisplay.style.boxShadow = '-5px 0 15px rgba(0,0,0,0.5)';
        }

        // 添加关闭按钮
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '10px';
        closeBtn.style.right = '10px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.color = '#ccc';
        closeBtn.style.zIndex = '101';
        closeBtn.addEventListener('click', function() {
            problemDisplay.style.display = 'none';
        });

        problemDisplay.appendChild(closeBtn);
        document.body.appendChild(problemDisplay);
    }

    return problemDisplay;
}

// 显示洛谷题目
function displayLuoguProblem(problemData) {
    const problemDisplay = document.getElementById('problem-display');
    if (!problemDisplay) return;

    // 检测是否为移动设备 - 使用 isFullMode 变量作为参考
    const isMobile = !isFullMode; // 非全屏模式视为移动设备

    // 清空并显示题目区域
    problemDisplay.innerHTML = '';
    problemDisplay.style.display = 'block';

    // 创建滚动容器
    const scrollContainer = document.createElement('div');
    scrollContainer.style.height = '100%';
    scrollContainer.style.overflowY = 'auto'; // 启用滚动以便按钮可以控制
    scrollContainer.style.padding = '20px';
    scrollContainer.style.boxSizing = 'border-box';
    scrollContainer.style.touchAction = 'none'; // 禁用触摸操作，使用按钮滚动

    // 为移动端隐藏滚动条
    if (isMobile) {
        // 隐藏滚动条的样式
        scrollContainer.style.msOverflowStyle = 'none';  // IE 和 Edge
        scrollContainer.style.scrollbarWidth = 'none';  // Firefox

        // 为 Webkit 浏览器隐藏滚动条
        const style = document.createElement('style');
        style.textContent = `
            #problem-display [data-scroll-container]::-webkit-scrollbar {
                display: none;  /* Chrome, Safari, Opera*/
            }
        `;
        document.head.appendChild(style);
    }

    scrollContainer.setAttribute('data-scroll-container', 'true'); // 标记这个容器用于滚动

    // 难度标签
    const difficultyTag = document.createElement('div');
    difficultyTag.style.display = 'inline-block';
    difficultyTag.style.padding = '4px 8px';
    difficultyTag.style.borderRadius = '4px';
    difficultyTag.style.fontSize = '12px';
    difficultyTag.style.fontWeight = 'bold';
    difficultyTag.style.marginRight = '10px';
    difficultyTag.style.verticalAlign = 'middle';

    // 根据难度设置颜色
    switch(problemData.difficulty) {
        case 0: // 暂无评定
            difficultyTag.style.backgroundColor = '#666';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '暂无评定';
            break;
        case 1: // 入门
            difficultyTag.style.backgroundColor = '#ff4444';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '入门';
            break;
        case 2: // 普及-
            difficultyTag.style.backgroundColor = '#ff8800';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '普及-';
            break;
        case 3: // 普及/提高-
            difficultyTag.style.backgroundColor = '#ffbb00';
            difficultyTag.style.color = 'black';
            difficultyTag.textContent = '普及/提高-';
            break;
        case 4: // 普及+/提高
            difficultyTag.style.backgroundColor = '#00aa00';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '普及+/提高';
            break;
        case 5: // 提高+/省选-
            difficultyTag.style.backgroundColor = '#0066cc';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '提高+/省选-';
            break;
        case 6: // 省选/NOI-
            difficultyTag.style.backgroundColor = '#8800cc';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '省选/NOI-';
            break;
        case 7: // NOI/NOI+/CTSC
            difficultyTag.style.backgroundColor = '#220066';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = 'NOI/NOI+/CTSC';
            break;
        default:
            difficultyTag.style.backgroundColor = '#666';
            difficultyTag.style.color = 'white';
            difficultyTag.textContent = '未知难度';
    }

    // 标题区域
    const titleContainer = document.createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.justifyContent = 'space-between';
    titleContainer.style.alignItems = 'center';
    titleContainer.style.marginTop = '30px';
    titleContainer.style.flexWrap = 'wrap';
    titleContainer.style.gap = '10px';

    const titleElement = document.createElement('h2');
    titleElement.style.color = '#ccc';
    titleElement.style.margin = '0';
    titleElement.style.flex = '1';
    titleElement.style.minWidth = '0';
    titleElement.style.display = 'flex';
    titleElement.style.alignItems = 'center';
    titleElement.appendChild(difficultyTag);

    const titleSpan = document.createElement('span');
    titleSpan.textContent = `${problemData.pid}. ${problemData.title}`;
    titleElement.appendChild(titleSpan);

    const linkButton = document.createElement('a');
    linkButton.href = `https://www.luogu.com.cn/problem/${problemData.pid}`;
    linkButton.target = '_blank';
    linkButton.style.backgroundColor = '#0e639c';
    linkButton.style.color = 'white';
    linkButton.style.padding = '8px 16px';
    linkButton.style.textDecoration = 'none';
    linkButton.style.borderRadius = '4px';
    linkButton.style.fontSize = '14px';
    linkButton.style.whiteSpace = 'nowrap';
    linkButton.textContent = '跳转到洛谷';

    // 检查CPH插件是否启用，如果启用则显示"传送至cph"按钮
    const cphTransferButton = document.createElement('button');
    const cphPluginEnabled = localStorage.getItem('cph_plugin_enabled') === 'true';
    
    if (cphPluginEnabled) {
        cphTransferButton.textContent = '传送至CPH';
        cphTransferButton.style.backgroundColor = '#5a3fc0'; // 紫色背景，区别于洛谷的蓝色
        cphTransferButton.style.color = 'white';
        cphTransferButton.style.padding = '8px 16px';
        cphTransferButton.style.textDecoration = 'none';
        cphTransferButton.style.border = 'none';
        cphTransferButton.style.borderRadius = '4px';
        cphTransferButton.style.fontSize = '14px';
        cphTransferButton.style.whiteSpace = 'nowrap';
        cphTransferButton.style.marginRight = '10px';
        cphTransferButton.style.cursor = 'pointer';
        
        // 添加点击事件，传输题目数据到CPH
        cphTransferButton.addEventListener('click', function(e) {
            e.preventDefault();
            transferProblemToCPH(problemData);
        });
    } else {
        // 如果CPH插件未启用，隐藏按钮
        cphTransferButton.style.display = 'none';
    }

    titleContainer.appendChild(titleElement);
    // 先添加CPH按钮，再添加洛谷按钮，这样CPH按钮会在左边
    titleContainer.appendChild(cphTransferButton);
    titleContainer.appendChild(linkButton);
    scrollContainer.appendChild(titleContainer);

    // 题目描述
    const descSection = document.createElement('div');
    descSection.style.margin = '20px 0';

    const descHeading = document.createElement('h3');
    descHeading.style.color = '#569cd6';
    descHeading.textContent = '题目描述';

    const descContent = document.createElement('div');
    descContent.id = 'problem-description';
    descContent.style.color = '#ccc';
    descContent.style.lineHeight = '1.6';

    descSection.appendChild(descHeading);
    descSection.appendChild(descContent);
    scrollContainer.appendChild(descSection);

    // 输入格式
    const inputSection = document.createElement('div');
    inputSection.style.margin = '20px 0';

    const inputHeading = document.createElement('h3');
    inputHeading.style.color = '#569cd6';
    inputHeading.textContent = '输入格式';

    const inputContent = document.createElement('div');
    inputContent.id = 'problem-input-format';
    inputContent.style.color = '#ccc';
    inputContent.style.lineHeight = '1.6';

    inputSection.appendChild(inputHeading);
    inputSection.appendChild(inputContent);
    scrollContainer.appendChild(inputSection);

    // 输出格式
    const outputSection = document.createElement('div');
    outputSection.style.margin = '20px 0';

    const outputHeading = document.createElement('h3');
    outputHeading.style.color = '#569cd6';
    outputHeading.textContent = '输出格式';

    const outputContent = document.createElement('div');
    outputContent.id = 'problem-output-format';
    outputContent.style.color = '#ccc';
    outputContent.style.lineHeight = '1.6';

    outputSection.appendChild(outputHeading);
    outputSection.appendChild(outputContent);
    scrollContainer.appendChild(outputSection);

    // 样例
    if (problemData.samples && problemData.samples.length > 0) {
        const samplesSection = document.createElement('div');
        samplesSection.style.margin = '20px 0';

        const samplesHeading = document.createElement('h3');
        samplesHeading.style.color = '#569cd6';
        samplesHeading.textContent = '样例';

        samplesSection.appendChild(samplesHeading);

        problemData.samples.forEach((sample, index) => {
            const sampleContainer = document.createElement('div');
            sampleContainer.style.margin = '15px 0';
            sampleContainer.style.border = '1px solid #333';
            sampleContainer.style.borderRadius = '4px';
            sampleContainer.style.overflow = 'hidden';

            // 输入部分
            const inputBlock = document.createElement('div');
            inputBlock.style.padding = '10px';
            inputBlock.style.backgroundColor = '#1a1a1a';

            const inputLabel = document.createElement('div');
            inputLabel.style.color = '#6a9955';
            inputLabel.style.fontWeight = 'bold';
            inputLabel.style.marginBottom = '5px';
            inputLabel.textContent = `输入 #${index + 1}`;

            const inputPre = document.createElement('pre');
            inputPre.style.background = '#1e1e1e';
            inputPre.style.padding = '10px';
            inputPre.style.border = '1px solid #333';
            inputPre.style.color = '#ccc';
            inputPre.style.whiteSpace = 'pre-wrap';
            inputPre.style.margin = '0';
            inputPre.style.overflowX = 'auto';
            inputPre.style.webkitOverflowScrolling = 'touch';
            inputPre.textContent = sample[0];

            inputBlock.appendChild(inputLabel);
            inputBlock.appendChild(inputPre);

            // 输出部分
            const outputBlock = document.createElement('div');
            outputBlock.style.padding = '10px';
            outputBlock.style.backgroundColor = '#1a1a1a';

            const outputLabel = document.createElement('div');
            outputLabel.style.color = '#6a9955';
            outputLabel.style.fontWeight = 'bold';
            outputLabel.style.marginBottom = '5px';
            outputLabel.textContent = `输出 #${index + 1}`;

            const outputPre = document.createElement('pre');
            outputPre.style.background = '#1e1e1e';
            outputPre.style.padding = '10px';
            outputPre.style.border = '1px solid #333';
            outputPre.style.color = '#ccc';
            outputPre.style.whiteSpace = 'pre-wrap';
            outputPre.style.margin = '0';
            outputPre.style.overflowX = 'auto';
            outputPre.style.webkitOverflowScrolling = 'touch';
            outputPre.textContent = sample[1];

            outputBlock.appendChild(outputLabel);
            outputBlock.appendChild(outputPre);

            sampleContainer.appendChild(inputBlock);
            sampleContainer.appendChild(outputBlock);
            samplesSection.appendChild(sampleContainer);
        });

        scrollContainer.appendChild(samplesSection);
    }

    // 提示
    if (problemData.hint) {
        const hintSection = document.createElement('div');
        hintSection.style.margin = '20px 0';

        const hintHeading = document.createElement('h3');
        hintHeading.style.color = '#569cd6';
        hintHeading.textContent = '提示';

        const hintContent = document.createElement('div');
        hintContent.id = 'problem-hint';
        hintContent.style.color = '#ccc';
        hintContent.style.lineHeight = '1.6';

        hintSection.appendChild(hintHeading);
        hintSection.appendChild(hintContent);
        scrollContainer.appendChild(hintSection);
    }

    problemDisplay.appendChild(scrollContainer);

    // 在移动设备上，临时隐藏编辑器区域以显示题目详情
    if (isMobile) {
        const editorArea = document.getElementById('editor-area');
        if (editorArea) {
            editorArea.style.display = 'none';
        }

        // 添加一个返回编辑器的按钮
        const backButton = document.createElement('div');
        backButton.innerHTML = '返回编辑器';
        backButton.style.position = 'fixed';
        backButton.style.bottom = '20px';
        backButton.style.left = '50%';
        backButton.style.transform = 'translateX(-50%)';
        backButton.style.backgroundColor = '#0e639c';
        backButton.style.color = 'white';
        backButton.style.padding = '12px 24px';
        backButton.style.borderRadius = '30px';
        backButton.style.cursor = 'pointer';
        backButton.style.zIndex = '102';
        backButton.style.textAlign = 'center';
        backButton.style.fontSize = '16px';
        backButton.style.fontWeight = 'bold';
        backButton.style.boxSizing = 'border-box';
        backButton.id = 'back-to-editor-btn';

        backButton.addEventListener('click', function() {
            problemDisplay.style.display = 'none';
            const editorArea = document.getElementById('editor-area');
            if (editorArea) {
                editorArea.style.display = 'flex';
            }

            // 恢复背景页面滚动
            document.body.style.overflow = '';
        });

        problemDisplay.appendChild(backButton);

        // 确保在移动设备上可以滚动
        document.body.style.overflow = 'hidden';  // 防止背景页面滚动
    } else {
        // 在桌面设备上，确保滚动正常
        document.body.style.overflow = '';
    }

    // 渲染Markdown和LaTeX内容
    renderMarkdownAndLatex('problem-description', problemData.description || '');
    renderMarkdownAndLatex('problem-input-format', problemData.inputFormat || '');
    renderMarkdownAndLatex('problem-output-format', problemData.outputFormat || '');
    if (problemData.hint) {
        renderMarkdownAndLatex('problem-hint', problemData.hint);
    }

    // 添加关闭按钮
    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '10px';
    closeBtn.style.right = '10px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.color = '#ccc';
    closeBtn.style.zIndex = '101';
    closeBtn.addEventListener('click', function() {
        problemDisplay.style.display = 'none';

        // 在移动设备上，关闭题目显示后恢复编辑器显示
        if (isMobile) {
            const editorArea = document.getElementById('editor-area');
            if (editorArea) {
                editorArea.style.display = 'flex';

                // 检查当前是否为手机模式（通过检查lines-container的显示状态）
                const linesContainer = document.getElementById('lines-container');
                if (linesContainer && linesContainer.style.display !== 'none') {
                    // 当前是手机模式，确保3行预览区域可见
                    linesContainer.style.display = 'flex';

                    // 隐藏Monaco编辑器（在手机模式下）
                    const editorContainer = document.getElementById('editor-container');
                    if (editorContainer) {
                        editorContainer.style.display = 'none';
                    }
                }
            }

            // 移除返回编辑器按钮
            const backButton = document.getElementById('back-to-editor-btn');
            if (backButton && backButton.parentNode === problemDisplay) {
                backButton.parentNode.removeChild(backButton);
            }

            // 恢复背景页面滚动
            document.body.style.overflow = '';
        } else {
            // 在桌面设备上，确保滚动正常
            document.body.style.overflow = '';
        }
    });

    problemDisplay.appendChild(closeBtn);

    // 在移动端添加滚动按钮
    if (isMobile) {
        // 上移按钮
        const upBtn = document.createElement('div');
        upBtn.innerHTML = '↑';
        upBtn.className = 'up-btn-mobile';

        // 上移按钮点击事件
        let upBtnInterval;
        upBtn.addEventListener('mousedown', function() {
            scrollContainer.scrollTop -= 50;
            upBtnInterval = setInterval(() => {
                scrollContainer.scrollTop -= 50;
            }, 100);
        });

        upBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            scrollContainer.scrollTop -= 50;
            upBtnInterval = setInterval(() => {
                scrollContainer.scrollTop -= 50;
            }, 100);
        });

        upBtn.addEventListener('mouseup', function() {
            clearInterval(upBtnInterval);
        });

        upBtn.addEventListener('touchend', function() {
            clearInterval(upBtnInterval);
        });

        upBtn.addEventListener('mouseleave', function() {
            clearInterval(upBtnInterval);
        });

        problemDisplay.appendChild(upBtn);

        // 下移按钮
        const downBtn = document.createElement('div');
        downBtn.innerHTML = '↓';
        downBtn.className = 'down-btn-mobile';

        // 下移按钮点击事件
        let downBtnInterval;
        downBtn.addEventListener('mousedown', function() {
            scrollContainer.scrollTop += 50;
            downBtnInterval = setInterval(() => {
                scrollContainer.scrollTop += 50;
            }, 100);
        });

        downBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            scrollContainer.scrollTop += 50;
            downBtnInterval = setInterval(() => {
                scrollContainer.scrollTop += 50;
            }, 100);
        });

        downBtn.addEventListener('mouseup', function() {
            clearInterval(downBtnInterval);
        });

        downBtn.addEventListener('touchend', function() {
            clearInterval(downBtnInterval);
        });

        downBtn.addEventListener('mouseleave', function() {
            clearInterval(downBtnInterval);
        });

        problemDisplay.appendChild(downBtn);
    }
}

// 渲染Markdown和LaTeX内容
function renderMarkdownAndLatex(elementId, content) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // 使用Marked解析Markdown
    const markdownContent = marked.parse(content);

    // 设置HTML内容
    element.innerHTML = markdownContent;

    // 使用KaTeX渲染数学公式
    renderMathInElement(element, {
        delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false},
            {left: "\\(", right: "\\)", display: false},
            {left: "\\[", right: "\\]", display: true}
        ],
        throwOnError: false
    });
}

// 传输题目数据到CPH插件
function transferProblemToCPH(problemData) {
    try {
        // 提取题目编号，移除特殊字符，只保留字母和数字
        const problemId = problemData.pid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        // 准备测试用例数据
        const testCases = [];
        if (problemData.samples && problemData.samples.length > 0) {
            problemData.samples.forEach((sample, index) => {
                testCases.push({
                    stdin: sample[0],
                    stdout: sample[1],
                    name: `样例 ${index + 1}`
                });
            });
        }
        
        const fileName = `${problemId}.cpp`;
        
        // 首先确保在编辑器中创建并打开对应的cpp文件
        createAndOpenCppFile(fileName);
        
        // 然后发送消息到CPH插件
        if (window.cphPlugin) {
            // 如果当前不是目标文件，切换到目标文件
            if (window.cphPlugin.currentFile !== fileName) {
                // 保存当前文件的测试用例
                if (window.cphPlugin.testCases) {
                    window.cphPlugin.saveTestCases();
                }
                
                // 切换到新文件
                window.cphPlugin.currentFile = fileName;
                // 加载新文件的测试用例（如果是新文件则为空）
                window.cphPlugin.testCases = window.cphPlugin.loadTestCases();
                
                // 触发文件更改事件，通知编辑器
                localStorage.setItem('phoi_currentFileName', fileName);
            }
            
            // 添加测试用例
            testCases.forEach(testCase => {
                // 检查是否已存在相同的测试用例
                const exists = window.cphPlugin.testCases.some(existingCase => 
                    existingCase.stdin === testCase.stdin && existingCase.stdout === testCase.stdout
                );
                
                if (!exists) {
                    window.cphPlugin.testCases.push(testCase);
                }
            });
            
            // 保存测试用例
            window.cphPlugin.saveTestCases();
            
            // 更新UI
            window.cphPlugin.renderTestCases();
            window.cphPlugin.renderTestCasesMain();
            
            // 安全地调用showMessage函数
            if (typeof showMessage === 'function') {
                showMessage(`成功传输 ${testCases.length} 个测试用例到CPH: ${fileName}`, 'success');
            } else {
                console.log(`成功传输 ${testCases.length} 个测试用例到CPH: ${fileName}`);
            }
        } else {
            // 如果CPH插件未初始化，抛出异常
            throw new Error('CPH插件未初始化');
        }
    } catch (error) {
        console.error('传输题目到CPH失败:', error);
        // 安全地调用showMessage函数
        if (typeof showMessage === 'function') {
            showMessage('传输题目到CPH失败: ' + error.message, 'error');
        } else {
            console.error('传输题目到CPH失败: ' + error.message);
        }
    }
}

// 创建并打开cpp文件
function createAndOpenCppFile(fileName) {
    // 使用PhoiAPI创建和打开文件
    if (window.PhoiAPI) {
        // 检查文件是否已存在
        const fileList = window.PhoiAPI.getFileList();
        if (fileList.includes(fileName)) {
            // 文件已存在，直接打开
            window.PhoiAPI.openFile(fileName);
        } else {
            // 文件不存在，创建新文件并打开
            window.PhoiAPI.createNewFile(fileName);
        }
    } else {
        console.error('PhoiAPI 未初始化');
    }
}

// 初始化洛谷题目功能
initLuoguFeature();

// 监听窗口大小变化，调整题目显示区域样式
window.addEventListener('resize', function() {
    const problemDisplay = document.getElementById('problem-display');
    if (problemDisplay && problemDisplay.style.display !== 'none') {
        const keyboardContainer = document.getElementById('keyboard-container');
        const isMobile = !isFullMode; // 非全屏模式视为移动设备

        if (isMobile) {
            // 移动设备上的样式
            problemDisplay.style.position = 'fixed';
            problemDisplay.style.top = '36px';
            problemDisplay.style.left = '0';
            problemDisplay.style.right = '0';
            problemDisplay.style.bottom = '0';
            problemDisplay.style.width = 'auto';
            problemDisplay.style.height = 'auto';
        } else {
            // 桌面设备上的样式
            problemDisplay.style.position = 'fixed';
            problemDisplay.style.top = '36px';
            problemDisplay.style.right = '0';
            problemDisplay.style.width = '400px';
            problemDisplay.style.height = 'calc(100vh - 36px)';
            problemDisplay.style.borderLeft = '1px solid #333';
        }
    }
});

// 监听localStorage变化，同步插件开关状态
window.addEventListener('storage', function(e) {
    if (e.key === 'phoi_luogu_theme_enabled') {
        const luoguThemeEnabledCheckbox = document.getElementById('luogu-theme-enabled');
        if (luoguThemeEnabledCheckbox) {
            luoguThemeEnabledCheckbox.checked = e.newValue === 'true';
        }
    }
});