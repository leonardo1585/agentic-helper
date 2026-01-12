/**
 * Componente para buscar/verificar se já existe um agente
 * Com histórico de buscas e opção de copiar agente para novo repositório
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Copy, 
  Clock, 
  Trash2, 
  X, 
  Check, 
  Loader2, 
  GitBranch,
  Users,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { api, SearchResult, FindAgentResult } from '../services/api';

interface AgentFinderProps {
  onClose?: () => void;
}

interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  hasResults: boolean;
}

const HISTORY_KEY = 'gth_search_history';
const MAX_HISTORY = 10;

export function AgentFinder({ onClose }: AgentFinderProps) {
  const [description, setDescription] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<FindAgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Modal para criar/copiar repositório
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SearchResult | null>(null);
  const [copyMode, setCopyMode] = useState<'new' | 'existing'>('new');
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [teams, setTeams] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [existingRepos, setExistingRepos] = useState<Array<{ name: string; full_name: string; description: string | null }>>([]);
  const [selectedExistingRepo, setSelectedExistingRepo] = useState<string>('');
  const [targetFolder, setTargetFolder] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; message: string; url?: string } | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  // Carrega histórico do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar histórico:', e);
      }
    }
  }, []);

  // Carrega times da organização
  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const response = await api.listOrgTeams('weni-ai');
      setTeams(response.teams || []);
    } catch (e) {
      console.error('Erro ao carregar times:', e);
    }
  };

  const loadExistingRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const response = await api.listOrgRepos('weni-ai', true);
      setExistingRepos(response.repositories || []);
    } catch (e) {
      console.error('Erro ao carregar repositórios:', e);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Salva histórico no localStorage sempre que mudar
  useEffect(() => {
    if (searchHistory.length > 0) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory));
    }
  }, [searchHistory]);

  const addToHistory = (query: string, hasResults: boolean) => {
    const newItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query,
      timestamp: Date.now(),
      hasResults
    };
    
    // Remove duplicatas e limita tamanho - usa callback para ter o valor mais atual
    setSearchHistory(prevHistory => {
      const filtered = prevHistory.filter(h => h.query !== query);
      return [newItem, ...filtered].slice(0, MAX_HISTORY);
    });
  };

  const removeFromHistory = (id: string) => {
    setSearchHistory(prevHistory => {
      const filtered = prevHistory.filter(h => h.id !== id);
      // Se ficou vazio, remove do localStorage
      if (filtered.length === 0) {
        localStorage.removeItem(HISTORY_KEY);
      }
      return filtered;
    });
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    setShowHistory(false);
  };

  const handleSearch = async (query?: string) => {
    const searchQuery = query || description;
    if (!searchQuery.trim()) return;
    
    setDescription(searchQuery);
    setIsSearching(true);
    setError(null);
    setResult(null);
    setShowHistory(false);

    try {
      const searchResult = await api.findExistingAgent(searchQuery);
      setResult(searchResult);
      addToHistory(searchQuery, 
        (searchResult.similar_agents?.length ?? 0) > 0 || 
        (searchResult.matching_agents?.length ?? 0) > 0
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na busca');
      addToHistory(searchQuery, false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopyAgent = (agent: SearchResult) => {
    setSelectedAgent(agent);
    setCopyMode('new');
    setNewRepoName(agent.folder_name.toLowerCase().replace(/\s+/g, '-'));
    setNewRepoDescription(`Agente baseado em ${agent.repo_name}/${agent.folder_name}`);
    setSelectedExistingRepo('');
    setTargetFolder(agent.folder_name);
    setCreateResult(null);
    setShowCreateModal(true);
    loadExistingRepos();
  };

  const handleCreateRepo = async () => {
    if (!selectedAgent) return;
    
    setIsCreating(true);
    setCreateResult(null);
    
    try {
      if (copyMode === 'new') {
        // Criar novo repositório
        if (!newRepoName.trim()) return;
        
        const result = await api.createRepoFromAgent({
          name: newRepoName,
          description: newRepoDescription,
          source_repo: selectedAgent.repo_name,
          source_folder: selectedAgent.folder_name,
          team_slug: selectedTeam || undefined,
          private: true
        });
        
        setCreateResult({
          success: true,
          message: result.message,
          url: result.repository.url
        });
      } else {
        // Copiar para repositório existente
        if (!selectedExistingRepo) return;
        
        const result = await api.copyAgentToExisting({
          target_repo: selectedExistingRepo,
          source_repo: selectedAgent.repo_name,
          source_folder: selectedAgent.folder_name,
          target_folder: targetFolder || undefined
        });
        
        setCreateResult({
          success: true,
          message: result.message,
          url: result.repository.url
        });
      }
    } catch (err) {
      setCreateResult({
        success: false,
        message: err instanceof Error ? err.message : 'Erro ao copiar agente'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getRecommendationColor = (rec?: string) => {
    switch (rec) {
      case 'reutilizar': return 'text-emerald-400';
      case 'estender': return 'text-yellow-400';
      case 'criar_novo': return 'text-blue-400';
      case 'verificar': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  const getRecommendationText = (rec?: string) => {
    switch (rec) {
      case 'reutilizar': return '✅ Reutilize um agente existente';
      case 'estender': return '🔄 Estenda um agente existente';
      case 'criar_novo': return '🆕 Pode criar um novo agente';
      case 'verificar': return '🔍 Verifique os agentes encontrados';
      default: return rec || '';
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;
    
    if (diff < 60000) return 'Agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Search className="w-6 h-6 text-[#00DED2]" />
            Buscar Agente Existente
          </h1>
          <p className="page-subtitle">
          Descreva o agente que você precisa e veja se já existe algo similar
        </p>
      </div>
        
        {searchHistory.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="btn-secondary flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            Histórico ({searchHistory.length})
          </button>
        )}
      </div>

      {/* Histórico */}
      <AnimatePresence>
        {showHistory && searchHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                Buscas Recentes
              </h3>
              <button
                onClick={clearHistory}
                className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            </div>
            <div className="space-y-2">
              {searchHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group"
                >
                  <button
                    onClick={() => handleSearch(item.query)}
                    className="flex-1 text-left text-sm text-gray-700 hover:text-[#00DED2] truncate"
                  >
                    {item.query}
                  </button>
                  <span className="text-xs text-gray-400">
                    {formatDate(item.timestamp)}
                  </span>
                  {item.hasResults && (
                    <span className="text-xs text-emerald-500">✓</span>
                  )}
                  <button
                    onClick={() => removeFromHistory(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Input */}
      <div className="card">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSearch();
            }
          }}
          placeholder="Descreva o agente que você precisa...&#10;&#10;Exemplo: Preciso de um agente que consulte o status de pedidos na VTEX e envie notificações ao cliente"
          className="input w-full h-32 resize-none"
        />
        <button
          onClick={() => handleSearch()}
          disabled={isSearching || !description.trim()}
          className="btn-primary w-full mt-3 flex items-center justify-center gap-2"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Verificar se já existe
            </>
          )}
        </button>
      </div>

      {/* Results */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            className="card bg-red-50 border-red-200"
            >
            <p className="text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
            </motion.div>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Main Result */}
            <div className={`card ${
                result.exists || result.found 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-blue-50 border-blue-200'
              }`}>
              <p className="text-lg font-medium text-gray-900">
                  {result.message}
                </p>
                {result.recommendation && (
                <p className={`mt-2 text-sm font-medium ${getRecommendationColor(result.recommendation)}`}>
                    {getRecommendationText(result.recommendation)}
                  </p>
                )}
                {result.explanation && (
                <p className="mt-2 text-sm text-gray-600">
                    {result.explanation}
                  </p>
                )}
              </div>

              {/* Matching Agents */}
              {result.matching_agents && result.matching_agents.length > 0 && (
              <div className="card">
                <h4 className="text-sm font-medium text-emerald-600 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Agentes que atendem completamente:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.matching_agents.map((agent, i) => (
                    <span key={i} className="badge badge-teal">
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Partial Matches */}
              {result.partial_matches && result.partial_matches.length > 0 && (
              <div className="card">
                <h4 className="text-sm font-medium text-yellow-600 mb-3">
                    🔄 Atendem parcialmente:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.partial_matches.map((agent, i) => (
                    <span key={i} className="badge badge-orange">
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Features */}
              {result.missing_features && result.missing_features.length > 0 && (
              <div className="card">
                <h4 className="text-sm font-medium text-orange-600 mb-3">
                    ❓ Funcionalidades não encontradas:
                  </h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {result.missing_features.map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Similar Agents List */}
              {result.similar_agents && result.similar_agents.length > 0 && (
                <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-500">
                    📋 Agentes encontrados ({result.similar_agents.length}):
                  </h4>
                  {result.similar_agents.map((agent, i) => (
                  <AgentCard 
                    key={i} 
                    agent={agent} 
                    onCopy={() => handleCopyAgent(agent)}
                  />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {!result && !error && !isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            className="card text-center py-12"
          >
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-[#00DED2]" />
            <p className="text-gray-500">Descreva o agente que você precisa criar</p>
            <p className="text-sm text-gray-400 mt-1">Vamos verificar se já existe algo similar</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Copiar Agente */}
      <AnimatePresence>
        {showCreateModal && selectedAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !isCreating && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Copy className="w-5 h-5 text-[#00DED2]" />
                    Copiar Agente
                  </h3>
                  {!isCreating && (
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Copiando de: <span className="font-mono text-[#00DED2]">{selectedAgent.repo_name}/{selectedAgent.folder_name}</span>
                </p>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {!createResult ? (
                  <>
                    {/* Seleção de modo: novo ou existente */}
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                      <button
                        onClick={() => setCopyMode('new')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                          copyMode === 'new' 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        🆕 Novo Repositório
                      </button>
                      <button
                        onClick={() => setCopyMode('existing')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                          copyMode === 'existing' 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        📁 Repositório Existente
                      </button>
                    </div>

                    {copyMode === 'new' ? (
                      <>
                        {/* Nome do repositório */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nome do Repositório *
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">weni-ai/</span>
                            <input
                              type="text"
                              value={newRepoName}
                              onChange={(e) => setNewRepoName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                              placeholder="meu-agente"
                              className="input flex-1"
                            />
                            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">-agents</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            O nome final será: <span className="font-mono">weni-ai/{newRepoName || 'nome'}-agents</span>
                          </p>
                        </div>

                        {/* Descrição */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Descrição
                          </label>
                          <input
                            type="text"
                            value={newRepoDescription}
                            onChange={(e) => setNewRepoDescription(e.target.value)}
                            placeholder="Descrição do novo repositório"
                            className="input w-full"
                          />
                        </div>

                        {/* Time */}
                        {teams.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <Users className="w-4 h-4 inline mr-1" />
                              Time (opcional)
                            </label>
                            <select
                              value={selectedTeam}
                              onChange={(e) => setSelectedTeam(e.target.value)}
                              className="input w-full"
                            >
                              <option value="">Nenhum time</option>
                              {teams.map((team) => (
                                <option key={team.id} value={team.slug}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Info */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-700">
                            <GitBranch className="w-4 h-4 inline mr-1" />
                            Será criado um repositório <strong>privado</strong> na organização <strong>weni-ai</strong> com todos os arquivos do agente selecionado.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Selecionar repositório existente */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Repositório Destino *
                          </label>
                          {isLoadingRepos ? (
                            <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Carregando repositórios...
                            </div>
                          ) : existingRepos.length > 0 ? (
                            <select
                              value={selectedExistingRepo}
                              onChange={(e) => setSelectedExistingRepo(e.target.value)}
                              className="input w-full"
                            >
                              <option value="">Selecione um repositório</option>
                              {existingRepos.map((repo) => (
                                <option key={repo.full_name} value={repo.full_name}>
                                  {repo.name} {repo.description ? `- ${repo.description.slice(0, 50)}...` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-sm text-gray-500 py-2">
                              Nenhum repositório "-agents" encontrado.
                            </p>
                          )}
                        </div>

                        {/* Pasta destino */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pasta Destino
                          </label>
                          <input
                            type="text"
                            value={targetFolder}
                            onChange={(e) => setTargetFolder(e.target.value)}
                            placeholder="Nome da pasta (deixe vazio para raiz)"
                            className="input w-full"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Os arquivos serão copiados para: <span className="font-mono">{selectedExistingRepo || 'repo'}/{targetFolder || '(raiz)'}</span>
                          </p>
                        </div>

                        {/* Info */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-sm text-amber-700">
                            <AlertCircle className="w-4 h-4 inline mr-1" />
                            Os arquivos serão adicionados ao repositório existente. Arquivos com mesmo nome serão sobrescritos.
                          </p>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className={`p-4 rounded-lg ${createResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className={`font-medium ${createResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                      {createResult.success ? '✅' : '❌'} {createResult.message}
                    </p>
                    {createResult.url && (
                      <a
                        href={createResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-sm text-[#00DED2] hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir repositório no GitHub
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                {!createResult ? (
                  <>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      disabled={isCreating}
                      className="btn-secondary"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateRepo}
                      disabled={
                        isCreating || 
                        (copyMode === 'new' && !newRepoName.trim()) ||
                        (copyMode === 'existing' && !selectedExistingRepo)
                      }
                      className="btn-primary flex items-center gap-2"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Copiando...
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          {copyMode === 'new' ? 'Criar Repositório' : 'Copiar para Repositório'}
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="btn-primary"
                  >
                    Fechar
                  </button>
                )}
              </div>
            </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}

function AgentCard({ agent, onCopy }: { agent: SearchResult; onCopy: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const similarityPercent = Math.round(agent.similarity * 100);
  
  // Usa agent_name se disponível, senão folder_name
  const displayName = agent.agent_name || agent.folder_name;
  
  const getSimilarityColor = (sim: number) => {
    if (sim >= 0.7) return 'bg-emerald-500';
    if (sim >= 0.4) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  return (
    <motion.div
      layout
      className="card hover:border-[#00DED2]/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="font-medium text-gray-900 truncate" title={displayName}>
              {displayName}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">
            <span className="font-mono">{agent.repo_name}</span>
            {agent.agent_name && (
              <span className="text-gray-400 ml-2">• {agent.folder_name}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${getSimilarityColor(agent.similarity)}`} />
            <span className="text-sm text-gray-600 font-medium">
              {similarityPercent}%
            </span>
          </div>
          <button
            onClick={onCopy}
            className="p-2 text-[#00DED2] hover:bg-[#00DED2]/10 rounded-lg transition-colors"
            title="Copiar para novo repositório"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-gray-200">
              <pre className="text-xs text-gray-500 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg overflow-x-auto">
                {agent.document}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AgentFinder;
