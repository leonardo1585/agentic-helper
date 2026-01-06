#!/usr/bin/env python3
"""
Script de build para criar o GTH.app distribuível para macOS.
"""
import os
import sys
import shutil
import subprocess
from pathlib import Path

# Cores para output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log(msg, color=Colors.BLUE):
    print(f"{color}→ {msg}{Colors.END}")

def success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")

def error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")

def warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")

class GTHBuilder:
    def __init__(self):
        self.root_dir = Path(__file__).parent
        self.frontend_dir = self.root_dir / "frontend"
        self.backend_dir = self.root_dir / "backend"
        self.dist_dir = self.root_dir / "dist"
        self.app_name = "GTH"
        self.app_bundle = self.dist_dir / f"{self.app_name}.app"
        
    def clean(self):
        """Limpa builds anteriores."""
        log("Limpando builds anteriores...")
        if self.dist_dir.exists():
            shutil.rmtree(self.dist_dir)
        self.dist_dir.mkdir(exist_ok=True)
        success("Diretório limpo")
    
    def build_frontend(self):
        """Compila o frontend React."""
        log("Compilando frontend React...")
        
        # Instala dependências se necessário
        if not (self.frontend_dir / "node_modules").exists():
            log("Instalando dependências npm...")
            subprocess.run(["npm", "install"], cwd=self.frontend_dir, check=True)
        
        # Build
        result = subprocess.run(["npm", "run", "build"], cwd=self.frontend_dir, capture_output=True, text=True)
        if result.returncode != 0:
            error(f"Falha no build do frontend:\n{result.stderr}")
            return False
        
        # Copia para backend/static
        static_dir = self.backend_dir / "static"
        if static_dir.exists():
            shutil.rmtree(static_dir)
        shutil.copytree(self.frontend_dir / "dist", static_dir)
        
        success("Frontend compilado")
        return True
    
    def create_app_bundle(self):
        """Cria o .app bundle para macOS."""
        log("Criando app bundle...")
        
        # Estrutura do .app
        contents = self.app_bundle / "Contents"
        macos = contents / "MacOS"
        resources = contents / "Resources"
        
        for d in [contents, macos, resources]:
            d.mkdir(parents=True, exist_ok=True)
        
        # Info.plist
        info_plist = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>GTH</string>
    <key>CFBundleDisplayName</key>
    <string>GTH - Git Helper Tool</string>
    <key>CFBundleIdentifier</key>
    <string>com.weni.gth</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>GTH</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.developer-tools</string>
</dict>
</plist>'''
        (contents / "Info.plist").write_text(info_plist)
        
        # Copia backend completo
        log("Copiando backend...")
        backend_dest = resources / "backend"
        shutil.copytree(
            self.backend_dir, 
            backend_dest,
            ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.git', 'venv')
        )
        
        # Cria requirements.txt atualizado
        log("Configurando dependências Python...")
        
        # Copia arquivos de dados que precisam ser editáveis
        for data_file in ["app_config.json", "knowledge_bases.json"]:
            src = self.root_dir / data_file
            if src.exists():
                shutil.copy(src, resources / data_file)
            else:
                (resources / data_file).write_text("{}" if data_file.endswith('.json') else "")
        
        # Cria diretório para repositórios
        (resources / "repositories").mkdir(exist_ok=True)
        (resources / "vector_db").mkdir(exist_ok=True)
        
        # Cria e configura o venv com dependências
        log("Criando ambiente virtual e instalando dependências...")
        venv_dir = resources / "venv"
        subprocess.run([sys.executable, "-m", "venv", str(venv_dir)], check=True)
        
        pip_path = venv_dir / "bin" / "pip"
        subprocess.run([str(pip_path), "install", "--upgrade", "pip", "-q"], check=True)
        subprocess.run([str(pip_path), "install", "-r", str(backend_dest / "requirements.txt"), "-q"], check=True)
        subprocess.run([str(pip_path), "install", "pywebview", "-q"], check=True)
        success("Dependências instaladas")
        
        # Script de execução
        launcher_script = '''#!/bin/bash
# GTH Launcher Script

# Diretório do app
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
RESOURCES="$APP_DIR/Resources"
BACKEND="$RESOURCES/backend"

# Verifica se Python 3 está instalado
if ! command -v python3 &> /dev/null; then
    osascript -e 'display dialog "Python 3 não encontrado. Por favor, instale o Python 3.10 ou superior." buttons {"OK"} default button 1 with icon stop with title "GTH - Erro"'
    exit 1
fi

# Cria venv se não existir
if [ ! -d "$RESOURCES/venv" ]; then
    echo "Criando ambiente virtual..."
    python3 -m venv "$RESOURCES/venv"
    
    echo "Instalando dependências..."
    "$RESOURCES/venv/bin/pip" install --upgrade pip -q
    "$RESOURCES/venv/bin/pip" install -r "$BACKEND/requirements.txt" -q
    "$RESOURCES/venv/bin/pip" install pywebview -q
fi

# Ativa venv e executa
export PYTHONUNBUFFERED=1
export GTH_DATA_DIR="$RESOURCES"

cd "$BACKEND"
exec "$RESOURCES/venv/bin/python" "$RESOURCES/gth_launcher.py"
'''
        
        launcher_path = macos / "GTH"
        launcher_path.write_text(launcher_script)
        launcher_path.chmod(0o755)
        
        # Copia launcher Python
        shutil.copy(self.root_dir / "gth_launcher.py", resources / "gth_launcher.py")
        
        # Modifica o launcher para usar caminhos do app
        self._patch_launcher(resources / "gth_launcher.py")
        
        success("App bundle criado")
        return True
    
    def _patch_launcher(self, launcher_path):
        """Modifica o launcher para funcionar dentro do .app."""
        content = launcher_path.read_text()
        
        # Adiciona detecção do diretório de dados
        new_content = content.replace(
            'class GTHLauncher:',
            '''class GTHLauncher:
    def _get_data_dir(self):
        """Retorna o diretório de dados."""
        # Se estiver rodando como .app, usa Resources
        data_dir = os.environ.get('GTH_DATA_DIR')
        if data_dir:
            return Path(data_dir)
        return Path(__file__).parent
'''
        )
        
        # Modifica para usar data_dir
        new_content = new_content.replace(
            'self.base_dir = Path(__file__).parent',
            'self.base_dir = self._get_data_dir()'
        )
        
        launcher_path.write_text(new_content)
    
    def create_dmg(self):
        """Cria DMG para distribuição."""
        log("Criando DMG...")
        
        dmg_path = self.dist_dir / f"{self.app_name}.dmg"
        
        # Remove DMG anterior se existir
        if dmg_path.exists():
            dmg_path.unlink()
        
        # Cria DMG usando hdiutil
        try:
            subprocess.run([
                "hdiutil", "create",
                "-volname", self.app_name,
                "-srcfolder", str(self.app_bundle),
                "-ov",
                "-format", "UDZO",
                str(dmg_path)
            ], check=True, capture_output=True)
            success(f"DMG criado: {dmg_path}")
            return True
        except subprocess.CalledProcessError as e:
            warning(f"Não foi possível criar DMG: {e}")
            return False
    
    def build(self, create_dmg=True):
        """Executa o build completo."""
        print()
        print("=" * 60)
        print("   GTH Builder - Criando aplicativo para distribuição")
        print("=" * 60)
        print()
        
        steps = [
            ("Limpando", self.clean),
            ("Compilando Frontend", self.build_frontend),
            ("Criando App Bundle", self.create_app_bundle),
        ]
        
        if create_dmg:
            steps.append(("Criando DMG", self.create_dmg))
        
        for name, func in steps:
            log(f"Etapa: {name}")
            try:
                result = func()
                if result is False:
                    error(f"Falha na etapa: {name}")
                    return False
            except Exception as e:
                error(f"Erro na etapa {name}: {e}")
                import traceback
                traceback.print_exc()
                return False
        
        print()
        print("=" * 60)
        success("Build concluído com sucesso!")
        print("=" * 60)
        print()
        print(f"📦 App: {self.app_bundle}")
        if create_dmg and (self.dist_dir / f"{self.app_name}.dmg").exists():
            print(f"💿 DMG: {self.dist_dir / f'{self.app_name}.dmg'}")
        print()
        print("Para testar, execute:")
        print(f"  open {self.app_bundle}")
        print()
        
        return True


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Build GTH for distribution")
    parser.add_argument("--no-dmg", action="store_true", help="Não criar DMG")
    args = parser.parse_args()
    
    builder = GTHBuilder()
    success = builder.build(create_dmg=not args.no_dmg)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

