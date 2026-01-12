"""
Router para geração e gerenciamento de tools.
"""
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.tool_service import tool_service
from ..services.ai_service import ai_service


router = APIRouter(prefix="/tools", tags=["tools"])


# =============================================================================
# MODELS
# =============================================================================

class ToolGenerateRequest(BaseModel):
    """Request para geração de tool."""
    documentation: Optional[str] = ""
    url: Optional[str] = None
    tool_name: Optional[str] = None
    tool_description: Optional[str] = None


class ToolImproveRequest(BaseModel):
    """Request para melhorar código de tool."""
    current_code: str
    feedback: str


# =============================================================================
# OFFICIAL TOOLS LIBRARY
# =============================================================================

@router.get("/official")
def list_official_tools(category: Optional[str] = None):
    """Lista tools da biblioteca oficial."""
    return tool_service.get_official_tools(category)


@router.get("/official/{slug}")
def get_official_tool(slug: str):
    """Obtém uma tool oficial específica."""
    tool = tool_service.get_official_tool(slug)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool não encontrada")
    return tool


@router.post("/official/{slug}/generate")
async def generate_official_tool_code(slug: str):
    """Gera código completo para uma tool oficial."""
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="IA não configurada. Configure primeiro nas configurações."
        )
    
    try:
        return await tool_service.generate_tool_from_official(slug)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# TOOL GENERATION
# =============================================================================

@router.post("/generate")
async def generate_tool(request: ToolGenerateRequest):
    """Gera código de tool a partir de documentação."""
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="IA não configurada. Configure primeiro nas configurações."
        )
    
    if not request.documentation and not request.url:
        raise HTTPException(
            status_code=400,
            detail="Forneça documentação ou URL"
        )
    
    try:
        result = await tool_service.generate_tool(
            documentation=request.documentation,
            url=request.url,
            tool_name=request.tool_name,
            tool_description=request.tool_description
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na geração: {str(e)}")


@router.post("/improve")
async def improve_tool(request: ToolImproveRequest):
    """Melhora código de uma tool baseado em feedback."""
    if not ai_service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="IA não configurada. Configure primeiro nas configurações."
        )
    
    try:
        return await tool_service.improve_tool(request.current_code, request.feedback)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na melhoria: {str(e)}")


# =============================================================================
# TOOL CATEGORIES
# =============================================================================

@router.get("/categories")
def list_categories():
    """Lista categorias de tools disponíveis."""
    tools = tool_service.get_official_tools()
    categories = {}
    
    for tool in tools:
        cat = tool.get('category', 'other')
        if cat not in categories:
            categories[cat] = {
                "name": cat.replace('-', ' ').title(),
                "count": 0,
                "tools": []
            }
        categories[cat]["count"] += 1
        categories[cat]["tools"].append(tool['slug'])
    
    return categories

