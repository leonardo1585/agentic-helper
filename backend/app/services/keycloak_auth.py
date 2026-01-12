"""
Serviço de autenticação com Keycloak/Weni Cloud.
Todas as APIs requerem token válido do Keycloak.
"""
import ssl
import aiohttp
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient

from ..core import settings


# Contexto SSL para desenvolvimento
SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE


class KeycloakAuth:
    """Serviço de autenticação com Keycloak."""
    
    def __init__(self):
        self.realm = settings.WENI_REALM
        self.client_id = settings.WENI_CLIENT_ID
        self.accounts_url = settings.WENI_ACCOUNTS_URL
        self._jwks_client: Optional[PyJWKClient] = None
        self._public_key: Optional[str] = None
    
    @property
    def issuer_url(self) -> str:
        """URL do issuer do Keycloak."""
        return f"{self.accounts_url}/realms/{self.realm}"
    
    @property
    def jwks_uri(self) -> str:
        """URL do JWKS do Keycloak."""
        return f"{self.issuer_url}/protocol/openid-connect/certs"
    
    @property
    def userinfo_url(self) -> str:
        """URL do userinfo do Keycloak."""
        return f"{self.issuer_url}/protocol/openid-connect/userinfo"
    
    async def get_public_key(self) -> str:
        """Obtém a chave pública do Keycloak para validar tokens."""
        if self._public_key:
            return self._public_key
        
        try:
            async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=SSL_CONTEXT)) as session:
                async with session.get(self.jwks_uri) as response:
                    if response.status == 200:
                        jwks = await response.json()
                        # Retorna a primeira chave RSA
                        for key in jwks.get("keys", []):
                            if key.get("kty") == "RSA":
                                self._jwks_client = PyJWKClient(self.jwks_uri)
                                return key
        except Exception as e:
            print(f"Erro ao obter chave pública do Keycloak: {e}")
        
        return None
    
    async def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Valida um token JWT do Keycloak.
        
        Returns:
            Dict com informações do usuário se válido
        
        Raises:
            HTTPException se inválido
        """
        if not token:
            raise HTTPException(
                status_code=401,
                detail="Token não fornecido",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        try:
            # Método 1: Validar via userinfo endpoint (mais confiável)
            user_info = await self._validate_via_userinfo(token)
            if user_info:
                return user_info
            
            # Método 2: Validar JWT localmente (fallback)
            return await self._validate_jwt_locally(token)
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=401,
                detail="Token expirado",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=401,
                detail=f"Token inválido: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail=f"Erro na validação do token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"}
            )
    
    async def _validate_via_userinfo(self, token: str) -> Optional[Dict[str, Any]]:
        """Valida token via endpoint userinfo do Keycloak."""
        try:
            async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=SSL_CONTEXT)) as session:
                headers = {"Authorization": f"Bearer {token}"}
                async with session.get(self.userinfo_url, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
                    return None
        except Exception as e:
            print(f"Erro ao validar via userinfo: {e}")
            return None
    
    async def _validate_jwt_locally(self, token: str) -> Dict[str, Any]:
        """Valida JWT localmente usando a chave pública do Keycloak."""
        try:
            # Decodifica sem verificar para pegar o header
            unverified = jwt.decode(token, options={"verify_signature": False})
            
            # Usa PyJWKClient para obter a chave correta
            if not self._jwks_client:
                self._jwks_client = PyJWKClient(self.jwks_uri, ssl_context=SSL_CONTEXT)
            
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            
            # Decodifica e valida
            decoded = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self.client_id,
                issuer=self.issuer_url,
                options={"verify_aud": False}  # Weni pode ter audiences diferentes
            )
            
            return decoded
            
        except Exception as e:
            print(f"Erro ao validar JWT localmente: {e}")
            raise


# Instância global
keycloak_auth = KeycloakAuth()


# Security scheme para FastAPI
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Dependency para obter usuário autenticado.
    
    Uso:
        @router.get("/protected")
        async def protected_route(user: Dict = Depends(get_current_user)):
            return {"user": user}
    """
    # Permite algumas rotas públicas
    public_paths = [
        "/api/weni/status",
        "/api/weni/login-url", 
        "/api/weni/start-auth",
        "/api/weni/wait-auth",
        "/api/weni/callback",
        "/api/weni/exchange-token",
        "/api/config/status",
        "/health",
        "/api/system/status",
        "/docs",
        "/redoc",
        "/openapi.json",
    ]
    
    # Verifica se é rota pública
    path = request.url.path
    if any(path.startswith(p) for p in public_paths):
        return None
    
    # Verifica se é requisição para assets/frontend
    if not path.startswith("/api/"):
        return None
    
    # Requer autenticação
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Autenticação necessária. Faça login com Weni Cloud.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = credentials.credentials
    return await keycloak_auth.validate_token(token)


async def optional_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[Dict[str, Any]]:
    """
    Dependency para autenticação opcional.
    Retorna None se não autenticado, não levanta erro.
    """
    if not credentials:
        return None
    
    try:
        return await keycloak_auth.validate_token(credentials.credentials)
    except:
        return None
