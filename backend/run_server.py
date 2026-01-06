#!/usr/bin/env python3
"""
Script de entrada para o servidor GTH.
Usado pelo PyInstaller para criar o executável.
"""
import os
import sys

# Adiciona o diretório do app ao path
if getattr(sys, 'frozen', False):
    # Executando como executável PyInstaller
    base_path = sys._MEIPASS
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, base_path)

import uvicorn
from app.main import app

if __name__ == "__main__":
    # Encontra uma porta disponível
    port = int(os.environ.get("GTH_PORT", 8001))
    
    print(f"🚀 Iniciando GTH Backend na porta {port}...")
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info"
    )

