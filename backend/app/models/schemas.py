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
    trigger: Optional[str] = None
    handler: Optional[str] = None


class HandlerDetail(BaseModel):
    """Detalhes de um handler/função."""
    name: str
    file: Optional[str] = None
    purpose: Optional[str] = None
    input_parameters: List[dict] = []
    process_steps: List[str] = []
    external_calls: List[dict] = []
    validations: List[str] = []
    output: Optional[str] = None


class DataSource(BaseModel):
    """Fonte de dados externa (planilha, API, banco)."""
    name: str
    type: str  # google_sheet, api, database
    connection: Optional[str] = None
    data_provided: List[str] = []
    used_by: List[str] = []


class ValidationFlow(BaseModel):
    """Fluxo de validação."""
    name: str
    description: Optional[str] = None
    data_source: Optional[str] = None
    on_success: Optional[str] = None
    on_failure: Optional[str] = None


class Capability(BaseModel):
    """Capacidade do sistema (para visão de negócio)."""
    name: str
    description: Optional[str] = None
    when_to_use: Optional[str] = None
    required_info: List[str] = []
    process: Optional[str] = None
    possible_outcomes: List[str] = []
    dependencies: List[str] = []


class DetailedFlow(BaseModel):
    """Fluxo detalhado (para visão de negócio)."""
    name: str
    trigger: Optional[str] = None
    prerequisites: List[str] = []
    steps: List[str] = []
    possible_errors: List[str] = []
    external_systems: List[str] = []


class ExternalAPIConsumed(BaseModel):
    """API externa consumida pelo sistema."""
    name: str
    base_url: Optional[str] = None
    endpoints_used: List[str] = []
    authentication: Optional[str] = None
    purpose: Optional[str] = None


class DebugRequest(BaseModel):
    """Requisição para debug de problema."""
    repository: str
    folder_path: str
    problem_description: str
    output_json: Optional[str] = None  # JSON de retorno que causou o problema


class DebugResult(BaseModel):
    """Resultado da investigação de debug."""
    problem_summary: str
    root_cause: Optional[str] = None
    affected_handlers: List[str] = []
    affected_code_locations: List[str] = []
    data_flow: str = ""  # De onde veio cada dado do output
    suggestions: List[str] = []
    confidence: str = "medium"  # low, medium, high


# Base de Conhecimento Técnica
class TechnicalKnowledgeBase(BaseModel):
    """Base de conhecimento técnica - para desenvolvedores e agentes de IA."""
    repository_name: str
    
    # Visão Geral Técnica
    technical_summary: str = ""
    architecture_diagram: str = ""  # Descrição textual da arquitetura
    
    # NOVO: Detalhes de Handlers/Funções
    handlers_detail: List[dict] = []  # Lista de HandlerDetail como dicts
    
    # NOVO: Fontes de Dados
    data_sources: List[dict] = []  # Lista de DataSource como dicts
    
    # NOVO: Fluxos de Validação
    validation_flows: List[dict] = []  # Lista de ValidationFlow como dicts
    
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
    
    # NOVO: Capacidades Detalhadas
    capabilities: List[dict] = []  # Lista de Capability como dicts
    
    # NOVO: Fluxos Detalhados
    detailed_flows: List[dict] = []  # Lista de DetailedFlow como dicts
    
    # O que o sistema faz
    main_features: List[str] = []
    use_cases: List[str] = []
    
    # Quem usa
    target_users: List[str] = []
    user_personas: List[str] = []
    
    # Fluxos principais (resumidos)
    main_flows: List[str] = []
    
    # Integrações (visão simplificada)
    integrations_summary: List[dict] = []  # Mudado para dict para suportar mais detalhes
    
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


# ============================================
# SISTEMA DE GERENCIAMENTO DE PROMPTS
# ============================================

class PromptCategory(str, Enum):
    """Categorias de prompts."""
    ANALYSIS_TECHNICAL = "analysis_technical"  # Análise técnica de repositórios
    ANALYSIS_BUSINESS = "analysis_business"    # Análise de negócio
    CHAT = "chat"                              # Chat/Conversação
    DEBUG = "debug"                            # Debug de problemas
    SEARCH = "search"                          # Busca de agentes
    CUSTOM = "custom"                          # Customizado


class PromptConfig(BaseModel):
    """Configuração de um prompt."""
    id: str
    name: str
    description: str
    category: PromptCategory
    system_prompt: str
    user_prompt_template: str = ""  # Template com placeholders {variavel}
    model: Optional[str] = None  # Se None, usa o modelo padrão configurado
    provider: Optional[AIProvider] = None  # Se None, usa o provider padrão
    temperature: float = 0.5
    max_tokens: Optional[int] = None  # Se None, usa o padrão do modelo
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class PromptCreate(BaseModel):
    """Criar um novo prompt."""
    name: str
    description: str
    category: PromptCategory
    system_prompt: str
    user_prompt_template: str = ""
    model: Optional[str] = None
    provider: Optional[AIProvider] = None
    temperature: float = 0.5
    max_tokens: Optional[int] = None


class PromptUpdate(BaseModel):
    """Atualizar um prompt existente."""
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    user_prompt_template: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[AIProvider] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    is_active: Optional[bool] = None


class PromptTest(BaseModel):
    """Testar um prompt."""
    prompt_id: str
    variables: dict = {}  # Variáveis para substituir no template


class PromptTestResult(BaseModel):
    """Resultado do teste de prompt."""
    prompt_id: str
    input_rendered: str
    output: str
    model_used: str
    tokens_used: Optional[int] = None
    duration_ms: int


# ============================================
# AUTENTICAÇÃO E SEGURANÇA
# ============================================

class AdminLogin(BaseModel):
    """Login do admin."""
    password: str


class AdminLoginResponse(BaseModel):
    """Resposta do login."""
    success: bool
    token: str = ""
    message: str = ""


class AdminPasswordChange(BaseModel):
    """Troca de senha do admin."""
    current_password: str
    new_password: str


# ============================================
# TRACKING DE TOKENS E CUSTOS
# ============================================

class TokenUsageRecord(BaseModel):
    """Registro de uso de tokens."""
    id: str
    timestamp: datetime
    operation: str  # 'analysis_technical', 'analysis_business', 'chat', 'debug', 'test'
    prompt_id: Optional[str] = None
    repository: Optional[str] = None
    folder: Optional[str] = None
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost: float  # em USD
    duration_ms: int


class TokenUsageSummary(BaseModel):
    """Resumo de uso de tokens."""
    total_requests: int
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_estimated_cost: float
    by_operation: dict  # operation -> count, tokens, cost
    by_model: dict  # model -> count, tokens, cost
    by_day: dict  # date -> count, tokens, cost


# ============================================
# HISTÓRICO DE ANÁLISES
# ============================================

class AnalysisRecord(BaseModel):
    """Registro de uma análise de repositório."""
    id: str
    timestamp: datetime
    repository: str
    folder: Optional[str] = None
    status: str  # 'completed', 'failed', 'in_progress'
    operation: str = "repository_analysis"  # tipo de operação: repository_analysis, debug, agent_search
    kb_types: List[str]  # ['technical', 'business']
    model_used: str
    provider: str
    duration_seconds: int
    files_analyzed: int
    tokens_used: int
    estimated_cost: float
    error_message: Optional[str] = None


class AnalysisHistory(BaseModel):
    """Histórico de análises."""
    total_analyses: int
    successful: int
    failed: int
    records: List[AnalysisRecord]
