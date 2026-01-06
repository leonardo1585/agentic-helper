/**
 * Painel para gerenciar indexação de agentes no Vector Store
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api, VectorStats } from '../services/api';

interface IndexPanelProps {
  onClose?: () => void;
}

export function IndexPanel({ onClose }: IndexPanelProps) {
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<{ success: number; failed: number; agents: string[] } | null>(null);
  const [kbCount, setKbCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    loadKBCount();
  }, []);

  const loadStats = async () => {
    try {
      const s = await api.getVectorStats();
      setStats(s);
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    }
  };

  const loadKBCount = async () => {
    try {
      const kbs = await api.listKnowledgeBases();
      setKbCount(kbs.length);
    } catch (err) {
      console.error('Erro ao carregar KBs:', err);
    }
  };

  const handleIndexAll = async () => {
    setIsIndexing(true);
    setError(null);
    setIndexResult(null);

    try {
      const result = await api.indexAllAgents();
      setIndexResult(result);
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao indexar');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleClearIndex = async () => {
    if (!confirm('Tem certeza que deseja limpar o índice? Você precisará reindexar.')) return;
    
    try {
      await api.clearVectorIndex();
      await loadStats();
      setIndexResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao limpar');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0f1117]">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Gerenciar Índice
          </h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Indexe os agentes analisados para habilitar busca semântica
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[#1a1d24] rounded-lg border border-gray-800">
            <p className="text-sm text-gray-400">Agentes Indexados</p>
            <p className="text-3xl font-bold text-white mt-1">
              {stats?.total_agents ?? '-'}
            </p>
          </div>
          <div className="p-4 bg-[#1a1d24] rounded-lg border border-gray-800">
            <p className="text-sm text-gray-400">KBs Disponíveis</p>
            <p className="text-3xl font-bold text-white mt-1">
              {kbCount}
            </p>
          </div>
        </div>

        {/* Sync Status */}
        {stats && kbCount > 0 && (
          <div className={`p-4 rounded-lg border ${
            stats.total_agents === kbCount 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-yellow-500/10 border-yellow-500/30'
          }`}>
            {stats.total_agents === kbCount ? (
              <p className="text-green-400 flex items-center gap-2">
                <span>✅</span>
                Índice sincronizado! Todos os agentes estão indexados.
              </p>
            ) : (
              <p className="text-yellow-400 flex items-center gap-2">
                <span>⚠️</span>
                {kbCount - stats.total_agents} agente(s) ainda não indexado(s)
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleIndexAll}
            disabled={isIndexing || kbCount === 0}
            className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 
                       rounded-lg font-medium text-white hover:from-indigo-500 hover:to-purple-500 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all
                       flex items-center justify-center gap-2"
          >
            {isIndexing ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Indexando...
              </>
            ) : (
              <>
                <span>🔄</span>
                Indexar Todos os Agentes
              </>
            )}
          </button>

          {stats && stats.total_agents > 0 && (
            <button
              onClick={handleClearIndex}
              className="w-full px-4 py-2 bg-transparent border border-red-500/50 
                         rounded-lg text-red-400 hover:bg-red-500/10 transition-all
                         flex items-center justify-center gap-2"
            >
              <span>🗑️</span>
              Limpar Índice
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Result */}
        {indexResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-[#1a1d24] rounded-lg border border-gray-800"
          >
            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
              <span>📋</span>
              Resultado da Indexação
            </h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-2 bg-green-500/10 rounded">
                <p className="text-xs text-gray-400">Sucesso</p>
                <p className="text-xl font-bold text-green-400">{indexResult.success}</p>
              </div>
              <div className="p-2 bg-red-500/10 rounded">
                <p className="text-xs text-gray-400">Falhas</p>
                <p className="text-xl font-bold text-red-400">{indexResult.failed}</p>
              </div>
            </div>
            
            {indexResult.agents.length > 0 && (
              <div>
                <p className="text-sm text-gray-400 mb-2">Agentes indexados:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {indexResult.agents.map((agent, i) => (
                    <div key={i} className="text-xs text-gray-300 py-1 px-2 bg-gray-800/50 rounded">
                      {agent}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Info */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h4 className="font-medium text-blue-400 mb-2 flex items-center gap-2">
            <span>💡</span>
            Como funciona?
          </h4>
          <ul className="text-sm text-gray-300 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-400">1.</span>
              <span>A indexação cria embeddings (representações numéricas) de cada agente</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">2.</span>
              <span>Os embeddings são salvos localmente no ChromaDB</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">3.</span>
              <span>Isso permite busca semântica: encontrar agentes por significado, não apenas por texto</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">4.</span>
              <span>O chat inteligente usa RAG para responder com contexto relevante automaticamente</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default IndexPanel;

