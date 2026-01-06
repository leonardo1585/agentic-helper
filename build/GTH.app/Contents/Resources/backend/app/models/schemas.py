"""
Schemas Pydantic para validação de dados.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime


class AIProvider(str, Enum):
    """Provedores de IA suportados."""
    OPENAI = "openai"
    GEMINI = "gemini"


class KnowledgeBaseType(str, Enum):
    """Tipos de base de conhecimento."""
    TECHNICAL = "technical"
    BUSINESS = "business"


class AIConfig(BaseModel):
    """Configuração do provedor de IA."""
    provider: AIProvider = AIProvider.OPENAI
    api_key: str
    model: Optional[str] = None


class GitHubConfig(BaseModel):
    """Configuração do GitHub."""
    token: str


class Repository(BaseModel):
    """Representação de um repositório."""
    id: int
    name: str
    full_name: str
    description: Optional[str] = None
    url: str
    clone_url: str
    ssh_url: str
    language: Optional[str] = None
    private: bool = False
    owner: str
    default_branch: str = "main"
    updated_at: Optional[datetime] = None


class RepositorySelection(BaseModel):
    """Seleção de repositórios para análise."""
    repositories: List[str] = Field(..., description="Lista de full_names dos repositórios")


class FileAnalysis(BaseModel):
    """Análise de um arquivo."""
    path: str
    language: str
    summary: str
    key_functions: List[str] = []
    dependencies: List[str] = []


class APIEndpoint(BaseModel):
    """Informações sobre um endpoint de API."""
    method: str  # GET, POST, PUT, DELETE, etc.
    path: str
    description: str
    parameters: List[str] = []
    response_type: Optional[str] = None


class ServiceInfo(BaseModel):
    """Informações sobre um serviço identificado."""
    name: str
    type: str  # "api", "frontend", "worker", "database", etc.
    description: str
    technologies: List[str] = []
    endpoints: List[str] = []
    integrations: List[str] = []


class IntegrationInfo(BaseModel):
    """Informações sobre uma integração."""
    name: str
    type: str  # "rest_api", "grpc", "websocket", "database", "queue", etc.
    description: str
    endpoints: List[str] = []
    authentication: Optional[str] = None


class BusinessRule(BaseModel):
    """Regra de negócio identificada."""
    name: str
    description: str
    conditions: List[str] = []
    actions: List[str] = []
    code_location: Optional[str] = None


class ExternalAPIConsumed(BaseModel):
    """API externa consumida pelo sistema."""
    name: str
    base_url: Optional[str] = None
    endpoints_used: List[str] = []
    authentication: Optional[str] = None
    purpose: Optional[str] = None


# Base de Conhecimento Técnica
class TechnicalKnowledgeBase(BaseModel):
    """Base de conhecimento técnica - para desenvolvedores e agentes de IA."""
    repository_name: str
    
    # Visão Geral Técnica
    technical_summary: str = ""
    architecture_diagram: str = ""  # Descrição textual da arquitetura
    
    # APIs e Endpoints
    api_endpoints: List[APIEndpoint] = []
    external_apis_consumed: List[ExternalAPIConsumed] = []
    
    # Tecnologias e Dependências
    technologies: List[str] = []
    dependencies: List[str] = []
    
    # Serviços e Integrações
    services: List[ServiceInfo] = []
    integrations: List[IntegrationInfo] = []
    
    # Regras e Lógica
    business_rules: List[BusinessRule] = []
    validation_rules: List[str] = []
    
    # Padrões e Convenções
    code_patterns: List[str] = []
    naming_conventions: List[str] = []
    
    # Configurações
    environment_variables: List[str] = []
    configuration_files: List[str] = []
    
    # Webhooks
    webhooks: List[str] = []
    
    # Documentação Técnica Detalhada
    technical_documentation: str = ""
    
    generated_at: datetime = Field(default_factory=datetime.now)


# Base de Conhecimento de Negócio
class BusinessKnowledgeBase(BaseModel):
    """Base de conhecimento de negócio - para pessoas não-técnicas."""
    repository_name: str
    
    # Visão Geral do Produto
    product_name: str
    product_description: str
    
    # O que o sistema faz
    main_features: List[str] = []
    use_cases: List[str] = []
    
    # Quem usa
    target_users: List[str] = []
    user_personas: List[str] = []
    
    # Fluxos principais
    main_flows: List[str] = []
    
    # Integrações (visão simplificada)
    integrations_summary: List[str] = []
    
    # Perguntas frequentes
    faq: List[dict] = []  # [{"question": "...", "answer": "..."}]
    
    # Glossário de termos
    glossary: List[dict] = []  # [{"term": "...", "definition": "..."}]
    
    # Documentação para usuário final
    user_documentation: str
    
    generated_at: datetime = Field(default_factory=datetime.now)


# Base de Conhecimento Completa
class KnowledgeBase(BaseModel):
    """Base de conhecimento completa do repositório."""
    repository_name: str
    
    # Bases específicas
    technical: Optional[TechnicalKnowledgeBase] = None
    business: Optional[BusinessKnowledgeBase] = None
    
    # Metadados
    summary: str = ""  # Resumo geral
    architecture_overview: str = ""
    services: List[ServiceInfo] = []
    integrations: List[IntegrationInfo] = []
    technologies: List[str] = []
    key_files: List[FileAnalysis] = []
    documentation: str = ""
    
    generated_at: datetime = Field(default_factory=datetime.now)


class AnalysisRequest(BaseModel):
    """Requisição de análise."""
    repositories: List[str]
    include_tests: bool = False
    deep_analysis: bool = True
    kb_types: List[KnowledgeBaseType] = [KnowledgeBaseType.TECHNICAL, KnowledgeBaseType.BUSINESS]


class AnalysisStatus(BaseModel):
    """Status da análise."""
    repository: str
    status: str  # "pending", "cloning", "analyzing", "completed", "error"
    progress: int = 0
    message: Optional[str] = None


class ChatMessage(BaseModel):
    """Mensagem do chat."""
    role: str  # "user" ou "assistant"
    content: str


class ChatRequest(BaseModel):
    """Requisição de chat."""
    message: str
    context_repos: List[str] = []
    mode: str = "technical"  # "technical" ou "business"


class ChatResponse(BaseModel):
    """Resposta do chat."""
    response: str
    sources: List[str] = []


class ConfigUpdate(BaseModel):
    """Atualização de configuração."""
    github_token: Optional[str] = None
    ai_provider: Optional[AIProvider] = None
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = None


class AppStatus(BaseModel):
    """Status da aplicação."""
    github_configured: bool
    ai_configured: bool
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    repositories_count: int = 0
    knowledge_bases_count: int = 0
