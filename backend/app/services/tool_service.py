"""
Serviço de Geração de Tools.
Gera código de ferramentas (tools) para agentes usando IA.
"""
import json
import re
import requests
from typing import Optional, Dict, Any, List
from bs4 import BeautifulSoup

from .ai_service import ai_service
from .prompt_service import prompt_service


class ToolService:
    """Serviço para geração e gerenciamento de tools."""
    
    # Biblioteca de tools oficiais
    OFFICIAL_TOOLS = [
        {
            "slug": "vtex_get_order",
            "name": "VTEX Get Order",
            "description": "Consulta informações de pedido na VTEX",
            "category": "e-commerce",
            "parameters": [
                {"name": "order_id", "type": "string", "description": "ID do pedido VTEX", "required": True}
            ]
        },
        {
            "slug": "vtex_search_products",
            "name": "VTEX Search Products",
            "description": "Busca produtos no catálogo VTEX",
            "category": "e-commerce",
            "parameters": [
                {"name": "query", "type": "string", "description": "Termo de busca", "required": True},
                {"name": "limit", "type": "integer", "description": "Limite de resultados", "required": False}
            ]
        },
        {
            "slug": "vtex_update_address",
            "name": "VTEX Update Address",
            "description": "Atualiza endereço de entrega de um pedido",
            "category": "e-commerce",
            "parameters": [
                {"name": "order_id", "type": "string", "description": "ID do pedido", "required": True},
                {"name": "address", "type": "object", "description": "Novo endereço", "required": True}
            ]
        },
        {
            "slug": "zendesk_create_ticket",
            "name": "Zendesk Create Ticket",
            "description": "Cria um ticket de suporte no Zendesk",
            "category": "support",
            "parameters": [
                {"name": "subject", "type": "string", "description": "Assunto do ticket", "required": True},
                {"name": "description", "type": "string", "description": "Descrição do problema", "required": True},
                {"name": "priority", "type": "string", "description": "Prioridade (low, normal, high, urgent)", "required": False}
            ]
        },
        {
            "slug": "zendesk_get_ticket",
            "name": "Zendesk Get Ticket",
            "description": "Consulta um ticket no Zendesk",
            "category": "support",
            "parameters": [
                {"name": "ticket_id", "type": "string", "description": "ID do ticket", "required": True}
            ]
        },
        {
            "slug": "google_sheets_read",
            "name": "Google Sheets Read",
            "description": "Lê dados de uma planilha Google Sheets",
            "category": "data",
            "parameters": [
                {"name": "spreadsheet_id", "type": "string", "description": "ID da planilha", "required": True},
                {"name": "range", "type": "string", "description": "Range de células (ex: Sheet1!A1:B10)", "required": True}
            ]
        },
        {
            "slug": "google_sheets_write",
            "name": "Google Sheets Write",
            "description": "Escreve dados em uma planilha Google Sheets",
            "category": "data",
            "parameters": [
                {"name": "spreadsheet_id", "type": "string", "description": "ID da planilha", "required": True},
                {"name": "range", "type": "string", "description": "Range de células", "required": True},
                {"name": "values", "type": "array", "description": "Valores a serem escritos", "required": True}
            ]
        },
        {
            "slug": "http_request",
            "name": "HTTP Request",
            "description": "Faz requisições HTTP genéricas",
            "category": "integration",
            "parameters": [
                {"name": "url", "type": "string", "description": "URL do endpoint", "required": True},
                {"name": "method", "type": "string", "description": "Método HTTP (GET, POST, PUT, DELETE)", "required": True},
                {"name": "headers", "type": "object", "description": "Headers da requisição", "required": False},
                {"name": "body", "type": "object", "description": "Body da requisição", "required": False}
            ]
        },
        {
            "slug": "correios_tracking",
            "name": "Correios Tracking",
            "description": "Rastreia encomendas dos Correios",
            "category": "logistics",
            "parameters": [
                {"name": "tracking_code", "type": "string", "description": "Código de rastreamento", "required": True}
            ]
        },
        {
            "slug": "intelipost_tracking",
            "name": "Intelipost Tracking",
            "description": "Rastreia encomendas via Intelipost",
            "category": "logistics",
            "parameters": [
                {"name": "order_id", "type": "string", "description": "ID do pedido", "required": True}
            ]
        },
        {
            "slug": "whatsapp_send_message",
            "name": "WhatsApp Send Message",
            "description": "Envia mensagem via WhatsApp Business API",
            "category": "messaging",
            "parameters": [
                {"name": "phone", "type": "string", "description": "Número de telefone", "required": True},
                {"name": "message", "type": "string", "description": "Mensagem a enviar", "required": True},
                {"name": "template_name", "type": "string", "description": "Nome do template (opcional)", "required": False}
            ]
        },
        {
            "slug": "email_send",
            "name": "Email Send",
            "description": "Envia email via SMTP ou API",
            "category": "messaging",
            "parameters": [
                {"name": "to", "type": "string", "description": "Destinatário", "required": True},
                {"name": "subject", "type": "string", "description": "Assunto", "required": True},
                {"name": "body", "type": "string", "description": "Corpo do email", "required": True}
            ]
        }
    ]
    
    def get_official_tools(self, category: Optional[str] = None) -> List[Dict]:
        """Retorna lista de tools oficiais, opcionalmente filtrada por categoria."""
        if category:
            return [t for t in self.OFFICIAL_TOOLS if t.get('category') == category]
        return self.OFFICIAL_TOOLS
    
    def get_official_tool(self, slug: str) -> Optional[Dict]:
        """Obtém uma tool oficial pelo slug."""
        for tool in self.OFFICIAL_TOOLS:
            if tool['slug'] == slug:
                return tool
        return None
    
    async def fetch_url_content(self, url: str) -> str:
        """Busca e limpa conteúdo de uma URL."""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            
            # Parse HTML e extrai texto
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove scripts e styles
            for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
                tag.decompose()
            
            # Extrai texto
            text = soup.get_text(separator='\n', strip=True)
            
            # Limpa linhas vazias múltiplas
            text = re.sub(r'\n\s*\n', '\n\n', text)
            
            return text[:30000]  # Limita tamanho
            
        except Exception as e:
            raise ValueError(f"Erro ao buscar URL: {e}")
    
    async def generate_tool(
        self, 
        documentation: str = "",
        url: Optional[str] = None,
        tool_name: Optional[str] = None,
        tool_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Gera código de uma tool a partir de documentação."""
        context_text = documentation
        
        # Busca conteúdo de URL se fornecida
        if url:
            url_content = await self.fetch_url_content(url)
            context_text += f"\n\n--- Conteúdo de {url} ---\n\n{url_content}"
        
        if not context_text.strip():
            raise ValueError("Forneça documentação ou URL válida")
        
        # Tenta usar prompt configurável
        prompt_config = prompt_service.get_prompt("tool_generation")
        
        if prompt_config:
            system_prompt = prompt_config.system_prompt
            user_prompt = prompt_config.user_prompt_template.format(
                tool_name=tool_name or "Ferramenta",
                tool_description=tool_description or "Sem descrição específica",
                documentation=context_text
            )
        else:
            # Fallback para prompt padrão
            system_prompt = """Você é um desenvolvedor Python especialista em criar ferramentas para agentes de IA.
Sua tarefa é converter documentação de API em uma ferramenta Python pronta para produção.

Retorne APENAS um JSON válido (sem markdown, sem código antes ou depois):
{
    "tool_slug": "string (snake_case, ex: vtex_get_order)",
    "tool_name": "string (Title Case, ex: VTEX Get Order)",
    "description": "string (descrição clara da ferramenta)",
    "main_py": "string (código Python completo)",
    "requirements_txt": "string (dependências, uma por linha)",
    "parameters": [
        {"name": "param_name", "type": "string|integer|boolean|object|array", "description": "Descrição do parâmetro", "required": true/false}
    ]
}

REGRAS DO CÓDIGO:
1. Crie uma função Run() (R maiúsculo) que recebe parâmetros diretamente
2. Use type hints em todos os parâmetros
3. NUNCA hardcode API keys - receba como parâmetro api_key
4. Use try/except para tratar erros
5. Retorne sempre um dict com 'success' (boolean) e 'data' ou 'error'
6. Adicione docstrings com Args e Returns
7. Imports no topo, organizados
"""
            
            extra_context = ""
            if tool_name:
                extra_context += f"\nNome da tool: {tool_name}"
            if tool_description:
                extra_context += f"\nDescrição: {tool_description}"
            
            user_prompt = f"""Crie uma ferramenta Python para agentes de IA baseada nesta documentação:
{extra_context}

DOCUMENTAÇÃO/REFERÊNCIA:
{context_text}

Gere o JSON com a tool completa:"""

        response = await ai_service.generate(user_prompt, system_prompt)
        
        # Parse response
        response = response.strip()
        if response.startswith("```"):
            lines = response.split("\n")
            response = "\n".join(lines[1:-1])
            if response.startswith("json"):
                response = response[4:]
        
        try:
            tool_data = json.loads(response)
            return tool_data
        except json.JSONDecodeError as e:
            raise ValueError(f"Erro ao parsear resposta da IA: {e}")
    
    async def generate_tool_from_official(self, slug: str) -> Dict[str, Any]:
        """Gera código completo para uma tool oficial."""
        tool = self.get_official_tool(slug)
        if not tool:
            raise ValueError(f"Tool não encontrada: {slug}")
        
        # Gera código base para a tool
        system_prompt = """Você é um desenvolvedor Python especialista.
Gere código Python completo e funcional para a ferramenta descrita.

Retorne APENAS um JSON válido:
{
    "main_py": "código Python completo",
    "requirements_txt": "dependências"
}

O código deve:
1. Ter classe Run com método execute(self, context)
2. Usar context.get('parameters', {}) para parâmetros
3. Usar context.get('credentials', {}) para credenciais (API keys, tokens)
4. Tratar erros com try/except
5. Retornar dict com 'status' e 'data' ou 'message'
"""

        params_desc = "\n".join([
            f"- {p['name']} ({p['type']}): {p['description']} {'[OBRIGATÓRIO]' if p.get('required') else '[opcional]'}"
            for p in tool['parameters']
        ])
        
        prompt = f"""Gere código Python para esta ferramenta:

Nome: {tool['name']}
Slug: {tool['slug']}
Descrição: {tool['description']}
Categoria: {tool['category']}

Parâmetros:
{params_desc}

Gere código funcional e bem documentado:"""

        response = await ai_service.generate(prompt, system_prompt)
        
        response = response.strip()
        if response.startswith("```"):
            lines = response.split("\n")
            response = "\n".join(lines[1:-1])
            if response.startswith("json"):
                response = response[4:]
        
        try:
            code_data = json.loads(response)
            
            return {
                "tool_slug": tool['slug'],
                "tool_name": tool['name'],
                "description": tool['description'],
                "main_py": code_data.get('main_py', ''),
                "requirements_txt": code_data.get('requirements_txt', 'requests\n'),
                "parameters": tool['parameters']
            }
        except json.JSONDecodeError:
            # Fallback: gera código template
            return self._generate_template_tool(tool)
    
    def _generate_template_tool(self, tool: Dict) -> Dict[str, Any]:
        """Gera código template para uma tool."""
        params_code = ""
        for p in tool['parameters']:
            required = p.get('required', False)
            if required:
                params_code += f"""
        {p['name']} = params.get('{p['name']}')
        if not {p['name']}:
            return {{'status': 'error', 'message': "Parâmetro '{p['name']}' é obrigatório"}}
"""
            else:
                default = 'None' if p['type'] == 'string' else '{}' if p['type'] == 'object' else '[]' if p['type'] == 'array' else 'None'
                params_code += f"""
        {p['name']} = params.get('{p['name']}', {default})
"""

        main_py = f'''"""
Tool: {tool['name']}
Description: {tool['description']}
Category: {tool['category']}
"""
import requests
from typing import Dict, Any


class Run:
    """Executor para {tool['name']}."""
    
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executa a lógica da tool.
        
        Args:
            context: Dict com 'parameters' e 'credentials'
            
        Returns:
            Dict com 'status' e 'data' ou 'message'
        """
        try:
            params = context.get('parameters', {{}})
            creds = context.get('credentials', {{}})
{params_code}
            
            # TODO: Implementar lógica específica da tool
            # api_key = creds.get('api_key')
            # base_url = creds.get('base_url')
            
            # Placeholder - substitua pela implementação real
            result = {{
                "message": "Tool executada com sucesso",
                "tool": "{tool['slug']}",
                "params_received": params
            }}
            
            return {{
                'status': 'success',
                'data': result
            }}
            
        except Exception as e:
            return {{
                'status': 'error',
                'message': str(e)
            }}
'''
        
        return {
            "tool_slug": tool['slug'],
            "tool_name": tool['name'],
            "description": tool['description'],
            "main_py": main_py,
            "requirements_txt": "requests>=2.28.0\n",
            "parameters": tool['parameters']
        }
    
    async def improve_tool(self, current_code: str, feedback: str) -> Dict[str, Any]:
        """Melhora código de uma tool baseado em feedback."""
        system_prompt = """Você é um revisor de código Python especialista.
Melhore o código da ferramenta baseado no feedback fornecido.

Retorne APENAS um JSON válido:
{
    "main_py": "código Python melhorado",
    "changes": ["lista de mudanças feitas"]
}

Mantenha a estrutura (classe Run, método execute) e melhore:
- Tratamento de erros
- Documentação
- Performance
- Clareza do código
"""

        prompt = f"""Melhore este código de ferramenta:

CÓDIGO ATUAL:
```python
{current_code}
```

FEEDBACK/MELHORIAS SOLICITADAS:
{feedback}

Gere a versão melhorada:"""

        response = await ai_service.generate(prompt, system_prompt)
        
        response = response.strip()
        if response.startswith("```"):
            lines = response.split("\n")
            response = "\n".join(lines[1:-1])
            if response.startswith("json"):
                response = response[4:]
        
        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            raise ValueError(f"Erro ao parsear resposta: {e}")


# Instância global
tool_service = ToolService()

