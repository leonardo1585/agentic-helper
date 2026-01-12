/**
 * Componente para visualização de ticket de diagnóstico/debug.
 * Acessível via link compartilhável.
 * Exibe dados diferentes dependendo do tipo do ticket (diagnostic ou debug).
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Ticket,
  ArrowLeft,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileText,
  GitCommit,
  Code,
  Lightbulb,
  Target,
  Loader2,
  Bug,
  Database,
  Eye
} from 'lucide-react';
import { api, DiagnosticTicket } from '../services/api';

export function TicketView() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [ticket, setTicket] = useState<DiagnosticTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ticketId) {
      loadTicket(ticketId);
    }
  }, [ticketId]);

  const loadTicket = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDiagnosticTicket(id);
      setTicket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ticket não encontrado');
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'investigating': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'resolved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'closed': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'investigating': return 'Em Investigação';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Carregando ticket...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Ticket não encontrado</h1>
          <p className="text-slate-400 mb-6">{error || `O ticket ${ticketId} não existe ou foi removido.`}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  const isDebugTicket = ticket.ticket_type === 'debug';
  const debugData = ticket.debug_result;
  const diagnosisData = ticket.diagnosis_result;

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {isDebugTicket ? (
                <Bug className="w-6 h-6 text-red-400" />
              ) : (
                <Ticket className="w-6 h-6 text-purple-400" />
              )}
              <h1 className="text-2xl font-bold text-white">{ticket.id}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(ticket.status)}`}>
                {getStatusLabel(ticket.status)}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs ${isDebugTicket ? 'bg-red-500/20 text-red-300' : 'bg-purple-500/20 text-purple-300'}`}>
                {isDebugTicket ? 'Debug' : 'Diagnóstico'}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Criado em {new Date(ticket.created_at).toLocaleString('pt-BR')} por {ticket.created_by}
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Problema Reportado */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-400" />
              Problema Reportado
            </h2>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-500 uppercase">Repositório</span>
                <p className="text-white font-mono">{ticket.repository_name}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase">Descrição</span>
                <p className="text-slate-300">{ticket.problem_description}</p>
              </div>
              {ticket.error_message && (
                <div>
                  <span className="text-xs text-slate-500 uppercase">Mensagem de Erro</span>
                  <pre className="mt-1 p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-red-300 text-sm overflow-x-auto">
                    {ticket.error_message}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* === CONTEÚDO DO TICKET DE DEBUG === */}
          {isDebugTicket && debugData && (
            <>
              {/* Resumo do Problema */}
              {debugData.problem_summary && (
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-slate-400" />
                    Resumo do Problema
                  </h2>
                  <p className="text-slate-300 leading-relaxed">{debugData.problem_summary}</p>
                </div>
              )}

              {/* Causa Raiz */}
              {debugData.root_cause && (
                <div className="p-6 rounded-2xl bg-red-950/30 border border-red-500/30">
                  <h2 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Causa Raiz Identificada
                  </h2>
                  <div className="p-4 bg-red-950/50 rounded-lg border border-red-900/50">
                    <p className="text-red-200 leading-relaxed whitespace-pre-wrap">{debugData.root_cause}</p>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      debugData.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
                      debugData.confidence === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>
                      {debugData.confidence === 'high' ? 'Alta confiança' : 
                       debugData.confidence === 'medium' ? 'Média confiança' : 'Baixa confiança'}
                    </span>
                  </div>
                </div>
              )}

              {/* Problema na Lógica da Tool */}
              {debugData.tool_logic_issue && (
                <div className="p-6 rounded-2xl bg-purple-950/30 border border-purple-500/30">
                  <h2 className="text-lg font-semibold text-purple-400 mb-3 flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Problema na Lógica da Tool
                  </h2>
                  <div className="p-4 bg-purple-950/50 rounded-lg border border-purple-900/50">
                    <p className="text-purple-200 leading-relaxed whitespace-pre-wrap">{debugData.tool_logic_issue}</p>
                  </div>
                </div>
              )}

              {/* Análise Detalhada dos Dados */}
              {debugData.data_analysis && (
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-400" />
                    Análise Detalhada dos Dados
                  </h2>
                  <div className="space-y-3">
                    {debugData.data_analysis.seller_info && (
                      <div className="p-3 bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                        <span className="text-xs text-blue-400 uppercase font-medium">Seller/Origem</span>
                        <p className="text-slate-300 mt-1">{debugData.data_analysis.seller_info}</p>
                      </div>
                    )}
                    {debugData.data_analysis.data_returned && (
                      <div className="p-3 bg-amber-950/30 rounded-lg border-l-4 border-amber-500">
                        <span className="text-xs text-amber-400 uppercase font-medium">O que foi Retornado</span>
                        <p className="text-slate-300 mt-1">{debugData.data_analysis.data_returned}</p>
                      </div>
                    )}
                    {debugData.data_analysis.data_expected && (
                      <div className="p-3 bg-emerald-950/30 rounded-lg border-l-4 border-emerald-500">
                        <span className="text-xs text-emerald-400 uppercase font-medium">O que era Esperado</span>
                        <p className="text-slate-300 mt-1">{debugData.data_analysis.data_expected}</p>
                      </div>
                    )}
                    {debugData.data_analysis.discrepancy && (
                      <div className="p-3 bg-red-950/30 rounded-lg border-l-4 border-red-500">
                        <span className="text-xs text-red-400 uppercase font-medium">Discrepância</span>
                        <p className="text-slate-300 mt-1">{debugData.data_analysis.discrepancy}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Handlers Afetados */}
              {debugData.affected_handlers && debugData.affected_handlers.length > 0 && (
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Code className="w-5 h-5 text-purple-400" />
                    Handlers Afetados ({debugData.affected_handlers.length})
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {debugData.affected_handlers.map((handler, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-mono">
                        {handler}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidências */}
              {debugData.evidence && debugData.evidence.length > 0 && (
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    Evidências ({debugData.evidence.length})
                  </h2>
                  <ul className="space-y-2">
                    {debugData.evidence.map((ev, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-300">
                        <span className="text-cyan-400 mt-1">•</span>
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sugestões */}
              {debugData.suggestions && debugData.suggestions.length > 0 && (
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    Sugestões de Correção ({debugData.suggestions.length})
                  </h2>
                  <div className="space-y-3">
                    {debugData.suggestions.map((sug, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 bg-amber-950/20 rounded-lg border border-amber-900/30">
                        <span className="w-7 h-7 rounded-full bg-amber-500/30 flex items-center justify-center text-amber-300 text-sm font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <p className="text-slate-300">{sug}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* === CONTEÚDO DO TICKET DE DIAGNÓSTICO === */}
          {!isDebugTicket && diagnosisData && (
            <>
              {/* Veredito */}
              <div className={`p-6 rounded-2xl border ${
                diagnosisData.is_refactoring
                  ? 'bg-blue-950/30 border-blue-500/30'
                  : diagnosisData.found_cause
                  ? 'bg-red-950/30 border-red-500/30'
                  : 'bg-emerald-950/30 border-emerald-500/30'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    diagnosisData.is_refactoring
                      ? 'bg-blue-500/20'
                      : diagnosisData.found_cause
                      ? 'bg-red-500/20'
                      : 'bg-emerald-500/20'
                  }`}>
                    {diagnosisData.is_refactoring ? (
                      <RefreshCw className="w-6 h-6 text-blue-400" />
                    ) : diagnosisData.found_cause ? (
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold ${
                      diagnosisData.is_refactoring ? 'text-blue-400' : diagnosisData.found_cause ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {diagnosisData.is_refactoring ? 'Refatoração Detectada' : diagnosisData.found_cause ? 'Causa Identificada' : 'Sem Relação'}
                    </h3>
                    <p className={`mt-1 ${
                      diagnosisData.is_refactoring ? 'text-blue-300/80' : diagnosisData.found_cause ? 'text-red-300/80' : 'text-emerald-300/80'
                    }`}>
                      {diagnosisData.verdict}
                    </p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        diagnosisData.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
                        diagnosisData.confidence === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-slate-500/20 text-slate-300'
                      }`}>
                        {diagnosisData.confidence === 'high' ? 'Alta confiança' : 
                         diagnosisData.confidence === 'medium' ? 'Média confiança' : 'Baixa confiança'}
                      </span>
                      {diagnosisData.root_cause_type && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-slate-500/20 text-slate-300">
                          {diagnosisData.root_cause_type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Análise detalhada */}
              {diagnosisData.diagnosis_summary && (
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-400" />
                    Análise Detalhada
                  </h2>
                  <p className="text-slate-300 leading-relaxed">{diagnosisData.diagnosis_summary}</p>
                </div>
              )}

              {/* Código identificado */}
              {diagnosisData.code_location && (
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Code className="w-5 h-5 text-amber-400" />
                    Código Identificado
                  </h2>
                  <p className="text-sm text-slate-400 font-mono mb-3">{diagnosisData.code_location.file}</p>
                  {diagnosisData.code_location.line_removed && (
                    <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg mb-2">
                      <span className="text-xs text-red-400 uppercase">Removido</span>
                      <code className="block mt-1 text-red-300 text-sm">{diagnosisData.code_location.line_removed}</code>
                    </div>
                  )}
                  {diagnosisData.code_location.line_added && (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-lg">
                      <span className="text-xs text-emerald-400 uppercase">Adicionado</span>
                      <code className="block mt-1 text-emerald-300 text-sm">{diagnosisData.code_location.line_added}</code>
                    </div>
                  )}
                  {diagnosisData.code_location.explanation && (
                    <p className="mt-3 text-sm text-slate-400">{diagnosisData.code_location.explanation}</p>
                  )}
                </div>
              )}

              {/* Commits recentes */}
              {diagnosisData.recent_commits && diagnosisData.recent_commits.length > 0 && (
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <GitCommit className="w-5 h-5 text-cyan-400" />
                    Commits Analisados ({diagnosisData.recent_commits.length})
                  </h2>
                  <div className="space-y-2">
                    {diagnosisData.recent_commits.slice(0, 5).map((commit, idx) => (
                      <div key={idx} className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-cyan-400">{commit.sha.slice(0, 7)}</span>
                          <span className="text-sm text-white">{commit.message}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{commit.author}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recomendações */}
              {diagnosisData.recommendations && diagnosisData.recommendations.length > 0 && (
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    Recomendações
                  </h2>
                  <ul className="space-y-2">
                    {diagnosisData.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-300">
                        <span className="text-amber-400">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Log de debug */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                Log Completo
              </h2>
              <button
                onClick={() => copyToClipboard(ticket.debug_log)}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm flex items-center gap-2 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-lg text-xs text-slate-400 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
              {ticket.debug_log}
            </pre>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default TicketView;
