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
    
    def list_folders(self, repo_path: Path, max_depth: int = 1, min_code_files: int = 1) -> List[dict]:
        """Lista as pastas de um repositório clonado que contêm arquivos de código."""
        folders = []
        
        if not repo_path.exists():
            return folders
        
        # Pastas a ignorar
        ignore_patterns = {
            '.git', 'node_modules', '__pycache__', '.venv', 'venv',
            'dist', 'build', '.next', '.nuxt', 'coverage', '.pytest_cache',
            'vendor', '.idea', '.vscode', 'env', '.env', 
            '__tests__', 'docs', 'migrations', 'static', 'public',
            'tools'  # Ignora pastas tools
        }
        
        code_extensions = {
            '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.go', '.rs', 
            '.vue', '.rb', '.php', '.cs', '.cpp', '.c', '.h', '.swift', '.kt',
            '.yaml', '.yml', '.json', '.md'  # Inclui config e docs também
        }
        
        def scan_dir(path: Path, depth: int = 0):
            if depth > max_depth:
                return
            
            try:
                for item in sorted(path.iterdir()):
                    if item.is_dir() and item.name not in ignore_patterns and not item.name.startswith('.'):
                        relative_path = item.relative_to(repo_path)
                        
                        # Conta arquivos de código na pasta (recursivo)
                        code_files = sum(
                            1 for f in item.rglob('*') 
                            if f.is_file() and f.suffix.lower() in code_extensions
                        )
                        
                        # Mostra pastas com pelo menos 1 arquivo de código
                        if code_files >= min_code_files:
                            folders.append({
                                'name': item.name,
                                'path': str(relative_path),
                                'depth': depth,
                                'code_files': code_files
                            })
                        
                        # Continua explorando subpastas (mas só adiciona primeiro nível por padrão)
                        if depth < max_depth:
                            scan_dir(item, depth + 1)
            except PermissionError:
                pass
        
        scan_dir(repo_path)
        
        # Ordena por profundidade primeiro (pastas raiz primeiro), depois por nome
        folders.sort(key=lambda x: (x['depth'], x['name']))
        
        return folders


    async def create_repository(
        self,
        name: str,
        org: str = "weni-ai",
        description: str = "",
        private: bool = True,
        team_slug: Optional[str] = None
    ) -> dict:
        """Cria um novo repositório na organização."""
        client = await self.get_client()
        
        # Cria o repositório na organização
        response = await client.post(
            f"/orgs/{org}/repos",
            json={
                "name": name,
                "description": description,
                "private": private,
                "auto_init": True,  # Cria com README
                "has_issues": True,
                "has_projects": False,
                "has_wiki": False
            }
        )
        
        if response.status_code == 422:
            error_data = response.json()
            if "already exists" in str(error_data):
                raise Exception(f"Repositório '{name}' já existe na organização {org}")
            raise Exception(f"Erro de validação: {error_data}")
        
        response.raise_for_status()
        repo_data = response.json()
        
        # Adiciona time se especificado
        if team_slug:
            try:
                await client.put(
                    f"/orgs/{org}/teams/{team_slug}/repos/{org}/{name}",
                    json={"permission": "push"}
                )
            except Exception as e:
                print(f"Aviso: não foi possível adicionar time {team_slug}: {e}")
        
        return repo_data
    
    async def get_file_content(self, owner: str, repo: str, path: str, ref: str = "main") -> Optional[dict]:
        """Obtém conteúdo de um arquivo do repositório."""
        client = await self.get_client()
        try:
            response = await client.get(
                f"/repos/{owner}/{repo}/contents/{path}",
                params={"ref": ref}
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None
    
    async def create_or_update_file(
        self,
        owner: str,
        repo: str,
        path: str,
        content: str,
        message: str,
        branch: str = "main",
        sha: Optional[str] = None
    ) -> dict:
        """Cria ou atualiza um arquivo no repositório."""
        import base64
        client = await self.get_client()
        
        # Codifica conteúdo em base64
        content_b64 = base64.b64encode(content.encode()).decode()
        
        data = {
            "message": message,
            "content": content_b64,
            "branch": branch
        }
        
        if sha:
            data["sha"] = sha
        
        response = await client.put(
            f"/repos/{owner}/{repo}/contents/{path}",
            json=data
        )
        response.raise_for_status()
        return response.json()
    
    async def copy_folder_to_repo(
        self,
        source_owner: str,
        source_repo: str,
        source_folder: str,
        target_owner: str,
        target_repo: str,
        target_branch: str = "main",
        target_folder: Optional[str] = None
    ) -> dict:
        """Copia uma pasta de um repositório para outro."""
        # Caminho do repositório fonte clonado
        source_repo_path = settings.REPOS_BASE_DIR / f"{source_owner}_{source_repo}"
        source_folder_path = source_repo_path / source_folder
        
        if not source_folder_path.exists():
            # Tenta clonar se não existir
            repo_info = await self.get_repository(source_owner, source_repo)
            self.clone_repository(repo_info.clone_url, source_repo_path)
            
            if not source_folder_path.exists():
                raise Exception(f"Pasta {source_folder} não encontrada no repositório")
        
        files_copied = 0
        errors = []
        
        # Lista todos os arquivos da pasta
        for file_path in source_folder_path.rglob("*"):
            if file_path.is_file() and not any(
                part.startswith('.') or part in ['__pycache__', 'node_modules', '.git']
                for part in file_path.parts
            ):
                try:
                    # Calcula caminho relativo
                    relative_path = file_path.relative_to(source_folder_path)
                    # Se target_folder especificado, adiciona como prefixo
                    if target_folder:
                        target_path = f"{target_folder}/{relative_path}"
                    else:
                        target_path = str(relative_path)
                    
                    # Lê conteúdo do arquivo
                    try:
                        content = file_path.read_text(encoding='utf-8')
                    except UnicodeDecodeError:
                        # Pula arquivos binários
                        continue
                    
                    # Cria no repositório destino
                    await self.create_or_update_file(
                        owner=target_owner,
                        repo=target_repo,
                        path=target_path,
                        content=content,
                        message=f"Add {target_path} from {source_owner}/{source_repo}/{source_folder}",
                        branch=target_branch
                    )
                    files_copied += 1
                    
                except Exception as e:
                    errors.append(f"{file_path.name}: {str(e)}")
        
        return {
            "files_copied": files_copied,
            "errors": errors,
            "source": f"{source_owner}/{source_repo}/{source_folder}",
            "target": f"{target_owner}/{target_repo}"
        }
    
    async def list_org_teams(self, org: str = "weni-ai") -> List[dict]:
        """Lista os times de uma organização."""
        client = await self.get_client()
        try:
            response = await client.get(f"/orgs/{org}/teams")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Erro ao listar times: {e}")
            return []
    
    async def list_org_repositories(
        self,
        org: str = "weni-ai",
        per_page: int = 100
    ) -> List[Repository]:
        """Lista os repositórios de uma organização."""
        client = await self.get_client()
        repositories = []
        page = 1
        
        while True:
            try:
                response = await client.get(
                    f"/orgs/{org}/repos",
                    params={
                        "type": "all",
                        "sort": "updated",
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
                
                # Limitar a 500 repositórios
                if len(repositories) >= 500:
                    break
                    
            except Exception as e:
                print(f"Erro ao listar repos da org {org}: {e}")
                break
        
        return repositories
    
    async def get_latest_commit(
        self,
        owner: str,
        repo: str,
        branch: str = "main"
    ) -> Optional[str]:
        """
        Obtém o SHA do commit mais recente do GitHub (via API).
        Não depende do repositório local!
        """
        try:
            client = await self.get_client()
            
            # Tenta branch main primeiro
            response = await client.get(f"/repos/{owner}/{repo}/commits/{branch}")
            
            if response.status_code == 404:
                # Tenta master se main não existir
                response = await client.get(f"/repos/{owner}/{repo}/commits/master")
            
            if response.status_code == 200:
                data = response.json()
                return data.get("sha", "")[:8]  # Retorna os primeiros 8 chars
            
            print(f"Erro ao obter commit: {response.status_code}")
            return None
            
        except Exception as e:
            print(f"Erro ao obter latest commit: {e}")
            return None
    
    async def compare_commits(
        self,
        owner: str,
        repo: str,
        base: str,
        head: str
    ) -> Optional[dict]:
        """
        Compara dois commits usando a API do GitHub.
        Retorna lista de arquivos modificados e o diff.
        Não depende do repositório local!
        """
        try:
            client = await self.get_client()
            
            # API de comparação: /repos/{owner}/{repo}/compare/{base}...{head}
            response = await client.get(
                f"/repos/{owner}/{repo}/compare/{base}...{head}"
            )
            
            if response.status_code != 200:
                print(f"Erro ao comparar commits: {response.status_code}")
                return None
            
            data = response.json()
            
            # Extrai informações relevantes
            result = {
                "status": data.get("status", ""),  # ahead, behind, identical, diverged
                "ahead_by": data.get("ahead_by", 0),
                "behind_by": data.get("behind_by", 0),
                "total_commits": data.get("total_commits", 0),
                "commits": [],
                "files": []
            }
            
            # Commits entre base e head
            for commit in data.get("commits", []):
                result["commits"].append({
                    "sha": commit.get("sha", "")[:8],
                    "message": commit.get("commit", {}).get("message", "").split("\n")[0],
                    "author": commit.get("commit", {}).get("author", {}).get("name", ""),
                    "date": commit.get("commit", {}).get("author", {}).get("date", "")
                })
            
            # Arquivos modificados
            for file in data.get("files", []):
                result["files"].append({
                    "filename": file.get("filename", ""),
                    "status": file.get("status", ""),  # added, removed, modified, renamed
                    "additions": file.get("additions", 0),
                    "deletions": file.get("deletions", 0),
                    "changes": file.get("changes", 0),
                    "patch": file.get("patch", "")[:1000] if file.get("patch") else ""  # Preview do diff
                })
            
            return result
            
        except Exception as e:
            print(f"Erro ao comparar commits: {e}")
            return None


# Instância global do serviço
github_service = GitHubService()

