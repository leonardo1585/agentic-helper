"""
Router para gerenciamento de prompts.
"""
from fastapi import APIRouter, HTTPException
from typing import Optional, List

from ..models.schemas import (
    PromptConfig,
    PromptCreate,
    PromptUpdate,
    PromptCategory,
    PromptTest,
    PromptTestResult
)
from ..services.prompt_service import prompt_service

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.get("/", response_model=List[PromptConfig])
async def list_prompts(category: Optional[PromptCategory] = None):
    """Lista todos os prompts."""
    return prompt_service.list_prompts(category)


@router.get("/categories")
async def list_categories():
    """Lista todas as categorias de prompts."""
    return [
        {"id": cat.value, "name": cat.name.replace("_", " ").title()}
        for cat in PromptCategory
    ]


@router.get("/{prompt_id}", response_model=PromptConfig)
async def get_prompt(prompt_id: str):
    """Retorna um prompt específico."""
    prompt = prompt_service.get_prompt(prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt não encontrado")
    return prompt


@router.post("/", response_model=PromptConfig)
async def create_prompt(data: PromptCreate):
    """Cria um novo prompt."""
    return prompt_service.create_prompt(data)


@router.put("/{prompt_id}", response_model=PromptConfig)
async def update_prompt(prompt_id: str, data: PromptUpdate):
    """Atualiza um prompt existente."""
    prompt = prompt_service.update_prompt(prompt_id, data)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt não encontrado")
    return prompt


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: str):
    """Deleta um prompt."""
    if not prompt_service.delete_prompt(prompt_id):
        raise HTTPException(status_code=404, detail="Prompt não encontrado")
    return {"message": "Prompt deletado com sucesso"}


@router.post("/{prompt_id}/duplicate", response_model=PromptConfig)
async def duplicate_prompt(prompt_id: str, new_name: str):
    """Duplica um prompt existente."""
    prompt = prompt_service.duplicate_prompt(prompt_id, new_name)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt não encontrado")
    return prompt


@router.post("/test", response_model=PromptTestResult)
async def test_prompt(test: PromptTest):
    """Testa um prompt com variáveis fornecidas."""
    try:
        return await prompt_service.test_prompt(test)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{prompt_id}/variables")
async def get_prompt_variables(prompt_id: str):
    """Retorna as variáveis necessárias para um prompt."""
    variables = prompt_service.get_prompt_variables(prompt_id)
    return {"variables": variables}

