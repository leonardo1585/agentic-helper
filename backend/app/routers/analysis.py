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


@router.post("/reindex-all")
async def reindex_all_knowledge_bases():
    """
    Reindexe todas as bases de conhecimento, incluindo instructions do agent_definition.yaml.
    
    Isso atualiza o índice semântico para que a busca de agentes considere:
    - Instructions do agente
    - Guardrails do agente
    - Nome e descrição do agente
    
    Use após modificar o sistema de indexação ou para atualizar o índice com novas informações.
    """
    try:
        results = await agent_service.reindex_all_with_instructions()
        return {
            "message": "Reindexação concluída",
            "results": results
        }
    except Exception as e:
        print(f"Erro na reindexação: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro na reindexação: {str(e)}"
        )


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


class ChatKBRequest(BaseModel):
    """Request para chat com KB específica."""
    message: str
    kb_name: str
    mode: str = "technical"


@router.post("/chat/kb/stream")
async def chat_kb_stream(request: ChatKBRequest):
    """Chat focado em uma KB específica."""
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    async def generate():
        try:
            async for chunk in agent_service.chat_with_kb_stream(
                request.message,
                request.kb_name,
                mode=request.mode
            ):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"Erro no chat KB: {e}")
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
        import asyncio
        # Timeout de 60 segundos para evitar ficar carregando infinitamente
        result = await asyncio.wait_for(
            agent_service.find_existing_agent(request.description),
            timeout=60.0
        )
        return result
    except asyncio.TimeoutError:
        print("⚠️ Timeout na busca de agente")
        raise HTTPException(
            status_code=504,
            detail="Timeout: A busca demorou muito. Verifique sua conexão com a internet e tente novamente."
        )
    except RuntimeError as e:
        print(f"Erro de runtime: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Serviço temporariamente indisponível: {str(e)}"
        )
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


# ============================================
# DIFF DE ATUALIZAÇÕES (PARA CS)
# ============================================

from ..services.updates_service import updates_service
from ..services.diagnostic_service import diagnostic_service
from ..models.schemas import DiagnosticRequest


@router.post("/snapshot/{repository_name:path}")
async def create_snapshot(repository_name: str, indexed_by: str = "system"):
    """
    Cria um snapshot da indexação atual para comparação futura.
    Chamado automaticamente após cada indexação.
    """
    kb = agent_service.get_knowledge_base(repository_name)
    if not kb:
        raise HTTPException(
            status_code=404,
            detail=f"Base de conhecimento não encontrada: {repository_name}"
        )
    
    snapshot = await updates_service.create_snapshot_async(kb, indexed_by)
    return {
        "success": True,
        "snapshot_id": snapshot.id,
        "timestamp": snapshot.timestamp,
        "commit_sha": snapshot.content_hash
    }


@router.get("/snapshots/{repository_name:path}")
async def get_snapshots(repository_name: str):
    """Retorna todos os snapshots de um repositório."""
    snapshots = updates_service.get_snapshots(repository_name)
    return {
        "repository_name": repository_name,
        "total": len(snapshots),
        "snapshots": [
            {
                "id": s.id,
                "timestamp": s.timestamp,
                "indexed_by": s.indexed_by,
                "content_hash": s.content_hash
            }
            for s in snapshots
        ]
    }


@router.get("/updates-diff/{repository_name:path}")
async def get_updates_diff(
    repository_name: str,
    from_snapshot: Optional[str] = None,
    to_snapshot: Optional[str] = None
):
    """
    Retorna a diferença entre duas indexações.
    Se não especificado, compara as duas mais recentes.
    
    Útil para o time de CS saber o que mudou desde a última vez.
    """
    diff = await updates_service.compute_diff_async(
        repository_name,
        from_snapshot_id=from_snapshot,
        to_snapshot_id=to_snapshot
    )
    
    if not diff:
        return {
            "repository_name": repository_name,
            "message": "Não há snapshots suficientes para comparação. Faça pelo menos 2 indexações.",
            "has_diff": False
        }
    
    return {
        "has_diff": True,
        "diff": diff.model_dump(mode='json')
    }


# ============================================
# DIAGNÓSTICO DE PROBLEMAS
# ============================================

class DiagnoseRequest(BaseModel):
    """Request para diagnóstico de problema."""
    repository_name: str
    problem_description: str
    error_message: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    days_lookback: int = 7


@router.post("/diagnose")
async def diagnose_problem_endpoint(request: DiagnoseRequest):
    """
    Diagnostica um problema e verifica correlação com mudanças recentes.
    
    Analisa:
    - Commits recentes no repositório
    - Mudanças em instruções (agent_definition.yaml)
    - Mudanças em código (handlers, funções)
    - Mudanças em configurações
    
    Retorna diagnóstico com possíveis causas e recomendações.
    """
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    # Obtém KB se existir
    kb = agent_service.get_knowledge_base(request.repository_name)
    
    diagnostic_request = DiagnosticRequest(
        repository_name=request.repository_name,
        problem_description=request.problem_description,
        error_message=request.error_message,
        expected_behavior=request.expected_behavior,
        actual_behavior=request.actual_behavior,
        days_lookback=request.days_lookback
    )
    
    try:
        result = await diagnostic_service.diagnose_problem(diagnostic_request, kb)
        return result.model_dump(mode='json')
    except Exception as e:
        print(f"Erro no diagnóstico: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro no diagnóstico: {str(e)}"
        )


class CreateTicketRequest(BaseModel):
    """Request para criar ticket de diagnóstico."""
    repository_name: str
    problem_description: str
    error_message: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    days_lookback: int = 7
    created_by: str = "Suporte"


@router.post("/diagnostic/ticket")
async def create_diagnostic_ticket(request: CreateTicketRequest):
    """
    Realiza diagnóstico e cria um ticket compartilhável.
    
    Retorna um ticket com:
    - ID único para compartilhamento (ex: DBG-2024-0001)
    - Log de debug formatado
    - Link compartilhável
    """
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Serviço de IA não configurado"
        )
    
    # Obtém KB se existir
    kb = agent_service.get_knowledge_base(request.repository_name)
    
    diagnostic_request = DiagnosticRequest(
        repository_name=request.repository_name,
        problem_description=request.problem_description,
        error_message=request.error_message,
        expected_behavior=request.expected_behavior,
        actual_behavior=request.actual_behavior,
        days_lookback=request.days_lookback
    )
    
    try:
        # Realiza o diagnóstico
        result = await diagnostic_service.diagnose_problem(diagnostic_request, kb)
        
        # Cria o ticket
        ticket = diagnostic_service.create_ticket(
            result=result,
            request=diagnostic_request,
            created_by=request.created_by
        )
        
        return ticket.model_dump(mode='json')
    except Exception as e:
        print(f"Erro ao criar ticket: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao criar ticket: {str(e)}"
        )


@router.get("/diagnostic/ticket/{ticket_id}")
async def get_diagnostic_ticket(ticket_id: str):
    """
    Busca um ticket de diagnóstico por ID.
    Use esta rota para compartilhar diagnósticos com o time responsável.
    """
    ticket = diagnostic_service.get_ticket(ticket_id)
    
    if not ticket:
        raise HTTPException(
            status_code=404,
            detail=f"Ticket não encontrado: {ticket_id}"
        )
    
    return ticket.model_dump(mode='json')


class UpdateTicketRequest(BaseModel):
    """Request para atualizar status do ticket."""
    status: str  # 'open', 'investigating', 'resolved', 'closed'
    note: Optional[str] = None


@router.patch("/diagnostic/ticket/{ticket_id}")
async def update_diagnostic_ticket(ticket_id: str, request: UpdateTicketRequest):
    """
    Atualiza o status de um ticket de diagnóstico.
    """
    valid_statuses = ['open', 'investigating', 'resolved', 'closed']
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Status inválido. Use: {', '.join(valid_statuses)}"
        )
    
    ticket = diagnostic_service.update_ticket_status(
        ticket_id=ticket_id,
        status=request.status,
        note=request.note
    )
    
    if not ticket:
        raise HTTPException(
            status_code=404,
            detail=f"Ticket não encontrado: {ticket_id}"
        )
    
    return ticket.model_dump(mode='json')


@router.get("/diagnostic/history")
async def get_diagnostic_history(
    repository_name: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """
    Lista histórico de diagnósticos realizados.
    
    Filtros opcionais:
    - repository_name: filtrar por repositório
    - status: filtrar por status (open, investigating, resolved, closed)
    - limit: quantidade máxima de resultados
    """
    tickets = diagnostic_service.list_tickets(
        repository_name=repository_name,
        status=status,
        limit=limit
    )
    
    return {
        "total": len(tickets),
        "tickets": [t.model_dump(mode='json') for t in tickets]
    }


@router.get("/diagnostic/ticket/{ticket_id}/log")
async def get_ticket_debug_log(ticket_id: str):
    """
    Retorna apenas o log de debug formatado do ticket.
    Útil para copiar e colar em outras ferramentas.
    """
    ticket = diagnostic_service.get_ticket(ticket_id)
    
    if not ticket:
        raise HTTPException(
            status_code=404,
            detail=f"Ticket não encontrado: {ticket_id}"
        )
    
    return {
        "ticket_id": ticket_id,
        "debug_log": ticket.debug_log,
        "share_url": ticket.share_url
    }


class CreateDebugTicketRequest(BaseModel):
    """Request para criar ticket a partir de resultado de Debug."""
    repository_name: str
    problem_description: str
    error_message: Optional[str] = None
    debug_result: dict  # Resultado completo do debug
    created_by: str = "Debug"


@router.post("/diagnostic/debug-ticket")
async def create_debug_ticket(request: CreateDebugTicketRequest):
    """
    Cria um ticket a partir do resultado do módulo de Debug.
    
    Este endpoint é diferente do /diagnostic/ticket que faz um novo diagnóstico.
    Este usa o resultado do debug já realizado.
    """
    try:
        ticket = diagnostic_service.create_debug_ticket(
            repository_name=request.repository_name,
            problem_description=request.problem_description,
            debug_result=request.debug_result,
            error_message=request.error_message,
            created_by=request.created_by
        )
        
        return ticket.model_dump(mode='json')
    except Exception as e:
        print(f"Erro ao criar ticket de debug: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao criar ticket: {str(e)}"
        )
