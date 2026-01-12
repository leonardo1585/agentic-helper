"""
Router para integração com Weni Cloud.
Permite autenticação OAuth e listagem de projetos.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from ..services.weni_service import weni_service
from ..core import settings


router = APIRouter(prefix="/weni", tags=["weni"])


# =============================================================================
# MODELS
# =============================================================================

class TokenExchangeRequest(BaseModel):
    """Request para trocar código por token."""
    code: str
    redirect_uri: Optional[str] = None


# =============================================================================
# AUTH ENDPOINTS
# =============================================================================

@router.get("/status")
def get_weni_status():
    """Verifica status da conexão com Weni."""
    return {
        "connected": weni_service.is_connected,
        "has_token": bool(weni_service.token)
    }


@router.get("/login-url")
def get_login_url(redirect_uri: Optional[str] = Query(None, description="URL de callback (opcional, usa padrão se não fornecido)")):
    """
    Gera URL para iniciar login OAuth com Weni.
    
    O frontend deve redirecionar o usuário para esta URL.
    Após login, o usuário será redirecionado de volta para redirect_uri com um code.
    """
    return {
        "login_url": weni_service.get_login_url(redirect_uri),
        "redirect_uri": redirect_uri or settings.WENI_REDIRECT_URI
    }


@router.post("/start-auth")
async def start_auth():
    """
    Inicia o processo de autenticação OAuth.
    
    1. Inicia servidor de callback na porta 50051
    2. Retorna URL de login para o frontend abrir em nova janela
    """
    # Inicia servidor de callback
    if not weni_service.start_callback_server():
        raise HTTPException(
            status_code=500, 
            detail="Failed to start callback server. Port 50051 may be in use."
        )
    
    return {
        "login_url": weni_service.get_login_url(),
        "callback_started": True
    }


@router.get("/wait-auth")
async def wait_for_auth():
    """
    Aguarda a conclusão do OAuth e troca código por token.
    
    Deve ser chamado após start-auth enquanto o usuário faz login.
    """
    try:
        result = await weni_service.wait_for_auth_code(timeout=300)
        
        # Para o servidor após receber resposta
        weni_service.stop_callback_server()
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # Troca código por token
        code = result.get("code")
        if code:
            await weni_service.exchange_code_for_token(code)
            return {
                "success": True,
                "connected": weni_service.is_connected
            }
        
        raise HTTPException(status_code=400, detail="No authorization code received")
        
    except HTTPException:
        raise
    except Exception as e:
        weni_service.stop_callback_server()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exchange-token")
async def exchange_token(request: TokenExchangeRequest):
    """
    Troca código de autorização por token de acesso.
    
    Chamado após o callback do OAuth com o código recebido.
    """
    try:
        result = await weni_service.exchange_code_for_token(
            request.code, 
            request.redirect_uri
        )
        return {
            "success": True,
            "message": "Login successful",
            "connected": weni_service.is_connected
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/logout")
def logout():
    """Remove token salvo e desconecta."""
    weni_service.clear_token()
    return {
        "success": True,
        "message": "Logged out successfully"
    }


@router.get("/callback")
async def oauth_callback(code: str = Query(None), error: str = Query(None)):
    """
    Callback do OAuth.
    
    Esta rota recebe o código de autorização após o login.
    Retorna uma página HTML que envia mensagem para a janela pai e fecha.
    """
    if error:
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head><title>Login Error</title></head>
        <body>
            <script>
                if (window.opener) {{
                    window.opener.postMessage({{ type: 'weni-auth-error', error: '{error}' }}, '*');
                    window.close();
                }} else {{
                    document.body.innerHTML = '<h1>Error: {error}</h1><p>You can close this window.</p>';
                }}
            </script>
        </body>
        </html>
        """)
    
    if not code:
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html>
        <head><title>Login Error</title></head>
        <body>
            <script>
                if (window.opener) {
                    window.opener.postMessage({ type: 'weni-auth-error', error: 'No code received' }, '*');
                    window.close();
                } else {
                    document.body.innerHTML = '<h1>Error: No code received</h1><p>You can close this window.</p>';
                }
            </script>
        </body>
        </html>
        """)
    
    # Retorna página que envia o código para a janela pai
    return HTMLResponse(content=f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login Successful</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #00DED2 0%, #00B8AE 100%);
                color: white;
            }}
            .container {{
                text-align: center;
                padding: 40px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                color: #333;
            }}
            .success-icon {{
                font-size: 48px;
                margin-bottom: 16px;
            }}
            h1 {{
                margin: 0 0 8px 0;
                font-size: 24px;
            }}
            p {{
                margin: 0;
                color: #666;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="success-icon">✅</div>
            <h1>Login realizado!</h1>
            <p>Você pode fechar esta janela.</p>
        </div>
        <script>
            if (window.opener) {{
                window.opener.postMessage({{ type: 'weni-auth-success', code: '{code}' }}, '*');
                setTimeout(() => window.close(), 1500);
            }}
        </script>
    </body>
    </html>
    """)


# =============================================================================
# PROJECTS ENDPOINTS
# =============================================================================

@router.get("/organizations")
async def list_organizations():
    """Lista todas as organizações do usuário (todas as páginas)."""
    if not weni_service.is_connected:
        raise HTTPException(status_code=401, detail="Not connected to Weni. Please login first.")
    
    try:
        # Busca todas as organizações (todas as páginas)
        all_orgs = await weni_service._fetch_all_organizations()
        return {"results": all_orgs, "next": None}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/organizations/{org_uuid}/projects")
async def list_projects(org_uuid: str):
    """Lista todos os projetos de uma organização (todas as páginas)."""
    if not weni_service.is_connected:
        raise HTTPException(status_code=401, detail="Not connected to Weni. Please login first.")
    
    try:
        # Busca todos os projetos da organização (todas as páginas)
        all_projects = await weni_service._fetch_all_org_projects(org_uuid)
        return {"results": all_projects, "next": None}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects")
async def list_all_projects():
    """
    Lista todos os projetos de todas as organizações.
    
    Retorna estrutura hierárquica: Org > Projects
    """
    if not weni_service.is_connected:
        raise HTTPException(status_code=401, detail="Not connected to Weni. Please login first.")
    
    try:
        return await weni_service.get_all_projects()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

