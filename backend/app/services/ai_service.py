"""
Serviço de integração com provedores de IA (OpenAI e Google Gemini).
"""
from typing import Optional, List, AsyncGenerator
from abc import ABC, abstractmethod
import json

from ..models import AIProvider
from ..core import settings


class BaseAIProvider(ABC):
    """Interface base para provedores de IA."""
    
    @abstractmethod
    async def generate(self, prompt: str, system_prompt: Optional[str] = None, force_max_tokens: bool = False) -> str:
        """Gera uma resposta baseada no prompt."""
        pass
    
    @abstractmethod
    async def generate_stream(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Gera uma resposta em streaming."""
        pass


class OpenAIProvider(BaseAIProvider):
    """Provedor OpenAI."""
    
    def __init__(self, api_key: str, model: Optional[str] = None):
        self.api_key = api_key
        self.model = model or settings.OPENAI_MODEL
        self._client = None
        # Rastreamento de tokens
        self.last_input_tokens = 0
        self.last_output_tokens = 0
        self.total_input_tokens = 0
        self.total_output_tokens = 0
    
    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=self.api_key)
        return self._client
    
    def _get_max_tokens_for_model(self, force_max: bool = False) -> int:
        """Retorna o max_tokens apropriado para o modelo atual."""
        # Limites REAIS de output por modelo (não confundir com context window):
        # - gpt-4o-mini: 4096 output tokens
        # - gpt-4o: 16384 output tokens
        # - gpt-4-turbo: 4096 output tokens
        # - gpt-4.1: varia, assumir 16384
        # - gpt-3.5-turbo: 4096 output tokens
        
        if "gpt-4o-mini" in self.model or "gpt-4.1-mini" in self.model or "gpt-3.5" in self.model:
            return 4096  # Limite fixo para mini/3.5
        elif "gpt-4o" in self.model and "mini" not in self.model:
            return 16384 if force_max else 8192
        elif "gpt-4.1" in self.model and "mini" not in self.model:
            return 16384 if force_max else 8192
        elif "gpt-4-turbo" in self.model:
            return 4096  # Turbo tem limite de 4096
        elif "gpt-4" in self.model:
            return 8192
        
        return 4096  # Default seguro
    
    async def generate(self, prompt: str, system_prompt: Optional[str] = None, force_max_tokens: bool = False) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        max_tokens = self._get_max_tokens_for_model(force_max=force_max_tokens)
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.5,  # Menor temperatura para respostas mais consistentes
            max_tokens=max_tokens
        )
        
        # Captura tokens usados
        if response.usage:
            self.last_input_tokens = response.usage.prompt_tokens
            self.last_output_tokens = response.usage.completion_tokens
            self.total_input_tokens += response.usage.prompt_tokens
            self.total_output_tokens += response.usage.completion_tokens
        
        return response.choices[0].message.content
    
    async def generate_stream(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.7,
            max_tokens=4096,
            stream=True
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class GeminiProvider(BaseAIProvider):
    """Provedor Google Gemini."""
    
    def __init__(self, api_key: str, model: Optional[str] = None):
        self.api_key = api_key
        self.model = model or settings.GEMINI_MODEL
        self._client = None
        # Rastreamento de tokens (estimado para Gemini)
        self.last_input_tokens = 0
        self.last_output_tokens = 0
        self.total_input_tokens = 0
        self.total_output_tokens = 0
    
    @property
    def client(self):
        if self._client is None:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self._client = genai.GenerativeModel(self.model)
        return self._client
    
    async def generate(self, prompt: str, system_prompt: Optional[str] = None, force_max_tokens: bool = False) -> str:
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
        
        # Gemini suporta até 8192 output tokens na maioria dos modelos
        max_tokens = 8192 if force_max_tokens else 4096
        
        response = await self.client.generate_content_async(
            full_prompt,
            generation_config={
                "temperature": 0.5,  # Menor temperatura para respostas mais consistentes
                "max_output_tokens": max_tokens,
            }
        )
        
        # Estima tokens (Gemini não retorna diretamente, ~4 chars = 1 token)
        self.last_input_tokens = len(full_prompt) // 4
        self.last_output_tokens = len(response.text) // 4 if response.text else 0
        self.total_input_tokens += self.last_input_tokens
        self.total_output_tokens += self.last_output_tokens
        
        return response.text
    
    async def generate_stream(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
        
        response = await self.client.generate_content_async(
            full_prompt,
            generation_config={
                "temperature": 0.7,
                "max_output_tokens": 4096,
            },
            stream=True
        )
        
        async for chunk in response:
            if chunk.text:
                yield chunk.text


class AIService:
    """Serviço unificado de IA."""
    
    def __init__(self):
        self._provider: Optional[BaseAIProvider] = None
        self._provider_type: Optional[AIProvider] = None
        self._api_key: Optional[str] = None
        self._model: Optional[str] = None
    
    def configure(
        self,
        provider, 
        api_key: str, 
        model: Optional[str] = None
    ):
        """Configura o provedor de IA."""
        # Converte string para enum se necessário
        if isinstance(provider, str):
            provider = AIProvider(provider)
        
        self._provider_type = provider
        self._api_key = api_key
        self._model = model
        
        if provider == AIProvider.OPENAI:
            self._provider = OpenAIProvider(api_key, model)
        elif provider == AIProvider.GEMINI:
            self._provider = GeminiProvider(api_key, model)
        else:
            raise ValueError(f"Provedor não suportado: {provider}")
    
    @property
    def is_configured(self) -> bool:
        """Verifica se o serviço está configurado."""
        return self._provider is not None
    
    @property
    def provider_type(self) -> Optional[str]:
        """Retorna o tipo de provedor configurado."""
        return self._provider_type.value if self._provider_type else None
    
    @property
    def model(self) -> Optional[str]:
        """Retorna o modelo configurado."""
        return self._model
    
    @property
    def last_tokens(self) -> tuple:
        """Retorna (input_tokens, output_tokens) da última chamada."""
        if self._provider:
            return (self._provider.last_input_tokens, self._provider.last_output_tokens)
        return (0, 0)
    
    @property
    def total_tokens(self) -> tuple:
        """Retorna (total_input, total_output) da sessão."""
        if self._provider:
            return (self._provider.total_input_tokens, self._provider.total_output_tokens)
        return (0, 0)
    
    def reset_token_counters(self):
        """Reseta os contadores de tokens para uma nova sessão."""
        if self._provider:
            self._provider.total_input_tokens = 0
            self._provider.total_output_tokens = 0
    
    async def generate(self, prompt: str, system_prompt: Optional[str] = None, force_max_tokens: bool = False) -> str:
        """Gera uma resposta."""
        if not self._provider:
            raise RuntimeError("AI Service não configurado. Configure primeiro.")
        return await self._provider.generate(prompt, system_prompt, force_max_tokens)
    
    async def generate_stream(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Gera uma resposta em streaming."""
        if not self._provider:
            raise RuntimeError("AI Service não configurado. Configure primeiro.")
        async for chunk in self._provider.generate_stream(prompt, system_prompt):
            yield chunk
    
    async def generate_technical_kb(self, repo_name: str, files_content: List[dict]) -> dict:
        """Gera base de conhecimento técnica EXTREMAMENTE DETALHADA."""
        system_prompt = """Você é um arquiteto de software sênior fazendo onboarding de um novo desenvolvedor.
Analise CADA LINHA de código e extraia TODOS os detalhes técnicos. Um novo dev precisa entender TUDO sem ler o código.

REGRAS CRÍTICAS:
1. Para CADA função/handler, liste: nome, parâmetros necessários, o que faz passo a passo, o que retorna
2. Para CADA integração externa (API, planilha, banco), liste: nome, URL/conexão, para que é usada, dados trocados
3. Para CADA validação, liste: o que valida, quando é aplicada, o que acontece se falhar
4. Liste TODOS os fluxos de dados: de onde vem → para onde vai → o que acontece
5. Identifique conexões com: planilhas Google, APIs externas (VTEX, etc), bancos de dados, filas

Retorne APENAS um JSON válido (sem markdown):
{
    "technical_summary": "Resumo de 5+ parágrafos explicando: 1) O que o sistema faz, 2) Como está organizado, 3) Principais fluxos, 4) Integrações críticas, 5) Pontos de atenção",
    "architecture_diagram": "Diagrama ASCII mostrando: Entrada → Processamento → Saídas e todas as conexões externas",
    "handlers_detail": [
        {
            "name": "nome_do_handler",
            "file": "arquivo.py",
            "purpose": "O que este handler faz em detalhes",
            "input_parameters": [{"name": "param", "type": "tipo", "required": true, "description": "para que serve"}],
            "process_steps": ["Passo 1: faz X", "Passo 2: chama Y", "Passo 3: valida Z"],
            "external_calls": [{"service": "nome", "endpoint": "url/método", "purpose": "para que chama"}],
            "validations": ["Valida se X está presente", "Verifica se loja é válida"],
            "output": "O que retorna/faz ao final"
        }
    ],
    "data_sources": [
        {
            "name": "Nome da fonte (ex: Planilha de Lojas Válidas)",
            "type": "google_sheet/api/database",
            "connection": "Como se conecta (URL, credencial, etc)",
            "data_provided": ["ID de árvore", "ID de fila", "Lista de lojas válidas"],
            "used_by": ["handler1", "handler2"]
        }
    ],
    "api_endpoints": [{"method": "POST", "path": "/caminho", "description": "detalhes", "parameters": [], "response": ""}],
    "external_apis_consumed": [
        {"name": "VTEX/Planilha/etc", "base_url": "url", "endpoints_used": [], "authentication": "tipo", "purpose": "Para que é usada", "data_exchanged": ["dados enviados/recebidos"]}
    ],
    "business_rules": [
        {"name": "Regra", "trigger": "Quando é acionada", "conditions": ["Se X", "E Y"], "actions": ["Faz A", "Retorna B"], "handler": "onde está implementada"}
    ],
    "validation_flows": [
        {"name": "Validação de Loja", "description": "Verifica se loja da VTEX é válida consultando planilha", "data_source": "planilha X", "on_success": "continua", "on_failure": "retorna erro Y"}
    ],
    "technologies": [],
    "dependencies": [],
    "services": [],
    "integrations": [],
    "validation_rules": [],
    "code_patterns": [],
    "naming_conventions": [],
    "environment_variables": [],
    "configuration_files": [],
    "webhooks": [],
    "technical_documentation": "# Documentação Técnica Completa\n\n## 1. Visão Geral\n...\n\n## 2. Handlers em Detalhes\nPara cada handler: parâmetros, fluxo, integrações\n\n## 3. Integrações Externas\nCada API/planilha: como conecta, dados trocados\n\n## 4. Fluxos de Dados\nDe onde vem cada dado e para onde vai\n\n## 5. Validações\nTodas as validações e regras"
}"""

        files_text = self._prepare_files_text(files_content, max_files=40, max_chars_per_file=5000, max_total_chars=80000)
        
        prompt = f"""Repositório: {repo_name}

INSTRUÇÕES CRÍTICAS - LEIA COM ATENÇÃO:
1. Analise CADA arquivo de código linha por linha
2. Para CADA handler/função, extraia: parâmetros, passos de execução, chamadas externas
3. Identifique TODAS as conexões: planilhas Google Sheets, APIs (VTEX, etc), bancos
4. Liste TODAS as validações: o que valida, de onde vem os dados de validação
5. Documente TODOS os fluxos: troca de endereço, consulta de pedido, etc.

PERGUNTAS QUE A DOCUMENTAÇÃO DEVE RESPONDER:
- Quais parâmetros preciso passar para cada operação?
- De onde vem o ID de árvore e ID de fila? (planilha? qual?)
- Como saber se uma loja é válida? (consulta onde?)
- Quais APIs externas são chamadas e para quê?
- Quais validações são feitas antes de cada operação?

Arquivos do projeto (analise TODOS em detalhes):

{files_text}

Gere documentação COMPLETA onde um novo dev entenda TUDO sem precisar ler o código:"""

        response = await self.generate(prompt, system_prompt)
        return self._parse_json_response(response)
    
    async def generate_business_kb(self, repo_name: str, files_content: List[dict]) -> dict:
        """Gera base de conhecimento de negócio EXTREMAMENTE DETALHADA."""
        system_prompt = """Você é um Product Manager explicando um sistema para a equipe de negócios e atendimento.
Analise o código e documente TUDO que o sistema faz de forma prática e clara.

REGRAS CRÍTICAS:
1. Liste CADA funcionalidade que o sistema oferece
2. Para CADA funcionalidade, explique: quando usar, que informações precisa, o que acontece
3. Documente TODOS os fluxos passo a passo (ex: troca de endereço, consulta de pedido)
4. Explique as integrações de forma simples (ex: "consulta planilha de lojas válidas")
5. Crie FAQ respondendo dúvidas reais que um atendente teria

Retorne APENAS um JSON válido (sem markdown):
{
    "product_name": "Nome claro do agente/sistema",
    "product_description": "Descrição de 5+ parágrafos: O que é, Para que serve, Quem usa, Como ajuda no dia a dia, Principais benefícios",
    "capabilities": [
        {
            "name": "Nome da Capacidade (ex: Troca de Endereço)",
            "description": "O que faz em linguagem simples",
            "when_to_use": "Em qual situação usar esta funcionalidade",
            "required_info": ["CPF do cliente", "Número do pedido", "Novo endereço"],
            "process": "Passo a passo do que acontece quando acionado",
            "possible_outcomes": ["Sucesso: endereço atualizado", "Erro: loja não permite troca"],
            "dependencies": ["Consulta planilha de lojas válidas", "Atualiza na VTEX"]
        }
    ],
    "main_features": ["Funcionalidade 1: descrição completa", "Funcionalidade 2: descrição completa"],
    "detailed_flows": [
        {
            "name": "Nome do Fluxo (ex: Processo de Troca de Endereço)",
            "trigger": "O que inicia este fluxo",
            "prerequisites": ["O que precisa ter/saber antes"],
            "steps": [
                "1. Cliente solicita troca de endereço informando CPF e número do pedido",
                "2. Sistema consulta pedido na VTEX para verificar status",
                "3. Sistema verifica se loja permite troca (consulta planilha de lojas válidas)",
                "4. Se permitido, atualiza endereço na VTEX",
                "5. Retorna confirmação ao cliente"
            ],
            "possible_errors": ["Loja não permite alteração", "Pedido já enviado"],
            "external_systems": ["VTEX - consulta e atualização", "Planilha de lojas - validação"]
        }
    ],
    "use_cases": ["Caso real 1 com detalhes", "Caso real 2 com detalhes"],
    "target_users": ["Tipo de usuário com descrição de como usa"],
    "user_personas": ["Persona detalhada com necessidades"],
    "main_flows": ["Fluxo resumido 1", "Fluxo resumido 2"],
    "integrations_summary": [
        {
            "system": "Nome (VTEX, Planilha Google, etc)",
            "purpose": "Para que é usado em linguagem simples",
            "data_involved": ["Que dados são consultados/enviados"]
        }
    ],
    "faq": [
        {"question": "O que preciso para fazer uma troca de endereço?", "answer": "Você precisa do CPF do cliente, número do pedido e o novo endereço completo. O sistema vai verificar se a loja permite a alteração."},
        {"question": "Como saber se a loja permite alterações?", "answer": "O sistema consulta automaticamente uma planilha de lojas válidas. Se a loja não estiver na lista, a operação será recusada."},
        {"question": "De onde vêm os IDs de árvore e fila?", "answer": "São consultados automaticamente de uma planilha de configuração baseado no tipo de ticket."}
    ],
    "glossary": [{"term": "termo", "definition": "explicação simples"}],
    "user_documentation": "# Manual do Sistema\n\n## O que é\n...\n\n## Funcionalidades\nPara cada uma: o que faz, quando usar, o que precisa\n\n## Fluxos Principais\nPasso a passo de cada operação\n\n## Perguntas Frequentes\n..."
}"""

        files_text = self._prepare_files_text(files_content, max_files=40, max_chars_per_file=5000, max_total_chars=80000)
        
        prompt = f"""Repositório: {repo_name}

OBJETIVO: Criar documentação que um atendente/analista de negócio entenda COMPLETAMENTE o sistema.

PERGUNTAS QUE A DOCUMENTAÇÃO DEVE RESPONDER:
- Quais funcionalidades o sistema oferece?
- Para cada funcionalidade: o que preciso informar? O que vai acontecer?
- Quais são os fluxos passo a passo? (ex: troca de endereço)
- Com quais sistemas externos ele se conecta? (VTEX, planilhas, etc)
- Quais validações são feitas? (ex: loja válida)
- De onde vêm dados como ID de árvore, ID de fila?
- Quais erros podem acontecer e por quê?

Arquivos do projeto (extraia TODAS as funcionalidades):

{files_text}

Gere documentação COMPLETA onde qualquer pessoa entenda o sistema sem conhecimento técnico:"""

        response = await self.generate(prompt, system_prompt)
        return self._parse_json_response(response)
    
    async def generate_knowledge_base(
        self, 
        repo_name: str, 
        files_content: List[dict]
    ) -> dict:
        """Gera base de conhecimento completa (retrocompatibilidade)."""
        system_prompt = """Você é um especialista em arquitetura de software e documentação.
Analise os arquivos do repositório e gere uma base de conhecimento completa.

Retorne um JSON com:
{
    "summary": "Resumo geral do projeto",
    "architecture_overview": "Visão geral da arquitetura",
    "services": [
        {
            "name": "nome do serviço",
            "type": "tipo (api, frontend, worker, etc)",
            "description": "descrição",
            "technologies": ["tech1", "tech2"],
            "endpoints": ["endpoint1", "endpoint2"],
            "integrations": ["integração1"]
        }
    ],
    "integrations": [
        {
            "name": "nome da integração",
            "type": "tipo (rest_api, database, queue, etc)",
            "description": "descrição",
            "endpoints": ["endpoints usados"],
            "authentication": "tipo de autenticação"
        }
    ],
    "technologies": ["lista de tecnologias usadas"],
    "documentation": "Documentação detalhada em markdown"
}

Responda APENAS com o JSON, sem markdown code blocks."""

        files_text = self._prepare_files_text(files_content)
        
        prompt = f"""Repositório: {repo_name}

Arquivos do projeto:

{files_text}

Gere a base de conhecimento:"""

        response = await self.generate(prompt, system_prompt)
        return self._parse_json_response(response)
    
    def _prepare_files_text(
        self, 
        files_content: List[dict], 
        max_files: int = 30,
        max_chars_per_file: int = 4000,
        max_total_chars: int = 50000
    ) -> str:
        """Prepara o texto dos arquivos para o prompt, otimizado para análise detalhada."""
        # Priorizar arquivos importantes para análise
        priority_patterns = [
            # Alta prioridade - código de negócio
            'handler', 'handlers', 'action', 'actions', 'service', 'services',
            'route', 'router', 'routes', 'controller', 'controllers',
            'api', 'endpoint', 'endpoints', 'client', 'clients',
            # Média prioridade - integrações
            'integration', 'webhook', 'callback', 'tools', 'functions',
            'vtex', 'order', 'product', 'customer', 'ticket',
            # Configuração
            'main', 'app', 'index', 'config', 'settings',
            # Documentação/definição
            'schema', 'model', 'types', 'interface'
        ]
        
        def file_priority(f):
            path_lower = f['path'].lower()
            name_lower = f.get('name', '').lower()
            
            # Ignora arquivos de teste e cache
            if '__test__' in path_lower or '__pycache__' in path_lower or '.pyc' in path_lower:
                return (999, 0)
            
            for i, pattern in enumerate(priority_patterns):
                if pattern in path_lower or pattern in name_lower:
                    return (0, i)
            return (1, len(f['path']))
        
        sorted_files = sorted(files_content, key=file_priority)
        
        result_parts = []
        total_chars = 0
        files_included = 0
        
        for f in sorted_files:
            if files_included >= max_files:
                break
                
            content = f['content']
            
            # Se o arquivo é muito grande, pega início e fim
            if len(content) > max_chars_per_file:
                half = max_chars_per_file // 2
                content = content[:half] + "\n\n... [código omitido] ...\n\n" + content[-half:]
            
            file_text = f"### Arquivo: {f['path']} ###\n{content}"
            
            if total_chars + len(file_text) > max_total_chars:
                # Se ainda não incluímos muitos arquivos, tenta incluir resumido
                if files_included < 10:
                    content = content[:1500] + "\n... [truncado]"
                    file_text = f"### Arquivo: {f['path']} ###\n{content}"
                else:
                    break
            
            result_parts.append(file_text)
            total_chars += len(file_text)
            files_included += 1
        
        header = f"Total de arquivos analisados: {files_included}/{len(files_content)}\n\n"
        return header + "\n\n".join(result_parts)
    
    def _parse_json_response(self, response: str) -> dict:
        """Parse da resposta JSON."""
        try:
            response = response.strip()
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(lines[1:-1])
                if response.startswith("json"):
                    response = response[4:]
            return json.loads(response)
        except json.JSONDecodeError:
            return {
                "summary": "Erro ao gerar análise estruturada",
                "architecture_overview": response,
                "services": [],
                "integrations": [],
                "technologies": [],
                "documentation": response
            }


# Instância global do serviço
ai_service = AIService()
