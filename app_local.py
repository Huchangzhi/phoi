import os
import subprocess
import tempfile
import shutil
import re
import time
import sys
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# --- 安全配置 ---
# 1. 执行超时时间 (秒)
TIMEOUT_SECONDS = 1 

# 2. 内存限制 (MB)
MEMORY_LIMIT_MB = 512

# 3. 危险关键词黑名单
DANGEROUS_PATTERNS = [
    r'\bsystem\s*\(',       # 禁止 system()
    r'\bexec[lqvpe]*\s*\(', # 禁止 exec 系列
    r'\bfork\s*\(',         # 禁止 fork()
    r'\bpopen\s*\(',        # 禁止 popen
    r'\bkill\s*\(',         # 禁止 kill
    r'<windows\.h>',        # 禁止 Windows API
    r'<unistd\.h>',         # 禁止 POSIX 系统调用
    r'\bfstream\b',         # 禁止文件流操作
    r'\bFILE\s*\*',         # 禁止 C 风格文件指针
    r'\bfopen\s*\(',        # 禁止 fopen
    r'__asm__',             # 禁止内联汇编
    r'\basm\s*\(',
]

def check_security(code):
    """检查代码是否包含危险特征"""
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, code):
            return False, f"Security Alert: Detected forbidden pattern '{pattern}'"
    return True, ""

def set_process_limits():
    """
    在子进程启动前设置资源限制 (仅 Linux/macOS 有效)
    """
    try:
        import resource
        # 转换 MB 为 Bytes
        mem_bytes = MEMORY_LIMIT_MB * 1024 * 1024
        
        # 限制最大虚拟内存 (RLIMIT_AS)
        # soft limit, hard limit
        resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
        
        # 限制数据段大小 (可选增强)
        # resource.setrlimit(resource.RLIMIT_DATA, (mem_bytes, mem_bytes))
    except (ImportError, AttributeError):
        # Windows 或者是没有 resource 模块的环境，跳过
        pass

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/run', methods=['POST'])
def run_code():
    data = request.json
    code = data.get('code', '')
    stdin = data.get('input', '')

    # 1. 安全检查
    is_safe, message = check_security(code)
    if not is_safe:
        return jsonify({
            "Errors": message,
            "Result": "",
            "Stats": "Compilation aborted due to security violation."
        })

    # 创建临时目录
    temp_dir = tempfile.mkdtemp()
    source_path = os.path.join(temp_dir, 'source.cpp')
    executable_name = 'program.exe' if os.name == 'nt' else './program'
    executable_path = os.path.join(temp_dir, executable_name)

    response_data = {
        "Result": "",
        "Errors": "",
        "Warnings": "",
        "Stats": ""
    }

    try:
        # 2. 写入源码
        with open(source_path, 'w', encoding='utf-8') as f:
            f.write(code)

        # 3. 编译
        # 编译时一般不需要太严格的资源限制，主要限制运行
        start_time = time.time()
        compile_cmd = ['g++', source_path, '-o', executable_path, '-O2', '-Wall']
        
        compile_proc = subprocess.run(
            compile_cmd,
            capture_output=True,
            text=True,
            timeout=10 
        )

        if compile_proc.returncode != 0:
            response_data["Errors"] = compile_proc.stderr
            response_data["Stats"] = "Compilation Failed."
        else:
            if compile_proc.stderr:
                response_data["Warnings"] = compile_proc.stderr

            # 4. 运行程序 (带时间与内存限制)
            try:
                run_start = time.time()
                
                # 构建参数
                run_kwargs = {
                    "input": stdin,
                    "capture_output": True,
                    "text": True,
                    "timeout": TIMEOUT_SECONDS
                }

                # 仅在 POSIX 系统 (Linux/Mac) 下添加 preexec_fn 来限制内存
                if os.name == 'posix':
                    run_kwargs['preexec_fn'] = set_process_limits

                run_proc = subprocess.run(
                    [executable_path],
                    **run_kwargs
                )
                
                run_duration = time.time() - run_start
                response_data["Result"] = run_proc.stdout
                
                if run_proc.stderr:
                    # 检查是否是因为内存超限导致的错误 (通常是 std::bad_alloc 或 Segfault)
                    if "std::bad_alloc" in run_proc.stderr:
                        response_data["Errors"] += "\n[Error] Memory Limit Exceeded"
                    else:
                        response_data["Errors"] += "\n[Runtime Error]\n" + run_proc.stderr
                
                response_data["Stats"] = f"Run time: {run_duration:.2f}s | Mem Limit: {MEMORY_LIMIT_MB}MB"

            except subprocess.TimeoutExpired:
                response_data["Errors"] += f"\n[Error] Execution Timed Out (Limit: {TIMEOUT_SECONDS}s)"
                response_data["Stats"] = "Time Limit Exceeded"
            except Exception as e:
                # 如果是内存超限被 kill，可能会抛出特定异常或 returncode
                err_msg = str(e)
                if "MemoryError" in err_msg: 
                    response_data["Errors"] += f"\n[Error] Memory Limit Exceeded ({MEMORY_LIMIT_MB}MB)"
                else:
                    response_data["Errors"] += f"\n[Error] Execution Failed: {err_msg}"

    except Exception as e:
        response_data["Errors"] = f"Server Internal Error: {str(e)}"
    finally:
        try:
            shutil.rmtree(temp_dir)
        except:
            pass

    return jsonify(response_data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
