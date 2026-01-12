"""
Schemas Pydantic para validação de dados.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
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
    parameters: List[Any] = []  # Pode ser string ou dict com name/type/description
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
    
    # Definição do Agente (extraído do agent_definition.yaml)
    agent_instructions: List[str] = []  # Instructions do agent_definition
    agent_guardrails: List[str] = []    # Guardrails do agent_definition
    agent_name: str = ""                # Nome do agente
    agent_description: str = ""         # Descrição do agente
    
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
    environment_variables: List[Any] = []  # Pode ser string ou dict com name/purpose
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
    AGENT_CREATION = "agent_creation"          # Criação/edição de agentes (YAML)
    TOOL_GENERATION = "tool_generation"        # Geração de código de tools
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


# ============================================
# DIFF DE ATUALIZAÇÕES (PARA CS)
# ============================================

class IndexationSnapshot(BaseModel):
    """Snapshot de uma indexação para comparação posterior."""
    id: str
    repository_name: str
    timestamp: datetime
    indexed_by: str = "system"  # Quem fez a indexação
    
    # Snapshot do conteúdo
    instructions: List[str] = []
    guardrails: List[str] = []
    skills: List[str] = []  # Nomes das skills
    handlers: List[str] = []  # Nomes dos handlers
    environment_variables: List[str] = []
    api_endpoints: List[str] = []  # Resumo dos endpoints
    business_rules: List[str] = []
    capabilities: List[str] = []  # Capacidades de negócio
    
    # Hash do conteúdo para detecção rápida de mudanças
    content_hash: str = ""


class CrossReference(BaseModel):
    """Referência cruzada - onde uma variável/chave é usada."""
    file_path: str
    line_number: int
    line_content: str
    context: Optional[str] = None  # Linhas ao redor para contexto


class ChangeItem(BaseModel):
    """Item de mudança detectada."""
    type: str  # 'added', 'removed', 'modified'
    category: str  # 'instruction', 'guardrail', 'skill', 'handler', 'env_var', 'endpoint', 'rule', 'capability'
    description: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    impact: str = "low"  # 'low', 'medium', 'high'
    # Detalhes do diff (do GitHub)
    additions: int = 0  # Linhas adicionadas
    deletions: int = 0  # Linhas removidas
    patch: Optional[str] = None  # Diff do arquivo (preview)
    # Referências cruzadas - onde variáveis removidas são usadas
    removed_identifiers: List[str] = []  # Variáveis/chaves REALMENTE removidas
    format_changed_identifiers: List[str] = []  # Variáveis com MUDANÇA DE FORMATO (não são remoções reais)
    cross_references: List[CrossReference] = []  # Onde são usadas
    has_breaking_change: bool = False  # Se tem variável removida usada em outro lugar
    has_format_change: bool = False  # Se tem mudança de formato de dados


class UpdatesDiff(BaseModel):
    """Diferença entre duas indexações."""
    repository_name: str
    from_snapshot_id: str
    from_timestamp: datetime
    to_snapshot_id: str
    to_timestamp: datetime
    
    # Resumo das mudanças
    summary: str
    total_changes: int
    
    # Mudanças por categoria
    changes: List[ChangeItem] = []
    
    # Mudanças agrupadas
    instructions_changes: List[ChangeItem] = []
    code_changes: List[ChangeItem] = []
    config_changes: List[ChangeItem] = []
    
    # Impacto geral
    impact_level: str = "low"  # 'low', 'medium', 'high', 'critical'
    impact_summary: str = ""
    
    # Análise inteligente da IA
    ai_analysis: Optional[str] = None  # Resumo técnico/negócio das mudanças
    potential_issues: List[str] = []  # Possíveis problemas identificados
    
    # Commits entre os snapshots
    from_commit_sha: Optional[str] = None
    to_commit_sha: Optional[str] = None


# ============================================
# DIAGNÓSTICO DE PROBLEMAS
# ============================================

class FileChange(BaseModel):
    """Mudança em um arquivo específico."""
    filename: str
    status: str = "modified"  # added, removed, modified
    additions: int = 0
    deletions: int = 0
    patch: Optional[str] = None  # O diff real do arquivo


class CommitInfo(BaseModel):
    """Informações de um commit."""
    sha: str
    message: str
    author: str
    date: datetime
    files_changed: List[str] = []
    file_details: List[FileChange] = []  # Detalhes incluindo patches
    additions: int = 0
    deletions: int = 0


class DiagnosticRequest(BaseModel):
    """Requisição de diagnóstico de problema."""
    repository_name: str
    problem_description: str
    error_message: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    days_lookback: int = 7  # Quantos dias olhar para trás


class ProblemCorrelation(BaseModel):
    """Correlação entre problema e uma mudança."""
    change_type: str  # 'instruction', 'code', 'config', 'dependency'
    change_description: str
    file_or_location: str
    commit_sha: Optional[str] = None
    commit_date: Optional[datetime] = None
    commit_author: Optional[str] = None
    correlation_score: float  # 0 a 1, quanto maior mais provável ser a causa
    reasoning: str  # Explicação de por que pode ser relacionado


class CodeLocation(BaseModel):
    """Localização exata do código problemático."""
    file: str
    line_removed: Optional[str] = None  # Código removido (linha com -)
    line_added: Optional[str] = None  # Código adicionado (linha com +)
    explanation: Optional[str] = None  # Por que essa mudança causou o problema


class DiagnosticResult(BaseModel):
    """Resultado do diagnóstico de problema."""
    repository_name: str
    problem_description: str
    analyzed_at: datetime
    
    # VEREDITO PRINCIPAL
    found_cause: bool = False  # Se encontrou uma causa relacionada às mudanças
    is_refactoring: bool = False  # Se foi apenas refatoração (funcionalidade mantida, não é problema real)
    verdict: str = ""  # Veredito claro: "CAUSA ENCONTRADA: ..." ou "REFATORAÇÃO: ..." ou "NÃO ENCONTREI RELAÇÃO..."
    
    # Resumo do diagnóstico
    diagnosis_summary: str
    confidence: str  # 'low', 'medium', 'high'
    
    # Causa raiz identificada
    root_cause: Optional[str] = None
    root_cause_type: Optional[str] = None  # 'instruction', 'code', 'config', 'external', 'unknown'
    
    # LOCALIZAÇÃO EXATA DO CÓDIGO PROBLEMÁTICO
    code_location: Optional[CodeLocation] = None
    
    # Correlações encontradas
    correlations: List[ProblemCorrelation] = []
    
    # Top 3 possíveis causas
    top_suspects: List[str] = []
    
    # Commits recentes analisados
    recent_commits: List[CommitInfo] = []
    
    # Mudanças em instruções (agent_definition)
    instruction_changes: List[str] = []
    
    # Mudanças em código
    code_changes: List[str] = []
    
    # Recomendações
    recommendations: List[str] = []
    
    # Próximos passos sugeridos
    next_steps: List[str] = []


class DiagnosticTicket(BaseModel):
    """Ticket de diagnóstico para compartilhamento.
    Contém todas as informações necessárias para o time responsável investigar.
    """
    id: str  # ID único para compartilhamento (ex: "DBG-2024-0001")
    created_at: datetime
    created_by: str = "Suporte"  # Quem criou o ticket
    status: str = "open"  # 'open', 'investigating', 'resolved', 'closed'
    ticket_type: str = "diagnostic"  # 'diagnostic' ou 'debug'
    
    # Dados do diagnóstico
    repository_name: str
    problem_description: str
    error_message: Optional[str] = None
    
    # Resultado do diagnóstico (quando ticket_type = 'diagnostic')
    diagnosis_result: Optional[DiagnosticResult] = None
    
    # Resultado do debug ORIGINAL (quando ticket_type = 'debug')
    # Preserva TODOS os dados do debug sem conversão
    debug_result: Optional[Dict[str, Any]] = None
    
    # LOG DE DEBUG - Código gerado para reproduzir/investigar
    debug_log: str = ""  # Log formatado com todas as informações
    debug_code: Optional[str] = None  # Código de teste se aplicável
    
    # Arquivos relacionados
    affected_files: List[str] = []
    
    # Notas adicionais
    notes: List[str] = []
    
    # Link compartilhável (gerado automaticamente)
    share_url: Optional[str] = None


class DiagnosticHistory(BaseModel):
    """Histórico de diagnósticos realizados."""
    total: int = 0
    tickets: List[DiagnosticTicket] = []
