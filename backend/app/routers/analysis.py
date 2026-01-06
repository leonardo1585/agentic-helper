"""
Router para análise de repositórios.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import traceback

from ..models import (
    AnalysisRequest, 
    AnalysisStatus, 
    KnowledgeBase,
    TechnicalKnowledgeBase,
    BusinessKnowledgeBase,
    ChatRequest,
    ChatResponse
)
from ..services import agent_service, ai_service

router = APIRouter(prefix="/analysis", tags=["Análise"])


@router.post("/start")
async def start_analysis(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks
):
    """Inicia a análise de repositórios em background."""
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    async def run_analysis():
        await agent_service.analyze_multiple(request.repositories)
    
    background_tasks.add_task(run_analysis)
    
    return {
        "message": "Análise iniciada",
        "repositories": request.repositories
    }


@router.post("/analyze/{owner}/{repo}")
async def analyze_repository(owner: str, repo: str, folder_path: Optional[str] = None):
    """Analisa um repositório específico ou uma pasta dentro dele."""
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    repo_full_name = f"{owner}/{repo}"
    
    # Se folder_path for fornecido, usa como identificador
    analysis_name = f"{repo_full_name}/{folder_path}" if folder_path else repo_full_name
    
    try:
        kb = await agent_service.analyze_repository(
            repo_full_name, 
            folder_path=folder_path
        )
        return kb
    except Exception as e:
        error_detail = f"Erro na análise: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(
            status_code=500,
            detail=f"Erro na análise: {str(e)}"
        )


@router.get("/status/{owner}/{repo}")
async def get_analysis_status(owner: str, repo: str, folder_path: Optional[str] = None):
    """Retorna o status da análise de um repositório ou pasta."""
    repo_full_name = f"{owner}/{repo}"
    analysis_name = f"{repo_full_name}/{folder_path}" if folder_path else repo_full_name
    
    status = agent_service.get_status(analysis_name)
    
    if not status:
        return AnalysisStatus(
            repository=analysis_name,
            status="not_started",
            progress=0,
            message="Análise não iniciada"
        )
    
    return status


@router.delete("/knowledge-base/{owner}/{repo}")
async def delete_knowledge_base(owner: str, repo: str, folder_path: Optional[str] = None):
    """Deleta a base de conhecimento de um repositório ou pasta."""
    repo_full_name = f"{owner}/{repo}"
    kb_name = f"{repo_full_name}/{folder_path}" if folder_path else repo_full_name
    
    if kb_name in agent_service.knowledge_bases:
        del agent_service.knowledge_bases[kb_name]
        agent_service._save_knowledge_bases()
        return {"message": f"Base de conhecimento '{kb_name}' deletada"}
    
    raise HTTPException(
        status_code=404,
        detail="Base de conhecimento não encontrada"
    )


@router.delete("/knowledge-bases/clear")
async def clear_all_knowledge_bases():
    """Limpa todas as bases de conhecimento."""
    agent_service.knowledge_bases.clear()
    agent_service._save_knowledge_bases()
    return {"message": "Todas as bases de conhecimento foram removidas"}


@router.get("/knowledge-bases")
async def list_knowledge_bases():
    """Lista todas as bases de conhecimento disponíveis."""
    return agent_service.list_knowledge_bases()


@router.get("/knowledge-base/{owner}/{repo}")
async def get_knowledge_base(owner: str, repo: str, folder_path: Optional[str] = None):
    """Retorna a base de conhecimento de um repositório ou pasta."""
    repo_full_name = f"{owner}/{repo}"
    kb_name = f"{repo_full_name}/{folder_path}" if folder_path else repo_full_name
    
    kb = agent_service.get_knowledge_base(kb_name)
    
    if not kb:
        raise HTTPException(
            status_code=404,
            detail=f"Base de conhecimento não encontrada: {kb_name}"
        )
    
    return kb


@router.get("/knowledge-base/{owner}/{repo}/technical")
async def get_technical_kb(owner: str, repo: str):
    """Retorna a base de conhecimento técnica de um repositório."""
    repo_full_name = f"{owner}/{repo}"
    kb = agent_service.get_knowledge_base(repo_full_name)
    
    if not kb:
        raise HTTPException(
            status_code=404,
            detail="Base de conhecimento não encontrada"
        )
    
    if not kb.technical:
        raise HTTPException(
            status_code=404,
            detail="Base de conhecimento técnica não disponível"
        )
    
    return kb.technical


@router.get("/knowledge-base/{owner}/{repo}/business")
async def get_business_kb(owner: str, repo: str):
    """Retorna a base de conhecimento de negócio de um repositório."""
    repo_full_name = f"{owner}/{repo}"
    kb = agent_service.get_knowledge_base(repo_full_name)
    
    if not kb:
        raise HTTPException(
            status_code=404,
            detail="Base de conhecimento não encontrada"
        )
    
    if not kb.business:
        raise HTTPException(
            status_code=404,
            detail="Base de conhecimento de negócio não disponível"
        )
    
    return kb.business


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat com o agente sobre os repositórios."""
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    try:
        response = await agent_service.chat(
            request.message,
            request.context_repos,
            mode=request.mode
        )
        
        return ChatResponse(
            response=response,
            sources=request.context_repos or agent_service.list_knowledge_bases()
        )
    except Exception as e:
        print(f"Erro no chat: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro no chat: {str(e)}"
        )


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Chat com streaming."""
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    async def generate():
        try:
            async for chunk in agent_service.chat_stream(
                request.message,
                request.context_repos,
                mode=request.mode
            ):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"Erro no streaming: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# ===== ENDPOINTS RAG (Retrieval Augmented Generation) =====

@router.post("/chat/rag", response_model=ChatResponse)
async def chat_rag(request: ChatRequest):
    """
    Chat usando RAG - busca automaticamente contexto relevante.
    Não precisa selecionar repositórios manualmente.
    """
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    try:
        response = await agent_service.chat_rag(
            request.message,
            mode=request.mode
        )
        
        return ChatResponse(
            response=response,
            sources=["RAG - Contexto automático"]
        )
    except Exception as e:
        print(f"Erro no chat RAG: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro no chat: {str(e)}"
        )


@router.post("/chat/rag/stream")
async def chat_rag_stream(request: ChatRequest):
    """Chat RAG com streaming."""
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    async def generate():
        try:
            async for chunk in agent_service.chat_rag_stream(
                request.message,
                mode=request.mode
            ):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"Erro no streaming RAG: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


class FindAgentRequest(BaseModel):
    """Request para buscar agente existente."""
    description: str


@router.post("/find-agent")
async def find_existing_agent(request: FindAgentRequest):
    """
    Verifica se já existe um agente que atende a uma necessidade.
    Útil antes de criar um novo agente.
    
    Exemplo: "preciso de um agente que consulte pedidos na VTEX"
    """
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    try:
        result = await agent_service.find_existing_agent(request.description)
        return result
    except Exception as e:
        print(f"Erro ao buscar agente: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro na busca: {str(e)}"
        )


class DebugProblemRequest(BaseModel):
    """Request para debug de problema."""
    repository: str
    folder_path: str
    problem_description: str
    output_json: Optional[str] = None


@router.post("/debug")
async def debug_problem(request: DebugProblemRequest):
    """
    Investiga um problema reportado em um agente.
    
    Analisa:
    - agent_definition (instruções do agente)
    - Código Python
    - JSON de retorno (opcional)
    
    Retorna a causa raiz provável e sugestões de correção.
    """
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    try:
        result = await agent_service.debug_problem(
            repository=request.repository,
            folder_path=request.folder_path,
            problem_description=request.problem_description,
            output_json=request.output_json
        )
        return result
    except Exception as e:
        print(f"Erro no debug: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro na investigação: {str(e)}"
        )
