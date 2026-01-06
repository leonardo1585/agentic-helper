#!/bin/bash

# GTH - Git Helper Tool
# Script para iniciar o backend e frontend

echo "🚀 Iniciando GTH..."

# Cores
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Diretório base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Função para matar processos ao sair
cleanup() {
    echo -e "\n${CYAN}Encerrando serviços...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Verifica Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 não encontrado. Instale o Python 3.10+."
    exit 1
fi

# Verifica Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale o Node.js 18+."
    exit 1
fi

# Backend
echo -e "${PURPLE}📦 Configurando Backend...${NC}"
cd "$BASE_DIR/backend"

if [ ! -d "venv" ]; then
    echo "Criando ambiente virtual..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

echo -e "${PURPLE}🔧 Iniciando Backend na porta 8000...${NC}"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Frontend
echo -e "${CYAN}📦 Configurando Frontend...${NC}"
cd "$BASE_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "Instalando dependências..."
    npm install
fi

echo -e "${CYAN}🎨 Iniciando Frontend na porta 5173...${NC}"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${CYAN}  GTH - Git Helper Tool${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "  ${PURPLE}Backend:${NC}  http://localhost:8000"
echo -e "  ${CYAN}Frontend:${NC} http://localhost:5173"
echo ""
echo "  Pressione Ctrl+C para encerrar"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Aguarda
wait

