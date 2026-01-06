#!/usr/bin/env python3
"""
GTH - Git Helper Tool
Launcher que abre o app em uma janela nativa do macOS.
"""
import os
import sys
import time
import signal
import subprocess
import threading
from pathlib import Path

# Configurações
PORT = 8001
APP_URL = f"http://127.0.0.1:{PORT}"

class GTHLauncher:
    def __init__(self):
        self.backend_process = None
        self.base_dir = Path(__file__).parent
        self.backend_dir = self.base_dir / "backend"
        
    def find_python(self):
        """Encontra o Python do venv."""
        venv_python = self.backend_dir / "venv" / "bin" / "python"
        if venv_python.exists():
            return str(venv_python)
        return sys.executable
    
    def is_port_in_use(self, port):
        """Verifica se a porta está em uso."""
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('127.0.0.1', port)) == 0
    
    def start_backend(self):
        """Inicia o servidor backend."""
        python = self.find_python()
        
        # Se já tem algo na porta, assume que é o backend
        if self.is_port_in_use(PORT):
            print(f"✅ Backend já está rodando na porta {PORT}")
            return True
        
        print(f"🚀 Iniciando backend na porta {PORT}...")
        
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        
        self.backend_process = subprocess.Popen(
            [python, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)],
            cwd=str(self.backend_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        
        # Aguarda o backend iniciar
        for _ in range(30):  # 30 segundos de timeout
            if self.is_port_in_use(PORT):
                print("✅ Backend iniciado!")
                return True
            time.sleep(1)
        
        print("❌ Backend não iniciou a tempo")
        return False
    
    def stop_backend(self):
        """Para o backend."""
        if self.backend_process:
            print("🛑 Parando backend...")
            self.backend_process.terminate()
            try:
                self.backend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.backend_process.kill()
            self.backend_process = None
    
    def open_window(self):
        """Abre a janela nativa ou navegador."""
        import webbrowser
        
        # Tenta PyWebView primeiro
        try:
            import webview
            
            print("🖥️  Abrindo janela do GTH...")
            
            # Cria janela nativa
            window = webview.create_window(
                title="GTH - Git Helper Tool",
                url=APP_URL,
                width=1280,
                height=850,
                min_size=(1000, 700),
                confirm_close=True,
                text_select=True
            )
            
            # Inicia o webview (bloqueia até fechar)
            webview.start(debug=False)
            
        except Exception as e:
            print(f"⚠️  PyWebView falhou: {e}")
            print(f"🌐 Abrindo no navegador: {APP_URL}")
            webbrowser.open(APP_URL)
            
            # Mantém o processo rodando
            print("\n" + "=" * 50)
            print("   GTH está rodando no navegador!")
            print(f"   Acesse: {APP_URL}")
            print("=" * 50)
            print("\nPressione Ctrl+C para encerrar...")
            
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                pass
    
    def run(self):
        """Executa o app."""
        print("=" * 50)
        print("   GTH - Git Helper Tool")
        print("=" * 50)
        print()
        
        # Handler para sinais
        def cleanup(sig=None, frame=None):
            print("\n👋 Encerrando GTH...")
            self.stop_backend()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, cleanup)
        signal.signal(signal.SIGTERM, cleanup)
        
        try:
            # Inicia backend
            if not self.start_backend():
                print("Falha ao iniciar o backend.")
                return 1
            
            # Abre janela
            self.open_window()
            
        finally:
            cleanup()
        
        return 0


def main():
    # Verifica se pywebview está instalado
    try:
        import webview
    except ImportError:
        print("Instalando dependência PyWebView...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pywebview", "-q"])
    
    launcher = GTHLauncher()
    sys.exit(launcher.run())


if __name__ == "__main__":
    main()

