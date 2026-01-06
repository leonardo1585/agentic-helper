"""
GTH - Git Helper Tool
Aplicação principal FastAPI.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core import settings
from .routers import config_router, repositories_router, analysis_router, search_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Ferramenta para análise de repositórios e geração de base de conhecimento com IA",
)

# CORS para permitir conexões do frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000", 
        "http://127.0.0.1:5173",
        "https://free-malamute-indirectly.ngrok-free.app",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra routers
app.include_router(config_router, prefix="/api")
app.include_router(repositories_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(search_router, prefix="/api")


@app.get("/")
async def root():
    """Rota raiz."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check."""
    return {"status": "healthy"}


# Serve frontend estático em produção
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

frontend_dir = Path(__file__).parent.parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dir / "assets")), name="assets")
    
    @app.get("/")
    async def serve_frontend():
        return FileResponse(str(frontend_dir / "index.html"))
    
    @app.get("/{path:path}")
    async def serve_frontend_path(path: str):
        file_path = frontend_dir / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dir / "index.html"))
