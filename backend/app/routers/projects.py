"""
Router para gerenciamento de projetos de agentes.
"""
from typing import Dict, List, Optional, Any, Union
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime

from ..services.project_service import project_service
from ..services.ai_service import ai_service
from ..services.prompt_service import prompt_service
from ..models.schemas import PromptCategory


router = APIRouter(prefix="/projects", tags=["projects"])


# =============================================================================
# MODELS
# =============================================================================

class ProjectCreateRequest(BaseModel):
    """Request para criação de projeto."""
    name: str
    goal: str
    instructions: Optional[Union[str, List[str]]] = ""
    skills: Optional[List[Dict]] = []
    uuid: Optional[str] = None


class ProjectUpdateRequest(BaseModel):
    """Request para atualização de projeto."""
    name: Optional[str] = None


class YamlUpdateRequest(BaseModel):
    """Request para atualização de YAML."""
    content: str


class AgentPreviewRequest(BaseModel):
    """Request para preview de agente com IA."""
    name: str
    goal: str
    uuid: Optional[str] = None


class ToolAddRequest(BaseModel):
    """Request para adicionar tool."""
    tool_slug: str
    tool_name: str
    description: Optional[str] = ""
    main_py: Optional[str] = ""
    requirements_txt: Optional[str] = ""
    parameters: Optional[List[Dict]] = []


class ToolSourceUpdateRequest(BaseModel):
    """Request para atualizar código fonte de tool."""
    main_py: str
    requirements_txt: Optional[str] = None


class YamlImprovementRequest(BaseModel):
    """Request para melhorar YAML com IA."""
    goal: Optional[str] = ""
    instructions: Optional[str] = ""


# =============================================================================
# PROJECTS CRUD
# =============================================================================

@router.get("")
def list_projects():
    """Lista todos os projetos."""
    return project_service.list_projects()


@router.post("")
def create_project(request: ProjectCreateRequest):
    """Cria um novo projeto."""
    try:
        result = project_service.create_project(
            name=request.name,
            goal=request.goal,
            instructions=request.instructions or "",
            skills=request.skills or [],
            existing_uuid=request.uuid
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{uuid}")
def get_project(uuid: str):
    """Obtém um projeto específico."""
    project = project_service.get_project(uuid)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return project


@router.patch("/{uuid}")
def update_project(uuid: str, request: ProjectUpdateRequest):
    """Atualiza um projeto."""
    try:
        if request.name:
            return project_service.update_project_name(uuid, request.name)
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{uuid}")
def delete_project(uuid: str):
    """Deleta um projeto."""
    try:
        return project_service.delete_project(uuid)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# =============================================================================
# PROJECT YAML
# =============================================================================

@router.get("/{uuid}/yaml")
def get_project_yaml(uuid: str):
    """Obtém o weni.yaml de um projeto."""
    try:
        content = project_service.get_project_yaml(uuid)
        return {"content": content}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{uuid}/yaml")
def update_project_yaml(uuid: str, request: YamlUpdateRequest):
    """Atualiza o weni.yaml de um projeto."""
    try:
        return project_service.update_project_yaml(uuid, request.content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# PROJECT TOOLS
# =============================================================================

@router.get("/{uuid}/tools")
def list_project_tools(uuid: str):
    """Lista ferramentas de um projeto."""
    project = project_service.get_project(uuid)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return project.get("tools", [])


@router.post("/{uuid}/tools")
def add_project_tool(uuid: str, request: ToolAddRequest):
    """Adiciona uma ferramenta a um projeto."""
    try:
        tool_data = {
            "tool_slug": request.tool_slug,
            "tool_name": request.tool_name,
            "description": request.description,
            "main_py": request.main_py,
            "requirements_txt": request.requirements_txt,
            "parameters": request.parameters
        }
        return project_service.add_tool(uuid, tool_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{uuid}/tools/{slug}")
def delete_project_tool(uuid: str, slug: str):
    """Remove uma ferramenta de um projeto."""
    try:
        return project_service.delete_tool(uuid, slug)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{uuid}/tools/{slug}/source")
def get_tool_source(uuid: str, slug: str):
    """Obtém o código fonte de uma ferramenta."""
    try:
        return project_service.get_tool_source(uuid, slug)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{uuid}/tools/{slug}/source")
def update_tool_source(uuid: str, slug: str, request: ToolSourceUpdateRequest):
    """Atualiza o código fonte de uma ferramenta."""
    try:
        return project_service.update_tool_source(
            uuid, 
            slug, 
            request.main_py, 
            request.requirements_txt
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# =============================================================================
# AGENT PREVIEW (AI-powered)
# =============================================================================

@router.post("/preview")
async def preview_agent(request: AgentPreviewRequest):
    """Gera preview de configuração de agente usando IA."""
    print(f"[AgentPreview] IA configurada: {ai_service.is_configured}")
    
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400, 
            detail="IA não configurada. Configure primeiro nas configurações."
        )
    
    try:
        # Busca prompt configurável do sistema
        prompt_config = prompt_service.get_prompt("agent_creation")
        print(f"[AgentPreview] Prompt encontrado: {prompt_config is not None}")
        
        if prompt_config:
            system_prompt = prompt_config.system_prompt
            user_prompt = prompt_config.user_prompt_template.format(
                agent_name=request.name,
                agent_goal=request.goal
            )
            temperature = prompt_config.temperature
            max_tokens = prompt_config.max_tokens or 2000
        else:
            # Fallback para prompt padrão
            system_prompt = "Você é um Arquiteto de Agentes da plataforma Weni."
            user_prompt = f"Crie configuração para agente '{request.name}' com objetivo: {request.goal}"
        
        response = await ai_service.generate(user_prompt, system_prompt=system_prompt)
        
        # Parse JSON
        response = response.strip()
        if response.startswith("```"):
            lines = response.split("\n")
            response = "\n".join(lines[1:-1])
            if response.startswith("json"):
                response = response[4:]
        
        import json
        
        # Log para debug
        print(f"[AgentPreview] Resposta da IA (primeiros 500 chars): {response[:500]}")
        
        ai_data = json.loads(response)
        
        return {
            "preview": True,
            "source": "ai",
            "prompt_used": prompt_config.id if prompt_config else "default",
            "suggested_config": {
                "name": ai_data.get("name", request.name),
                "instructions": ai_data.get("instructions", ""),
                "guardrails": ai_data.get("guardrails", []),
                "skills": ai_data.get("skills", [])
            }
        }
        
    except Exception as e:
        # Log do erro
        print(f"[AgentPreview] ERRO: {str(e)}")
        # Fallback inteligente
        skills = []
        goal_lower = request.goal.lower()
        
        if any(word in goal_lower for word in ["venda", "produto", "compra", "pedido", "loja"]):
            skills.append({"name": "buscar_produto", "description": "Buscar produtos no catálogo"})
            skills.append({"name": "criar_pedido", "description": "Criar novo pedido"})
            skills.append({"name": "consultar_pedido", "description": "Consultar status de pedido"})
        elif any(word in goal_lower for word in ["suporte", "ajuda", "dúvida", "problema"]):
            skills.append({"name": "consultar_faq", "description": "Consultar base de conhecimento"})
            skills.append({"name": "abrir_ticket", "description": "Abrir chamado de suporte"})
            skills.append({"name": "transferir_atendimento", "description": "Transferir para atendente humano"})
        elif any(word in goal_lower for word in ["agendamento", "agenda", "reserva", "horário"]):
            skills.append({"name": "verificar_disponibilidade", "description": "Verificar horários disponíveis"})
            skills.append({"name": "agendar", "description": "Realizar agendamento"})
            skills.append({"name": "cancelar_agendamento", "description": "Cancelar agendamento existente"})
        else:
            skills.append({"name": "responder_pergunta", "description": "Responder perguntas gerais"})
            skills.append({"name": "buscar_informacao", "description": "Buscar informações relevantes"})
        
        return {
            "preview": True,
            "source": "fallback",
            "suggested_config": {
                "name": request.name,
                "instructions": [
                    f"Você é um assistente especializado em: {request.goal}.",
                    "Seja sempre educado, objetivo e útil nas respostas.",
                    "Se não souber a resposta, informe ao usuário e ofereça alternativas.",
                    "Mantenha o foco no tema principal da conversa."
                ],
                "guardrails": ["Não discuta tópicos sensíveis como política, religião ou conteúdo proibido."],
                "skills": skills
            },
            "fallback_reason": str(e)
        }


@router.post("/{uuid}/yaml/improve")
async def improve_project_yaml(uuid: str, request: YamlImprovementRequest):
    """Melhora o YAML de um projeto usando IA."""
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400, 
            detail="IA não configurada. Configure primeiro nas configurações."
        )
    
    # Busca YAML atual
    try:
        current_yaml = project_service.get_project_yaml(uuid)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    try:
        # Busca prompt de melhoria
        prompt_config = prompt_service.get_prompt("yaml_improvement")
        
        if prompt_config:
            system_prompt = prompt_config.system_prompt
            user_prompt = prompt_config.user_prompt_template.format(
                current_yaml=current_yaml,
                agent_goal=request.goal or "Não especificado",
                improvement_instructions=request.instructions or "Melhore a formatação e qualidade geral."
            )
        else:
            system_prompt = "Você é um especialista em configuração de agentes Weni."
            user_prompt = f"Melhore este YAML:\n{current_yaml}"
        
        response = await ai_service.generate(user_prompt, system_prompt=system_prompt)
        
        # Limpa resposta
        improved_yaml = response.strip()
        if improved_yaml.startswith("```"):
            lines = improved_yaml.split("\n")
            # Remove primeira e última linha (```)
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            improved_yaml = "\n".join(lines)
        
        return {
            "status": "improved",
            "original_yaml": current_yaml,
            "improved_yaml": improved_yaml,
            "prompt_used": prompt_config.id if prompt_config else "default"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao melhorar YAML: {str(e)}")

