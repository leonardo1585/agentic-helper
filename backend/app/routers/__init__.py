# v3 - Versão enxuta focada em tirar dúvidas
from .config import router as config_router
from .repositories import router as repositories_router
from .analysis import router as analysis_router
from .search import router as search_router
from .prompts import router as prompts_router

__all__ = [
    "config_router", 
    "repositories_router", 
    "analysis_router", 
    "search_router", 
    "prompts_router", 
]

