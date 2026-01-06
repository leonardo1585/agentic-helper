"""
Router para gerenciamento de repositórios.
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional

from ..models import Repository
from ..services import github_service
from ..core import settings

router = APIRouter(prefix="/repositories", tags=["Repositórios"])


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

