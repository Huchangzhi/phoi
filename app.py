import os
import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Rextester API 配置
REXTESTER_URL = "https://rextester.com/rundotnet/Run"
LANG_CPP_GCC = 7

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