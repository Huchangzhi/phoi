import sys
import os
import threading
import subprocess
import webbrowser
import requests
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
import socket
from flask import Flask, render_template, request, jsonify
import urllib.parse
import re
import tempfile
import shutil
import time


class PHCodeServer:
    def __init__(self):
        self.app = Flask(__name__)
        self.server_thread = None
        self.is_running = False
        self.host = '127.0.0.1'  # 默认本地访问
        self.port = 5000
        self.use_local_compiler = False  # 是否使用本地编译器
        
        # Rextester API 配置
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
        self.compiler_path = "g++"  # 默认编译器路径

    def setup_routes(self):
        """设置Flask路由"""
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
                return self._run_locally(code, stdin, getattr(self, 'compiler_path', 'g++'))
            else:
                # 使用Rextester API
                return self._run_with_rextester(code, stdin)

        except Exception as e:
            return jsonify({"Errors": f"Internal Server Error: {str(e)}"}), 500

    def _run_with_rextester(self, code, stdin):
        """使用Rextester API运行代码"""
        import requests
        
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
        executable_name = 'program.exe' if os.name == 'nt' else './program'
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

            # 编译 - 使用指定的编译器路径
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

                    # 在Windows上可能需要不同的处理方式
                    if os.name == 'nt':  # Windows
                        run_proc = subprocess.run(
                            [executable_path],
                            input=stdin,
                            capture_output=True,
                            text=True,
                            timeout=self.TIMEOUT_SECONDS
                        )
                    else:  # Unix-like systems
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
            response_data["Errors"] = f"{compiler_path} 编译器未找到，请确保已正确设置编译器路径"
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
        """处理easyrun API请求"""
        try:
            # 从URL参数获取代码
            url_encoded_code = request.args.get('url', '')
            if not url_encoded_code:
                return jsonify({"Errors": "Missing code in URL parameter"}), 400

            # 解码URL参数中的代码
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
                # 使用本地编译器
                return self._run_locally(code, stdin, getattr(self, 'compiler_path', 'g++'))
            else:
                # 使用Rextester API
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

    def _run_flask_app(self):
        """运行Flask应用"""
        self.app.run(host=self.host, port=self.port, debug=False, use_reloader=False)

    def stop_server(self):
        """停止服务器"""
        if self.is_running:
            # Flask没有内置的停止方法，这里我们只是标记服务器为停止状态
            self.is_running = False
            if self.server_thread:
                self.server_thread.join(timeout=1)  # 等待最多1秒让线程结束

    def restart_server(self, host='127.0.0.1', port=5000):
        """重启服务器"""
        self.stop_server()
        time.sleep(1)  # 等待服务器完全停止
        self.start_server(host=host, port=port)


class PHCodeGUIClient:
    def __init__(self):
        self.server = PHCodeServer()
        self.root = tk.Tk()
        self.root.title("PH Code GUI Server")
        self.root.geometry("600x500")
        
        self.setup_gui()
    
    def setup_gui(self):
        """设置GUI界面"""
        # 主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 服务器控制区域
        server_control_frame = ttk.LabelFrame(main_frame, text="服务器控制", padding="10")
        server_control_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        # 端口设置
        ttk.Label(server_control_frame, text="端口:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
        self.port_var = tk.StringVar(value="5000")
        self.port_var_entry = ttk.Entry(server_control_frame, textvariable=self.port_var, width=10)
        self.port_var_entry.grid(row=0, column=1, sticky=tk.W)

        # 网络访问设置
        self.network_var = tk.BooleanVar()
        self.network_check = ttk.Checkbutton(
            server_control_frame,
            text="对外公开 (0.0.0.0)",
            variable=self.network_var
        )
        self.network_check.grid(row=0, column=2, sticky=tk.W, padx=(20, 0))

        # 本地编译器设置
        self.local_compiler_var = tk.BooleanVar()
        self.compiler_path = tk.StringVar(value="g++")  # 默认编译器路径
        self.local_compiler_check = ttk.Checkbutton(
            server_control_frame,
            text="使用本地MinGW",
            variable=self.local_compiler_var,
            command=self.on_local_compiler_toggle
        )
        self.local_compiler_check.grid(row=0, column=3, sticky=tk.W, padx=(20, 0))
        
        # 控制按钮
        self.start_btn = ttk.Button(
            server_control_frame,
            text="启动服务器",
            command=self.start_server
        )
        self.start_btn.grid(row=1, column=0, pady=10)

        self.restart_btn = ttk.Button(
            server_control_frame,
            text="重启服务器",
            command=self.restart_server,
            state=tk.DISABLED
        )
        self.restart_btn.grid(row=1, column=1, pady=10, padx=5)

        self.stop_btn = ttk.Button(
            server_control_frame,
            text="停止服务器",
            command=self.stop_server,
            state=tk.DISABLED
        )
        self.stop_btn.grid(row=1, column=2, pady=10, padx=5)

        self.open_browser_btn = ttk.Button(
            server_control_frame,
            text="在浏览器中打开",
            command=self.open_in_browser,
            state=tk.DISABLED
        )
        self.open_browser_btn.grid(row=1, column=3, pady=10, padx=5)
        
        # 状态显示
        status_frame = ttk.Frame(main_frame)
        status_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=10)
        
        ttk.Label(status_frame, text="服务器状态:").pack(side=tk.LEFT)
        self.status_var = tk.StringVar(value="未启动")
        self.status_label = ttk.Label(status_frame, textvariable=self.status_var, foreground="red")
        self.status_label.pack(side=tk.LEFT, padx=(5, 0))
        
        # 日志显示区域
        log_frame = ttk.LabelFrame(main_frame, text="日志输出", padding="5")
        log_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, height=15, state=tk.DISABLED)
        self.log_text.pack(fill=tk.BOTH, expand=True)
        
        # 配置网格权重
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(2, weight=1)
        server_control_frame.columnconfigure(4, weight=1)

    def on_local_compiler_toggle(self):
        """处理本地编译器复选框切换事件"""
        if self.local_compiler_var.get():  # 如果选中了本地编译器
            # 显示警告弹窗
            warning_msg = (
                "警告：使用本地g++编译器存在安全风险！\n\n"
                "1. 本地编译器可以直接访问系统资源\n"
                "2. 恶意代码可能对系统造成损害\n"
                "3. 建议仅在受信任的环境下使用\n\n"
                "请确认您了解这些风险，并且不会将此服务对外开放。\n\n"
                "点击“确定”继续并选择g++.exe的位置。"
            )
            
            if messagebox.askokcancel("安全警告", warning_msg):
                # 用户确认后，弹出文件选择对话框
                compiler_path = filedialog.askopenfilename(
                    title="选择g++.exe的位置",
                    filetypes=[("Executable files", "*.exe"), ("All files", "*.*")]
                )
                
                if compiler_path:  # 如果用户选择了文件
                    self.compiler_path.set(compiler_path)
                    self.log_message(f"已选择编译器路径: {compiler_path}")
                else:  # 如果用户取消了选择
                    self.local_compiler_var.set(False)  # 取消勾选
                    self.log_message("未选择编译器，已取消本地编译器选项")
            else:  # 如果用户取消了警告对话框
                self.local_compiler_var.set(False)  # 取消勾选
                self.log_message("用户取消了本地编译器选项")

    def log_message(self, message):
        """在日志区域添加消息"""
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)
    
    def start_server(self):
        """启动或重启服务器"""
        try:
            port = int(self.port_var.get())
            if not (1 <= port <= 65535):
                raise ValueError("端口号必须在1-65535之间")

            host = '0.0.0.0' if self.network_var.get() else '127.0.0.1'
            self.server.use_local_compiler = self.local_compiler_var.get()

            # 如果使用本地编译器，则设置编译器路径
            if self.local_compiler_var.get():
                self.server.compiler_path = self.compiler_path.get()

            # 如果服务器已经在运行，则重启；否则启动新服务器
            if self.server.is_running:
                self.server.restart_server(host=host, port=port)
                self.log_message("服务器已重启")
            else:
                self.server.start_server(host=host, port=port)

            # 禁用所有设置项
            self.port_var_entry.config(state=tk.DISABLED)
            self.network_check.config(state=tk.DISABLED)
            self.local_compiler_check.config(state=tk.DISABLED)
            
            self.start_btn.config(state=tk.DISABLED)
            self.restart_btn.config(state=tk.NORMAL)
            self.stop_btn.config(state=tk.NORMAL)
            self.open_browser_btn.config(state=tk.NORMAL)
            self.status_var.set(f"运行中 - {host}:{port}")
            self.status_label.config(foreground="green")

            self.log_message(f"服务器已在 {host}:{port} 启动")
            self.log_message(f"{'对外公开' if self.network_var.get() else '仅本地访问'}")
            self.log_message(f"{'使用本地编译器' if self.local_compiler_var.get() else '使用Rextester API'}")
            if self.local_compiler_var.get():
                self.log_message(f"编译器路径: {self.compiler_path.get()}")

        except ValueError as e:
            messagebox.showerror("错误", str(e))
        except Exception as e:
            messagebox.showerror("错误", f"启动服务器失败: {str(e)}")
    
    def stop_server(self):
        """停止服务器"""
        self.server.stop_server()

        # 重新启用所有设置项
        self.port_var_entry.config(state=tk.NORMAL)
        self.network_check.config(state=tk.NORMAL)
        self.local_compiler_check.config(state=tk.NORMAL)

        self.start_btn.config(state=tk.NORMAL)
        self.restart_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.DISABLED)
        self.open_browser_btn.config(state=tk.DISABLED)
        self.status_var.set("已停止")
        self.status_label.config(foreground="red")

        self.log_message("服务器已停止")

    def restart_server(self):
        """重启服务器"""
        if self.server.is_running:
            try:
                port = int(self.port_var.get())
                if not (1 <= port <= 65535):
                    raise ValueError("端口号必须在1-65535之间")

                host = '0.0.0.0' if self.network_var.get() else '127.0.0.1'
                self.server.use_local_compiler = self.local_compiler_var.get()

                # 如果使用本地编译器，则设置编译器路径
                if self.local_compiler_var.get():
                    self.server.compiler_path = self.compiler_path.get()

                self.server.restart_server(host=host, port=port)

                # 禁用所有设置项
                self.port_var_entry.config(state=tk.DISABLED)
                self.network_check.config(state=tk.DISABLED)
                self.local_compiler_check.config(state=tk.DISABLED)

                self.log_message(f"服务器已在 {host}:{port} 重启")
                self.log_message(f"{'对外公开' if self.network_var.get() else '仅本地访问'}")
                self.log_message(f"{'使用本地编译器' if self.local_compiler_var.get() else '使用Rextester API'}")
                if self.local_compiler_var.get():
                    self.log_message(f"编译器路径: {self.compiler_path.get()}")

            except ValueError as e:
                messagebox.showerror("错误", str(e))
            except Exception as e:
                messagebox.showerror("错误", f"重启服务器失败: {str(e)}")
        else:
            self.log_message("服务器未运行，无法重启。请先启动服务器。")
    
    def open_in_browser(self):
        """在浏览器中打开"""
        port = self.port_var.get()
        host = '0.0.0.0' if self.network_var.get() else '127.0.0.1'
        url = f"http://{'localhost' if host == '127.0.0.1' else host}:{port}"
        
        try:
            webbrowser.open(url)
            self.log_message(f"在浏览器中打开: {url}")
        except Exception as e:
            messagebox.showerror("错误", f"无法打开浏览器: {str(e)}")
    
    def run(self):
        """运行GUI应用"""
        self.root.mainloop()


if __name__ == "__main__":
    client = PHCodeGUIClient()
    client.run()