#!/usr/bin/env python3
"""
GTH - Git Helper Tool
Ferramenta para gerenciar e sincronizar múltiplos repositórios Git.
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

CONFIG_FILE = "repos.json"
BASE_DIR = Path(__file__).parent.resolve()


def load_config() -> dict:
    """Carrega a configuração de repositórios."""
    config_path = BASE_DIR / CONFIG_FILE
    if config_path.exists():
        with open(config_path, "r") as f:
            return json.load(f)
    return {"repositories": []}


def save_config(config: dict) -> None:
    """Salva a configuração de repositórios."""
    config_path = BASE_DIR / CONFIG_FILE
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)


def run_git_command(args: list[str], cwd: Optional[Path] = None) -> tuple[bool, str]:
    """Executa um comando git e retorna (sucesso, output)."""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=300
        )
        output = result.stdout + result.stderr
        return result.returncode == 0, output.strip()
    except subprocess.TimeoutExpired:
        return False, "Timeout: comando demorou muito para executar"
    except Exception as e:
        return False, str(e)


def get_repo_name(url: str) -> str:
    """Extrai o nome do repositório da URL."""
    name = url.rstrip("/").split("/")[-1]
    if name.endswith(".git"):
        name = name[:-4]
    return name


def add_repo(url: str, name: Optional[str] = None) -> None:
    """Adiciona um repositório à lista."""
    config = load_config()
    
    repo_name = name or get_repo_name(url)
    
    # Verifica se já existe
    for repo in config["repositories"]:
        if repo["url"] == url or repo["name"] == repo_name:
            print(f"⚠️  Repositório já existe: {repo_name}")
            return
    
    config["repositories"].append({
        "url": url,
        "name": repo_name
    })
    save_config(config)
    print(f"✅ Repositório adicionado: {repo_name}")


def remove_repo(name: str) -> None:
    """Remove um repositório da lista."""
    config = load_config()
    
    for i, repo in enumerate(config["repositories"]):
        if repo["name"] == name:
            config["repositories"].pop(i)
            save_config(config)
            print(f"✅ Repositório removido da lista: {name}")
            print(f"   (Os arquivos locais não foram deletados)")
            return
    
    print(f"❌ Repositório não encontrado: {name}")


def list_repos() -> None:
    """Lista todos os repositórios configurados."""
    config = load_config()
    
    if not config["repositories"]:
        print("📋 Nenhum repositório configurado.")
        print("   Use: python gth.py add <url> [nome]")
        return
    
    print("\n📋 Repositórios configurados:\n")
    print(f"{'Nome':<30} {'Status':<15} {'URL'}")
    print("-" * 80)
    
    for repo in config["repositories"]:
        repo_path = BASE_DIR / repo["name"]
        
        if repo_path.exists() and (repo_path / ".git").exists():
            status = "✅ Clonado"
        elif repo_path.exists():
            status = "⚠️  Sem .git"
        else:
            status = "⏳ Pendente"
        
        print(f"{repo['name']:<30} {status:<15} {repo['url']}")
    
    print()


def clone_repo(repo: dict) -> bool:
    """Clona um único repositório."""
    repo_path = BASE_DIR / repo["name"]
    
    if repo_path.exists():
        print(f"⏭️  {repo['name']}: já existe, use 'update' para atualizar")
        return True
    
    print(f"📥 Clonando {repo['name']}...")
    success, output = run_git_command(["clone", repo["url"], repo["name"]], cwd=BASE_DIR)
    
    if success:
        print(f"✅ {repo['name']}: clonado com sucesso")
    else:
        print(f"❌ {repo['name']}: erro ao clonar")
        print(f"   {output}")
    
    return success


def clone_all() -> None:
    """Clona todos os repositórios configurados."""
    config = load_config()
    
    if not config["repositories"]:
        print("📋 Nenhum repositório configurado.")
        return
    
    print(f"\n🚀 Clonando {len(config['repositories'])} repositório(s)...\n")
    
    success_count = 0
    for repo in config["repositories"]:
        if clone_repo(repo):
            success_count += 1
    
    print(f"\n📊 Resultado: {success_count}/{len(config['repositories'])} repositórios OK")


def update_repo(repo: dict) -> bool:
    """Atualiza um único repositório."""
    repo_path = BASE_DIR / repo["name"]
    
    if not repo_path.exists():
        print(f"⏭️  {repo['name']}: não existe, use 'clone' primeiro")
        return False
    
    print(f"🔄 Atualizando {repo['name']}...")
    success, output = run_git_command(["pull", "--ff-only"], cwd=repo_path)
    
    if success:
        if "Already up to date" in output or "Já está atualizado" in output:
            print(f"✅ {repo['name']}: já está atualizado")
        else:
            print(f"✅ {repo['name']}: atualizado com sucesso")
    else:
        print(f"❌ {repo['name']}: erro ao atualizar")
        print(f"   {output}")
    
    return success


def update_all() -> None:
    """Atualiza todos os repositórios clonados."""
    config = load_config()
    
    if not config["repositories"]:
        print("📋 Nenhum repositório configurado.")
        return
    
    print(f"\n🔄 Atualizando repositórios...\n")
    
    success_count = 0
    for repo in config["repositories"]:
        repo_path = BASE_DIR / repo["name"]
        if repo_path.exists():
            if update_repo(repo):
                success_count += 1
    
    print(f"\n📊 Resultado: {success_count} repositórios atualizados")


def sync_all() -> None:
    """Clona novos e atualiza existentes."""
    config = load_config()
    
    if not config["repositories"]:
        print("📋 Nenhum repositório configurado.")
        return
    
    print(f"\n🔄 Sincronizando {len(config['repositories'])} repositório(s)...\n")
    
    for repo in config["repositories"]:
        repo_path = BASE_DIR / repo["name"]
        if repo_path.exists():
            update_repo(repo)
        else:
            clone_repo(repo)
    
    print("\n✅ Sincronização concluída!")


def status_all() -> None:
    """Mostra o status git de cada repositório."""
    config = load_config()
    
    if not config["repositories"]:
        print("📋 Nenhum repositório configurado.")
        return
    
    print(f"\n📊 Status dos repositórios:\n")
    
    for repo in config["repositories"]:
        repo_path = BASE_DIR / repo["name"]
        
        if not repo_path.exists():
            print(f"⏳ {repo['name']}: não clonado")
            continue
        
        # Branch atual
        success, branch = run_git_command(["branch", "--show-current"], cwd=repo_path)
        branch = branch if success else "?"
        
        # Status de mudanças
        success, status = run_git_command(["status", "--porcelain"], cwd=repo_path)
        
        if not success:
            print(f"❓ {repo['name']}: erro ao verificar status")
        elif status:
            changes = len(status.split("\n"))
            print(f"📝 {repo['name']} [{branch}]: {changes} arquivo(s) modificado(s)")
        else:
            print(f"✅ {repo['name']} [{branch}]: limpo")


def print_help() -> None:
    """Mostra a ajuda."""
    help_text = """
╔═══════════════════════════════════════════════════════════════════╗
║                    GTH - Git Helper Tool                          ║
╚═══════════════════════════════════════════════════════════════════╝

Uso: python gth.py <comando> [argumentos]

COMANDOS:

  add <url> [nome]     Adiciona um repositório à lista
                       Exemplo: python gth.py add https://github.com/user/repo.git
                       Exemplo: python gth.py add https://github.com/user/repo.git meu-repo

  remove <nome>        Remove um repositório da lista (não deleta arquivos)
                       Exemplo: python gth.py remove meu-repo

  list                 Lista todos os repositórios configurados

  clone                Clona todos os repositórios pendentes

  update               Atualiza (git pull) todos os repositórios clonados

  sync                 Clona novos + atualiza existentes

  status               Mostra o status git de cada repositório

  help                 Mostra esta ajuda

ARQUIVOS:
  repos.json           Configuração dos repositórios (gerado automaticamente)

"""
    print(help_text)


def main():
    if len(sys.argv) < 2:
        print_help()
        return
    
    command = sys.argv[1].lower()
    
    if command == "add":
        if len(sys.argv) < 3:
            print("❌ Uso: python gth.py add <url> [nome]")
            return
        url = sys.argv[2]
        name = sys.argv[3] if len(sys.argv) > 3 else None
        add_repo(url, name)
    
    elif command == "remove":
        if len(sys.argv) < 3:
            print("❌ Uso: python gth.py remove <nome>")
            return
        remove_repo(sys.argv[2])
    
    elif command == "list":
        list_repos()
    
    elif command == "clone":
        clone_all()
    
    elif command == "update":
        update_all()
    
    elif command == "sync":
        sync_all()
    
    elif command == "status":
        status_all()
    
    elif command in ["help", "-h", "--help"]:
        print_help()
    
    else:
        print(f"❌ Comando desconhecido: {command}")
        print("   Use 'python gth.py help' para ver os comandos disponíveis")


if __name__ == "__main__":
    main()

