#!/usr/bin/env python3
"""
GTH Desktop App
Aplicativo standalone que roda o frontend e backend em uma janela nativa.
"""
import os
import sys
import time
import threading
import subprocess
import signal
import webbrowser
from pathlib import Path

# Configurações
PORT = 8001
FRONTEND_PORT = 5173

class GTHApp:
    def __init__(self):
        self.backend_process = None
        self.frontend_process = None
        self.base_dir = Path(__file__).parent.parent
        
    def start_backend(self):
        """Inicia o servidor backend."""
        backend_dir = self.base_dir / "backend"
        venv_python = backend_dir / "venv" / "bin" / "python"
        
        if not venv_python.exists():
            print("⚠️ Virtual environment não encontrado. Criando...")
            subprocess.run([sys.executable, "-m", "venv", str(backend_dir / "venv")])
            subprocess.run([str(venv_python), "-m", "pip", "install", "-r", str(backend_dir / "requirements.txt")])
        
        env = os.environ.copy()
        env["GTH_PORT"] = str(PORT)
        
        self.backend_process = subprocess.Popen(
            [str(venv_python), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)],
            cwd=str(backend_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        
        print(f"✅ Backend iniciado na porta {PORT}")
        
    def start_frontend(self):
        """Inicia o servidor frontend de desenvolvimento."""
        frontend_dir = self.base_dir / "frontend"
        
        # Verifica se node_modules existe
        if not (frontend_dir / "node_modules").exists():
            print("⚠️ Instalando dependências do frontend...")
            subprocess.run(["npm", "install"], cwd=str(frontend_dir))
        
        self.frontend_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(frontend_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        
        print(f"✅ Frontend iniciado na porta {FRONTEND_PORT}")
        
    def wait_for_server(self, port, timeout=30):
        """Aguarda o servidor ficar disponível."""
        import urllib.request
        import urllib.error
        
        start = time.time()
        while time.time() - start < timeout:
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1)
                return True
            except (urllib.error.URLError, ConnectionRefusedError):
                time.sleep(0.5)
        return False
    
    def open_window(self):
        """Abre a janela do aplicativo usando webview ou navegador."""
        try:
            import webview
            
            # Usa PyWebView para janela nativa
            window = webview.create_window(
                "GTH - Git Helper Tool",
                f"http://127.0.0.1:{FRONTEND_PORT}",
                width=1200,
                height=800,
                min_size=(900, 600),
                confirm_close=True
            )
            webview.start()
            
        except ImportError:
            # Fallback: abre no navegador
            print("💡 PyWebView não instalado. Abrindo no navegador...")
            webbrowser.open(f"http://127.0.0.1:{FRONTEND_PORT}")
            
            # Mantém o script rodando
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                pass
    
    def cleanup(self):
        """Para todos os processos."""
        if self.backend_process:
            self.backend_process.terminate()
            self.backend_process.wait()
            
        if self.frontend_process:
            self.frontend_process.terminate()
            self.frontend_process.wait()
            
        print("👋 GTH encerrado")
    
    def run(self):
        """Executa o aplicativo."""
        print("🚀 Iniciando GTH Desktop...")
        
        # Handler para Ctrl+C
        def signal_handler(sig, frame):
            self.cleanup()
            sys.exit(0)
            
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            # Inicia backend e frontend
            self.start_backend()
            self.start_frontend()
            
            # Aguarda servidores
            print("⏳ Aguardando servidores...")
            
            if not self.wait_for_server(PORT):
                print("❌ Backend não iniciou a tempo")
                self.cleanup()
                return
                
            if not self.wait_for_server(FRONTEND_PORT):
                print("❌ Frontend não iniciou a tempo")
                self.cleanup()
                return
            
            print("✅ Servidores prontos!")
            
            # Abre janela
            self.open_window()
            
        finally:
            self.cleanup()


def main():
    app = GTHApp()
    app.run()


if __name__ == "__main__":
    main()

