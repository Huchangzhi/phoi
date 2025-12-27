// DOM Elements
const editorWrapper = document.getElementById('editor-wrapper');
const fullEditor = document.getElementById('full-editor');
const highlightLayer = document.getElementById('highlight-layer');
const keyboardContainer = document.getElementById('keyboard-container');
const toggleBtn = document.getElementById('mode-toggle-btn');
const runBtn = document.getElementById('run-btn');
const copyBtn = document.getElementById('copy-btn');
const outputPanel = document.getElementById('output-panel');
const outputContent = document.getElementById('output-content');
const closeOutputBtn = document.getElementById('close-output');
const linesContainer = document.getElementById('lines-container');
const linePrev = document.getElementById('line-prev');
const lineCurr = document.getElementById('line-curr');
const lineNext = document.getElementById('line-next');

const keys = document.querySelectorAll('.key');
const shiftKeys = document.querySelectorAll('.shift-key');
const ctrlKeys = document.querySelectorAll('.ctrl-key');

const inputModal = document.getElementById('input-modal');
const modalTextarea = document.getElementById('modal-textarea');
const modalRun = document.getElementById('modal-run');
const modalCancel = document.getElementById('modal-cancel');

// State
let globalText = `#include <iostream>\n#include <vector>\n\nusing namespace std;\n\nint main() {\n\tcout << "Hello" << endl;\n\treturn 0;\n}`;
let globalCursorPos = globalText.length;
let isShiftActive = false;
let isShiftHeld = false;
let shiftUsageFlag = false;
let isCtrlActive = false;
let isFullMode = false;
let keyRepeatTimer = null, keyDelayTimer = null;

// --- Run Logic (Calls Python Backend) ---
runBtn.addEventListener('click', () => {
    inputModal.style.display = 'flex';
    modalTextarea.value = "";
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
    
    // 发送数据到本地 Flask 服务器 /run 接口
    try {
        const response = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: globalText,
                input: stdin
            })
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
        outputContent.innerHTML = `<span class="out-err">Server Connection Error: ${e.message}<br>确保 app.py 正在运行。</span>`;
    }
}

// --- Copy Logic ---
function copyCode() {
    const t = document.createElement('textarea'); t.value = globalText; document.body.appendChild(t); t.select();
    try {
        if(document.execCommand('copy')){
            if(navigator.vibrate)navigator.vibrate(50);
            const originalColor = copyBtn.style.color;
            copyBtn.style.color = "#0f0";
            setTimeout(() => copyBtn.style.color = originalColor, 500);
        } else alert('Fail');
    } catch(e){}
    document.body.removeChild(t);
}
copyBtn.addEventListener('click', copyCode);
closeOutputBtn.addEventListener('click', () => outputPanel.style.display='none');

// --- Helper Functions ---
function escapeHtml(t) { return (t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function highlight(code) {
    let pMap = {}, pIdx = 0;
    // 保护字符串和注释
    let safe = code.replace(/(".*?"|'.*?'|\/\/.*$)/gm, m => { const k=`_P${pIdx++}_`; pMap[k]=m; return k; });
    safe = escapeHtml(safe);
    
    // Keywords
    safe = safe.replace(/\b(int|float|double|char|void|if|else|for|while|do|return|class|struct|public|private|protected|virtual|static|const|namespace|using|template|typename|bool|true|false|new|delete|std|cin|cout|endl)\b/g, '<span class="hl-kw">$1</span>');
    // Numbers
    safe = safe.replace(/\b(\d+)\b/g, '<span class="hl-num">$1</span>');
    // Preprocessor
    safe = safe.replace(/^(#\w+)(.*)$/gm, (m,d,r) => `<span class="hl-dir">${d}${r}</span>`);
    
    // Restore
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
}

// Sync Listeners
fullEditor.addEventListener('input', () => { updateHighlight(); globalText = fullEditor.value; globalCursorPos = fullEditor.selectionStart; });
fullEditor.addEventListener('scroll', () => { highlightLayer.scrollTop=fullEditor.scrollTop; highlightLayer.scrollLeft=fullEditor.scrollLeft; });

// --- Toggle Line Comment ---
function toggleLineComment() {
    let start = globalText.lastIndexOf('\n', globalCursorPos - 1) + 1;
    let end = globalText.indexOf('\n', globalCursorPos);
    if (end === -1) end = globalText.length;
    
    const line = globalText.substring(start, end);
    let newLine = "", offset = 0;

    if (line.trim().startsWith('//')) {
        newLine = line.replace('//', ''); offset = -2;
    } else {
        newLine = '//' + line; offset = 2;
    }
    globalText = globalText.substring(0, start) + newLine + globalText.substring(end);
    globalCursorPos += offset;
    syncState();
}

// --- Smart Enter (Indent & Brackets) ---
function handleEnter() {
    // Check surroundings
    const prevChar = globalText[globalCursorPos-1];
    const nextChar = globalText[globalCursorPos];
    
    // Get indent from current line
    const lastNL = globalText.lastIndexOf('\n', globalCursorPos - 1);
    const lineStart = lastNL === -1 ? 0 : lastNL + 1;
    const currentLine = globalText.substring(lineStart, globalCursorPos);
    const indentMatch = currentLine.match(/^(\t*)/); // Only matching Tabs
    let indent = indentMatch ? indentMatch[1] : "";

    // If inside {}
    if (prevChar === '{' && nextChar === '}') {
        // Expand to 3 lines
        insertTextAtCursor('\n' + indent + '\t' + '\n' + indent, 1 + indent.length);
        return;
    } 
    
    // Normal indent inheritance
    if (prevChar === '{') indent += '\t';
    insertTextAtCursor('\n' + indent);
}

function handleAutoPair(char) {
    const pairs = {'(':')', '{':'}', '[':']', '"':'"', "'":"'"};
    if (pairs[char]) insertTextAtCursor(char + pairs[char], 1);
    else insertTextAtCursor(char);
}

// --- Display Logic ---
function renderThreeLines() {
    if(isFullMode) return;
    const lines = globalText.split('\n');
    let accum = 0, idx = 0, start = 0;
    for(let i=0; i<lines.length; i++) {
        if(globalCursorPos >= accum && globalCursorPos <= accum + lines[i].length) { idx=i; start=accum; break; }
        accum += lines[i].length + 1;
    }
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
    if(isFullMode) { fullEditor.value=globalText; fullEditor.setSelectionRange(globalCursorPos, globalCursorPos); updateHighlight(); }
    else renderThreeLines();
}

// --- Keyboard Input ---
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
        // Fix for symbols < > ?
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

// --- Full Editor Handlers ---
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

// --- Visual & Touch ---
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

// --- Mode Toggle ---
toggleBtn.addEventListener('click', () => {
    isFullMode = !isFullMode;
    if (isFullMode) {
        keyboardContainer.classList.add('hide-keyboard');
        linesContainer.style.display = 'none'; 
        editorWrapper.style.display = 'block';
        fullEditor.value=globalText; fullEditor.focus(); fullEditor.setSelectionRange(globalCursorPos, globalCursorPos); updateHighlight();
        toggleBtn.textContent = '▲';
    } else {
        globalText=fullEditor.value; globalCursorPos=fullEditor.selectionStart;
        keyboardContainer.classList.remove('hide-keyboard');
        linesContainer.style.display = 'flex';
        editorWrapper.style.display = 'none';
        toggleBtn.textContent = '▼';
        renderThreeLines();
    }
});

// Init
renderThreeLines();
updateKeyboardVisuals();
