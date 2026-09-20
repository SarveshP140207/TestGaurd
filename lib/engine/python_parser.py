import ast
import os
import sys
import json

def get_module_name(file_path, root_dir):
    rel_path = os.path.relpath(file_path, root_dir)
    module_name = os.path.splitext(rel_path)[0].replace(os.sep, '.')
    if module_name.endswith('.__init__'):
        module_name = module_name[:-9]
    return module_name

class ASTVisitor(ast.NodeVisitor):
    def __init__(self, file_path, module_name):
        self.file_path = file_path
        self.module_name = module_name
        
        self.functions = []
        self.tests = []
        self.classes = []
        
        self.imports = []  # List of imported modules
        self.calls = []    # List of tuples (caller_function_name, called_name)
        
        self.current_class = None
        self.current_function = None

    def visit_ClassDef(self, node):
        prev_class = self.current_class
        self.current_class = node.name
        self.generic_visit(node)
        self.current_class = prev_class

    def visit_FunctionDef(self, node):
        func_name = node.name
        is_test = func_name.startswith('test_') or (self.current_class and self.current_class.startswith('Test') and func_name.startswith('test_'))
        
        if self.current_class:
            full_name = f"{self.module_name}.{self.current_class}.{func_name}"
        else:
            full_name = f"{self.module_name}.{func_name}"
        
        if is_test:
            self.tests.append({
                "id": full_name,
                "type": "test",
                "name": func_name,
                "module": self.module_name,
                "description": f"Test function {func_name}"
            })
        else:
            self.functions.append({
                "id": full_name,
                "type": "function",
                "name": func_name,
                "module": self.module_name,
                "description": f"Function {func_name}"
            })

        prev_func = self.current_function
        self.current_function = full_name
        self.generic_visit(node)
        self.current_function = prev_func

    def visit_Import(self, node):
        for alias in node.names:
            self.imports.append(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            self.imports.append(node.module)
            # also potentially the specific names imported, but module is primary
        self.generic_visit(node)

    def visit_Call(self, node):
        if self.current_function:
            if isinstance(node.func, ast.Name):
                self.calls.append((self.current_function, node.func.id))
            elif isinstance(node.func, ast.Attribute):
                # e.g., obj.method() -> we just record the method name for simplicity
                self.calls.append((self.current_function, node.func.attr))
        self.generic_visit(node)

def analyze_directory(root_dir):
    nodes = []
    edges = []
    
    modules = set()
    module_exports = {}
    
    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            if not filename.endswith('.py'):
                continue
                
            file_path = os.path.join(dirpath, filename)
            rel_file_path = os.path.relpath(file_path, root_dir).replace('\\', '/')
            module_name = get_module_name(file_path, root_dir)
            
            modules.add(module_name)
            
            file_id = rel_file_path
            nodes.append({
                "id": file_id,
                "type": "file",
                "name": filename,
                "module": module_name,
                "description": file_id
            })
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    source = f.read()
                tree = ast.parse(source, filename=file_path)
                
                visitor = ASTVisitor(file_path, module_name)
                visitor.visit(tree)
                
                nodes.extend(visitor.functions)
                nodes.extend(visitor.tests)
                
                module_exports[module_name] = [fn['name'] for fn in visitor.functions] + [t['name'] for t in visitor.tests]
                
                for fn in visitor.functions:
                    edges.append({
                        "source": file_id,
                        "target": fn["id"],
                        "type": "contains"
                    })
                for test in visitor.tests:
                    edges.append({
                        "source": file_id,
                        "target": test["id"],
                        "type": "contains"
                    })
                    
                for imp in visitor.imports:
                    edges.append({
                        "source": file_id,
                        "target": imp,
                        "type": "imports"
                    })
                    
                for caller, called in visitor.calls:
                    local_target = f"{module_name}.{called}"
                    edges.append({
                        "source": caller,
                        "target": called,
                        "type": "calls"
                    })
                    if called in module_exports.get(module_name, []):
                        edges.append({
                            "source": caller,
                            "target": local_target,
                            "type": "calls"
                        })
                    
            except Exception as e:
                print(f"Error parsing {file_path}: {e}", file=sys.stderr)
                
    for mod in modules:
        nodes.append({
            "id": mod,
            "type": "module",
            "name": mod,
            "module": mod,
            "description": f"Python module {mod}"
        })
        
    for node in nodes:
        if node['type'] == 'file':
            edges.append({
                "source": node['module'],
                "target": node['id'],
                "type": "contains"
            })
            
    return {
        "projectName": os.path.basename(os.path.normpath(root_dir)),
        "languages": ["python"],
        "nodes": nodes,
        "edges": edges
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python_parser.py <directory_path>")
        sys.exit(1)
        
    directory = sys.argv[1]
    if not os.path.isdir(directory):
        print(f"Error: {directory} is not a valid directory.")
        sys.exit(1)
        
    result = analyze_directory(directory)
    print(json.dumps(result, indent=2))
