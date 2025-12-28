// DOM Elements
const editorWrapper = document.getElementById('editor-wrapper');
const fullEditor = document.getElementById('full-editor');
const highlightLayer = document.getElementById('highlight-layer');
const gutter = document.getElementById('gutter'); 

const keyboardContainer = document.getElementById('keyboard-container');
const toggleBtn = document.getElementById('mode-toggle-btn');
const runBtn = document.getElementById('run-btn');
const copyBtn = document.getElementById('copy-btn');
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

// --- [功能优化 3] 恢复保存的代码 (如果存在) ---
const defaultCode = `#include <iostream>\n#include <vector>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello" << endl;\n\treturn 0;\n};`;
let globalText = localStorage.getItem('phoi_savedCode') || defaultCode;
let globalCursorPos = globalText.length;

// --- [功能优化 2] 恢复保存的模式 ---
let isFullMode = localStorage.getItem('phoi_isFullMode') === 'true';

let isShiftActive = false;
let isShiftHeld = false;
let shiftUsageFlag = false;
let isCtrlActive = false;
let keyRepeatTimer = null, keyDelayTimer = null;

// --- [功能优化 1] 恢复保存的输入数据 ---
modalTextarea.value = localStorage.getItem('phoi_savedStdin') || "";
// 监听输入并保存
modalTextarea.addEventListener('input', () => {
    localStorage.setItem('phoi_savedStdin', modalTextarea.value);
});

// Run & Copy
runBtn.addEventListener('click', () => { 
    inputModal.style.display = 'flex'; 
    // 自动聚焦，方便输入
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

// Core Helpers
function escapeHtml(t) { return (t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function highlight(code) {
    let pMap = {}, pIdx = 0;
    let safe = code.replace(/(".?"|'.?'|\/\/.*$)/gm, (m) => { const k = `___P${pIdx++}_`; pMap[k]=m; return k; });
    safe = escapeHtml(safe);
    safe = safe.replace(/\b(int|float|double|char|void|if|else|for|while|do|return|class|struct|public|private|protected|virtual|static|const|namespace|using|template|typename|bool|true|false|new|delete|std|cin|cout|endl)\b/g, '<span class="hl-kw">$1</span>');
    safe = safe.replace(/\b(\d+)\b/g, '<span class="hl-num">$1</span>');
    safe = safe.replace(/^(#\w+)(.*)$/gm, (m,d,r) => `<span class="hl-dir">${d}</span>${r}`);
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
    // 在全屏模式下输入也需要保存代码
    localStorage.setItem('phoi_savedCode', globalText);
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
    // --- [功能优化 3] 每次状态同步（代码改变）时保存代码 ---
    localStorage.setItem('phoi_savedCode', globalText);

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
    // --- [功能优化 2] 切换模式时保存状态 ---
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
    // 在全屏模式下初始化编辑器内容
    fullEditor.value = globalText;
    updateHighlight();
} else {
    updateGutter();
    renderThreeLines();
}
updateKeyboardVisuals();