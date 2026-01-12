/**
 * Debug de Problemas com visual premium.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bug, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Code,
  FileText,
  ChevronDown,
  Lightbulb,
  Target,
  Folder,
  Zap,
  Database,
  ArrowRight,
  Eye,
  Share2,
  Copy,
  Check,
  History,
  Ticket,
  Cloud,
  Phone,
  Calendar,
  Download,
  X,
  Search,
  Building2,
  FolderKanban,
  MessageSquare,
  Activity
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api, DiagnosticTicket, DiagnosticHistory, weniApi, ConversationMessage, WeniProject, WeniOrganization, ProcessedTrace } from '../services/api';

interface DataAnalysis {
  seller_info?: string;
  data_returned?: string;
  data_expected?: string;
  discrepancy?: string;
}

interface DebugResult {
  problem_summary: string;
  root_cause: string | null;
  data_flow: string;
  data_analysis?: DataAnalysis;
  tool_logic_issue?: string;
  affected_handlers: string[];
  affected_code_locations: string[];
  evidence?: string[];
  suggestions: string[];
  confidence: 'low' | 'medium' | 'high';
  agent_definition_found: boolean;
  knowledge_base_found: boolean;
  error?: string;
  raw_analysis?: string;  // Análise bruta quando JSON falha
}

// Interface para organização com projetos
interface OrgWithProjects {
  org_name: string;
  org_uuid: string;
  projects: WeniProject[];
  projectsLoaded: boolean;
  loadingProjects: boolean;
  error?: string | null;
}

export function DebugPanel() {
  const { knowledgeBases, status } = useAppStore();
  
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [outputJson, setOutputJson] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['cause', 'analysis']));
  
  // Estado para tickets
  const [currentTicket, setCurrentTicket] = useState<DiagnosticTicket | null>(null);
  const [history, setHistory] = useState<DiagnosticHistory | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [copied, setCopied] = useState(false);

  // ======= Estados para Busca de Conversas (Nexus) =======
  const [showConversationSearch, setShowConversationSearch] = useState(false);
  const [isWeniConnected, setIsWeniConnected] = useState(false);
  const [weniLoading, setWeniLoading] = useState(true);
  const [weniLoggingIn, setWeniLoggingIn] = useState(false);
  
  // Seleção de projeto Weni
  const [projectUuid, setProjectUuid] = useState('');
  const [projectName, setProjectName] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [organizations, setOrganizations] = useState<OrgWithProjects[]>([]);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  
  // Busca de conversas
  const [contactUrn, setContactUrn] = useState('');
  const [conversationDaysBack, setConversationDaysBack] = useState(7);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [showConversationPreview, setShowConversationPreview] = useState(false);
  
  // Traces de mensagem
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [isLoadingTraces, setIsLoadingTraces] = useState(false);
  const [traces, setTraces] = useState<ProcessedTrace[]>([]);
  const [tracesError, setTracesError] = useState<string | null>(null);
  const [showTracesModal, setShowTracesModal] = useState(false);
  
  const analyzedRepos = [...new Set(knowledgeBases.map(kb => {
    const parts = kb.split('/');
    return `${parts[0]}/${parts[1]}`;
  }))];

  // ======= Funções para Nexus/Conversas =======
  
  // Verifica conexão com Weni
  const checkWeniStatus = useCallback(async () => {
    try {
      setWeniLoading(true);
      const status = await weniApi.getStatus();
      setIsWeniConnected(status.connected);
    } catch {
      setIsWeniConnected(false);
    } finally {
      setWeniLoading(false);
    }
  }, []);

  useEffect(() => {
    checkWeniStatus();
  }, [checkWeniStatus]);

  // Login Weni
  const handleWeniLogin = async () => {
    try {
      setWeniLoggingIn(true);
      setConversationError(null);
      
      const { login_url } = await weniApi.startAuth();
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        login_url,
        'weni-login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );
      
      const result = await weniApi.waitAuth();
      
      if (result.success) {
        await checkWeniStatus();
      }
    } catch (err: any) {
      setConversationError(err.message || 'Erro no login');
    } finally {
      setWeniLoggingIn(false);
    }
  };

  // Carrega organizações
  const loadOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      setConversationError(null);
      const data = await weniApi.listOrganizations();
      
      const orgsWithProjects: OrgWithProjects[] = (data.results || []).map((org: WeniOrganization) => ({
        org_name: org.name,
        org_uuid: org.uuid,
        projects: [],
        projectsLoaded: false,
        loadingProjects: false,
        error: null
      }));
      
      setOrganizations(orgsWithProjects);
      setExpandedOrgs(new Set());
    } catch (err: any) {
      setConversationError(err.message);
    } finally {
      setLoadingOrgs(false);
    }
  };

  // Carrega projetos de uma organização
  const loadProjectsForOrg = async (orgUuid: string) => {
    setOrganizations(prev => prev.map(org => 
      org.org_uuid === orgUuid 
        ? { ...org, loadingProjects: true, error: null }
        : org
    ));

    try {
      const data = await weniApi.listProjects(orgUuid);
      const projects: WeniProject[] = (data.results || []).map((p: any) => ({
        name: p.name,
        uuid: p.uuid
      }));

      setOrganizations(prev => prev.map(org => 
        org.org_uuid === orgUuid 
          ? { ...org, projects, projectsLoaded: true, loadingProjects: false }
          : org
      ));
    } catch (err: any) {
      setOrganizations(prev => prev.map(org => 
        org.org_uuid === orgUuid 
          ? { ...org, loadingProjects: false, error: err.message }
          : org
      ));
    }
  };

  // Toggle org expansion
  const toggleOrg = async (orgUuid: string) => {
    const org = organizations.find(o => o.org_uuid === orgUuid);
    
    if (expandedOrgs.has(orgUuid)) {
      setExpandedOrgs(prev => {
        const next = new Set(prev);
        next.delete(orgUuid);
        return next;
      });
    } else {
      setExpandedOrgs(prev => {
        const next = new Set(prev);
        next.add(orgUuid);
        return next;
      });
      
      if (org && !org.projectsLoaded && !org.loadingProjects) {
        loadProjectsForOrg(orgUuid);
      }
    }
  };

  // Seleciona projeto
  const handleSelectProject = (uuid: string, name: string) => {
    setProjectUuid(uuid);
    setProjectName(name);
    setShowProjectModal(false);
  };

  // Abre modal de projetos
  const handleOpenProjectModal = () => {
    setShowProjectModal(true);
    setOrgSearchQuery('');
    if (isWeniConnected && organizations.length === 0) {
      loadOrganizations();
    }
  };

  // Busca conversas
  const handleSearchConversations = async () => {
    if (!projectUuid || !contactUrn.trim()) {
      setConversationError('Preencha o projeto e o URN do contato');
      return;
    }
    
    setIsLoadingConversations(true);
    setConversationError(null);
    setConversations([]);
    
    try {
      const result = await weniApi.getConversationMessages({
        project_uuid: projectUuid,
        contact_urn: contactUrn.trim(),
        days_back: conversationDaysBack
      });
      
      if (result.success && result.messages) {
        setConversations(result.messages);
        setShowConversationPreview(true);
        
        // Auto-preenche a descrição do problema com contexto da conversa
        if (result.messages.length > 0) {
          const conversationContext = formatConversationForDebug(result.messages);
          setProblemDescription(prev => prev ? prev + '\n\n--- Conversa do Nexus ---\n' + conversationContext : conversationContext);
        }
      } else {
        setConversationError('Nenhuma conversa encontrada no período');
      }
    } catch (err: any) {
      setConversationError(err.message || 'Erro ao buscar conversas');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Formata conversas para debug
  const formatConversationForDebug = (messages: ConversationMessage[]): string => {
    const lastMessages = messages.slice(-20);
    
    return lastMessages.map(msg => {
      const isUser = msg.source_type === 'user' || msg.direction === 'in';
      const direction = isUser ? '👤 Usuário' : '🤖 Agente';
      const text = msg.text || '[mídia/anexo]';
      return `${direction}: ${text}`;
    }).join('\n');
  };

  // Busca traces de uma mensagem do agente
  const handleSelectAgentMessage = async (message: ConversationMessage) => {
    if (!projectUuid || !message.id) return;
    
    setSelectedMessageId(message.id);
    setIsLoadingTraces(true);
    setTracesError(null);
    setTraces([]);
    setShowTracesModal(true);
    
    try {
      const result = await weniApi.getMessageTraces(projectUuid, message.id);
      
      if (result.success && result.traces) {
        setTraces(result.traces);
        
        // Auto-preenche informações de traces no JSON
        if (result.traces.length > 0) {
          const tracesContext = formatTracesForDebug(result.traces, message.text || '');
          setOutputJson(prev => prev ? prev + '\n\n' + tracesContext : tracesContext);
        }
      }
    } catch (err: any) {
      setTracesError(err.message || 'Erro ao buscar traces');
    } finally {
      setIsLoadingTraces(false);
    }
  };

  // Formata traces para debug
  const formatTracesForDebug = (traceList: ProcessedTrace[], messageText: string): string => {
    let output = `// Traces da mensagem: "${messageText.substring(0, 100)}..."\n`;
    
    traceList.forEach((trace, idx) => {
      if (trace.tool_details) {
        output += `\n[Tool ${idx + 1}] ${trace.tool_name || trace.tool_details.function}\n`;
        output += `Agente: ${trace.agent_name}\n`;
        output += `Parâmetros:\n`;
        trace.tool_details.parameters.forEach(param => {
          output += `  ${param.name}: ${param.value}\n`;
        });
      } else if (trace.delegation) {
        output += `\n[Delegação ${idx + 1}] → ${trace.delegation.target_agent}\n`;
        output += `Input: ${trace.delegation.input_text.substring(0, 200)}...\n`;
      }
    });
    
    return output;
  };

  // Retorna ícone e cor baseado no tipo de trace
  const getTraceTypeInfo = (trace: ProcessedTrace) => {
    switch (trace.type) {
      case 'executing_tool':
        return { icon: '🔧', color: 'text-blue-600', bg: 'bg-blue-50', label: 'Tool' };
      case 'delegating_to_agent':
        return { icon: '🤝', color: 'text-purple-600', bg: 'bg-purple-50', label: 'Delegação' };
      case 'invoking_model':
        return { icon: '🧠', color: 'text-amber-600', bg: 'bg-amber-50', label: 'Modelo' };
      case 'model_response_received':
        return { icon: '💬', color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Resposta' };
      default:
        return { icon: '📋', color: 'text-gray-600', bg: 'bg-gray-50', label: trace.type };
    }
  };

  // Filtra organizações
  const filteredOrgs = orgSearchQuery.trim()
    ? organizations.filter(org => {
        const query = orgSearchQuery.toLowerCase();
        const orgMatches = org.org_name.toLowerCase().includes(query);
        if (org.projectsLoaded) {
          const projectMatches = org.projects.some(
            p => p.name.toLowerCase().includes(query) || p.uuid.toLowerCase().includes(query)
          );
          return orgMatches || projectMatches;
        }
        return orgMatches;
      })
    : organizations;
  
  const handleRepoChange = async (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    setSelectedFolder('');
    
    const repoFolders = knowledgeBases
      .filter(kb => kb.startsWith(repoFullName + '/'))
      .map(kb => kb.split('/').slice(2).join('/'))
      .filter(f => f);
    
    setFolders(repoFolders);
  };
  
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Funções de ticket
  const handleCreateTicket = async () => {
    if (!result || !selectedRepo) return;
    
    const repoName = selectedFolder 
      ? `${selectedRepo}/${selectedFolder}` 
      : selectedRepo;
    
    setIsCreatingTicket(true);
    try {
      // Usa o novo endpoint que aproveita o resultado do debug já feito
      const ticket = await api.createDebugTicket({
        repository_name: repoName,
        problem_description: problemDescription,
        error_message: outputJson || undefined,
        debug_result: result as unknown as Record<string, unknown>,
        created_by: 'Debug'
      });
      
      setCurrentTicket(ticket);
      loadHistory();
    } catch (err) {
      console.error('Erro ao criar ticket:', err);
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await api.getDiagnosticHistory({ limit: 20 });
      setHistory(data);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const handleToggleHistory = () => {
    if (!showHistory && !history) {
      loadHistory();
    }
    setShowHistory(!showHistory);
  };
  
  const handleDebug = async () => {
    if (!selectedRepo || !selectedFolder || !problemDescription) return;
    
    setIsLoading(true);
    setResult(null);
    
    try {
      const response = await api.debugProblem({
        repository: selectedRepo,
        folder_path: selectedFolder,
        problem_description: problemDescription,
        output_json: outputJson || undefined
      });
      
      setResult(response);
    } catch (error: any) {
      setResult({
        problem_summary: 'Erro na investigação',
        root_cause: error.message || 'Erro desconhecido',
        data_flow: '',
        affected_handlers: [],
        affected_code_locations: [],
        suggestions: ['Tente novamente ou verifique os logs'],
        confidence: 'low',
        agent_definition_found: false,
        knowledge_base_found: false,
        error: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!status?.ai_configured) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Bug className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Configure a IA</h3>
          <p className="text-slate-400 text-sm">Configure OpenAI ou Gemini para usar o debug.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-red-950/30 to-slate-900 p-6 border border-slate-700/50"
      >
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>
        
        <div className="relative flex items-center gap-4">
          <motion.div 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/20"
          >
            <Bug className="w-7 h-7 text-white" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-white">Debug de Problemas</h1>
            <p className="text-slate-400">Análise profunda de código e comportamento do agente</p>
          </div>
        </div>
      </motion.div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário */}
        <div className="space-y-4">
          {/* Seleção do Agente */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Selecione o Agente</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Repositório</label>
                {analyzedRepos.length === 0 ? (
                  <div className="px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-700 text-sm">
                    ⚠️ Nenhum repositório analisado. Indexe um repositório primeiro na aba "Repositórios".
                  </div>
                ) : (
                  <select
                    value={selectedRepo}
                    onChange={(e) => handleRepoChange(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  >
                    <option value="">Selecione um repositório...</option>
                    {analyzedRepos.map(repo => (
                      <option key={repo} value={repo}>{repo}</option>
                    ))}
                  </select>
                )}
              </div>
              
              <AnimatePresence>
                {selectedRepo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pasta (Agente)</label>
                    <select
                      value={selectedFolder}
                      onChange={(e) => setSelectedFolder(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    >
                      <option value="">Selecione uma pasta...</option>
                      {folders.map(folder => (
                        <option key={folder} value={folder}>{folder}</option>
                      ))}
                    </select>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          
          {/* ========== Importar Conversa do Nexus ========== */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl bg-gradient-to-br from-[#00DED2]/5 to-cyan-50 border border-[#00DED2]/30 p-5 shadow-sm"
          >
            {/* Header colapsável */}
            <button
              onClick={() => setShowConversationSearch(!showConversationSearch)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00DED2]/20 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-[#00DED2]" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Importar Conversa do Nexus</h3>
                  <p className="text-xs text-gray-500">Busque conversas automaticamente para debug</p>
                </div>
              </div>
              <motion.div animate={{ rotate: showConversationSearch ? 180 : 0 }}>
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </motion.div>
            </button>

            {/* Conteúdo expandível */}
            <AnimatePresence>
              {showConversationSearch && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 pt-5 border-t border-[#00DED2]/20 space-y-4">
                    {/* Botão de conectar com Weni - SEMPRE visível no topo */}
                    <div className="p-4 rounded-xl bg-white border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${isWeniConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          <span className="text-sm text-gray-600">
                            {weniLoading ? 'Verificando...' : isWeniConnected ? 'Conectado à Weni' : 'Não conectado'}
                          </span>
                        </div>
                        <button
                          onClick={handleWeniLogin}
                          disabled={weniLoggingIn || weniLoading}
                          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 ${
                            isWeniConnected 
                              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                              : 'bg-[#00DED2] text-white hover:bg-[#00DED2]/90'
                          }`}
                        >
                          {weniLoggingIn ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Aguardando...
                            </>
                          ) : (
                            <>
                              <Cloud className="w-4 h-4" />
                              {isWeniConnected ? 'Reconectar' : 'Conectar com Weni'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Verifica conexão Weni para campos */}
                    {weniLoading ? (
                      <div className="flex items-center gap-2 text-gray-500 text-sm justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verificando conexão...
                      </div>
                    ) : !isWeniConnected ? (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                        <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                        <p className="text-sm text-amber-700">
                          Clique em "Conectar com Weni" acima para poder buscar conversas
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Seletor de Projeto */}
                        <div>
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                            <FolderKanban className="w-4 h-4 text-[#00DED2]" />
                            Projeto Weni
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={projectUuid}
                              onChange={(e) => setProjectUuid(e.target.value)}
                              placeholder="UUID do projeto ou selecione"
                              className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#00DED2] focus:border-[#00DED2]"
                            />
                            <button
                              onClick={handleOpenProjectModal}
                              className="px-3 py-2 rounded-lg bg-[#00DED2]/10 border border-[#00DED2]/30 text-[#00DED2] text-sm font-medium hover:bg-[#00DED2]/20 transition-colors flex items-center gap-1"
                            >
                              <Search className="w-4 h-4" />
                              Buscar
                            </button>
                          </div>
                          {projectName && (
                            <p className="mt-1 text-xs text-[#00DED2]">
                              ✓ {projectName}
                            </p>
                          )}
                        </div>

                        {/* Campo Contact URN */}
                        <div>
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                            <Phone className="w-4 h-4 text-cyan-600" />
                            URN do Contato
                          </label>
                          <input
                            type="text"
                            value={contactUrn}
                            onChange={(e) => setContactUrn(e.target.value)}
                            placeholder="ex: ext:5511999999999@analyst.conta.com"
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                          />
                        </div>

                        {/* Período de busca */}
                        <div>
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                            <Calendar className="w-4 h-4 text-purple-600" />
                            Período
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: 1, label: '1 dia' },
                              { value: 7, label: '7 dias' },
                              { value: 14, label: '14 dias' },
                              { value: 30, label: '30 dias' },
                              { value: 60, label: '60 dias' },
                              { value: 90, label: '3 meses' },
                            ].map(option => (
                              <button
                                key={option.value}
                                onClick={() => setConversationDaysBack(option.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  conversationDaysBack === option.value
                                    ? 'bg-purple-500 text-white shadow-md'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Erro */}
                        {conversationError && (
                          <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-600 text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {conversationError}
                          </div>
                        )}

                        {/* Botão de buscar */}
                        <button
                          onClick={handleSearchConversations}
                          disabled={isLoadingConversations || !projectUuid || !contactUrn.trim()}
                          className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-[#00DED2] to-cyan-500 text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoadingConversations ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Buscando...
                            </>
                          ) : (
                            <>
                              <Download className="w-5 h-5" />
                              Importar Conversas
                            </>
                          )}
                        </button>

                        {/* Preview das conversas */}
                        {showConversationPreview && conversations.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-xl bg-white border border-gray-200"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-[#00DED2]" />
                                {conversations.length} mensagens
                              </h4>
                              <button
                                onClick={() => setShowConversationPreview(false)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
                              <Lightbulb className="w-3 h-3" />
                              Clique em uma mensagem do agente para ver os traces
                            </p>
                            
                            <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
                              {conversations.map((msg, idx) => {
                                const isAgent = msg.source_type === 'agent' || msg.direction === 'out';
                                const createdAt = msg.created_at || msg.created_on;
                                
                                return (
                                  <div
                                    key={msg.id || idx}
                                    onClick={() => isAgent && msg.id ? handleSelectAgentMessage(msg) : null}
                                    className={`p-2 rounded-lg transition-all ${
                                      isAgent
                                        ? 'bg-[#00DED2]/10 ml-2 cursor-pointer hover:bg-[#00DED2]/20 border border-transparent hover:border-[#00DED2]/30'
                                        : 'bg-gray-100 mr-2'
                                    } ${selectedMessageId === msg.id ? 'ring-2 ring-[#00DED2]' : ''}`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                        isAgent 
                                          ? 'bg-[#00DED2]/20 text-[#00DED2]' 
                                          : 'bg-gray-200 text-gray-500'
                                      }`}>
                                        {isAgent ? '🤖 Agente' : '👤 Usuário'}
                                      </span>
                                      {isAgent && msg.id && (
                                        <span className="ml-auto text-[10px] text-[#00DED2] flex items-center gap-1">
                                          <Eye className="w-3 h-3" />
                                          Ver traces
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-gray-700 line-clamp-2">{msg.text || '[mídia]'}</p>
                                    {createdAt && (
                                      <p className="text-gray-400 text-[10px] mt-1">
                                        {new Date(createdAt).toLocaleString('pt-BR')}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            
                            <p className="text-xs text-emerald-600 mt-3 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Conversas importadas para o debug!
                            </p>
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Descrição do Problema */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Descreva o Problema</h3>
            </div>
            
            <textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Ex: O agente está retornando informações incorretas sobre o método de entrega..."
              className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
          </motion.div>
          
          {/* JSON de Retorno */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Code className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">JSON de Retorno</h3>
                <p className="text-xs text-gray-500">Opcional - cole o JSON que o agente retornou</p>
              </div>
            </div>
            
            <textarea
              value={outputJson}
              onChange={(e) => setOutputJson(e.target.value)}
              placeholder='{"response": {...}}'
              className="w-full h-36 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 resize-none font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </motion.div>
          
          {/* Botão de Debug */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={handleDebug}
            disabled={isLoading || !selectedRepo || !selectedFolder || !problemDescription}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
              isLoading || !selectedRepo || !selectedFolder || !problemDescription
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50'
            }`}
          >
            {isLoading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Loader2 className="w-5 h-5" />
                </motion.div>
                Investigando...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Investigar Problema
              </>
            )}
          </motion.button>

          {/* Botão de histórico */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={handleToggleHistory}
            className="w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
          >
            <History className="w-5 h-5" />
            <span>Histórico de Tickets ({history?.total || 0})</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </motion.button>

          {/* Histórico de tickets */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Ticket className="w-4 h-4" />
                    Tickets de Debug Anteriores
                  </h4>
                  
                  {!history || history.tickets.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Nenhum ticket criado ainda.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {history.tickets.map((ticket) => (
                        <a
                          key={ticket.id}
                          href={`/diagnostic/ticket/${ticket.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-lg bg-white border-2 border-gray-200 hover:border-[#00DED2] hover:shadow-md transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-mono text-[#00DED2] font-bold">{ticket.id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              ticket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                              ticket.status === 'investigating' ? 'bg-blue-100 text-blue-700' :
                              ticket.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {ticket.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1 truncate">
                            {ticket.problem_description}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-400">
                              {new Date(ticket.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            <span className="text-xs text-[#00DED2] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                              Abrir ticket →
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Resultado */}
        <div>
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl bg-white p-8 border border-gray-200 shadow-sm"
              >
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="w-16 h-16 rounded-full border-2 border-red-200 border-t-red-500"
                    />
                    <Bug className="w-6 h-6 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-gray-900 font-medium">Investigando problema...</h3>
                    <p className="text-sm text-gray-500">Analisando código, instruções e comportamento</p>
                  </div>
                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="h-full w-1/3 bg-gradient-to-r from-transparent via-red-500 to-transparent"
                    />
                  </div>
                </div>
              </motion.div>
            )}
            
            {result && !isLoading && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Status Header */}
                <div className={`rounded-2xl p-5 border shadow-sm ${
                  result.error 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                        <Bug className="w-5 h-5 text-red-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Resultado da Investigação</h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      result.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                      result.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {result.confidence === 'high' ? 'Alta' : result.confidence === 'medium' ? 'Média' : 'Baixa'} confiança
                    </span>
                  </div>
                  
                  <div className="flex gap-4">
                    <span className={`flex items-center gap-2 text-sm ${result.agent_definition_found ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {result.agent_definition_found ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      agent_definition
                    </span>
                    <span className={`flex items-center gap-2 text-sm ${result.knowledge_base_found ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {result.knowledge_base_found ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      Base de Conhecimento
                    </span>
                  </div>
                </div>
                
                {/* Resumo */}
                <CollapsibleCard
                  title="Resumo do Problema"
                  icon={<Eye className="w-4 h-4" />}
                  isExpanded={expandedSections.has('summary')}
                  onToggle={() => toggleSection('summary')}
                  accentColor="slate"
                >
                  <p className="text-base text-gray-700 leading-relaxed">{result.problem_summary}</p>
                </CollapsibleCard>
                
                {/* Causa Raiz */}
                {result.root_cause && (
                  <CollapsibleCard
                    title="Causa Raiz Identificada"
                    icon={<Target className="w-4 h-4" />}
                    isExpanded={expandedSections.has('cause')}
                    onToggle={() => toggleSection('cause')}
                    accentColor="red"
                  >
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-base text-red-800 leading-relaxed whitespace-pre-wrap">{result.root_cause}</p>
                    </div>
                  </CollapsibleCard>
                )}
                
                {/* Análise de Dados */}
                {result.data_analysis && (
                  <CollapsibleCard
                    title="Análise Detalhada dos Dados"
                    icon={<Database className="w-4 h-4" />}
                    isExpanded={expandedSections.has('analysis')}
                    onToggle={() => toggleSection('analysis')}
                    accentColor="blue"
                  >
                    <div className="space-y-4">
                      {result.data_analysis.seller_info && (
                        <div className="p-4 rounded-lg bg-blue-50 border-l-4 border-blue-500">
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Seller/Origem</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{result.data_analysis.seller_info}</p>
                        </div>
                      )}
                      {result.data_analysis.data_returned && (
                        <div className="p-4 rounded-lg bg-amber-50 border-l-4 border-amber-500">
                          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">O que foi retornado</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{result.data_analysis.data_returned}</p>
                        </div>
                      )}
                      {result.data_analysis.data_expected && (
                        <div className="p-4 rounded-lg bg-emerald-50 border-l-4 border-emerald-500">
                          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">O que deveria retornar</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{result.data_analysis.data_expected}</p>
                        </div>
                      )}
                      {result.data_analysis.discrepancy && (
                        <div className="p-4 rounded-lg bg-red-50 border-l-4 border-red-500">
                          <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">❌ Discrepância</p>
                          <p className="text-sm text-red-800 font-medium leading-relaxed">{result.data_analysis.discrepancy}</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleCard>
                )}
                
                {/* Problema na Lógica */}
                {result.tool_logic_issue && (
                  <CollapsibleCard
                    title="Problema na Lógica da Tool"
                    icon={<Code className="w-4 h-4" />}
                    isExpanded={expandedSections.has('toollogic')}
                    onToggle={() => toggleSection('toollogic')}
                    accentColor="purple"
                  >
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-base text-purple-900 leading-relaxed whitespace-pre-wrap">{result.tool_logic_issue}</p>
                    </div>
                  </CollapsibleCard>
                )}
                
                {/* Handlers Afetados */}
                {result.affected_handlers?.length > 0 && (
                  <CollapsibleCard
                    title={`Handlers Afetados (${result.affected_handlers.length})`}
                    icon={<Code className="w-4 h-4" />}
                    isExpanded={expandedSections.has('handlers')}
                    onToggle={() => toggleSection('handlers')}
                    accentColor="purple"
                  >
                    <div className="flex flex-wrap gap-2">
                      {result.affected_handlers.map((handler, i) => (
                        <span key={i} className="px-4 py-2 bg-purple-100 border border-purple-300 rounded-lg text-sm text-purple-800 font-mono">
                          {handler}
                        </span>
                      ))}
                    </div>
                  </CollapsibleCard>
                )}
                
                {/* Locais no Código */}
                {result.affected_code_locations?.length > 0 && (
                  <CollapsibleCard
                    title={`Locais no Código (${result.affected_code_locations.length})`}
                    icon={<Folder className="w-4 h-4" />}
                    isExpanded={expandedSections.has('locations')}
                    onToggle={() => toggleSection('locations')}
                    accentColor="amber"
                  >
                    <div className="space-y-2">
                      {result.affected_code_locations.map((loc, i) => (
                        <div key={i} className="px-4 py-3 bg-amber-50 border-l-4 border-amber-500 rounded-lg text-sm text-gray-800 font-mono">
                          {loc}
                        </div>
                      ))}
                    </div>
                  </CollapsibleCard>
                )}
                
                {/* Sugestões */}
                {result.suggestions?.length > 0 && (
                  <CollapsibleCard
                    title={`Sugestões de Correção (${result.suggestions.length})`}
                    icon={<Lightbulb className="w-4 h-4" />}
                    isExpanded={expandedSections.has('suggestions')}
                    onToggle={() => toggleSection('suggestions')}
                    accentColor="emerald"
                  >
                    <div className="space-y-3">
                      {result.suggestions.map((sug, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 rounded-lg bg-emerald-50 border-l-4 border-emerald-500">
                          <span className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {i + 1}
                          </span>
                          <p className="text-sm text-gray-700 leading-relaxed">{sug}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleCard>
                )}
                
                {/* Análise Bruta (fallback quando JSON falha) */}
                {result.raw_analysis && (
                  <CollapsibleCard
                    title="Análise Completa (Texto)"
                    icon={<FileText className="w-4 h-4" />}
                    isExpanded={expandedSections.has('raw')}
                    onToggle={() => toggleSection('raw')}
                    accentColor="slate"
                  >
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg overflow-x-auto max-h-80 overflow-y-auto leading-relaxed border border-gray-200">
                      {result.raw_analysis}
                    </pre>
                  </CollapsibleCard>
                )}
                
                {/* Fluxo de dados (quando não há análise estruturada) */}
                {result.data_flow && !result.data_analysis && !result.raw_analysis && (
                  <CollapsibleCard
                    title="Análise de Fluxo"
                    icon={<ArrowRight className="w-4 h-4" />}
                    isExpanded={expandedSections.has('flow')}
                    onToggle={() => toggleSection('flow')}
                    accentColor="blue"
                  >
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg overflow-x-auto max-h-60 overflow-y-auto leading-relaxed border border-gray-200">
                      {result.data_flow}
                    </pre>
                  </CollapsibleCard>
                )}

                {/* Card de compartilhamento/ticket */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-200 flex items-center justify-center">
                      <Share2 className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-purple-900">Compartilhar Debug</h4>
                      <p className="text-xs text-purple-600/70">Crie um ticket para enviar ao time responsável</p>
                    </div>
                  </div>

                  {currentTicket ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 bg-white/80 rounded-lg border border-purple-200">
                        <Ticket className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-mono text-purple-700">{currentTicket.id}</span>
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                          currentTicket.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {currentTicket.status}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(`${window.location.origin}/diagnostic/ticket/${currentTicket.id}`)}
                          className="flex-1 py-2 px-3 rounded-lg bg-purple-200 hover:bg-purple-300 text-purple-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? 'Copiado!' : 'Copiar Link'}
                        </button>
                        <button
                          onClick={() => copyToClipboard(currentTicket.debug_log)}
                          className="flex-1 py-2 px-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Copiar Log
                        </button>
                      </div>

                      {/* Link direto */}
                      <a 
                        href={`/diagnostic/ticket/${currentTicket.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-xs text-purple-600 hover:text-purple-800 underline"
                      >
                        Abrir ticket em nova aba →
                      </a>
                    </div>
                  ) : (
                    <button
                      onClick={handleCreateTicket}
                      disabled={isCreatingTicket}
                      className="w-full py-3 px-4 rounded-lg bg-purple-200 hover:bg-purple-300 text-purple-700 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isCreatingTicket ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Criando ticket...
                        </>
                      ) : (
                        <>
                          <Ticket className="w-4 h-4" />
                          Criar Ticket de Debug
                        </>
                      )}
                    </button>
                  )}
                </motion.div>
              </motion.div>
            )}
            
            {!result && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl bg-white border border-gray-200 p-12 text-center shadow-sm"
              >
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Bug className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-medium mb-2">Pronto para investigar</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  Selecione um agente, descreva o problema e clique em "Investigar" para análise completa
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ========== Modal de seleção de projeto ========== */}
      <AnimatePresence>
        {showProjectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
            onClick={() => setShowProjectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-xl flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#00DED2]/10">
                    <FolderKanban className="w-5 h-5 text-[#00DED2]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Selecionar Projeto</h2>
                    <p className="text-xs text-gray-500">Escolha o projeto para buscar conversas</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowProjectModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-gray-100 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar organização ou projeto..."
                    value={orgSearchQuery}
                    onChange={(e) => setOrgSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00DED2]/50"
                  />
                </div>
              </div>

              {/* Lista */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingOrgs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#00DED2]" />
                  </div>
                ) : filteredOrgs.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">Nenhuma organização encontrada</p>
                    <button
                      onClick={loadOrganizations}
                      className="mt-3 text-sm text-[#00DED2] hover:underline"
                    >
                      Carregar organizações
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredOrgs.map((org) => (
                      <div key={org.org_uuid} className="rounded-xl border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => toggleOrg(org.org_uuid)}
                          className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        >
                          {org.loadingProjects ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#00DED2]" />
                          ) : expandedOrgs.has(org.org_uuid) ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                          )}
                          <Building2 className="w-4 h-4 text-[#00DED2]" />
                          <span className="font-medium text-gray-900 flex-1 truncate">{org.org_name}</span>
                          {org.projectsLoaded && (
                            <span className="text-xs text-gray-400">
                              {org.projects.length} projetos
                            </span>
                          )}
                        </button>

                        <AnimatePresence>
                          {expandedOrgs.has(org.org_uuid) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                            >
                              <div className="border-t border-gray-200 max-h-[200px] overflow-y-auto">
                                {org.loadingProjects && (
                                  <div className="p-4 text-center text-gray-400 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                    Carregando...
                                  </div>
                                )}
                                {org.error && (
                                  <div className="p-4 text-center text-red-500 text-sm">
                                    {org.error}
                                  </div>
                                )}
                                {org.projectsLoaded && org.projects.length === 0 && (
                                  <div className="p-4 text-center text-gray-400 text-sm">
                                    Nenhum projeto
                                  </div>
                                )}
                                {org.projects.map((project) => (
                                  <button
                                    key={project.uuid}
                                    onClick={() => handleSelectProject(project.uuid, project.name)}
                                    className={`w-full flex items-center gap-3 p-3 pl-11 hover:bg-[#00DED2]/5 transition-colors text-left ${
                                      projectUuid === project.uuid ? 'bg-[#00DED2]/10' : ''
                                    }`}
                                  >
                                    <FolderKanban className="w-4 h-4 text-gray-400" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">{project.name}</p>
                                      <p className="text-xs text-gray-400 font-mono truncate">{project.uuid}</p>
                                    </div>
                                    {projectUuid === project.uuid && (
                                      <Check className="w-4 h-4 text-[#00DED2]" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== Modal de Traces ========== */}
      <AnimatePresence>
        {showTracesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
            onClick={() => setShowTracesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Activity className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Traces de Execução</h2>
                    <p className="text-xs text-gray-500">
                      {selectedMessageId && `Log ID: ${selectedMessageId}`}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTracesModal(false)}
                  className="p-2 hover:bg-white/50 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingTraces ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
                    <p className="text-gray-500">Carregando traces...</p>
                  </div>
                ) : tracesError ? (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
                    <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-red-600">{tracesError}</p>
                  </div>
                ) : traces.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhum trace encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {traces.map((trace, idx) => {
                      const typeInfo = getTraceTypeInfo(trace);
                      
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`p-4 rounded-xl border border-gray-200 ${typeInfo.bg}`}
                        >
                          {/* Header */}
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-xl">{typeInfo.icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${typeInfo.color}`}>
                                  {typeInfo.label}
                                </span>
                                {trace.tool_name && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-white text-gray-600 font-mono border border-gray-200">
                                    {trace.tool_name}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                Agente: {trace.agent_name}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                          </div>

                          {/* Tool details */}
                          {trace.tool_details && (
                            <div className="mt-3 p-3 rounded-lg bg-white border border-gray-200">
                              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Code className="w-3 h-3" />
                                Parâmetros da Tool
                              </p>
                              <div className="space-y-1.5">
                                {trace.tool_details.parameters.map((param, pIdx) => (
                                  <div key={pIdx} className="flex items-start gap-2">
                                    <span className="text-xs text-gray-500 font-mono min-w-[80px]">
                                      {param.name}:
                                    </span>
                                    <span className="text-xs text-gray-700 font-mono break-all bg-gray-50 px-2 py-1 rounded flex-1 border border-gray-100">
                                      {param.value.length > 200 
                                        ? param.value.substring(0, 200) + '...' 
                                        : param.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Delegation details */}
                          {trace.delegation && (
                            <div className="mt-3 p-3 rounded-lg bg-white border border-purple-200">
                              <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                Delegado para: {trace.delegation.target_agent}
                              </p>
                              <p className="text-xs text-gray-600 italic">
                                "{trace.delegation.input_text.length > 300 
                                  ? trace.delegation.input_text.substring(0, 300) + '...' 
                                  : trace.delegation.input_text}"
                              </p>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              {traces.length > 0 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {traces.length} trace{traces.length !== 1 ? 's' : ''} encontrado{traces.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => {
                        const selectedMsg = conversations.find(m => m.id === selectedMessageId);
                        if (selectedMsg) {
                          const tracesContext = formatTracesForDebug(traces, selectedMsg.text || '');
                          setOutputJson(prev => prev ? prev + '\n\n' + tracesContext : tracesContext);
                        }
                        setShowTracesModal(false);
                      }}
                      className="px-4 py-2 rounded-lg bg-amber-100 text-amber-700 text-sm font-medium hover:bg-amber-200 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Importar para Debug
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Componente de card colapsável - tema claro
function CollapsibleCard({
  title,
  icon,
  isExpanded,
  onToggle,
  accentColor,
  children
}: {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  accentColor: 'red' | 'blue' | 'purple' | 'amber' | 'emerald' | 'slate';
  children: React.ReactNode;
}) {
  const colors = {
    red: { 
      border: 'border-red-200', 
      text: 'text-red-600', 
      iconBg: 'bg-red-100',
      headerBg: 'bg-red-50',
      leftBar: 'bg-red-500'
    },
    blue: { 
      border: 'border-blue-200', 
      text: 'text-blue-600', 
      iconBg: 'bg-blue-100',
      headerBg: 'bg-blue-50',
      leftBar: 'bg-blue-500'
    },
    purple: { 
      border: 'border-purple-200', 
      text: 'text-purple-600', 
      iconBg: 'bg-purple-100',
      headerBg: 'bg-purple-50',
      leftBar: 'bg-purple-500'
    },
    amber: { 
      border: 'border-amber-200', 
      text: 'text-amber-600', 
      iconBg: 'bg-amber-100',
      headerBg: 'bg-amber-50',
      leftBar: 'bg-amber-500'
    },
    emerald: { 
      border: 'border-emerald-200', 
      text: 'text-emerald-600', 
      iconBg: 'bg-emerald-100',
      headerBg: 'bg-emerald-50',
      leftBar: 'bg-emerald-500'
    },
    slate: { 
      border: 'border-gray-200', 
      text: 'text-gray-600', 
      iconBg: 'bg-gray-100',
      headerBg: 'bg-gray-50',
      leftBar: 'bg-gray-400'
    }
  };

  const c = colors[accentColor];

  return (
    <div className={`rounded-xl overflow-hidden bg-white border ${c.border} shadow-sm`}>
      <button
        onClick={onToggle}
        className={`w-full px-4 py-4 flex items-center justify-between ${c.headerBg} hover:brightness-95 transition-all`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${c.iconBg} flex items-center justify-center ${c.text}`}>
            {icon}
          </div>
          <span className="font-semibold text-gray-900 text-base">{title}</span>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </motion.div>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className={`relative p-5 bg-white border-t border-gray-100`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${c.leftBar}`} />
              <div className="pl-3">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
