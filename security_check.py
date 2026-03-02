import re
import pycparser
from pycparser import c_parser, c_ast, parse_file

class SecurityCheckError(Exception):
    pass

class SecurityVisitor(c_ast.NodeVisitor):
    DANGEROUS_FUNCS = {
        'system', 'exec', 'popen', 'fork', 'pclose',
        'dlopen', 'LoadLibraryA', 'LoadLibraryW', 'LoadLibrary',
        'CreateProcessA', 'CreateProcessW', 'CreateProcess',
        'ShellExecuteA', 'ShellExecuteW', 'ShellExecute',
        'WinExec', '_wsystem', 'spawn', 'spawnl', 'spawnv',
        'execl', 'execv', 'execlp', 'execvp', 'execle',
        'signal', 'raise', 'kill', 'ptrace',
        'atexit', 'exit', '_exit',
    }
    
    DANGEROUS_HEADERS = {
        'windows.h', 'unistd.h', 'process.h', 'sys/',
        'spawn.h', 'dlfcn.h',
    }
    
    DANGEROUS_PATTERNS = [
        r'#include\s*<.*\.h>',
        r'asm\s*\(',
        r'__asm__\s*\(',
        r'__asm\s*\(',
    ]
    
    def __init__(self):
        self.violations = []
        self.pattern_violations = []
    
    def visit_FuncCall(self, node):
        if hasattr(node, 'name') and hasattr(node.name, 'name'):
            func_name = node.name.name
            if func_name.lower() in {f.lower() for f in self.DANGEROUS_FUNCS}:
                self.violations.append(f"危险函数调用: {func_name}")
        self.generic_visit(node)
    
    def visit_ID(self, node):
        if hasattr(node, 'name'):
            for danger in self.DANGEROUS_FUNCS:
                if node.name.lower() == danger.lower():
                    self.violations.append(f"危险标识符: {node.name}")
        self.generic_visit(node)

def check_ast(code):
    """使用 AST 解析检查代码安全性"""
    if not code or not code.strip():
        return True, ""
    
    visitor = SecurityVisitor()
    
    try:
        parser = c_parser.CParser()
        ast = parser.parse(code, filename='<input>')
        visitor.visit(ast)
    except pycparser.c_parser.ParseError:
        pass
    
    if visitor.violations:
        return False, f"Security Alert: {', '.join(visitor.violations)}"
    
    return True, ""

def check_patterns(code):
    """使用正则检查危险模式"""
    if not code or not code.strip():
        return True, ""
    
    code_lower = code.lower()
    violations = []
    
    dangerous_words = [
        'system', 'exec', 'fork', 'popen', 'kill',
        'windows.h', 'unistd.h', 'fstream', 'freopen',
        'fopen', 'file', 'asm', '__asm__', '__asm',
        'CreateProcess', 'ShellExecute', 'WinExec',
        'spawn', '_wsystem', 'dlopen', 'LoadLibrary',
    ]
    
    for word in dangerous_words:
        pattern = r'\b' + re.escape(word) + r'\b'
        if re.search(pattern, code_lower, re.IGNORECASE):
            violations.append(word)
    
    if violations:
        return False, f"Security Alert: 检测到危险词: {', '.join(set(violations))}"
    
    return True, ""

def check_security(code):
    """综合安全检查：AST + 正则"""
    if not code or not code.strip():
        return True, ""
    
    is_safe, msg = check_patterns(code)
    if not is_safe:
        return False, msg
    
    is_safe, msg = check_ast(code)
    if not is_safe:
        return False, msg
    
    return True, ""
