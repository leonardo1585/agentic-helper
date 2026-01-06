"""
Router para busca semântica de agentes.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

from ..services.vector_service import vector_service
from ..services.agent_service import agent_service

router = APIRouter(prefix="/search", tags=["Busca Semântica"])


class SearchQuery(BaseModel):
    """Query de busca."""
    query: str
    n_results: int = 5


class SearchResult(BaseModel):
    """Resultado de busca."""
    kb_name: str
    repo_name: str
    folder_name: str
    similarity: float
    document: str


class IndexResult(BaseModel):
    """Resultado de indexação."""
    success: int
    failed: int
    agents: List[str]


class VectorStats(BaseModel):
    """Estatísticas do vector store."""
    total_agents: int
    collection_name: str
    initialized: bool


@router.post("/index-all", response_model=IndexResult)
async def index_all_agents():
    """
    Indexa todos os agentes já analisados no vector store.
    Isso permite busca semântica posterior.
    """
    knowledge_bases = agent_service.knowledge_bases
    
    if not knowledge_bases:
        raise HTTPException(
            status_code=400,
            detail="Nenhuma base de conhecimento encontrada. Analise alguns agentes primeiro."
        )
    
    # Converte KBs para dicts
    kb_dicts = {}
    for name, kb in knowledge_bases.items():
        kb_dicts[name] = kb.model_dump(mode="json")
    
    result = vector_service.index_all_agents(kb_dicts)
    return result


@router.post("/index/{owner}/{repo}")
async def index_agent(owner: str, repo: str, folder_path: Optional[str] = None):
    """
    Indexa um agente específico no vector store.
    """
    repo_full_name = f"{owner}/{repo}"
    kb_name = f"{repo_full_name}/{folder_path}" if folder_path else repo_full_name
    
    kb = agent_service.get_knowledge_base(kb_name)
    if not kb:
        raise HTTPException(
            status_code=404,
            detail=f"Base de conhecimento não encontrada: {kb_name}"
        )
    
    kb_dict = kb.model_dump(mode="json")
    success = vector_service.index_agent(kb_name, kb_dict)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Erro ao indexar agente"
        )
    
    return {"message": f"Agente indexado: {kb_name}"}


@router.get("/agents", response_model=List[SearchResult])
async def search_agents(
    q: str = Query(..., description="Descrição do agente que você procura"),
    n: int = Query(5, ge=1, le=20, description="Número de resultados")
):
    """
    Busca agentes similares a uma descrição.
    
    Exemplo: "agente que consulta status de pedido na VTEX"
    """
    results = vector_service.search_similar_agents(q, n_results=n)
    
    if not results:
        return []
    
    return results


@router.post("/find-existing")
async def find_existing_agent(query: SearchQuery):
    """
    Verifica se já existe um agente similar ao descrito.
    Útil antes de criar um novo agente.
    
    Retorna os agentes mais similares com análise de se já existe.
    """
    results = vector_service.search_similar_agents(
        query.query, 
        n_results=query.n_results
    )
    
    if not results:
        return {
            "exists": False,
            "message": "Nenhum agente similar encontrado. Você pode criar um novo!",
            "similar_agents": []
        }
    
    # Verifica se há algum muito similar (>70%)
    high_similarity = [r for r in results if r["similarity"] > 0.7]
    medium_similarity = [r for r in results if 0.4 < r["similarity"] <= 0.7]
    
    if high_similarity:
        return {
            "exists": True,
            "message": f"Encontrei {len(high_similarity)} agente(s) muito similar(es)! Verifique se já não atende sua necessidade.",
            "similar_agents": results,
            "recommendation": "Reutilize um existente ou estenda-o"
        }
    elif medium_similarity:
        return {
            "exists": False,
            "message": f"Encontrei {len(medium_similarity)} agente(s) parcialmente similar(es). Pode haver funcionalidades que você pode reaproveitar.",
            "similar_agents": results,
            "recommendation": "Considere reaproveitar partes dos agentes existentes"
        }
    else:
        return {
            "exists": False,
            "message": "Nenhum agente muito similar encontrado.",
            "similar_agents": results,
            "recommendation": "Pode criar um novo agente"
        }


@router.get("/stats", response_model=VectorStats)
async def get_vector_stats():
    """
    Retorna estatísticas do vector store.
    """
    return vector_service.get_stats()


@router.delete("/clear")
async def clear_index():
    """
    Limpa todo o índice de busca.
    Você precisará reindexar os agentes depois.
    """
    success = vector_service.clear_index()
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Erro ao limpar índice"
        )
    
    return {"message": "Índice limpo com sucesso"}

