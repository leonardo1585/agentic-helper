"""
Serviço de integração com Weni Cloud.
Permite autenticação OAuth e listagem de projetos.
"""
import os
import json
import ssl
import aiohttp
import asyncio
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Optional, List, Dict, Any
from pathlib import Path
from datetime import datetime
from queue import Queue

from ..core import settings

# Contexto SSL que não verifica certificados (para desenvolvimento)
# Em produção, considere usar certificados válidos
SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE

# Timeout padrão para requisições HTTP (45 segundos total, 15 segundos para conectar)
DEFAULT_TIMEOUT = aiohttp.ClientTimeout(total=45, connect=15)

# Arquivo para armazenar token
CONFIG_FILE = Path(__file__).parent.parent.parent.parent / "app_config.json"

# Fila para comunicação entre o servidor de callback e o serviço principal
auth_code_queue: Queue = Queue()


def _load_config() -> Dict:
    """Carrega configuração."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except:
            pass
    return {}


def _save_config(config: Dict):
    """Salva configuração."""
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """Handler HTTP para receber callback OAuth."""
    
    def log_message(self, format, *args):
        """Silencia logs do servidor HTTP."""
        pass
    
    def do_GET(self):
        """Processa requisição GET do callback."""
        parsed = urlparse(self.path)
        
        if parsed.path == "/sso-callback":
            query_params = parse_qs(parsed.query)
            code = query_params.get("code", [None])[0]
            error = query_params.get("error", [None])[0]
            
            if code:
                auth_code_queue.put({"code": code})
                self._send_success_page()
            elif error:
                auth_code_queue.put({"error": error})
                self._send_error_page(error)
            else:
                auth_code_queue.put({"error": "No code received"})
                self._send_error_page("No code received")
        else:
            self.send_error(404, "Not Found")
    
    def _send_success_page(self):
        """Envia página de sucesso."""
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>Login Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #00DED2 0%, #00B8AE 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            color: #333;
        }
        .success-icon { font-size: 48px; margin-bottom: 16px; }
        h1 { margin: 0 0 8px 0; font-size: 24px; }
        p { margin: 0; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>Login realizado!</h1>
        <p>Você pode fechar esta janela.</p>
    </div>
    <script>
        if (window.opener) {
            window.opener.postMessage({ type: 'weni-auth-callback-success' }, '*');
        }
        setTimeout(() => window.close(), 2000);
    </script>
</body>
</html>'''
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode())
    
    def _send_error_page(self, error: str):
        """Envia página de erro."""
        html = f'''<!DOCTYPE html>
<html>
<head>
    <title>Login Error</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }}
        .container {{
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }}
        .error-icon {{ font-size: 48px; margin-bottom: 16px; }}
        h1 {{ margin: 0 0 8px 0; font-size: 24px; color: #e74c3c; }}
        p {{ margin: 0; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">❌</div>
        <h1>Erro no Login</h1>
        <p>{error}</p>
    </div>
    <script>
        if (window.opener) {{
            window.opener.postMessage({{ type: 'weni-auth-callback-error', error: '{error}' }}, '*');
        }}
        setTimeout(() => window.close(), 3000);
    </script>
</body>
</html>'''
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode())


class WeniService:
    """Serviço para integração com Weni Cloud."""
    
    def __init__(self):
        self._token: Optional[str] = None
        self._callback_server: Optional[HTTPServer] = None
        self._server_thread: Optional[threading.Thread] = None
        self._load_token()
    
    def _load_token(self):
        """Carrega token do arquivo de config."""
        config = _load_config()
        self._token = config.get("weni_token")
    
    def _save_token(self, token: str):
        """Salva token no arquivo de config."""
        config = _load_config()
        config["weni_token"] = token
        config["weni_token_saved_at"] = datetime.now().isoformat()
        _save_config(config)
        self._token = token
    
    def clear_token(self):
        """Remove token salvo."""
        config = _load_config()
        if "weni_token" in config:
            del config["weni_token"]
        if "weni_token_saved_at" in config:
            del config["weni_token_saved_at"]
        _save_config(config)
        self._token = None
    
    @property
    def token(self) -> Optional[str]:
        """Retorna token atual."""
        self._load_token()
        return self._token
    
    @property
    def is_connected(self) -> bool:
        """Verifica se está conectado."""
        return bool(self._token)
    
    def start_callback_server(self, port: int = 50051) -> bool:
        """
        Inicia servidor HTTP para receber callback OAuth.
        
        Args:
            port: Porta para o servidor (padrão: 50051)
            
        Returns:
            True se iniciou com sucesso
        """
        try:
            # Limpa a fila
            while not auth_code_queue.empty():
                auth_code_queue.get_nowait()
            
            self._callback_server = HTTPServer(("localhost", port), OAuthCallbackHandler)
            self._server_thread = threading.Thread(target=self._callback_server.serve_forever)
            self._server_thread.daemon = True
            self._server_thread.start()
            return True
        except OSError as e:
            # Porta já em uso
            print(f"Could not start callback server on port {port}: {e}")
            return False
    
    def stop_callback_server(self):
        """Para o servidor de callback."""
        if self._callback_server:
            self._callback_server.shutdown()
            self._callback_server = None
        if self._server_thread:
            self._server_thread.join(timeout=1)
            self._server_thread = None
    
    async def wait_for_auth_code(self, timeout: int = 300) -> Dict[str, Any]:
        """
        Aguarda código de autorização do callback.
        
        Args:
            timeout: Tempo máximo de espera em segundos
            
        Returns:
            Dict com 'code' ou 'error'
        """
        import time
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                result = auth_code_queue.get_nowait()
                return result
            except:
                await asyncio.sleep(0.5)
        
        return {"error": "Timeout waiting for authentication"}
    
    def get_login_url(self, redirect_uri: str = None) -> str:
        """
        Gera URL para login OAuth.
        
        Args:
            redirect_uri: URL de callback após login (usa padrão das settings se não fornecido)
            
        Returns:
            URL completa para iniciar login
        """
        uri = redirect_uri or settings.WENI_REDIRECT_URI
        return (
            f"{settings.WENI_ACCOUNTS_URL}/auth/realms/{settings.WENI_REALM}/protocol/openid-connect/auth"
            f"?client_id={settings.WENI_CLIENT_ID}"
            f"&redirect_uri={uri}"
            f"&response_type=code"
        )
    
    async def exchange_code_for_token(self, code: str, redirect_uri: str = None) -> Dict[str, Any]:
        """
        Troca código de autorização por token de acesso.
        
        Args:
            code: Código recebido do callback OAuth
            redirect_uri: Mesma URI usada no login (usa padrão das settings se não fornecido)
            
        Returns:
            Dict com access_token e outras informações
        """
        uri = redirect_uri or settings.WENI_REDIRECT_URI
        token_url = f"{settings.WENI_ACCOUNTS_URL}/auth/realms/{settings.WENI_REALM}/protocol/openid-connect/token"
        
        data = {
            "grant_type": "authorization_code",
            "client_id": settings.WENI_CLIENT_ID,
            "code": code,
            "redirect_uri": uri
        }
        
        connector = aiohttp.TCPConnector(ssl=SSL_CONTEXT)
        try:
            async with aiohttp.ClientSession(connector=connector, timeout=DEFAULT_TIMEOUT) as session:
                async with session.post(token_url, data=data) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"Failed to exchange code for token: {error_text}")
                    
                    result = await response.json()
                    
                    # Salva o token
                    if "access_token" in result:
                        self._save_token(result["access_token"])
                    
                    return result
        except asyncio.TimeoutError:
            raise Exception("Timeout ao conectar com a API da Weni. Tente novamente.")
        except aiohttp.ClientError as e:
            raise Exception(f"Erro de conexão com a API da Weni: {str(e)}")
    
    async def list_organizations(self, url: str = None) -> Dict[str, Any]:
        """
        Lista organizações do usuário.
        
        Args:
            url: URL completa para requisição (usa URL base se não fornecida)
            
        Returns:
            Dict com 'results' (lista de orgs) e 'next' (URL da próxima página com cursor)
        """
        if not self._token:
            raise Exception("Not authenticated. Please login first.")
        
        # Usa URL fornecida ou URL base
        request_url = url or f"{settings.WENI_API_URL}/v2/organizations/"
        
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json"
        }
        
        connector = aiohttp.TCPConnector(ssl=SSL_CONTEXT)
        try:
            async with aiohttp.ClientSession(connector=connector, timeout=DEFAULT_TIMEOUT) as session:
                async with session.get(request_url, headers=headers) as response:
                    if response.status == 401:
                        self.clear_token()
                        raise Exception("Token expired. Please login again.")
                
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"Failed to list organizations: {error_text}")
                
                    return await response.json()
        except asyncio.TimeoutError:
            raise Exception("Timeout ao conectar com a API da Weni. Tente novamente.")
        except aiohttp.ClientError as e:
            raise Exception(f"Erro de conexão com a API da Weni: {str(e)}")
    
    async def list_projects(self, org_uuid: str = None, url: str = None) -> Dict[str, Any]:
        """
        Lista projetos de uma organização.
        
        Args:
            org_uuid: UUID da organização (usado na primeira request)
            url: URL completa para requisição (usado para paginação com cursor)
            
        Returns:
            Dict com 'results' (lista de projetos) e 'next' (URL da próxima página)
        """
        if not self._token:
            raise Exception("Not authenticated. Please login first.")
        
        # Usa URL fornecida (cursor) ou constrói URL base
        if url:
            request_url = url
        elif org_uuid:
            request_url = f"{settings.WENI_API_URL}/v2/organizations/{org_uuid}/projects"
        else:
            raise Exception("org_uuid ou url é obrigatório")
        
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json"
        }
        
        connector = aiohttp.TCPConnector(ssl=SSL_CONTEXT)
        try:
            async with aiohttp.ClientSession(connector=connector, timeout=DEFAULT_TIMEOUT) as session:
                async with session.get(request_url, headers=headers) as response:
                    if response.status == 401:
                        self.clear_token()
                        raise Exception("Token expired. Please login again.")
                
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"Failed to list projects: {error_text}")
                
                    return await response.json()
        except asyncio.TimeoutError:
            raise Exception("Timeout ao conectar com a API da Weni. Tente novamente.")
        except aiohttp.ClientError as e:
            raise Exception(f"Erro de conexão com a API da Weni: {str(e)}")
    
    async def _fetch_all_org_projects(self, org_uuid: str) -> List[Dict[str, Any]]:
        """
        Busca TODOS os projetos de uma organização usando cursor-based pagination.
        
        Args:
            org_uuid: UUID da organização
            
        Returns:
            Lista de projetos (sem duplicatas)
        """
        # Usa dict para deduplicação por UUID
        projects_by_uuid = {}
        next_url = None  # Primeira request usa org_uuid
        page_count = 0
        max_pages = 100  # Limite de segurança
        
        while page_count < max_pages:
            page_count += 1
            
            try:
                # Primeira request usa org_uuid, as seguintes usam next_url
                if next_url:
                    response = await self.list_projects(url=next_url)
                else:
                    response = await self.list_projects(org_uuid=org_uuid)
                
                results = response.get("results", [])
                
                # Adiciona projetos (deduplicação por UUID)
                for project in results:
                    uuid = project.get("uuid")
                    if uuid and uuid not in projects_by_uuid:
                        projects_by_uuid[uuid] = project
                
                # Pega URL da próxima página (cursor-based) e garante HTTPS
                next_url = self._fix_url_scheme(response.get("next"))
                
                # Se não há próxima página, termina
                if not next_url:
                    break
                    
            except Exception as e:
                print(f"[Weni] Erro ao buscar projetos página {page_count}: {e}")
                raise
        
        return list(projects_by_uuid.values())

    async def _fetch_org_projects(self, org: Dict[str, Any]) -> Dict[str, Any]:
        """
        Busca projetos de uma organização específica.
        
        Args:
            org: Dict com dados da organização
            
        Returns:
            Dict com org_name, org_uuid, projects (nunca None)
        """
        org_name = org.get("name", "Unknown")
        org_uuid = org.get("uuid")
        
        org_data = {
            "org_name": org_name,
            "org_uuid": org_uuid,
            "projects": [],
            "error": None
        }
        
        try:
            # Busca TODOS os projetos (todas as páginas)
            projects = await self._fetch_all_org_projects(org_uuid)
            
            org_data["projects"] = [
                {
                    "name": p.get("name", "Unknown"),
                    "uuid": p.get("uuid")
                }
                for p in projects
            ]
            
            print(f"[Weni]   ✓ {org_name}: {len(projects)} projetos")
            
        except Exception as e:
            error_msg = str(e)
            # Simplifica mensagem de erro
            if "500" in error_msg:
                org_data["error"] = "Erro no servidor Weni (500)"
            else:
                org_data["error"] = error_msg[:100]
            print(f"[Weni]   ✗ {org_name}: ERRO - {org_data['error']}")
        
        return org_data

    def _fix_url_scheme(self, url: str) -> str:
        """Garante que a URL use HTTPS ao invés de HTTP."""
        if url and url.startswith("http://"):
            return url.replace("http://", "https://", 1)
        return url

    async def _fetch_all_organizations(self) -> List[Dict[str, Any]]:
        """
        Busca TODAS as organizações usando cursor-based pagination.
        
        Returns:
            Lista de organizações (sem duplicatas)
        """
        print("[Weni] Buscando organizações...")
        
        # Usa dict para deduplicação por UUID
        orgs_by_uuid = {}
        next_url = None  # Primeira request usa URL base
        page_count = 0
        max_pages = 100  # Limite de segurança
        
        while page_count < max_pages:
            page_count += 1
            
            try:
                response = await self.list_organizations(next_url)
                results = response.get("results", [])
                
                # Adiciona organizações (deduplicação por UUID)
                new_count = 0
                for org in results:
                    uuid = org.get("uuid")
                    if uuid and uuid not in orgs_by_uuid:
                        orgs_by_uuid[uuid] = org
                        new_count += 1
                
                print(f"[Weni]   Página {page_count}: {len(results)} orgs ({new_count} novas)")
                
                # Pega URL da próxima página (cursor-based) e garante HTTPS
                next_url = self._fix_url_scheme(response.get("next"))
                
                # Se não há próxima página, termina
                if not next_url:
                    break
                    
            except Exception as e:
                print(f"[Weni] Erro ao buscar organizações página {page_count}: {e}")
                break
        
        all_orgs = list(orgs_by_uuid.values())
        print(f"[Weni] Total: {len(all_orgs)} organizações únicas encontradas")
        return all_orgs

    async def get_all_projects(self) -> List[Dict[str, Any]]:
        """
        Lista todos os projetos de todas as organizações.
        Usa asyncio.gather para carregar em paralelo (muito mais rápido).
        
        Returns:
            Lista de dicts com 'org_name', 'org_uuid', 'projects'
        """
        if not self._token:
            raise Exception("Not authenticated. Please login first.")
        
        # Busca TODAS as organizações (todas as páginas)
        orgs = await self._fetch_all_organizations()
        
        if not orgs:
            print("[Weni] Nenhuma organização encontrada")
            return []
        
        print(f"[Weni] Buscando projetos de {len(orgs)} organizações em paralelo...")
        
        # Busca projetos de todas as orgs EM PARALELO
        tasks = [self._fetch_org_projects(org) for org in orgs]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Processa resultados - inclui TODAS as orgs, mesmo com erro
        all_orgs = []
        errors_count = 0
        total_projects = 0
        
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                # Se asyncio.gather retornou exceção, cria org com erro
                org = orgs[i]
                all_orgs.append({
                    "org_name": org.get("name", "Unknown"),
                    "org_uuid": org.get("uuid"),
                    "projects": [],
                    "error": str(r)[:100]
                })
                errors_count += 1
            elif r is not None:
                all_orgs.append(r)
                total_projects += len(r.get("projects", []))
                if r.get("error"):
                    errors_count += 1
        
        print(f"[Weni] ═══════════════════════════════════════════")
        print(f"[Weni] ✅ Total: {len(all_orgs)} organizações")
        print(f"[Weni]    📁 {total_projects} projetos")
        if errors_count > 0:
            print(f"[Weni]    ⚠️  {errors_count} organizações com erro")
        print(f"[Weni] ═══════════════════════════════════════════")
        
        return all_orgs


# Instância global
weni_service = WeniService()

