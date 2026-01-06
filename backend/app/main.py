"""
GTH - Git Helper Tool
Aplicação principal FastAPI.
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .core import settings
from .routers import config_router, repositories_router, analysis_router, search_router, prompts_router, admin_router

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

# Registra routers da API
app.include_router(config_router, prefix="/api")
app.include_router(repositories_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(prompts_router, prefix="/api")
app.include_router(admin_router, prefix="/api")


# Serve frontend estático se existir o build
# Tenta primeiro o diretório static (produção/app), depois frontend/dist (desenvolvimento)
STATIC_DIR = Path(__file__).parent.parent / "static"
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"

# Usa static se existir (produção), senão usa frontend/dist (dev)
if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    FRONTEND_DIR = STATIC_DIR

if FRONTEND_DIR.exists() and (FRONTEND_DIR / "index.html").exists():
    # Monta assets estáticos
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")
    
    @app.get("/")
    async def serve_index():
        """Serve o frontend."""
        return FileResponse(str(FRONTEND_DIR / "index.html"))
    
    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """Serve arquivos do SPA ou fallback para index.html."""
        # Ignora rotas da API
        if path.startswith("api/"):
            return {"detail": "Not Found"}
        
        file_path = FRONTEND_DIR / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        
        # SPA fallback
        return FileResponse(str(FRONTEND_DIR / "index.html"))
else:
    @app.get("/")
    async def root():
        """Rota raiz (modo desenvolvimento)."""
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running",
            "frontend": "Use http://localhost:5173 para acessar o frontend em desenvolvimento"
        }


@app.get("/health")
async def health():
    """Health check."""
    return {"status": "healthy"}

