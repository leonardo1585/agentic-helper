import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Check, 
  GitBranch, 
  Lock, 
  Globe,
  Loader2,
  RefreshCw,
  Play,
  X,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Layers,
  Trash2,
  GitCompare,
  Bug,
  ChevronDown
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { MultiFolderSelectModal } from './MultiFolderSelectModal';
import { UpdatesDiffPanel } from './UpdatesDiffPanel';
import { DiagnosticPanel } from './DiagnosticPanel';
import { api, VectorStats } from '../services/api';

type StatusFilter = 'all' | 'analyzing' | 'completed' | 'error' | 'pending';

export function RepositoryList() {
  const { 
    repositories, 
    selectedRepos, 
    isLoading,
    status,
    analysisProgress,
    knowledgeBases,
    fetchRepositories, 
    toggleRepoSelection,
    clearSelection,
    analyzeMultipleFolders,
    fetchKnowledgeBases
  } = useAppStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showPrivate, setShowPrivate] = useState(true);
  const [showPublic, setShowPublic] = useState(true);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  // Estado para indexação
  const [isIndexing, setIsIndexing] = useState(false);
  const [vectorStats, setVectorStats] = useState<VectorStats | null>(null);
  const [indexMessage, setIndexMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Estado para Atualizações & Diagnóstico
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [showUpdatesPanel, setShowUpdatesPanel] = useState(false);
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);
  
  // Função para obter o status de um repositório
  const getRepoStatus = (repoName: string): string | null => {
    // Verifica status direto do repo
    const directProgress = analysisProgress.get(repoName);
    if (directProgress) return directProgress.status;
    
    // Verifica se alguma pasta deste repo tem status
    for (const [key, value] of analysisProgress.entries()) {
      if (key.startsWith(repoName + '/')) {
        return value.status;
      }
    }
    return null;
  };
  
  // Conta repositórios por status
  const statusCounts = useMemo(() => {
    const counts = { analyzing: 0, completed: 0, error: 0, pending: 0 };
    
    for (const repo of repositories) {
      const repoStatus = getRepoStatus(repo.full_name);
      if (repoStatus === 'analyzing') counts.analyzing++;
      else if (repoStatus === 'completed') counts.completed++;
      else if (repoStatus === 'error') counts.error++;
      else if (repoStatus === 'pending') counts.pending++;
    }
    
    return counts;
  }, [repositories, analysisProgress]);
  
  useEffect(() => {
    if (status?.github_configured) {
      fetchRepositories();
    }
  }, [status?.github_configured, fetchRepositories]);
  
  // Carrega stats de indexação e KBs
  useEffect(() => {
    loadVectorStats();
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);
  
  const loadVectorStats = async () => {
    try {
      const stats = await api.getVectorStats();
      setVectorStats(stats);
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    }
  };
  
  const handleIndexAll = async () => {
    setIsIndexing(true);
    setIndexMessage(null);
    
    try {
      const result = await api.indexAllAgents();
      await loadVectorStats();
      setIndexMessage({
        type: 'success',
        text: `✓ ${result.success} agente(s) indexado(s)${result.failed > 0 ? `, ${result.failed} falha(s)` : ''}`
      });
      
      // Limpa mensagem após 5 segundos
      setTimeout(() => setIndexMessage(null), 5000);
    } catch (err) {
      setIndexMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao indexar'
      });
    } finally {
      setIsIndexing(false);
    }
  };
  
  const handleClearIndex = async () => {
    if (!confirm('Limpar índice? Você precisará reindexar.')) return;
    
    try {
      await api.clearVectorIndex();
      await loadVectorStats();
      setIndexMessage({ type: 'success', text: 'Índice limpo com sucesso' });
      setTimeout(() => setIndexMessage(null), 3000);
    } catch (err) {
      setIndexMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao limpar'
      });
    }
  };
  
  const filteredRepos = useMemo(() => {
    return repositories.filter(repo => {
      const matchesSearch = repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (repo.description?.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesVisibility = (showPrivate && repo.private) || (showPublic && !repo.private);
      
      // Filtro de status
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        const repoStatus = getRepoStatus(repo.full_name);
        matchesStatus = repoStatus === statusFilter;
      }
      
      return matchesSearch && matchesVisibility && matchesStatus;
    });
  }, [repositories, searchTerm, showPrivate, showPublic, statusFilter, analysisProgress]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Quando clicar em Analisar, abre o modal de seleção de pastas
  const handleAnalyze = () => {
    if (selectedRepos.size > 0) {
      setShowFolderModal(true);
    }
  };
  
  if (!status?.github_configured) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <GitBranch className="w-8 h-8" />
        </div>
        <h3 className="empty-state-title">Configure o GitHub</h3>
        <p className="empty-state-description">
          Adicione seu token do GitHub nas configurações para ver seus repositórios.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Repositórios</h1>
          <p className="page-subtitle">
            {selectedRepos.size > 0 
              ? `${selectedRepos.size} selecionado(s) de ${filteredRepos.length}` 
              : `${filteredRepos.length} repositórios disponíveis`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRepositories}
            disabled={isLoading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          
          {selectedRepos.size > 0 && (
            <>
              <button
                onClick={clearSelection}
                className="btn-secondary flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Limpar
              </button>
              
              <button
                onClick={handleAnalyze}
                disabled={isLoading || !status?.ai_configured}
                className="btn-primary flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Analisar {selectedRepos.size > 1 ? `(${selectedRepos.size} repos)` : ''}
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Indexação Card */}
      {knowledgeBases.length > 0 && (
        <div className="card bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Indexação para Busca</h3>
                <p className="text-sm text-gray-500">
                  {vectorStats 
                    ? `${vectorStats.total_agents} de ${knowledgeBases.length} agentes indexados`
                    : `${knowledgeBases.length} agentes disponíveis para indexar`
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {vectorStats && vectorStats.total_agents > 0 && (
                <button
                  onClick={handleClearIndex}
                  className="btn-secondary flex items-center gap-2 text-red-600 hover:bg-red-50"
                  title="Limpar índice"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              
              <button
                onClick={handleIndexAll}
                disabled={isIndexing || knowledgeBases.length === 0}
                className="btn-primary flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                {isIndexing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Indexando...
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    {vectorStats && vectorStats.total_agents === knowledgeBases.length 
                      ? 'Reindexar' 
                      : 'Indexar Agentes'
                    }
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Message */}
          <AnimatePresence>
            {indexMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mt-3 p-2 rounded-lg text-sm ${
                  indexMessage.type === 'success' 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {indexMessage.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      
      {/* Atualizações & Diagnóstico Card */}
      {knowledgeBases.length > 0 && (
        <div className="card bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <GitCompare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Atualizações & Diagnóstico</h3>
                <p className="text-sm text-gray-500">
                  Veja mudanças recentes e diagnostique problemas
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Seletor de Agente */}
              <div className="relative">
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="appearance-none px-4 py-2 pr-8 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[250px]"
                >
                  <option value="">Selecione um agente...</option>
                  {knowledgeBases.map((kb) => (
                    <option key={kb} value={kb}>
                      {kb.split('/').slice(-1)[0]} ({kb.split('/').slice(0, 2).join('/')})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              
              {/* Botões */}
              <button
                onClick={() => {
                  if (selectedAgent) setShowUpdatesPanel(true);
                }}
                disabled={!selectedAgent}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <GitCompare className="w-4 h-4" />
                Atualizações
              </button>
              
              <button
                onClick={() => {
                  if (selectedAgent) setShowDiagnosticPanel(true);
                }}
                disabled={!selectedAgent}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Bug className="w-4 h-4" />
                Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Atualizações */}
      <AnimatePresence>
        {showUpdatesPanel && selectedAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowUpdatesPanel(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a2e] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <GitCompare className="w-5 h-5 text-[#00DED2]" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Histórico de Atualizações</h2>
                    <p className="text-sm text-gray-400">{selectedAgent}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpdatesPanel(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)] min-h-[300px]">
                <UpdatesDiffPanel repositoryName={selectedAgent} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Modal de Diagnóstico */}
      <AnimatePresence>
        {showDiagnosticPanel && selectedAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDiagnosticPanel(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a2e] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <Bug className="w-5 h-5 text-orange-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Diagnóstico de Problema</h2>
                    <p className="text-sm text-gray-400">{selectedAgent}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDiagnosticPanel(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                <DiagnosticPanel repositoryName={selectedAgent} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Search and Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="search-container flex-1">
            <Search className="search-icon w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Buscar repositórios..."
              className="search-input"
            />
          </div>
          
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white border border-gray-200">
            <Filter className="w-4 h-4 text-gray-400" />
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrivate}
                onChange={(e) => setShowPrivate(e.target.checked)}
                className="checkbox"
              />
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm text-gray-600">Privados</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPublic}
                onChange={(e) => setShowPublic(e.target.checked)}
                className="checkbox"
              />
              <Globe className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm text-gray-600">Públicos</span>
            </label>
          </div>
        </div>
        
        {/* Status Filter Pills */}
        {(statusCounts.analyzing > 0 || statusCounts.completed > 0 || statusCounts.error > 0 || statusCounts.pending > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 mr-1">Status:</span>
            
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs rounded-full transition-all flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            
            {statusCounts.analyzing > 0 && (
              <button
                onClick={() => setStatusFilter('analyzing')}
                className={`px-3 py-1.5 text-xs rounded-full transition-all flex items-center gap-1.5 ${
                  statusFilter === 'analyzing'
                    ? 'bg-[#00DED2] text-gray-900'
                    : 'bg-[#00DED2]/10 text-[#00DED2] hover:bg-[#00DED2]/20'
                }`}
              >
                <Activity className="w-3 h-3" />
                Processando ({statusCounts.analyzing})
              </button>
            )}
            
            {statusCounts.pending > 0 && (
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 text-xs rounded-full transition-all flex items-center gap-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20'
                }`}
              >
                <Clock className="w-3 h-3" />
                Aguardando ({statusCounts.pending})
              </button>
            )}
            
            {statusCounts.completed > 0 && (
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 text-xs rounded-full transition-all flex items-center gap-1.5 ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                }`}
              >
                <CheckCircle className="w-3 h-3" />
                Concluídos ({statusCounts.completed})
              </button>
            )}
            
            {statusCounts.error > 0 && (
              <button
                onClick={() => setStatusFilter('error')}
                className={`px-3 py-1.5 text-xs rounded-full transition-all flex items-center gap-1.5 ${
                  statusFilter === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                }`}
              >
                <AlertCircle className="w-3 h-3" />
                Erros ({statusCounts.error})
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Repository Grid */}
      {isLoading && repositories.length === 0 ? (
        <div className="empty-state">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-[#00DED2]" />
          <p className="text-gray-500">Carregando repositórios...</p>
        </div>
      ) : (
        <div className="grid gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
          <AnimatePresence mode="sync">
            {filteredRepos.map((repo) => {
              const isSelected = selectedRepos.has(repo.full_name);
              
              // Busca progresso do repositório ou de suas pastas
              let repoProgress = analysisProgress.get(repo.full_name);
              if (!repoProgress) {
                // Verifica se alguma pasta deste repo está sendo analisada
                for (const [key, value] of analysisProgress.entries()) {
                  if (key.startsWith(repo.full_name + '/')) {
                    repoProgress = value;
                    break;
                  }
                }
              }
              
              return (
                <motion.div
                  key={repo.full_name}
                  layout="position"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => toggleRepoSelection(repo.full_name)}
                  className={`repo-card ${isSelected ? 'selected' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected 
                        ? 'bg-[#00DED2] text-gray-900' 
                        : 'bg-gray-100 border border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-900">{repo.name}</h3>
                        {repo.private ? (
                          <span className="badge badge-gray flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Privado
                          </span>
                        ) : (
                          <span className="badge badge-teal flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            Público
                          </span>
                        )}
                        {repo.language && (
                          <span className="badge badge-blue">{repo.language}</span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                        {repo.description || 'Sem descrição'}
                      </p>
                      
                      <p className="text-xs text-gray-400 mt-1">
                        {repo.full_name}
                      </p>
                    </div>
                    
                    {/* Progress */}
                    {repoProgress && (
                      <div className="flex-shrink-0 text-right min-w-[100px]">
                        <span className={`text-xs font-medium ${
                          repoProgress.status === 'completed' ? 'text-emerald-600' :
                          repoProgress.status === 'error' ? 'text-red-500' :
                          'text-[#00DED2]'
                        }`}>
                          {repoProgress.status === 'completed' ? '✓ Concluído' :
                           repoProgress.status === 'error' ? '✗ Erro' :
                           `${repoProgress.progress}%`}
                        </span>
                        {repoProgress.status === 'analyzing' && (
                          <div className="progress-bar mt-1.5">
                            <motion.div
                              className="progress-fill"
                              initial={{ width: 0 }}
                              animate={{ width: `${repoProgress.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {filteredRepos.length === 0 && !isLoading && (
            <div className="empty-state">
              <p className="text-gray-500">Nenhum repositório encontrado</p>
            </div>
          )}
        </div>
      )}
      
      {/* Modal de Seleção de Pastas */}
      <MultiFolderSelectModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        repositories={Array.from(selectedRepos)}
        onAnalyze={(selections) => {
          analyzeMultipleFolders(selections);
          setShowFolderModal(false);
          clearSelection();
        }}
      />
    </div>
  );
}
