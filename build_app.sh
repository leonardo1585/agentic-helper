#!/bin/bash

# ========================================
# GTH - Build Script para macOS
# Cria um aplicativo .app completo
# ========================================

set -e

echo "🚀 GTH Build Script para macOS"
echo "=============================="

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Diretórios
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
APP_NAME="GTH.app"
APP_DIR="$BUILD_DIR/$APP_NAME"

# Limpa build anterior
echo -e "${BLUE}🧹 Limpando build anterior...${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# ========================================
# 1. Build do Frontend
# ========================================
echo -e "${BLUE}📦 1/4 - Construindo frontend...${NC}"
cd "$SCRIPT_DIR/frontend"

# Atualiza a URL da API para produção
cat > .env.production << EOF
VITE_API_URL=http://127.0.0.1:8001/api
EOF

npm install --silent
npm run build

echo -e "${GREEN}✅ Frontend construído!${NC}"

# ========================================
# 2. Prepara o Backend
# ========================================
echo -e "${BLUE}📦 2/4 - Preparando backend...${NC}"
cd "$SCRIPT_DIR/backend"

# Garante que o venv existe
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --quiet -r requirements.txt
pip install --quiet pywebview

echo -e "${GREEN}✅ Backend preparado!${NC}"

# ========================================
# 3. Cria estrutura do .app
# ========================================
echo -e "${BLUE}📦 3/4 - Criando estrutura do app...${NC}"

mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"
mkdir -p "$APP_DIR/Contents/Resources/backend"
mkdir -p "$APP_DIR/Contents/Resources/frontend"

# Copia frontend build
cp -r "$SCRIPT_DIR/frontend/dist/"* "$APP_DIR/Contents/Resources/frontend/"

# Copia backend
cp -r "$SCRIPT_DIR/backend/app" "$APP_DIR/Contents/Resources/backend/"
cp "$SCRIPT_DIR/backend/requirements.txt" "$APP_DIR/Contents/Resources/backend/"

# Cria Info.plist
cat > "$APP_DIR/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>GTH</string>
    <key>CFBundleDisplayName</key>
    <string>GTH - Git Helper Tool</string>
    <key>CFBundleIdentifier</key>
    <string>com.gth.app</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>gth</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
</dict>
</plist>
EOF

# Cria script executável principal
cat > "$APP_DIR/Contents/MacOS/gth" << 'SCRIPT'
#!/bin/bash

# GTH Launcher Script
DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"
BACKEND_DIR="$DIR/backend"
FRONTEND_DIR="$DIR/frontend"
DATA_DIR="$HOME/.gth"

# Cria diretório de dados
mkdir -p "$DATA_DIR"

# Porta do backend
PORT=8001

# Verifica se Python está disponível
if ! command -v python3 &> /dev/null; then
    osascript -e 'display alert "Python 3 não encontrado" message "Por favor, instale o Python 3 para usar o GTH."'
    exit 1
fi

# Cria venv se não existir
VENV_DIR="$DATA_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install --quiet -r "$BACKEND_DIR/requirements.txt"
    "$VENV_DIR/bin/pip" install --quiet pywebview
fi

# Inicia backend em background
cd "$BACKEND_DIR"
"$VENV_DIR/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port $PORT &
BACKEND_PID=$!

# Aguarda backend iniciar
sleep 2

# Função para cleanup
cleanup() {
    kill $BACKEND_PID 2>/dev/null
    exit 0
}
trap cleanup EXIT INT TERM

# Abre janela com webview ou navegador
"$VENV_DIR/bin/python" << PYTHON
import webbrowser
try:
    import webview
    window = webview.create_window(
        "GTH - Git Helper Tool",
        "http://127.0.0.1:$PORT",
        width=1200,
        height=800,
        min_size=(900, 600)
    )
    webview.start()
except ImportError:
    webbrowser.open("http://127.0.0.1:$PORT")
    import time
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
PYTHON
SCRIPT

chmod +x "$APP_DIR/Contents/MacOS/gth"

echo -e "${GREEN}✅ Estrutura do app criada!${NC}"

# ========================================
# 4. Atualiza frontend para servir estático
# ========================================
echo -e "${BLUE}📦 4/4 - Configurando servidor de arquivos estáticos...${NC}"

# Atualiza main.py para servir frontend
cat >> "$APP_DIR/Contents/Resources/backend/app/main.py" << 'STATICCODE'

# Serve frontend estático em produção
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

frontend_dir = Path(__file__).parent.parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dir / "assets")), name="assets")
    
    @app.get("/")
    async def serve_frontend():
        return FileResponse(str(frontend_dir / "index.html"))
    
    @app.get("/{path:path}")
    async def serve_frontend_path(path: str):
        file_path = frontend_dir / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dir / "index.html"))
STATICCODE

echo -e "${GREEN}✅ Servidor estático configurado!${NC}"

# ========================================
# Finalização
# ========================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Build completo!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "O aplicativo está em: ${YELLOW}$APP_DIR${NC}"
echo ""
echo "Para instalar:"
echo "  1. Arraste GTH.app para a pasta Aplicativos"
echo "  2. Na primeira execução, clique com botão direito > Abrir"
echo ""
echo "Para distribuir:"
echo "  zip -r GTH.zip build/GTH.app"
echo ""

# Abre o diretório
open "$BUILD_DIR"

