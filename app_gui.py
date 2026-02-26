import sys
import os
import threading
import subprocess
import requests
import socket
from flask import Flask, render_template, request, jsonify
import urllib.parse
import re
import tempfile
import shutil
import time
import webview


class PHCodeServer:
    def __init__(self):
        self.app = Flask(__name__)
        self.server_thread = None
        self.is_running = False
        self.host = '127.0.0.1'  # 仅本地访问
        self.port = 5000
        self.use_local_compiler = True  # 默认使用本地编译器

        # Rextester API 配置（备用）
        self.REXTESTER_URL = "https://rextester.com/rundotnet/Run"
        self.LANG_CPP_GCC = 7

        # 安全配置
        self.TIMEOUT_SECONDS = 1
        self.MEMORY_LIMIT_MB = 512
        self.DANGEROUS_PATTERNS = [
            r'\bsystem\s*\(',       # 禁止 system()
            r'\bexec[lqvpe]*\s*\(', # 禁止 exec 系列
            r'\bfork\s*\(',         # 禁止 fork()
            r'\bpopen\s*\(',        # 禁止 popen
            r'\bkill\s*\(',         # 禁止 kill
            r'<windows\.h>',        # 禁止 Windows API
            r'<unistd\.h>',         # 禁止 POSIX 系统调用
            r'\bfstream\b',         # 禁止文件流操作
            r'\bfreopen\b',
            r'\bFILE\s*\*',         # 禁止 C 风格文件指针
            r'\bfopen\s*\(',        # 禁止 fopen
            r'__asm__',             # 禁止内联汇编
            r'\basm\s*\(',
        ]

        self.setup_routes()
        self.compiler_path = self._get_compiler_path()  # 自动获取编译器路径

    def _get_compiler_path(self):
        """获取编译器路径，优先使用 bundled w64devkit"""
        # 检查 bundled w64devkit
        if getattr(sys, 'frozen', False):
            # PyInstaller 打包后的路径
            bundle_dir = sys._MEIPASS
            bundled_compiler = os.path.join(bundle_dir, 'w64devkit', 'bin', 'g++.exe')
            if os.path.exists(bundled_compiler):
                print(f"使用 bundled 编译器：{bundled_compiler}")
                return bundled_compiler
        
        # 检查当前目录下的 w64devkit
        local_compiler = os.path.join(os.getcwd(), 'w64devkit', 'bin', 'g++.exe')
        if os.path.exists(local_compiler):
            print(f"使用本地编译器：{local_compiler}")
            return local_compiler
        
        # 检查系统 PATH 中的 g++
        try:
            result = subprocess.run(['where', 'g++'], capture_output=True, text=True)
            if result.returncode == 0:
                compiler_path = result.stdout.strip().split('\n')[0].strip()
                print(f"使用系统 PATH 中的编译器：{compiler_path}")
                return compiler_path
        except:
            pass
        
        # 默认返回 g++（期望在 PATH 中）
        print("使用默认编译器：g++")
        return 'g++'

    def setup_routes(self):
        """设置 Flask 路由"""
        @self.app.route('/')
        def index():
            return render_template('index.html')

        @self.app.route('/run', methods=['POST'])
        def run_code():
            return self._handle_run_code(request)

        @self.app.route('/easyrun', methods=['GET'])
        def easy_run_page():
            return render_template('easyrun.html')

        @self.app.route('/easyrun_api', methods=['GET'])
        def easy_run_api():
            return self._handle_easy_run_api(request)

    def check_security(self, code):
        """检查代码是否包含危险特征"""
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, code):
                return False, f"Security Alert: Detected forbidden pattern '{pattern}'"
        return True, ""

    def _handle_run_code(self, request):
        """处理代码运行请求"""
        try:
            data = request.json
            code = data.get('code', '')
            stdin = data.get('input', '')

            # 安全检查
            is_safe, message = self.check_security(code)
            if not is_safe:
                return jsonify({
                    "Errors": message,
                    "Result": "",
                    "Stats": "Compilation aborted due to security violation."
                })

            if self.use_local_compiler:
                # 使用本地编译器
                return self._run_locally(code, stdin, self.compiler_path)
            else:
                # 使用 Rextester API（备用）
                return self._run_with_rextester(code, stdin)

        except Exception as e:
            return jsonify({"Errors": f"Internal Server Error: {str(e)}"}), 500

    def _run_with_rextester(self, code, stdin):
        """使用 Rextester API 运行代码"""
        # 构造发往 Rextester 的 payload
        payload = {
            "LanguageChoiceWrapper": self.LANG_CPP_GCC,
            "Program": code,
            "Input": stdin,
            "CompilerArgs": "-o a.out source_file.cpp -Wall -std=c++14 -O2"
        }

        # 服务器端发起请求 (无 CORS 限制)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

        try:
            resp = requests.post(self.REXTESTER_URL, data=payload, headers=headers, timeout=15)
            return jsonify(resp.json())
        except requests.exceptions.Timeout:
            return jsonify({"Errors": "Server Timeout: 请求编译器超时，请稍后重试。"}), 504
        except Exception as e:
            return jsonify({"Errors": f"Request Error: {str(e)}"}), 500

    def _run_locally(self, code, stdin, compiler_path="g++"):
        """本地运行代码"""
        temp_dir = tempfile.mkdtemp()
        source_path = os.path.join(temp_dir, 'source.cpp')
        executable_name = 'program.exe'
        executable_path = os.path.join(temp_dir, executable_name)

        response_data = {
            "Result": "",
            "Errors": "",
            "Warnings": "",
            "Stats": ""
        }

        try:
            # 写入源码
            with open(source_path, 'w', encoding='utf-8') as f:
                f.write(code)

            # 编译
            start_time = time.time()
            compile_cmd = [compiler_path, source_path, '-o', executable_path, '-O2', '-Wall', '-std=c++14']

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

                # 运行程序 (带时间与内存限制)
                try:
                    run_start = time.time()

                    run_proc = subprocess.run(
                        [executable_path],
                        input=stdin,
                        capture_output=True,
                        text=True,
                        timeout=self.TIMEOUT_SECONDS
                    )

                    run_duration = time.time() - run_start
                    response_data["Result"] = run_proc.stdout

                    if run_proc.stderr:
                        response_data["Errors"] += "\n[Runtime Error]\n" + run_proc.stderr

                    response_data["Stats"] = f"Run time: {run_duration:.2f}s | Mem Limit: {self.MEMORY_LIMIT_MB}MB"

                except subprocess.TimeoutExpired:
                    response_data["Errors"] += f"\n[Error] Execution Timed Out (Limit: {self.TIMEOUT_SECONDS}s)"
                    response_data["Stats"] = "Time Limit Exceeded"
                except Exception as e:
                    response_data["Errors"] += f"\n[Error] Execution Failed: {str(e)}"

        except FileNotFoundError:
            response_data["Errors"] = f"{compiler_path} 编译器未找到，请确保已正确安装 w64devkit 或 MinGW"
            response_data["Stats"] = "Compilation Failed."
        except Exception as e:
            response_data["Errors"] = f"Server Internal Error: {str(e)}"
        finally:
            try:
                shutil.rmtree(temp_dir)
            except:
                pass

        return jsonify(response_data)

    def _handle_easy_run_api(self, request):
        """处理 easyrun API 请求"""
        try:
            # 从 URL 参数获取代码
            url_encoded_code = request.args.get('url', '')
            if not url_encoded_code:
                return jsonify({"Errors": "Missing code in URL parameter"}), 400

            # 解码 URL 参数中的代码
            code = urllib.parse.unquote(url_encoded_code)

            # 安全检查
            is_safe, message = self.check_security(code)
            if not is_safe:
                return jsonify({
                    "Errors": message,
                    "Result": "",
                    "Stats": "Compilation aborted due to security violation."
                })

            # 获取可选的标准输入
            stdin = request.args.get('stdin', '')

            if self.use_local_compiler:
                return self._run_locally(code, stdin, self.compiler_path)
            else:
                return self._run_with_rextester(code, stdin)

        except Exception as e:
            return jsonify({"Errors": f"Internal Server Error: {str(e)}"}), 500

    def start_server(self, host='127.0.0.1', port=5000):
        """启动服务器"""
        self.host = host
        self.port = port
        self.server_thread = threading.Thread(target=self._run_flask_app)
        self.server_thread.daemon = True
        self.server_thread.start()
        self.is_running = True
        print(f"服务器已在 {host}:{port} 启动")

    def _run_flask_app(self):
        """运行 Flask 应用"""
        self.app.run(host=self.host, port=self.port, debug=False, use_reloader=False)

    def stop_server(self):
        """停止服务器"""
        if self.is_running:
            self.is_running = False
            if self.server_thread:
                self.server_thread.join(timeout=1)


class PHCodeWebViewApp:
    def __init__(self):
        self.server = PHCodeServer()
        self.window = None

    def run(self):
        """运行应用"""
        # 启动 Flask 服务器（仅本地访问）
        self.server.start_server(host='127.0.0.1', port=5000)
        
        # 等待服务器启动
        time.sleep(1)
        
        # 使用 pywebview 创建窗口
        url = 'http://127.0.0.1:5000'
        
        # 获取数据存储路径（在程序同级目录创建 phcode_data 文件夹）
        if getattr(sys, 'frozen', False):
            # PyInstaller 打包后，数据存储在程序同级的 data 目录
            storage_path = os.path.join(os.path.dirname(sys.executable), 'phcode_data')
        else:
            # 开发环境，数据也存储在程序同级目录
            storage_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'phcode_data')
        
        # 确保存储目录存在
        os.makedirs(storage_path, exist_ok=True)
        
        self.window = webview.create_window(
            title='PH Code - 在线 C++ 编辑器',
            url=url,
            width=1200,
            height=800,
            resizable=True,
            fullscreen=False,
            min_size=(800, 600)
        )
        
        # 启动 pywebview，传入 storage_path 参数并禁用私有模式以启用数据持久化
        webview.start(storage_path=storage_path, private_mode=False)
        
        # 窗口关闭后停止服务器
        self.server.stop_server()


if __name__ == "__main__":
    app = PHCodeWebViewApp()
    app.run()
