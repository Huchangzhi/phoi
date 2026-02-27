import sys
import os
import threading
import subprocess
import requests
import socket
import random
import string
from flask import Flask, render_template, request, jsonify
import urllib.parse
import re
import tempfile
import shutil
import time
import webview


def show_debug_confirm_dialog(pairing_code):
    """显示调试确认对话框（阻塞直到用户确认）"""
    try:
        import tkinter as tk
        from tkinter import messagebox
        
        # 创建临时窗口显示确认对话框
        root = tk.Tk()
        root.withdraw()  # 隐藏主窗口
        root.attributes('-topmost', True)
        
        message = (
            f"有人想要启动调试功能\n\n"
            f"配对码：{pairing_code}\n\n"
            f"⚠️ 安全警告：\n"
            f"调试功能允许执行任意代码，可能访问系统资源。\n"
            f"请确保代码来源可信！\n\n"
            f"是否允许启动调试？"
        )
        
        response = messagebox.askyesno("调试安全确认", message, icon='warning', parent=root)
        root.destroy()
        return response
    except Exception as e:
        print(f"显示对话框失败：{e}")
        # 降级为控制台输入
        print(f"\n⚠️ 有人想要启动调试功能，配对码：{pairing_code}")
        print("⚠️ 安全警告：调试功能允许执行任意代码，可能访问系统资源。")
        response = input("是否允许启动调试？(y/n): ").strip().lower()
        return response == 'y'


class DebugManager:
    """调试管理器 - 单例模式管理 GDB 调试会话"""
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        
        self.debug_process = None  # GDB 进程
        self.debug_thread = None  # 通信线程
        self.pairing_code = None  # 当前配对码
        self.status = "idle"  # idle, busy, compiling
        self.temp_dir = None  # 临时文件目录
        self.source_path = None  # 源码路径
        self.executable_path = None  # 可执行文件路径
        self.stop_flag = False  # 停止标志
        self.output_buffer = ""  # GDB 输出缓冲
        self.output_lock = threading.Lock()  # 输出锁
        self.clients = []  # SSE 客户端队列
    
    def add_client(self, queue):
        """添加 SSE 客户端"""
        self.clients.append(queue)
    
    def remove_client(self, queue):
        """移除 SSE 客户端"""
        if queue in self.clients:
            self.clients.remove(queue)
    
    def _emit_output(self, text):
        """发送输出到所有 SSE 客户端"""
        with self.output_lock:
            self.output_buffer += text
            # 发送到所有客户端
            for client_queue in self.clients[:]:
                try:
                    client_queue.put_nowait(text)
                except:
                    pass
    
    def generate_pairing_code(self):
        """生成 6 位随机配对码"""
        return ''.join(random.choices(string.digits, k=6))
    
    def start_debug_session(self, code, pairing_code, compiler_path="g++", gdb_path="gdb"):
        """开始调试会话"""
        with self._lock:
            if self.status != "idle":
                return False, "调试器繁忙"

            self.pairing_code = pairing_code
            self.status = "compiling"
            self.stop_flag = False
            self.output_buffer = ""

        # 创建临时目录（不清理，以便 gdb 访问）
        self.temp_dir = tempfile.mkdtemp(prefix="phcode_debug_")
        self.source_path = os.path.join(self.temp_dir, 'source.cpp')
        self.executable_path = os.path.join(self.temp_dir, 'program.exe')

        try:
            # 写入源码
            with open(self.source_path, 'w', encoding='utf-8') as f:
                f.write(code)

            # 编译代码（带调试信息）
            compile_cmd = [
                compiler_path,
                self.source_path,
                '-o', self.executable_path,
                '-g',  # 调试信息
                '-O0',  # 不优化
                '-Wall',
                '-std=c++14'
            ]

            compile_proc = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=30
            )

            if compile_proc.returncode != 0:
                self.status = "idle"
                shutil.rmtree(self.temp_dir, ignore_errors=True)
                return False, f"编译失败：{compile_proc.stderr}"

            if compile_proc.stderr:
                # 警告信息
                self._emit_output(f"[警告] {compile_proc.stderr}\n")

            # 启动 GDB（传入 gdb_path）
            self._start_gdb(gdb_path)
            return True, "调试已启动"

        except subprocess.TimeoutExpired:
            self.status = "idle"
            shutil.rmtree(self.temp_dir, ignore_errors=True)
            return False, "编译超时"
        except Exception as e:
            self.status = "idle"
            shutil.rmtree(self.temp_dir, ignore_errors=True)
            return False, f"错误：{str(e)}"
    
    def _start_gdb(self, gdb_path):
        """启动 GDB 调试器"""
        try:
            # 启动 GDB 进程（去掉 -batch 以支持交互模式）
            gdb_cmd = [gdb_path, '-q', self.executable_path]
            self.debug_process = subprocess.Popen(
                gdb_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                encoding='utf-8',
                errors='replace'
            )

            self.status = "busy"
            self._emit_output(f"[调试] GDB 已启动，配对码：{self.pairing_code}\n")
            self._emit_output(f"[调试] 可执行文件：{self.executable_path}\n")
            self._emit_output(f"[调试] 源码路径：{self.source_path}\n")
            self._emit_output("[调试] 输入 'help' 查看可用命令，输入 'quit' 退出调试\n\n")

            # 启动读取线程
            self.debug_thread = threading.Thread(target=self._read_gdb_output)
            self.debug_thread.daemon = True
            self.debug_thread.start()

        except FileNotFoundError:
            self.status = "idle"
            self._emit_output("[错误] 未找到 gdb，请确保已安装 GDB 调试器\n")
            shutil.rmtree(self.temp_dir, ignore_errors=True)
        except Exception as e:
            self.status = "idle"
            self._emit_output(f"[错误] 启动 GDB 失败：{str(e)}\n")
            shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def _read_gdb_output(self):
        """读取 GDB 输出"""
        try:
            while self.debug_process and self.debug_process.poll() is None and not self.stop_flag:
                # 按行读取
                line = self.debug_process.stdout.readline()
                if line:
                    # 统一换行符：将 \r\n 或 \r 替换为 \n
                    normalized_line = line.replace('\r\n', '\n').replace('\r', '\n')
                    # 确保每行都有换行符
                    if not normalized_line.endswith('\n'):
                        normalized_line += '\n'
                    self._emit_output(normalized_line)
                else:
                    # 没有更多输出，短暂等待
                    time.sleep(0.01)
        except Exception as e:
            self._emit_output(f"[错误] 读取 GDB 输出失败：{str(e)}\n")
        finally:
            self._cleanup()
    
    def _emit_output(self, text):
        """发送输出到所有 SSE 客户端"""
        with self.output_lock:
            self.output_buffer += text
            # 发送到所有客户端
            for client_queue in self.clients[:]:
                try:
                    client_queue.put_nowait(text)
                except:
                    pass
    
    def send_command(self, command):
        """发送 GDB 命令"""
        if self.debug_process and self.status == "busy":
            try:
                self.debug_process.stdin.write(command + '\n')
                self.debug_process.stdin.flush()
                return True
            except Exception as e:
                self._emit_output(f"[错误] 发送命令失败：{str(e)}\n")
        return False
    
    def stop_debug(self):
        """停止调试"""
        self.stop_flag = True
        
        if self.debug_process:
            try:
                self.debug_process.stdin.write('quit\n')
                self.debug_process.stdin.flush()
                self.debug_process.wait(timeout=2)
            except:
                self.debug_process.kill()
            finally:
                self.debug_process = None
        
        self._cleanup()
    
    def _cleanup(self):
        """清理调试资源"""
        self.status = "idle"
        self.pairing_code = None
        self._emit_output("[调试] 调试会话已结束\n")
        # 注意：不清理临时目录，以便用户后续查看源码
        # shutil.rmtree(self.temp_dir, ignore_errors=True)
        # 改为只清理可执行文件，保留源码
        if self.executable_path and os.path.exists(self.executable_path):
            try:
                os.remove(self.executable_path)
            except:
                pass


class PHCodeServer:
    def __init__(self):
        # 获取程序所在目录（exe 所在目录或脚本所在目录）
        if getattr(sys, 'frozen', False):
            # PyInstaller 打包后，获取 exe 所在目录
            base_dir = os.path.dirname(sys.executable)
        else:
            # 开发环境，获取脚本所在目录
            base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 设置 Flask 模板和静态文件路径
        template_folder = os.path.join(base_dir, 'templates')
        static_folder = os.path.join(base_dir, 'static')
        
        self.app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
        self.debug_manager = DebugManager()
        self.server_thread = None
        self.is_running = False
        self.host = '127.0.0.1'  # 仅本地访问
        self.port = 5000
        self.use_local_compiler = True  # 默认使用本地编译器
        self.base_dir = base_dir  # 保存基础目录路径

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
        self.gdb_path = self._get_gdb_path()  # 自动获取 GDB 路径

    def _get_gdb_path(self):
        """获取 GDB 路径，从 exe 同级目录查找 w64devkit 或系统 PATH"""
        # 获取程序所在目录（exe 所在目录或脚本所在目录）
        if getattr(sys, 'frozen', False):
            # PyInstaller 打包后，获取 exe 所在目录
            base_dir = os.path.dirname(sys.executable)
        else:
            # 开发环境，获取脚本所在目录
            base_dir = os.path.dirname(os.path.abspath(__file__))

        # 查找 w64devkit 中的 gdb
        bundled_gdb = os.path.join(base_dir, 'w64devkit', 'bin', 'gdb.exe')
        if os.path.exists(bundled_gdb):
            print(f"使用 bundled GDB: {bundled_gdb}")
            return bundled_gdb

        # 检查系统 PATH 中的 gdb
        try:
            result = subprocess.run(['where', 'gdb'], capture_output=True, text=True)
            if result.returncode == 0:
                gdb_path = result.stdout.strip().split('\n')[0].strip()
                print(f"使用系统 PATH 中的 GDB: {gdb_path}")
                return gdb_path
        except:
            pass

        # 默认返回 gdb（期望在 PATH 中）
        print("使用默认 GDB: gdb")
        return 'gdb'

    def _get_compiler_path(self):
        """获取编译器路径，从 exe 同级目录查找 w64devkit"""
        # 获取程序所在目录（exe 所在目录或脚本所在目录）
        if getattr(sys, 'frozen', False):
            # PyInstaller 打包后，获取 exe 所在目录
            base_dir = os.path.dirname(sys.executable)
        else:
            # 开发环境，获取脚本所在目录
            base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 查找 w64devkit 中的 g++
        bundled_compiler = os.path.join(base_dir, 'w64devkit', 'bin', 'g++.exe')
        if os.path.exists(bundled_compiler):
            print(f"使用 bundled 编译器：{bundled_compiler}")
            return bundled_compiler
        
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

        # 调试功能路由
        @self.app.route('/debug/status', methods=['GET'])
        def debug_status():
            """获取调试器状态"""
            return jsonify({
                'status': self.debug_manager.status,
                'pairing_code': self.debug_manager.pairing_code
            })

        @self.app.route('/debug/start', methods=['POST'])
        def debug_start():
            """开始调试会话 - 后端弹出安全确认对话框"""
            try:
                data = request.json
                code = data.get('code', '')
                pairing_code = data.get('pairing_code', '')

                if not pairing_code or len(pairing_code) != 6:
                    return jsonify({'success': False, 'message': '配对码必须是 6 位数字'})

                # 检查是否包含危险代码
                is_safe, message = self.check_security(code)
                if not is_safe:
                    return jsonify({'success': False, 'message': message})

                # 弹出安全警告对话框（阻塞直到用户确认）
                confirmed = show_debug_confirm_dialog(pairing_code)
                
                if not confirmed:
                    return jsonify({'success': False, 'message': '用户取消了调试'})

                # 开始调试会话（传入 gdb_path）
                success, msg = self.debug_manager.start_debug_session(
                    code, pairing_code, self.compiler_path, self.gdb_path
                )

                return jsonify({'success': success, 'message': msg})

            except Exception as e:
                return jsonify({'success': False, 'message': f'错误：{str(e)}'})

        @self.app.route('/debug/stop', methods=['POST'])
        def debug_stop():
            """停止调试会话"""
            try:
                self.debug_manager.stop_debug()
                return jsonify({'success': True, 'message': '调试已停止'})
            except Exception as e:
                return jsonify({'success': False, 'message': f'错误：{str(e)}'})

        @self.app.route('/debug/command', methods=['POST'])
        def debug_command():
            """发送 GDB 命令"""
            try:
                data = request.json
                command = data.get('command', '')

                if not command:
                    return jsonify({'success': False, 'message': '命令不能为空'})

                # 验证配对码
                session_code = data.get('pairing_code', '')
                if session_code != self.debug_manager.pairing_code:
                    return jsonify({'success': False, 'message': '配对码错误'})

                if self.debug_manager.status != 'busy':
                    return jsonify({'success': False, 'message': '调试器未运行'})

                success = self.debug_manager.send_command(command)
                return jsonify({'success': success})

            except Exception as e:
                return jsonify({'success': False, 'message': f'错误：{str(e)}'})

        @self.app.route('/debug/events')
        def debug_events():
            """SSE - 调试事件流"""
            from flask import Response
            import queue
            import json

            def generate():
                msg_queue = queue.Queue()
                self.debug_manager.add_client(msg_queue)
                try:
                    while True:
                        try:
                            msg = msg_queue.get(timeout=30)  # 30 秒超时
                            # 使用 JSON 编码确保换行符正确传输
                            encoded_msg = json.dumps(msg, ensure_ascii=False)
                            yield f"data: {encoded_msg}\n\n"
                        except queue.Empty:
                            # 发送心跳
                            yield ": heartbeat\n\n"
                except GeneratorExit:
                    pass
                finally:
                    self.debug_manager.remove_client(msg_queue)

            return Response(
                generate(),
                mimetype='text/event-stream',
                headers={
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no'
                }
            )

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
            compile_cmd = [compiler_path, source_path, '-o', executable_path, '-O2', '-g', '-Wall', '-std=c++14']

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
        self.app.run(host=self.host, port=self.port, debug=False, use_reloader=False, threaded=True)

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
