/**
 * Componente para buscar/verificar se já existe um agente
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, SearchResult, FindAgentResult } from '../services/api';

interface AgentFinderProps {
  onClose?: () => void;
}

export function AgentFinder({ onClose }: AgentFinderProps) {
  const [description, setDescription] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<FindAgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!description.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const searchResult = await api.findExistingAgent(description);
      setResult(searchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na busca');
    } finally {
      setIsSearching(false);
    }
  };

  const getRecommendationColor = (rec?: string) => {
    switch (rec) {
      case 'reutilizar':
        return 'text-green-400';
      case 'estender':
        return 'text-yellow-400';
      case 'criar_novo':
        return 'text-blue-400';
      case 'verificar':
        return 'text-orange-400';
      default:
        return 'text-gray-400';
    }
  };

  const getRecommendationText = (rec?: string) => {
    switch (rec) {
      case 'reutilizar':
        return '✅ Reutilize um agente existente';
      case 'estender':
        return '🔄 Estenda um agente existente';
      case 'criar_novo':
        return '🆕 Pode criar um novo agente';
      case 'verificar':
        return '🔍 Verifique os agentes encontrados';
      default:
        return rec || '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0f1117]">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            Buscar Agente Existente
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Descreva o agente que você precisa e veja se já existe algo similar
        </p>
      </div>

      {/* Search Input */}
      <div className="p-4">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva o agente que você precisa...&#10;&#10;Exemplo: Preciso de um agente que consulte o status de pedidos na VTEX e envie notificações ao cliente"
          className="w-full h-32 px-4 py-3 bg-[#1a1d24] border border-gray-700 rounded-lg 
                     text-white placeholder-gray-500 resize-none focus:outline-none 
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching || !description.trim()}
          className="mt-3 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 
                     rounded-lg font-medium text-white hover:from-blue-500 hover:to-indigo-500 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all
                     flex items-center justify-center gap-2"
        >
          {isSearching ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              Buscando...
            </>
          ) : (
            <>
              <span>🔎</span>
              Verificar se já existe
            </>
          )}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
            >
              <p className="text-red-400">{error}</p>
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
              <div className={`p-4 rounded-lg border ${
                result.exists || result.found 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-blue-500/10 border-blue-500/30'
              }`}>
                <p className="text-lg font-medium text-white">
                  {result.message}
                </p>
                {result.recommendation && (
                  <p className={`mt-2 text-sm ${getRecommendationColor(result.recommendation)}`}>
                    {getRecommendationText(result.recommendation)}
                  </p>
                )}
                {result.explanation && (
                  <p className="mt-2 text-sm text-gray-300">
                    {result.explanation}
                  </p>
                )}
              </div>

              {/* Matching Agents */}
              {result.matching_agents && result.matching_agents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-green-400">
                    ✅ Agentes que atendem:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.matching_agents.map((agent, i) => (
                      <span key={i} className="px-3 py-1 bg-green-500/20 rounded-full text-sm text-green-300">
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Partial Matches */}
              {result.partial_matches && result.partial_matches.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-yellow-400">
                    🔄 Atendem parcialmente:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.partial_matches.map((agent, i) => (
                      <span key={i} className="px-3 py-1 bg-yellow-500/20 rounded-full text-sm text-yellow-300">
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Features */}
              {result.missing_features && result.missing_features.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-orange-400">
                    ❓ Funcionalidades não encontradas:
                  </h4>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    {result.missing_features.map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Similar Agents List */}
              {result.similar_agents && result.similar_agents.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-400">
                    📋 Agentes encontrados ({result.similar_agents.length}):
                  </h4>
                  {result.similar_agents.map((agent, i) => (
                    <AgentCard key={i} agent={agent} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {!result && !error && !isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-gray-500 py-8"
            >
              <p className="text-4xl mb-4">💡</p>
              <p>Descreva o agente que você precisa criar</p>
              <p className="text-sm mt-1">Vamos verificar se já existe algo similar</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: SearchResult }) {
  const [expanded, setExpanded] = useState(false);
  const similarityPercent = Math.round(agent.similarity * 100);
  
  const getSimilarityColor = (sim: number) => {
    if (sim >= 0.7) return 'bg-green-500';
    if (sim >= 0.4) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  return (
    <motion.div
      layout
      className="p-3 bg-[#1a1d24] rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="font-medium text-white truncate">
              {agent.folder_name}
            </span>
          </div>
          <p className="text-sm text-gray-400 truncate">
            {agent.repo_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${getSimilarityColor(agent.similarity)}`} />
            <span className="text-sm text-gray-300">
              {similarityPercent}%
            </span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-white text-sm"
          >
            {expanded ? '▲' : '▼'}
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
            <div className="mt-3 pt-3 border-t border-gray-800">
              <pre className="text-xs text-gray-400 whitespace-pre-wrap">
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

