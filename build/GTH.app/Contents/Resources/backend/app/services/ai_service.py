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
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
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
    
    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=self.api_key)
        return self._client
    
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        # Ajusta max_tokens baseado no modelo
        max_tokens = 4096
        if "gpt-4" in self.model or "gpt-4o" in self.model:
            max_tokens = 4096
        elif "gpt-3.5" in self.model:
            max_tokens = 2048  # Modelo menor, menos tokens
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.7,
            max_tokens=max_tokens
        )
        
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
    
    @property
    def client(self):
        if self._client is None:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self._client = genai.GenerativeModel(self.model)
        return self._client
    
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
        
        response = await self.client.generate_content_async(
            full_prompt,
            generation_config={
                "temperature": 0.7,
                "max_output_tokens": 8192,
            }
        )
        
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
    
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Gera uma resposta."""
        if not self._provider:
            raise RuntimeError("AI Service não configurado. Configure primeiro.")
        return await self._provider.generate(prompt, system_prompt)
    
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
        """Gera base de conhecimento técnica."""
        system_prompt = """Analise o código e retorne APENAS um JSON válido com esta estrutura:
{"technical_summary": "resumo", "architecture_diagram": "arquitetura", "api_endpoints": [], "external_apis_consumed": [], "technologies": [], "dependencies": [], "services": [], "integrations": [], "business_rules": [], "validation_rules": [], "code_patterns": [], "naming_conventions": [], "environment_variables": [], "configuration_files": [], "webhooks": [], "technical_documentation": "doc"}"""

        files_text = self._prepare_files_text(files_content)
        
        prompt = f"""Repositório: {repo_name}

Arquivos do projeto:

{files_text}

Gere a base de conhecimento TÉCNICA COMPLETA (não omita nenhuma API ou integração):"""

        response = await self.generate(prompt, system_prompt)
        return self._parse_json_response(response)
    
    async def generate_business_kb(self, repo_name: str, files_content: List[dict]) -> dict:
        """Gera base de conhecimento de negócio."""
        system_prompt = """Analise o código e retorne APENAS um JSON válido para usuários não-técnicos:
{"product_name": "nome", "product_description": "descrição", "main_features": [], "use_cases": [], "target_users": [], "user_personas": [], "main_flows": [], "integrations_summary": [], "faq": [], "glossary": [], "user_documentation": "doc"}"""

        files_text = self._prepare_files_text(files_content)
        
        prompt = f"""Repositório: {repo_name}

Arquivos do projeto:

{files_text}

Gere a base de conhecimento de NEGÓCIO COMPLETA (liste todas funcionalidades e integrações):"""

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
        max_files: int = 15,
        max_chars_per_file: int = 1500,
        max_total_chars: int = 12000
    ) -> str:
        """Prepara o texto dos arquivos para o prompt, otimizado para modelos com contexto limitado."""
        # Priorizar arquivos importantes
        priority_patterns = [
            'route', 'router', 'controller', 'api', 'endpoint', 'service',
            'client', 'integration', 'webhook', 'handler', 'action',
            'main', 'app', 'index', 'tools', 'functions',
            'config', 'settings', 'env', 'requirements', 'package.json'
        ]
        
        def file_priority(f):
            path_lower = f['path'].lower()
            for i, pattern in enumerate(priority_patterns):
                if pattern in path_lower:
                    return (0, i)
            return (1, 0)
        
        sorted_files = sorted(files_content, key=file_priority)
        
        result_parts = []
        total_chars = 0
        
        for f in sorted_files[:max_files]:
            content = f['content'][:max_chars_per_file]
            file_text = f"=== {f['path']} ===\n{content}"
            
            if total_chars + len(file_text) > max_total_chars:
                break
            
            result_parts.append(file_text)
            total_chars += len(file_text)
        
        return "\n\n".join(result_parts)
    
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
