import os
import requests
from flask import Flask, render_template, request, jsonify
import urllib.parse
import re

app = Flask(__name__)

# Rextester API 配置
REXTESTER_URL = "https://rextester.com/rundotnet/Run"
LANG_CPP_GCC = 7

# 3. 危险词列表 - 包含即拒绝（不区分大小写）
DANGEROUS_WORDS = [
    'system',        # system()
    'exec',          # exec 系列
    'fork',          # fork()
    'popen',         # popen()
    'kill',          # kill()
    'windows.h',     # Windows API
    'unistd.h',      # POSIX 系统调用
    'fstream',       # 文件流
    'freopen',       # 文件重定向
    'fopen',         # 文件打开
    'FILE',          # C 文件指针
    'asm',           # 汇编
    '__asm__',       # 内联汇编
    'CreateProcess', # Windows 创建进程
    'ShellExecute',  # Windows 执行
    'WinExec',       # Windows 执行
    'spawn',         # spawn 系列
    '_wsystem',      # 宽字符 system
]

def check_security(code):
    """检查代码是否包含危险特征 - 包含危险词即拒绝"""
    code_lower = code.lower()
    for word in DANGEROUS_WORDS:
        if word.lower() in code_lower:
            return False, f"Security Alert: Detected forbidden word '{word}'"
    return True, ""

@app.route('/')
def index():
    """渲染主页"""
    return render_template('index.html')

@app.route('/run', methods=['POST'])
def run_code():
    """接收前端代码，转发给 Rextester 编译，返回结果"""
    try:
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

        # 构造发往 Rextester 的 payload
        payload = {
            "LanguageChoiceWrapper": LANG_CPP_GCC,
            "Program": code,
            "Input": stdin,
            "CompilerArgs": "-o a.out source_file.cpp -Wall -std=c++14 -O2"
        }

        # 服务器端发起请求 (无 CORS 限制)
        # 设置 User-Agent 防止被简单的反爬拦截
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

        resp = requests.post(REXTESTER_URL, data=payload, headers=headers, timeout=15)

        # 将第三方 API 的结果直接返回给前端
        return jsonify(resp.json())

    except requests.exceptions.Timeout:
        return jsonify({"Errors": "Server Timeout: 请求编译器超时，请稍后重试。"}), 504
    except Exception as e:
        return jsonify({"Errors": f"Internal Server Error: {str(e)}"}), 500

@app.route('/easyrun', methods=['GET'])
def easy_run_page():
    """渲染easyrun页面，用户访问时只显示stdin输入框"""
    return render_template('easyrun.html')

@app.route('/easyrun_api', methods=['GET'])
def easy_run_api():
    """从URL参数获取代码并运行，返回JSON结果"""
    try:
        # 从URL参数获取代码
        url_encoded_code = request.args.get('url', '')
        if not url_encoded_code:
            return jsonify({"Errors": "Missing code in URL parameter"}), 400

        # 解码URL参数中的代码
        code = urllib.parse.unquote(url_encoded_code)

        # 1. 安全检查
        is_safe, message = check_security(code)
        if not is_safe:
            return jsonify({
                "Errors": message,
                "Result": "",
                "Stats": "Compilation aborted due to security violation."
            })

        # 获取可选的标准输入
        stdin = request.args.get('stdin', '')

        # 构造发往 Rextester 的 payload
        payload = {
            "LanguageChoiceWrapper": LANG_CPP_GCC,
            "Program": code,
            "Input": stdin,
            "CompilerArgs": "-o a.out source_file.cpp -Wall -std=c++14 -O2"
        }

        # 服务器端发起请求 (无 CORS 限制)
        # 设置 User-Agent 防止被简单的反爬拦截
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

        resp = requests.post(REXTESTER_URL, data=payload, headers=headers, timeout=15)

        # 将第三方 API 的结果直接返回给前端
        return jsonify(resp.json())

    except requests.exceptions.Timeout:
        return jsonify({"Errors": "Server Timeout: 请求编译器超时，请稍后重试。"}), 504
    except Exception as e:
        return jsonify({"Errors": f"Internal Server Error: {str(e)}"}), 500

if __name__ == '__main__':
    # 启动服务，允许所有 IP 访问 (手机在同一局域网下输入电脑IP:5000 即可访问)
    app.run(host='0.0.0.0', port=5000, debug=True)