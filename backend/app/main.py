"""
GTH - Git Helper Tool v3
Suporte a agentes customizados.
Autenticação obrigatória via Weni Cloud/Keycloak.
"""
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from .core import settings
from .routers import (
    config_router, 
    repositories_router, 
    analysis_router, 
    search_router, 
    prompts_router,
    weni_router,
)
from .services.keycloak_auth import get_current_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida da aplicação."""
    # === STARTUP ===
    print("🚀 Iniciando GTH...")
    
    # Pré-carrega modelo de embeddings em background (não bloqueia)
    try:
        from .services.vector_service import preload_embedding_model, get_model_status
        preload_embedding_model()
        print("📥 Modelo de embeddings sendo carregado em background...")
    except Exception as e:
        print(f"⚠️ Aviso: Não foi possível iniciar pré-carregamento do modelo: {e}")
    
    yield  # App está rodando
    
    # === SHUTDOWN ===
    print("👋 Encerrando GTH...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Suporte a agentes customizados - Autenticação via Weni Cloud",
    lifespan=lifespan,
)


# Middleware de autenticação Keycloak
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """
    Middleware que verifica autenticação Keycloak em todas as requisições /api.
    Rotas públicas (login, status, health) são permitidas sem token.
    """
    path = request.url.path
    
    # Rotas públicas - não requerem autenticação
    public_paths = [
        "/api/weni/",
        "/api/config/status",
        "/health",
        "/api/system/status",
        "/docs",
        "/redoc", 
        "/openapi.json",
        "/",
        "/assets/",
    ]
    
    # Verifica se é rota pública
    is_public = any(path.startswith(p) or path == p.rstrip('/') for p in public_paths)
    
    # Se não é API ou é pública, permite
    if not path.startswith("/api/") or is_public:
        return await call_next(request)
    
    # Verifica token de autenticação
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={
                "detail": "Autenticação necessária. Faça login com Weni Cloud.",
                "login_required": True
            },
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Token presente - valida via Keycloak
    token = auth_header.replace("Bearer ", "")
    
    try:
        from .services.keycloak_auth import keycloak_auth
        user_info = await keycloak_auth.validate_token(token)
        # Armazena info do usuário no request state
        request.state.user = user_info
    except Exception as e:
        return JSONResponse(
            status_code=401,
            content={
                "detail": f"Token inválido ou expirado: {str(e)}",
                "login_required": True
            },
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return await call_next(request)

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

# Registra routers da API (v3 - suporte a agentes)
app.include_router(config_router, prefix="/api")
app.include_router(repositories_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(prompts_router, prefix="/api")
app.include_router(weni_router, prefix="/api")


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


@app.get("/api/system/status")
async def system_status():
    """Status detalhado do sistema."""
    try:
        from .services.vector_service import get_model_status
        model_status = get_model_status()
    except Exception:
        model_status = {"loaded": False, "loading": False, "error": "Não disponível"}
    
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "embedding_model": model_status
    }

