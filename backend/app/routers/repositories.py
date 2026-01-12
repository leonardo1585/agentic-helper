"""
Router para gerenciamento de repositórios.
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel

from ..models import Repository
from ..services import github_service
from ..core import settings

router = APIRouter(prefix="/repositories", tags=["Repositórios"])


class CreateRepoRequest(BaseModel):
    """Request para criar repositório."""
    name: str  # Nome do repositório (sem -agents, será adicionado automaticamente)
    description: str = ""
    source_repo: str  # Ex: "weni-ai/cea-agents"
    source_folder: str  # Ex: "ticket"
    team_slug: Optional[str] = None  # Time a ser adicionado
    private: bool = True


class CopyAgentRequest(BaseModel):
    """Request para copiar agente para novo repositório."""
    target_repo_name: str
    source_repo: str
    source_folder: str
    description: str = ""
    team_slug: Optional[str] = None


class CopyToExistingRequest(BaseModel):
    """Request para copiar agente para repositório existente."""
    target_repo: str  # Ex: "weni-ai/meu-repo-agents"
    source_repo: str  # Ex: "weni-ai/cea-agents"
    source_folder: str  # Ex: "ticket"
    target_folder: Optional[str] = None  # Pasta destino (se None, usa raiz)


@router.get("/", response_model=List[Repository])
async def list_repositories(
    visibility: str = "all",
    language: Optional[str] = None
):
    """Lista todos os repositórios que o usuário tem acesso."""
    if not github_service.token:
        raise HTTPException(
            status_code=400,
            detail="Token GitHub não configurado"
        )
    
    try:
        repos = await github_service.list_repositories(visibility=visibility)
        
        # Filtra por linguagem se especificado
        if language:
            repos = [r for r in repos if r.language and r.language.lower() == language.lower()]
        
        return repos
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao listar repositórios: {str(e)}"
        )


@router.get("/{owner}/{repo}", response_model=Repository)
async def get_repository(owner: str, repo: str):
    """Obtém informações de um repositório específico."""
    if not github_service.token:
        raise HTTPException(
            status_code=400,
            detail="Token GitHub não configurado"
        )
    
    try:
        return await github_service.get_repository(owner, repo)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Repositório não encontrado: {str(e)}"
        )


@router.get("/languages")
async def get_languages():
    """Retorna as linguagens disponíveis nos repositórios."""
    if not github_service.token:
        raise HTTPException(
            status_code=400,
            detail="Token GitHub não configurado"
        )
    
    try:
        repos = await github_service.list_repositories()
        languages = set()
        
        for repo in repos:
            if repo.language:
                languages.add(repo.language)
        
        return sorted(list(languages))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao obter linguagens: {str(e)}"
        )


@router.get("/{owner}/{repo}/folders")
async def list_repository_folders(owner: str, repo: str):
    """Lista as pastas de um repositório para seleção de análise."""
    if not github_service.token:
        raise HTTPException(
            status_code=400,
            detail="Token GitHub não configurado"
        )
    
    try:
        # Verifica se o repositório existe
        repo_info = await github_service.get_repository(owner, repo)
        
        # Caminho do repositório clonado
        repo_full_name = f"{owner}/{repo}"
        repo_path = settings.REPOS_BASE_DIR / repo_full_name.replace("/", "_")
        
        # Clona se não existir
        if not repo_path.exists():
            success = github_service.clone_repository(
                repo_info.clone_url,
                repo_path
            )
            if not success:
                raise HTTPException(
                    status_code=500,
                    detail="Erro ao clonar repositório"
                )
        
        # Lista as pastas
        folders = github_service.list_folders(repo_path)
        
        return {
            "repository": repo_full_name,
            "folders": folders
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao listar pastas: {str(e)}"
        )


@router.get("/org/{org}/teams")
async def list_org_teams(org: str = "weni-ai"):
    """Lista os times de uma organização."""
    if not github_service.token:
        raise HTTPException(
            status_code=400,
            detail="Token GitHub não configurado"
        )
    
    try:
        teams = await github_service.list_org_teams(org)
        return {"teams": teams}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao listar times: {str(e)}"
        )


@router.post("/create-from-agent")
async def create_repo_from_agent(request: CreateRepoRequest):
    """
    Cria um novo repositório copiando um agente existente.
    O nome do repositório sempre terminará com -agents.
    """
    if not github_service.token:
        raise HTTPException(
            status_code=400,
            detail="Token GitHub não configurado"
        )
    
    # Garante que termina com -agents
    repo_name = request.name.lower().replace(" ", "-")
    if not repo_name.endswith("-agents"):
        repo_name = f"{repo_name}-agents"
    
    try:
        # 1. Cria o repositório
        new_repo = await github_service.create_repository(
            name=repo_name,
            org="weni-ai",
            description=request.description or f"Agente copiado de {request.source_repo}/{request.source_folder}",
            private=request.private,
            team_slug=request.team_slug
        )
        
        # 2. Copia os arquivos
        source_parts = request.source_repo.split("/")
        if len(source_parts) != 2:
            raise HTTPException(
                status_code=400,
                detail="source_repo deve estar no formato 'owner/repo'"
            )
        
        source_owner, source_repo = source_parts
        
        # Sempre cria uma pasta separada para o agente usando o nome da pasta de origem
        target_folder = request.source_folder
        
        copy_result = await github_service.copy_folder_to_repo(
            source_owner=source_owner,
            source_repo=source_repo,
            source_folder=request.source_folder,
            target_owner="weni-ai",
            target_repo=repo_name,
            target_folder=target_folder  # Pasta separada para cada agente
        )
        
        return {
            "success": True,
            "repository": {
                "name": repo_name,
                "full_name": f"weni-ai/{repo_name}",
                "url": new_repo.get("html_url"),
                "clone_url": new_repo.get("clone_url")
            },
            "copy_result": copy_result,
            "message": f"Repositório criado com sucesso! {copy_result['files_copied']} arquivos copiados."
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao criar repositório: {str(e)}"
        )


@router.get("/org/{org}/repos")
async def list_org_repos(org: str = "weni-ai", filter_agents: bool = True):
    """Lista os repositórios de uma organização."""
    if not github_service.token:
        raise HTTPException(
            status_code=400,
            detail="Token GitHub não configurado"
        )
    
    try:
        repos = await github_service.list_org_repositories(org)
        
        # Filtra apenas repositórios que terminam com -agents
        if filter_agents:
            repos = [r for r in repos if r.name.endswith("-agents")]
        
        return {
            "repositories": [
                {
                    "name": r.name,
                    "full_name": r.full_name,
                    "description": r.description,
                    "url": r.url,
                    "private": r.private
                }
                for r in repos
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao listar repositórios: {str(e)}"
        )


@router.post("/copy-to-existing")
async def copy_agent_to_existing_repo(request: CopyToExistingRequest):
    """
    Copia um agente para um repositório já existente.
    Os arquivos serão copiados para a pasta especificada ou para a raiz.
    """
    if not github_service.token:
        raise HTTPException(
            status_code=400,
            detail="Token GitHub não configurado"
        )
    
    try:
        # Parse source repo
        source_parts = request.source_repo.split("/")
        if len(source_parts) != 2:
            raise HTTPException(
                status_code=400,
                detail="source_repo deve estar no formato 'owner/repo'"
            )
        source_owner, source_repo = source_parts
        
        # Parse target repo
        target_parts = request.target_repo.split("/")
        if len(target_parts) != 2:
            raise HTTPException(
                status_code=400,
                detail="target_repo deve estar no formato 'owner/repo'"
            )
        target_owner, target_repo = target_parts
        
        # Copia os arquivos
        copy_result = await github_service.copy_folder_to_repo(
            source_owner=source_owner,
            source_repo=source_repo,
            source_folder=request.source_folder,
            target_owner=target_owner,
            target_repo=target_repo,
            target_folder=request.target_folder
        )
        
        # Busca URL do repositório
        repo_info = await github_service.get_repository(target_owner, target_repo)
        
        return {
            "success": True,
            "repository": {
                "name": target_repo,
                "full_name": f"{target_owner}/{target_repo}",
                "url": repo_info.url
            },
            "copy_result": copy_result,
            "message": f"Agente copiado com sucesso! {copy_result['files_copied']} arquivos adicionados."
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao copiar agente: {str(e)}"
        )

