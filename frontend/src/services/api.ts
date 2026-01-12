/**
 * Serviço de API para comunicação com o backend
 */

// Em desenvolvimento usa proxy, em produção usa mesma origem
const isDev = typeof window !== 'undefined' && window.location.port === '5173';
const API_BASE = isDev ? '/api' : '/api';

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  clone_url: string;
  ssh_url: string;
  language: string | null;
  private: boolean;
  owner: string;
  default_branch: string;
  updated_at: string | null;
}

export interface APIEndpoint {
  method: string;
  path: string;
  description: string;
  parameters: string[];
  response_type: string | null;
}

export interface ServiceInfo {
  name: string;
  type: string;
  description: string;
  technologies: string[];
  endpoints: string[];
  integrations: string[];
}

export interface IntegrationInfo {
  name: string;
  type: string;
  description: string;
  endpoints: string[];
  authentication: string | null;
}

export interface BusinessRule {
  name: string;
  description: string;
  conditions: string[];
  actions: string[];
  code_location?: string;
}

export interface ExternalAPIConsumed {
  name: string;
  base_url?: string;
  endpoints_used: string[];
  authentication?: string;
  purpose?: string;
}

export interface TechnicalKnowledgeBase {
  repository_name: string;
  technical_summary: string;
  architecture_diagram: string;
  api_endpoints: APIEndpoint[];
  external_apis_consumed: ExternalAPIConsumed[];
  technologies: string[];
  dependencies: string[];
  services: ServiceInfo[];
  integrations: IntegrationInfo[];
  business_rules: BusinessRule[];
  validation_rules: string[];
  code_patterns: string[];
  naming_conventions: string[];
  environment_variables: string[];
  configuration_files: string[];
  webhooks: string[];
  technical_documentation: string;
  generated_at: string;
}

export interface BusinessKnowledgeBase {
  repository_name: string;
  product_name: string;
  product_description: string;
  main_features: string[];
  use_cases: string[];
  target_users: string[];
  user_personas: string[];
  main_flows: string[];
  integrations_summary: string[];
  faq: Array<{ question: string; answer: string }>;
  glossary: Array<{ term: string; definition: string }>;
  user_documentation: string;
  generated_at: string;
}

export interface KnowledgeBase {
  repository_name: string;
  technical: TechnicalKnowledgeBase | null;
  business: BusinessKnowledgeBase | null;
  summary: string;
  architecture_overview: string;
  services: ServiceInfo[];
  integrations: IntegrationInfo[];
  technologies: string[];
  documentation: string;
  generated_at: string;
}

export interface AnalysisStatus {
  repository: string;
  status: 'pending' | 'cloning' | 'analyzing' | 'completed' | 'error' | 'not_started';
  progress: number;
  message: string | null;
}

export interface AppStatus {
  github_configured: boolean;
  ai_configured: boolean;
  ai_provider: string | null;
  ai_model: string | null;
  repositories_count: number;
  knowledge_bases_count: number;
}

export interface AIModel {
  id: string;
  name: string;
}

export interface SearchResult {
  kb_name: string;
  repo_name: string;
  folder_name: string;
  agent_name?: string;  // Nome amigável do agente
  similarity: number;
  document: string;
}

export interface VectorStats {
  total_agents: number;
  collection_name: string;
  initialized: boolean;
}

export interface FindAgentResult {
  found?: boolean;
  exists?: boolean;
  message: string;
  similar_agents: SearchResult[];
  recommendation?: string;
  matching_agents?: string[];
  partial_matches?: string[];
  missing_features?: string[];
  explanation?: string;
}

// ============================================
// DIFF DE ATUALIZAÇÕES
// ============================================

export interface CrossReference {
  file_path: string;
  line_number: number;
  line_content: string;
  context?: string;
}

export interface ChangeItem {
  type: 'added' | 'removed' | 'modified';
  category: string;
  description: string;
  old_value?: string;
  new_value?: string;
  impact: 'low' | 'medium' | 'high';
  // Detalhes do diff do GitHub
  additions?: number;
  deletions?: number;
  patch?: string;  // O diff real do arquivo
  // Referências cruzadas - onde variáveis removidas são usadas
  removed_identifiers?: string[];  // Variáveis REALMENTE removidas
  format_changed_identifiers?: string[];  // Variáveis com MUDANÇA DE FORMATO
  cross_references?: CrossReference[];
  has_breaking_change?: boolean;  // Variável removida é usada em outro lugar
  has_format_change?: boolean;  // Houve mudança de formato de dados
}

export interface UpdatesDiff {
  repository_name: string;
  from_snapshot_id: string;
  from_timestamp: string;
  to_snapshot_id: string;
  to_timestamp: string;
  summary: string;
  total_changes: number;
  changes: ChangeItem[];
  instructions_changes: ChangeItem[];
  code_changes: ChangeItem[];
  config_changes: ChangeItem[];
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  impact_summary: string;
  // Análise inteligente da IA
  ai_analysis?: string;
  potential_issues?: string[];
  // Commits
  from_commit_sha?: string;
  to_commit_sha?: string;
}

// ============================================
// DIAGNÓSTICO DE PROBLEMAS
// ============================================

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  files_changed: string[];
  additions: number;
  deletions: number;
}

export interface ProblemCorrelation {
  change_type: string;
  change_description: string;
  file_or_location: string;
  commit_sha?: string;
  commit_date?: string;
  commit_author?: string;
  correlation_score: number;
  reasoning: string;
}

export interface CodeLocation {
  file: string;
  line_removed?: string;  // Código que foi removido
  line_added?: string;    // Código que foi adicionado
  explanation?: string;   // Por que essa mudança causou o problema
}

export interface DiagnosticResult {
  repository_name: string;
  problem_description: string;
  analyzed_at: string;
  // Veredito principal
  found_cause: boolean;
  is_refactoring?: boolean;  // Se foi apenas uma refatoração (não é problema real)
  verdict: string;
  // Detalhes
  diagnosis_summary: string;
  confidence: 'low' | 'medium' | 'high';
  root_cause?: string;
  root_cause_type?: 'instruction' | 'code' | 'config' | 'external' | 'unknown';
  // Localização exata do código problemático
  code_location?: CodeLocation;
  correlations: ProblemCorrelation[];
  top_suspects: string[];
  recent_commits: CommitInfo[];
  instruction_changes: string[];
  code_changes: string[];
  recommendations: string[];
  next_steps: string[];
}

// Resultado do Debug (preservado integralmente)
export interface DebugResultData {
  problem_summary?: string;
  root_cause?: string;
  data_flow?: string;
  data_analysis?: {
    seller_info?: string;
    data_returned?: string;
    data_expected?: string;
    discrepancy?: string;
  };
  tool_logic_issue?: string;
  affected_handlers?: string[];
  affected_code_locations?: string[];
  evidence?: string[];
  suggestions?: string[];
  confidence?: 'low' | 'medium' | 'high';
  agent_definition_found?: boolean;
  knowledge_base_found?: boolean;
}

// Ticket de diagnóstico para compartilhamento
export interface DiagnosticTicket {
  id: string;  // Ex: "DBG-2024-0001"
  created_at: string;
  created_by: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  ticket_type: 'diagnostic' | 'debug';  // Tipo do ticket
  repository_name: string;
  problem_description: string;
  error_message?: string;
  diagnosis_result?: DiagnosticResult;  // Para tickets de diagnóstico
  debug_result?: DebugResultData;  // Para tickets de debug (preservado original)
  debug_log: string;  // Log formatado para compartilhamento
  debug_code?: string;
  affected_files: string[];
  notes: string[];
  share_url?: string;
}

export interface DiagnosticHistory {
  total: number;
  tickets: DiagnosticTicket[];
}

export interface CreateTicketRequest {
  repository_name: string;
  problem_description: string;
  error_message?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  days_lookback?: number;
  created_by?: string;
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 60000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
        throw new Error(error.detail || 'Erro na requisição');
      }

      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Timeout: a requisição demorou muito');
      }
      throw err;
    }
  }

  // Config
  async getStatus(): Promise<AppStatus> {
    return this.request('/config/status');
  }

  async updateConfig(config: {
    github_token?: string;
    ai_provider?: 'openai' | 'gemini' | 'anthropic';
    ai_api_key?: string;
    ai_model?: string;
  }): Promise<{ message: string }> {
    return this.request('/config/update', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async getAIModels(): Promise<Record<string, AIModel[]>> {
    return this.request('/config/ai-models');
  }

  // Repositories
  async listRepositories(language?: string): Promise<Repository[]> {
    const params = language ? `?language=${language}` : '';
    return this.request(`/repositories/${params}`);
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    return this.request(`/repositories/${owner}/${repo}`);
  }

  async getLanguages(): Promise<string[]> {
    return this.request('/repositories/languages');
  }

  async listFolders(owner: string, repo: string): Promise<{
    repository: string;
    folders: Array<{
      name: string;
      path: string;
      depth: number;
      code_files: number;
    }>;
  }> {
    return this.request(`/repositories/${owner}/${repo}/folders`);
  }

  // Analysis
  async startAnalysis(repositories: string[]): Promise<{ message: string }> {
    return this.request('/analysis/start', {
      method: 'POST',
      body: JSON.stringify({ repositories }),
    });
  }

  async analyzeRepository(owner: string, repo: string, folderPath?: string): Promise<KnowledgeBase> {
    const params = folderPath ? `?folder_path=${encodeURIComponent(folderPath)}` : '';
    // Timeout de 5 minutos para análise
    return this.request(`/analysis/analyze/${owner}/${repo}${params}`, {
      method: 'POST',
    }, 300000);
  }

  async getAnalysisStatus(owner: string, repo: string, folderPath?: string): Promise<AnalysisStatus> {
    const params = folderPath ? `?folder_path=${encodeURIComponent(folderPath)}` : '';
    return this.request(`/analysis/status/${owner}/${repo}${params}`);
  }

  async listKnowledgeBases(): Promise<string[]> {
    return this.request('/analysis/knowledge-bases');
  }

  async getKnowledgeBase(owner: string, repo: string, folderPath?: string): Promise<KnowledgeBase> {
    const params = folderPath ? `?folder_path=${encodeURIComponent(folderPath)}` : '';
    return this.request(`/analysis/knowledge-base/${owner}/${repo}${params}`);
  }

  async deleteKnowledgeBase(owner: string, repo: string, folderPath?: string): Promise<void> {
    const params = folderPath ? `?folder_path=${encodeURIComponent(folderPath)}` : '';
    return this.request(`/analysis/knowledge-base/${owner}/${repo}${params}`, {
      method: 'DELETE',
    });
  }

  async clearAllKnowledgeBases(): Promise<void> {
    return this.request('/analysis/knowledge-bases/clear', {
      method: 'DELETE',
    });
  }

  async getTechnicalKB(owner: string, repo: string): Promise<TechnicalKnowledgeBase> {
    return this.request(`/analysis/knowledge-base/${owner}/${repo}/technical`);
  }

  async getBusinessKB(owner: string, repo: string): Promise<BusinessKnowledgeBase> {
    return this.request(`/analysis/knowledge-base/${owner}/${repo}/business`);
  }

  async chat(
    message: string,
    contextRepos: string[] = [],
    mode: 'technical' | 'business' = 'technical'
  ): Promise<{ response: string; sources: string[] }> {
    return this.request('/analysis/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        context_repos: contextRepos,
        mode,
      }),
    });
  }

  async chatStream(
    message: string,
    contextRepos: string[] = [],
    mode: 'technical' | 'business' = 'technical',
    onChunk: (chunk: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2min timeout

    try {
      const response = await fetch(`${API_BASE}/analysis/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context_repos: contextRepos,
          mode,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Erro no chat');
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                onChunk(parsed.content);
              }
              if (parsed.error && onError) {
                onError(parsed.error);
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          onError?.('Timeout: a requisição demorou muito');
        } else {
            onError?.(err.message);
        }
      }
      throw err;
    }
  }

  // ===== VECTOR SEARCH / RAG =====

  async indexAllAgents(): Promise<{ success: number; failed: number; agents: string[] }> {
    return this.request('/search/index-all', {
      method: 'POST',
    }, 300000); // 5 min timeout
  }

  async searchAgents(query: string, n: number = 5): Promise<SearchResult[]> {
    return this.request(`/search/agents?q=${encodeURIComponent(query)}&n=${n}`);
  }

  async findExistingAgent(description: string): Promise<FindAgentResult> {
    return this.request('/analysis/find-agent', {
      method: 'POST',
      body: JSON.stringify({ description }),
    }, 120000);
  }

  // Criar repositório a partir de agente existente
  async createRepoFromAgent(data: {
    name: string;
    description?: string;
    source_repo: string;
    source_folder: string;
    team_slug?: string;
    private?: boolean;
  }): Promise<{
    success: boolean;
    repository: {
      name: string;
      full_name: string;
      url: string;
      clone_url: string;
    };
    copy_result: {
      files_copied: number;
      errors: string[];
    };
    message: string;
  }> {
    return this.request('/repositories/create-from-agent', {
      method: 'POST',
      body: JSON.stringify(data),
    }, 180000); // 3 min timeout
  }

  // Listar times da organização
  async listOrgTeams(org: string = 'weni-ai'): Promise<{ teams: Array<{ id: number; name: string; slug: string }> }> {
    return this.request(`/repositories/org/${org}/teams`);
  }

  // Listar repositórios da organização (apenas -agents)
  async listOrgRepos(org: string = 'weni-ai', filterAgents: boolean = true): Promise<{
    repositories: Array<{
      name: string;
      full_name: string;
      description: string | null;
      url: string;
      private: boolean;
    }>
  }> {
    return this.request(`/repositories/org/${org}/repos?filter_agents=${filterAgents}`);
  }

  // Copiar agente para repositório existente
  async copyAgentToExisting(data: {
    target_repo: string;
    source_repo: string;
    source_folder: string;
    target_folder?: string;
  }): Promise<{
    success: boolean;
    repository: {
      name: string;
      full_name: string;
      url: string;
    };
    copy_result: {
      files_copied: number;
      errors: string[];
    };
    message: string;
  }> {
    return this.request('/repositories/copy-to-existing', {
      method: 'POST',
      body: JSON.stringify(data),
    }, 180000);
  }

  async getVectorStats(): Promise<VectorStats> {
    return this.request('/search/stats');
  }

  async clearVectorIndex(): Promise<void> {
    return this.request('/search/clear', {
      method: 'DELETE',
    });
  }

  // Chat RAG (busca contexto automaticamente)
  async chatRag(
    message: string,
    mode: 'technical' | 'business' = 'technical'
  ): Promise<{ response: string; sources: string[] }> {
    return this.request('/analysis/chat/rag', {
      method: 'POST',
      body: JSON.stringify({
        message,
        mode,
      }),
    }, 120000);
  }

  async chatRagStream(
    message: string,
    mode: 'technical' | 'business' = 'technical',
    onChunk: (chunk: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(`${API_BASE}/analysis/chat/rag/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          mode,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Erro no chat RAG');
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                onChunk(parsed.content);
              }
              if (parsed.error && onError) {
                onError(parsed.error);
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          onError?.('Timeout: a requisição demorou muito');
        } else {
          onError?.(err.message);
        }
      }
      throw err;
    }
  }

  // Chat com contexto de uma KB específica
  async chatWithKB(
    message: string,
    kbName: string,
    mode: 'technical' | 'business' = 'technical',
    onChunk: (chunk: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(`${API_BASE}/analysis/chat/kb/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          kb_name: kbName,
          mode,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Erro no chat');
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                onChunk(parsed.content);
              }
              if (parsed.error && onError) {
                onError(parsed.error);
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          onError?.('Timeout: a requisição demorou muito');
        } else {
          onError?.(err.message);
        }
      }
      throw err;
    }
  }

  // Debug de problemas
  async debugProblem(request: {
    repository: string;
    folder_path: string;
    problem_description: string;
    output_json?: string;
  }) {
    return this.request<any>('/analysis/debug', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ============================================
  // DIFF DE ATUALIZAÇÕES (PARA CS)
  // ============================================

  // Cria snapshot da indexação atual
  async createSnapshot(repositoryName: string, indexedBy: string = 'system'): Promise<{
    success: boolean;
    snapshot_id: string;
    timestamp: string;
  }> {
    return this.request(`/analysis/snapshot/${encodeURIComponent(repositoryName)}?indexed_by=${indexedBy}`, {
      method: 'POST',
    });
  }

  // Lista snapshots de um repositório
  async getSnapshots(repositoryName: string): Promise<{
    repository_name: string;
    total: number;
    snapshots: Array<{
      id: string;
      timestamp: string;
      indexed_by: string;
      content_hash: string;
    }>;
  }> {
    return this.request(`/analysis/snapshots/${encodeURIComponent(repositoryName)}`);
  }

  // Obtém diff entre indexações
  async getUpdatesDiff(
    repositoryName: string,
    fromSnapshot?: string,
    toSnapshot?: string
  ): Promise<{
    has_diff: boolean;
    message?: string;
    diff?: UpdatesDiff;
  }> {
    let url = `/analysis/updates-diff/${encodeURIComponent(repositoryName)}`;
    const params = [];
    if (fromSnapshot) params.push(`from_snapshot=${fromSnapshot}`);
    if (toSnapshot) params.push(`to_snapshot=${toSnapshot}`);
    if (params.length > 0) url += '?' + params.join('&');
    
    return this.request(url);
  }

  // ============================================
  // DIAGNÓSTICO DE PROBLEMAS
  // ============================================

  // Diagnostica problema e correlaciona com mudanças
  async diagnoseProblem(request: {
    repository_name: string;
    problem_description: string;
    error_message?: string;
    expected_behavior?: string;
    actual_behavior?: string;
    days_lookback?: number;
  }): Promise<DiagnosticResult> {
    return this.request('/analysis/diagnose', {
      method: 'POST',
      body: JSON.stringify(request),
    }, 120000); // 2 min timeout
  }

  // Cria ticket de diagnóstico para compartilhamento
  async createDiagnosticTicket(request: CreateTicketRequest): Promise<DiagnosticTicket> {
    return this.request('/analysis/diagnostic/ticket', {
      method: 'POST',
      body: JSON.stringify(request),
    }, 120000);
  }

  // Busca ticket por ID
  async getDiagnosticTicket(ticketId: string): Promise<DiagnosticTicket> {
    return this.request(`/analysis/diagnostic/ticket/${ticketId}`);
  }

  // Lista histórico de diagnósticos
  async getDiagnosticHistory(params?: {
    repository_name?: string;
    status?: string;
    limit?: number;
  }): Promise<DiagnosticHistory> {
    const queryParams = new URLSearchParams();
    if (params?.repository_name) queryParams.set('repository_name', params.repository_name);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return this.request(`/analysis/diagnostic/history${query ? `?${query}` : ''}`);
  }

  // Atualiza status do ticket
  async updateDiagnosticTicket(ticketId: string, status: string, note?: string): Promise<DiagnosticTicket> {
    return this.request(`/analysis/diagnostic/ticket/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    });
  }

  // Busca apenas o log de debug do ticket
  async getDiagnosticTicketLog(ticketId: string): Promise<{ ticket_id: string; debug_log: string; share_url: string }> {
    return this.request(`/analysis/diagnostic/ticket/${ticketId}/log`);
  }

  // Cria ticket a partir do resultado do Debug (não faz novo diagnóstico)
  async createDebugTicket(request: {
    repository_name: string;
    problem_description: string;
    error_message?: string;
    debug_result: Record<string, unknown>;
    created_by?: string;
  }): Promise<DiagnosticTicket> {
    return this.request('/analysis/diagnostic/debug-ticket', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ============================================
  // GERENCIAMENTO DE PROMPTS
  // ============================================

  async listPrompts(category?: string) {
    const url = category ? `/prompts/?category=${category}` : '/prompts/';
    return this.request<PromptConfig[]>(url);
  }

  async getAllPrompts() {
    return this.request<PromptConfig[]>('/prompts/');
  }

  async getPromptCategories() {
    return this.request<{ id: string; name: string }[]>('/prompts/categories');
  }

  async getPrompt(promptId: string) {
    return this.request<PromptConfig>(`/prompts/${promptId}`);
  }

  async createPrompt(data: PromptCreate) {
    return this.request<PromptConfig>('/prompts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePrompt(promptId: string, data: PromptUpdate) {
    return this.request<PromptConfig>(`/prompts/${promptId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePrompt(promptId: string) {
    return this.request<{ message: string }>(`/prompts/${promptId}`, {
      method: 'DELETE',
    });
  }

  async duplicatePrompt(promptId: string, newName: string) {
    return this.request<PromptConfig>(`/prompts/${promptId}/duplicate?new_name=${encodeURIComponent(newName)}`, {
      method: 'POST',
    });
  }

  async testPrompt(promptId: string, variables: Record<string, string>) {
    return this.request<PromptTestResult>('/prompts/test', {
      method: 'POST',
      body: JSON.stringify({ prompt_id: promptId, variables }),
    });
  }

  async getPromptVariables(promptId: string) {
    return this.request<{ variables: string[] }>(`/prompts/${promptId}/variables`);
  }
}

// Interfaces para Prompts
export interface PromptConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  system_prompt: string;
  user_prompt_template: string;
  model: string | null;
  provider: string | null;
  temperature: number;
  max_tokens: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptCreate {
  name: string;
  description: string;
  category: string;
  system_prompt: string;
  user_prompt_template?: string;
  model?: string;
  provider?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface PromptUpdate {
  name?: string;
  description?: string;
  system_prompt?: string;
  user_prompt_template?: string;
  model?: string;
  provider?: string;
  temperature?: number;
  max_tokens?: number;
  is_active?: boolean;
}

export interface PromptTestResult {
  prompt_id: string;
  input_rendered: string;
  output: string;
  model_used: string;
  tokens_used: number | null;
  duration_ms: number;
}

// ============================================
// ADMIN E MÉTRICAS
// ============================================

export interface TokenUsageRecord {
  id: string;
  timestamp: string;
  operation: string;
  prompt_id: string | null;
  repository: string | null;
  folder: string | null;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  duration_ms: number;
}

export interface TokenUsageSummary {
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_estimated_cost: number;
  by_operation: Record<string, { count: number; tokens: number; cost: number }>;
  by_model: Record<string, { count: number; tokens: number; cost: number }>;
  by_day: Record<string, { count: number; tokens: number; cost: number }>;
}

export interface AnalysisRecord {
  id: string;
  timestamp: string;
  repository: string;
  folder: string | null;
  status: string;
  operation: string;  // repository_analysis, debug, agent_search
  kb_types: string[];
  model_used: string;
  provider: string;
  duration_seconds: number;
  files_analyzed: number;
  tokens_used: number;
  estimated_cost: number;
  error_message: string | null;
}

export interface AnalysisHistory {
  total_analyses: number;
  successful: number;
  failed: number;
  records: AnalysisRecord[];
}

export const api = new ApiService();

// ============================================
// PROJECTS AND TOOLS INTERFACES
// ============================================

export interface Project {
  uuid: string;
  title: string;
  description?: string;
  org: string;
  status: string;
  path: string;
  tools: ProjectTool[];
  created_at?: string;
  updated_at?: string;
}

export interface ProjectTool {
  [slug: string]: {
    name: string;
    description?: string;
    source: {
      path: string;
      entrypoint: string;
    };
    parameters: ToolParameter[];
  };
}

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

export interface OfficialTool {
  slug: string;
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
}

export interface GeneratedTool {
  tool_slug: string;
  tool_name: string;
  description: string;
  main_py: string;
  requirements_txt: string;
  parameters: ToolParameter[];
}

export interface AgentPreview {
  preview: boolean;
  source: 'ai' | 'fallback';
  suggested_config: {
    name: string;
    instructions: string | string[];
    guardrails?: string[];
    skills: Array<{ name: string; description: string }>;
  };
  fallback_reason?: string;
}

// ============================================
// PROJECTS SERVICE
// ============================================

class ProjectsService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 60000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
        throw new Error(error.detail || 'Erro na requisição');
      }

      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Timeout: a requisição demorou muito');
      }
      throw err;
    }
  }

  // Projects CRUD
  async listProjects(): Promise<Project[]> {
    return this.request('/projects');
  }

  async getProject(uuid: string): Promise<Project> {
    return this.request(`/projects/${uuid}`);
  }

  async createProject(data: {
    name: string;
    goal: string;
    instructions?: string | string[];
    skills?: Array<{ name: string; description: string }>;
    uuid?: string;
  }): Promise<{ status: string; path: string; uuid: string; slug: string }> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(uuid: string, data: { name?: string }): Promise<{ status: string }> {
    return this.request(`/projects/${uuid}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(uuid: string): Promise<{ status: string; message: string }> {
    return this.request(`/projects/${uuid}`, {
      method: 'DELETE',
    });
  }

  // Project YAML
  async getProjectYaml(uuid: string): Promise<{ content: string }> {
    return this.request(`/projects/${uuid}/yaml`);
  }

  async updateProjectYaml(uuid: string, content: string): Promise<{ status: string }> {
    return this.request(`/projects/${uuid}/yaml`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async improveProjectYaml(uuid: string, goal?: string, instructions?: string): Promise<{
    status: string;
    original_yaml: string;
    improved_yaml: string;
    prompt_used: string;
  }> {
    return this.request(`/projects/${uuid}/yaml/improve`, {
      method: 'POST',
      body: JSON.stringify({ goal, instructions }),
    });
  }

  // Project Tools
  async listProjectTools(uuid: string): Promise<ProjectTool[]> {
    return this.request(`/projects/${uuid}/tools`);
  }

  async addProjectTool(uuid: string, tool: {
    tool_slug: string;
    tool_name: string;
    description?: string;
    main_py?: string;
    requirements_txt?: string;
    parameters?: ToolParameter[];
  }): Promise<{ status: string; tool_slug: string }> {
    return this.request(`/projects/${uuid}/tools`, {
      method: 'POST',
      body: JSON.stringify(tool),
    });
  }

  async deleteProjectTool(uuid: string, slug: string): Promise<{ status: string }> {
    return this.request(`/projects/${uuid}/tools/${slug}`, {
      method: 'DELETE',
    });
  }

  async getToolSource(uuid: string, slug: string): Promise<{ main_py: string; requirements_txt: string }> {
    return this.request(`/projects/${uuid}/tools/${slug}/source`);
  }

  async updateToolSource(uuid: string, slug: string, main_py: string, requirements_txt?: string): Promise<{ status: string }> {
    return this.request(`/projects/${uuid}/tools/${slug}/source`, {
      method: 'PUT',
      body: JSON.stringify({ main_py, requirements_txt }),
    });
  }

  // Agent Preview (AI-powered)
  async previewAgent(data: { name: string; goal: string; uuid?: string }): Promise<AgentPreview> {
    return this.request('/projects/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }, 120000);
  }
}

// ============================================
// TOOLS SERVICE
// ============================================

class ToolsService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 60000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
        throw new Error(error.detail || 'Erro na requisição');
      }

      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Timeout: a requisição demorou muito');
      }
      throw err;
    }
  }

  // Official Tools Library
  async listOfficialTools(category?: string): Promise<OfficialTool[]> {
    const params = category ? `?category=${category}` : '';
    return this.request(`/tools/official${params}`);
  }

  async getOfficialTool(slug: string): Promise<OfficialTool> {
    return this.request(`/tools/official/${slug}`);
  }

  async generateOfficialToolCode(slug: string): Promise<GeneratedTool> {
    return this.request(`/tools/official/${slug}/generate`, {
      method: 'POST',
    }, 120000);
  }

  // Tool Generation
  async generateTool(data: {
    documentation?: string;
    url?: string;
    tool_name?: string;
    tool_description?: string;
  }): Promise<GeneratedTool> {
    return this.request('/tools/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }, 120000);
  }

  async improveTool(current_code: string, feedback: string): Promise<{ main_py: string; changes: string[] }> {
    return this.request('/tools/improve', {
      method: 'POST',
      body: JSON.stringify({ current_code, feedback }),
    }, 120000);
  }

  // Categories
  async listCategories(): Promise<Record<string, { name: string; count: number; tools: string[] }>> {
    return this.request('/tools/categories');
  }
}

export const projectsApi = new ProjectsService();
export const toolsApi = new ToolsService();

// ============================================
// WENI CLOUD INTEGRATION
// ============================================

export interface WeniOrganization {
  name: string;
  uuid: string;
}

export interface WeniProject {
  name: string;
  uuid: string;
}

export interface WeniOrgWithProjects {
  org_name: string;
  org_uuid: string;
  projects: WeniProject[];
  error?: string | null;
}

export interface ConversationSearchRequest {
  project_uuid: string;
  contact_urn: string;
  days_back?: number;
  start_date?: string;
  end_date?: string;
}

export interface ConversationMessage {
  id: number;  // ID para buscar traces
  uuid?: string;
  text?: string;
  source_type?: 'user' | 'agent';  // Formato do Nexus
  direction?: 'in' | 'out';  // Formato alternativo
  created_at?: string;  // Formato do Nexus
  created_on?: string;  // Formato alternativo
  msg_type?: string;
  attachments?: any[];
  [key: string]: any;  // Permite campos adicionais
}

export interface TraceToolDetails {
  action_group: string;
  function: string;
  parameters: Array<{ name: string; value: string }>;
}

export interface TraceDelegation {
  target_agent: string;
  input_text: string;
}

export interface ProcessedTrace {
  agent_name: string;
  type: string;
  tool_name: string;
  tool_details?: TraceToolDetails;
  delegation?: TraceDelegation;
  raw_trace: any;
}

export interface MessageTracesResult {
  success: boolean;
  project_uuid: string;
  log_id: number;
  total_traces: number;
  traces: ProcessedTrace[];
  raw_traces: any[];
}

export interface ConversationSearchResult {
  success: boolean;
  project_uuid: string;
  contact_urn: string;
  period: {
    start: string;
    end: string;
    days: number;
  };
  data?: any;
  total_messages?: number;
  messages?: ConversationMessage[];
}

class WeniService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 60000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
        throw new Error(error.detail || 'Erro na requisição');
      }

      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Timeout: a requisição demorou muito');
      }
      throw err;
    }
  }

  // Status
  async getStatus(): Promise<{ connected: boolean; has_token: boolean }> {
    return this.request('/weni/status');
  }

  // Auth
  async getLoginUrl(redirectUri?: string): Promise<{ login_url: string; redirect_uri: string }> {
    const params = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
    return this.request(`/weni/login-url${params}`);
  }

  async startAuth(): Promise<{ login_url: string; callback_started: boolean }> {
    return this.request('/weni/start-auth', {
      method: 'POST',
    });
  }

  async waitAuth(): Promise<{ success: boolean; connected: boolean }> {
    // Timeout maior para esperar o usuário fazer login (5 minutos)
    return this.request('/weni/wait-auth', {}, 310000);
  }

  async exchangeToken(code: string, redirectUri?: string): Promise<{ success: boolean; message: string }> {
    return this.request('/weni/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
  }

  async logout(): Promise<{ success: boolean; message: string }> {
    return this.request('/weni/logout', {
      method: 'POST',
    });
  }

  // Projects
  async listAllProjects(): Promise<WeniOrgWithProjects[]> {
    return this.request('/weni/projects', {}, 120000);
  }

  async listOrganizations(): Promise<{ results: WeniOrganization[]; next?: string }> {
    return this.request('/weni/organizations');
  }

  async listProjects(orgUuid: string): Promise<{ results: WeniProject[]; next?: string }> {
    return this.request(`/weni/organizations/${orgUuid}/projects`);
  }

  // Nexus - Conversations
  async searchConversations(request: ConversationSearchRequest): Promise<ConversationSearchResult> {
    return this.request('/weni/conversations', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getConversationMessages(request: ConversationSearchRequest): Promise<ConversationSearchResult> {
    return this.request('/weni/conversations/messages', {
      method: 'POST',
      body: JSON.stringify(request),
    }, 120000);  // 2 min timeout para buscar todas as mensagens
  }

  async getMessageTraces(projectUuid: string, logId: number): Promise<MessageTracesResult> {
    return this.request('/weni/traces', {
      method: 'POST',
      body: JSON.stringify({
        project_uuid: projectUuid,
        log_id: logId
      }),
    });
  }
}

export const weniApi = new WeniService();

// ============================================
// ADMIN SERVICE (com autenticação)
// ============================================

class AdminService {
  private token: string | null = null;
  
  constructor() {
    // Recuperar token do localStorage se existir
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('admin_token');
    }
  }
  
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
      throw new Error(error.detail || `Erro ${response.status}`);
    }
    
    return response.json();
  }
  
  // Autenticação
  async login(password: string): Promise<{ success: boolean; message: string }> {
    const result = await this.request<{ success: boolean; token: string; message: string }>(
      '/admin/login',
      { method: 'POST', body: JSON.stringify({ password }) }
    );
    
    if (result.success && result.token) {
      this.token = result.token;
      localStorage.setItem('admin_token', result.token);
    }
    
    return { success: result.success, message: result.message };
  }
  
  async logout(): Promise<void> {
    try {
      await this.request('/admin/logout', { method: 'POST' });
    } catch {}
    this.token = null;
    localStorage.removeItem('admin_token');
  }
  
  async verifyToken(): Promise<boolean> {
    if (!this.token) return false;
    try {
      await this.request('/admin/verify');
      return true;
    } catch {
      this.token = null;
      localStorage.removeItem('admin_token');
      return false;
    }
  }
  
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.request('/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
  }
  
  isAuthenticated(): boolean {
    return !!this.token;
  }
  
  // Métricas
  async getMetricsSummary(days: number = 30): Promise<TokenUsageSummary> {
    return this.request(`/admin/metrics/summary?days=${days}`);
  }
  
  async getRecentUsage(limit: number = 50): Promise<{ records: TokenUsageRecord[] }> {
    return this.request(`/admin/metrics/recent?limit=${limit}`);
  }
  
  // Histórico de análises
  async getAnalysisHistory(limit: number = 100, repository?: string): Promise<AnalysisHistory> {
    const url = repository 
      ? `/admin/history?limit=${limit}&repository=${encodeURIComponent(repository)}`
      : `/admin/history?limit=${limit}`;
    return this.request(url);
  }
  
  // Preços
  async getTokenPrices(): Promise<Record<string, Record<string, { input: number; output: number }>>> {
    return this.request('/admin/token-prices');
  }
}

export const adminApi = new AdminService();
