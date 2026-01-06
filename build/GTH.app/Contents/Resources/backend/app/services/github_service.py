"""
Serviço de integração com GitHub.
"""
import httpx
from typing import List, Optional
from pathlib import Path
import subprocess
import shutil

from ..models import Repository
from ..core import settings


class GitHubService:
    """Serviço para interagir com a API do GitHub."""
    
    BASE_URL = "https://api.github.com"
    
    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.GITHUB_TOKEN
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def headers(self) -> dict:
        """Headers para requisições à API."""
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers
    
    async def get_client(self) -> httpx.AsyncClient:
        """Retorna o cliente HTTP."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers=self.headers,
                timeout=30.0
            )
        return self._client
    
    async def close(self):
        """Fecha o cliente HTTP."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
    
    async def get_user(self) -> dict:
        """Obtém informações do usuário autenticado."""
        client = await self.get_client()
        response = await client.get("/user")
        response.raise_for_status()
        return response.json()
    
    async def list_repositories(
        self,
        visibility: str = "all",
        affiliation: str = "owner,collaborator,organization_member",
        sort: str = "updated",
        per_page: int = 100
    ) -> List[Repository]:
        """Lista todos os repositórios que o usuário tem acesso."""
        client = await self.get_client()
        repositories = []
        page = 1
        
        while True:
            response = await client.get(
                "/user/repos",
                params={
                    "visibility": visibility,
                    "affiliation": affiliation,
                    "sort": sort,
                    "per_page": per_page,
                    "page": page
                }
            )
            response.raise_for_status()
            data = response.json()
            
            if not data:
                break
            
            for repo in data:
                repositories.append(Repository(
                    id=repo["id"],
                    name=repo["name"],
                    full_name=repo["full_name"],
                    description=repo.get("description"),
                    url=repo["html_url"],
                    clone_url=repo["clone_url"],
                    ssh_url=repo["ssh_url"],
                    language=repo.get("language"),
                    private=repo["private"],
                    owner=repo["owner"]["login"],
                    default_branch=repo.get("default_branch", "main"),
                    updated_at=repo.get("updated_at")
                ))
            
            page += 1
            
            # Limitar a 500 repositórios para evitar loops infinitos
            if len(repositories) >= 500:
                break
        
        return repositories
    
    async def get_repository(self, owner: str, repo: str) -> Repository:
        """Obtém informações de um repositório específico."""
        client = await self.get_client()
        response = await client.get(f"/repos/{owner}/{repo}")
        response.raise_for_status()
        data = response.json()
        
        return Repository(
            id=data["id"],
            name=data["name"],
            full_name=data["full_name"],
            description=data.get("description"),
            url=data["html_url"],
            clone_url=data["clone_url"],
            ssh_url=data["ssh_url"],
            language=data.get("language"),
            private=data["private"],
            owner=data["owner"]["login"],
            default_branch=data.get("default_branch", "main"),
            updated_at=data.get("updated_at")
        )
    
    def clone_repository(
        self,
        clone_url: str,
        target_dir: Path,
        use_ssh: bool = False,
        force_update: bool = False
    ) -> bool:
        """Clona um repositório para o diretório especificado."""
        if target_dir.exists():
            # Verifica se tem arquivos (repo válido)
            git_dir = target_dir / ".git"
            if git_dir.exists():
                if force_update:
                    # Só atualiza se forçado
                    try:
                        subprocess.run(
                            ["git", "fetch", "--depth", "1", "origin"],
                            cwd=target_dir,
                            check=True,
                            capture_output=True,
                            timeout=60
                        )
                        subprocess.run(
                            ["git", "reset", "--hard", "origin/HEAD"],
                            cwd=target_dir,
                            check=True,
                            capture_output=True,
                            timeout=30
                        )
                    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                        print(f"Erro ao atualizar repo (usando cache): {e}")
                return True  # Usa o cache local
        
        # Clona o repositório
        target_dir.parent.mkdir(parents=True, exist_ok=True)
        
        # Adiciona token na URL se disponível e não for SSH
        auth_clone_url = clone_url
        if self.token and not use_ssh and "github.com" in clone_url:
            auth_clone_url = clone_url.replace(
                "https://github.com",
                f"https://{self.token}@github.com"
            )
        
        try:
            result = subprocess.run(
                ["git", "clone", "--depth", "1", auth_clone_url, str(target_dir)],
                check=True,
                capture_output=True,
                timeout=300
            )
            return True
        except subprocess.CalledProcessError as e:
            print(f"Erro ao clonar: {e.stderr.decode() if e.stderr else str(e)}")
            return False
        except subprocess.TimeoutExpired:
            print("Timeout ao clonar repositório")
            return False
    
    def delete_repository_local(self, target_dir: Path) -> bool:
        """Remove um repositório clonado localmente."""
        if target_dir.exists():
            shutil.rmtree(target_dir)
            return True
        return False
    
    def list_folders(self, repo_path: Path, max_depth: int = 2, min_code_files: int = 2) -> List[dict]:
        """Lista as pastas de um repositório clonado que contêm múltiplos arquivos de código."""
        folders = []
        
        if not repo_path.exists():
            return folders
        
        # Pastas a ignorar
        ignore_patterns = {
            '.git', 'node_modules', '__pycache__', '.venv', 'venv',
            'dist', 'build', '.next', '.nuxt', 'coverage', '.pytest_cache',
            'vendor', '.idea', '.vscode', 'env', '.env', 'tests', 'test',
            '__tests__', 'docs', 'scripts', 'migrations', 'static', 'public',
            'tools'  # Ignora pastas tools
        }
        
        code_extensions = {
            '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.go', '.rs', 
            '.vue', '.rb', '.php', '.cs', '.cpp', '.c', '.h', '.swift', '.kt'
        }
        
        def scan_dir(path: Path, depth: int = 0):
            if depth > max_depth:
                return
            
            try:
                for item in sorted(path.iterdir()):
                    if item.is_dir() and item.name not in ignore_patterns and not item.name.startswith('.'):
                        relative_path = item.relative_to(repo_path)
                        
                        # Conta arquivos de código na pasta (não recursivo para primeira camada)
                        code_files = sum(
                            1 for f in item.rglob('*') 
                            if f.is_file() and f.suffix.lower() in code_extensions
                        )
                        
                        # Só mostra pastas com pelo menos min_code_files arquivos de código
                        if code_files >= min_code_files:
                            folders.append({
                                'name': item.name,
                                'path': str(relative_path),
                                'depth': depth,
                                'code_files': code_files
                            })
                        
                        # Continua explorando subpastas
                        scan_dir(item, depth + 1)
            except PermissionError:
                pass
        
        scan_dir(repo_path)
        
        # Ordena por quantidade de arquivos (mais arquivos primeiro)
        folders.sort(key=lambda x: (-x['code_files'], x['path']))
        
        return folders


# Instância global do serviço
github_service = GitHubService()

