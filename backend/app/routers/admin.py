"""
Router para administração - autenticação e métricas.
"""
from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Optional

from ..models.schemas import (
    AdminLogin, 
    AdminLoginResponse,
    AdminPasswordChange,
    TokenUsageSummary,
    TokenUsageRecord,
    AnalysisHistory
)
from ..services.auth_service import auth_service
from ..services.metrics_service import metrics_service

router = APIRouter(prefix="/admin", tags=["admin"])


def verify_admin_token(authorization: Optional[str] = Header(None)) -> bool:
    """Verifica se o token do admin é válido."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    
    # Formato: "Bearer <token>"
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Formato de token inválido")
    
    token = parts[1]
    if not auth_service.validate_token(token):
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    
    return True


# ============================================
# AUTENTICAÇÃO
# ============================================

@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(data: AdminLogin):
    """Login do admin."""
    success, token, message = auth_service.login(data.password)
    return AdminLoginResponse(success=success, token=token, message=message)


@router.post("/logout")
async def admin_logout(authorization: Optional[str] = Header(None)):
    """Logout do admin."""
    if authorization:
        parts = authorization.split(" ")
        if len(parts) == 2:
            auth_service.logout(parts[1])
    return {"message": "Logout realizado"}


@router.post("/change-password")
async def change_password(
    data: AdminPasswordChange,
    _: bool = Depends(verify_admin_token)
):
    """Troca a senha do admin."""
    success, message = auth_service.change_password(data.current_password, data.new_password)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


@router.get("/verify")
async def verify_token(_: bool = Depends(verify_admin_token)):
    """Verifica se o token é válido."""
    return {"valid": True}


# ============================================
# MÉTRICAS DE TOKENS
# ============================================

@router.get("/metrics/summary", response_model=TokenUsageSummary)
async def get_metrics_summary(
    days: int = 30,
    _: bool = Depends(verify_admin_token)
):
    """Retorna resumo de uso de tokens."""
    return metrics_service.get_usage_summary(days)


@router.get("/metrics/recent")
async def get_recent_usage(
    limit: int = 50,
    _: bool = Depends(verify_admin_token)
):
    """Retorna registros recentes de uso de tokens."""
    records = metrics_service.get_recent_usage(limit)
    return {"records": [r.model_dump(mode="json") for r in records]}


# ============================================
# HISTÓRICO DE ANÁLISES
# ============================================

@router.get("/history", response_model=AnalysisHistory)
async def get_analysis_history(
    limit: int = 100,
    repository: Optional[str] = None,
    _: bool = Depends(verify_admin_token)
):
    """Retorna histórico de análises."""
    return metrics_service.get_analysis_history(limit, repository)


# ============================================
# PREÇOS DE TOKENS
# ============================================

@router.get("/token-prices")
async def get_token_prices(_: bool = Depends(verify_admin_token)):
    """Retorna tabela de preços de tokens."""
    from ..services.metrics_service import TOKEN_PRICES
    return TOKEN_PRICES

