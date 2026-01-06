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
    ai_provider?: 'openai' | 'gemini';
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
