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
  Activity
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { MultiFolderSelectModal } from './MultiFolderSelectModal';

type StatusFilter = 'all' | 'analyzing' | 'completed' | 'error' | 'pending';

export function RepositoryList() {
  const { 
    repositories, 
    selectedRepos, 
    isLoading,
    status,
    analysisProgress,
    fetchRepositories, 
    toggleRepoSelection,
    clearSelection,
    analyzeMultipleFolders
  } = useAppStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showPrivate, setShowPrivate] = useState(true);
  const [showPublic, setShowPublic] = useState(true);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
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
