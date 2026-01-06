#!/bin/bash

# ========================================
# GTH - Cria aplicativo .app para macOS
# ========================================

set -e

echo "🚀 Criando GTH.app..."

# Diretórios
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/dist"
APP_NAME="GTH.app"
APP_DIR="$BUILD_DIR/$APP_NAME"

# Limpa e cria estrutura
rm -rf "$BUILD_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# ========================================
# 1. Copia todo o projeto
# ========================================
echo "📦 Copiando arquivos..."

# Backend
cp -r "$SCRIPT_DIR/backend" "$APP_DIR/Contents/Resources/"

# Frontend (build)
if [ -d "$SCRIPT_DIR/frontend/dist" ]; then
    mkdir -p "$APP_DIR/Contents/Resources/frontend"
    cp -r "$SCRIPT_DIR/frontend/dist" "$APP_DIR/Contents/Resources/frontend/"
else
    echo "⚠️  Build do frontend não encontrado. Execute: cd frontend && npm run build"
fi

# Launcher
cp "$SCRIPT_DIR/gth_launcher.py" "$APP_DIR/Contents/Resources/"

# ========================================
# 2. Cria Info.plist
# ========================================
cat > "$APP_DIR/Contents/Info.plist" << 'PLIST'
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
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>GTH</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
PLIST

# ========================================
# 3. Cria script executável
# ========================================
cat > "$APP_DIR/Contents/MacOS/GTH" << 'LAUNCHER'
#!/bin/bash

# GTH Launcher
DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"

# Usa o Python do venv se existir
VENV_PYTHON="$DIR/backend/venv/bin/python"
if [ -f "$VENV_PYTHON" ]; then
    PYTHON="$VENV_PYTHON"
else
    PYTHON="python3"
fi

# Executa o launcher
cd "$DIR"
exec "$PYTHON" "$DIR/gth_launcher.py"
LAUNCHER

chmod +x "$APP_DIR/Contents/MacOS/GTH"

# ========================================
# Finalização
# ========================================
echo ""
echo "=========================================="
echo "✅ GTH.app criado com sucesso!"
echo "=========================================="
echo ""
echo "Localização: $APP_DIR"
echo ""
echo "Para usar:"
echo "  1. Arraste GTH.app para /Applications"
echo "  2. Duplo clique para abrir"
echo "  3. Se pedir permissão, vá em Preferências > Segurança"
echo ""

# Abre a pasta
open "$BUILD_DIR"

