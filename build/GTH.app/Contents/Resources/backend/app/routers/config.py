"""
Router para configurações da aplicação.
"""
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from ..models import ConfigUpdate, AppStatus, AIProvider
from ..services import github_service, ai_service, agent_service
from ..core import settings

router = APIRouter(prefix="/config", tags=["Configuração"])

# Arquivo para persistir configurações
CONFIG_FILE = settings.REPOS_BASE_DIR.parent / "app_config.json"


def load_saved_config():
    """Carrega configurações salvas do arquivo."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_config(config: dict):
    """Salva configurações no arquivo."""
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    existing = load_saved_config()
    existing.update(config)
    with open(CONFIG_FILE, "w") as f:
        json.dump(existing, f, indent=2)


async def restore_config():
    """Restaura configurações salvas ao iniciar."""
    config = load_saved_config()
    
    if config.get("github_token"):
        github_service.token = config["github_token"]
    
    if config.get("ai_api_key") and config.get("ai_provider"):
        try:
            ai_service.configure(
                provider=config["ai_provider"],
                api_key=config["ai_api_key"],
                model=config.get("ai_model")
            )
        except Exception as e:
            print(f"Erro ao restaurar config de IA: {e}")


# Restaura config ao carregar o módulo
import asyncio
try:
    # Tenta restaurar de forma síncrona
    config = load_saved_config()
    if config.get("github_token"):
        github_service.token = config["github_token"]
    if config.get("ai_api_key") and config.get("ai_provider"):
        ai_service.configure(
            provider=config["ai_provider"],
            api_key=config["ai_api_key"],
            model=config.get("ai_model")
        )
        print(f"✅ Configurações restauradas: GitHub={'✓' if config.get('github_token') else '✗'}, AI={config.get('ai_provider', '✗')}")
except Exception as e:
    print(f"⚠️ Erro ao restaurar configurações: {e}")


@router.get("/status", response_model=AppStatus)
async def get_status():
    """Retorna o status atual da aplicação."""
    return AppStatus(
        github_configured=github_service.token is not None,
        ai_configured=ai_service.is_configured,
        ai_provider=ai_service.provider_type,
        ai_model=ai_service.model,
        repositories_count=0,
        knowledge_bases_count=len(agent_service.knowledge_bases)
    )


@router.post("/update")
async def update_config(config: ConfigUpdate):
    """Atualiza as configurações da aplicação."""
    config_to_save = {}
    
    if config.github_token:
        github_service.token = config.github_token
        config_to_save["github_token"] = config.github_token
        # Testa a conexão
        try:
            await github_service.get_user()
        except Exception as e:
            raise HTTPException(
                status_code=400, 
                detail=f"Token GitHub inválido: {str(e)}"
            )
    
    if config.ai_api_key and config.ai_provider:
        try:
            ai_service.configure(
                provider=config.ai_provider,
                api_key=config.ai_api_key,
                model=config.ai_model
            )
            config_to_save["ai_provider"] = config.ai_provider
            config_to_save["ai_api_key"] = config.ai_api_key
            if config.ai_model:
                config_to_save["ai_model"] = config.ai_model
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Erro ao configurar IA: {str(e)}"
            )
    
    # Salva configurações no arquivo
    if config_to_save:
        save_config(config_to_save)
    
    return {"message": "Configuração atualizada com sucesso"}


@router.get("/ai-models")
async def get_available_models():
    """Retorna os modelos disponíveis para cada provedor."""
    return {
        "openai": [
            {"id": "gpt-4-turbo-preview", "name": "GPT-4 Turbo"},
            {"id": "gpt-4", "name": "GPT-4"},
            {"id": "gpt-4o", "name": "GPT-4o"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
        ],
        "gemini": [
            {"id": "gemini-pro", "name": "Gemini Pro"},
            {"id": "gemini-pro-vision", "name": "Gemini Pro Vision"},
        ]
    }

