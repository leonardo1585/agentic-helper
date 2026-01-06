#!/bin/bash

# Script para criar o executável Mac do GTH
# Usa Tauri para o frontend e PyInstaller para o backend

set -e

echo "🚀 Iniciando build do GTH para macOS..."

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório base
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$BASE_DIR/desktop"
FRONTEND_DIR="$BASE_DIR/frontend"
BACKEND_DIR="$BASE_DIR/backend"

echo -e "${BLUE}📦 Passo 1: Construindo o backend Python...${NC}"
cd "$BACKEND_DIR"

# Ativa venv e instala PyInstaller
source venv/bin/activate
pip install pyinstaller --quiet

# Cria executável do backend
pyinstaller --onefile --name gth-backend \
    --add-data "app:app" \
    --hidden-import=uvicorn \
    --hidden-import=uvicorn.logging \
    --hidden-import=uvicorn.loops \
    --hidden-import=uvicorn.loops.auto \
    --hidden-import=uvicorn.protocols \
    --hidden-import=uvicorn.protocols.http \
    --hidden-import=uvicorn.protocols.http.auto \
    --hidden-import=uvicorn.protocols.websockets \
    --hidden-import=uvicorn.protocols.websockets.auto \
    --hidden-import=uvicorn.lifespan \
    --hidden-import=uvicorn.lifespan.on \
    --hidden-import=chromadb \
    --hidden-import=sentence_transformers \
    --hidden-import=tiktoken \
    --hidden-import=tiktoken_ext \
    --hidden-import=tiktoken_ext.openai_public \
    --collect-all chromadb \
    --collect-all sentence_transformers \
    run_server.py

echo -e "${GREEN}✅ Backend construído!${NC}"

echo -e "${BLUE}📦 Passo 2: Construindo o frontend...${NC}"
cd "$FRONTEND_DIR"

# Build do frontend
npm run build

echo -e "${GREEN}✅ Frontend construído!${NC}"

echo -e "${BLUE}📦 Passo 3: Criando app Tauri...${NC}"
cd "$DESKTOP_DIR"

# Instala dependências do Tauri
npm install

# Build do app Tauri
npm run tauri build

echo -e "${GREEN}✅ Build completo!${NC}"
echo ""
echo "O aplicativo está em: $DESKTOP_DIR/src-tauri/target/release/bundle/macos/"

