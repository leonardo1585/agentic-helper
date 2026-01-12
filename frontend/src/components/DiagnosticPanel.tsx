/**
 * Componente para diagnóstico de problemas com experiência visual premium.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  GitCommit,
  Settings,
  Shield,
  Loader2,
  ChevronDown,
  Lightbulb,
  ArrowRight,
  User,
  Calendar,
  Code,
  Sparkles,
  Zap,
  Target,
  Activity,
  Eye,
  MessageSquare,
  RefreshCw,
  Share2,
  Copy,
  Check,
  History,
  FileText,
  Ticket
} from 'lucide-react';
import { api, DiagnosticResult, DiagnosticTicket, DiagnosticHistory } from '../services/api';

interface DiagnosticPanelProps {
  repositoryName: string;
}

export function DiagnosticPanel({ repositoryName }: DiagnosticPanelProps) {
  const [problemDescription, setProblemDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [daysLookback, setDaysLookback] = useState(7);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['cause']));
  
  // Estado para ticket e histórico
  const [currentTicket, setCurrentTicket] = useState<DiagnosticTicket | null>(null);
  const [history, setHistory] = useState<DiagnosticHistory | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDiagnose = async () => {
    if (!problemDescription.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setCurrentTicket(null);
    
    try {
      const response = await api.diagnoseProblem({
        repository_name: repositoryName,
        problem_description: problemDescription,
        error_message: errorMessage || undefined,
        expected_behavior: expectedBehavior || undefined,
        actual_behavior: actualBehavior || undefined,
        days_lookback: daysLookback
      });
      
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no diagnóstico');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Cria ticket para compartilhamento
  const handleCreateTicket = async () => {
    if (!result) return;
    
    setIsCreatingTicket(true);
    try {
      const ticket = await api.createDiagnosticTicket({
        repository_name: repositoryName,
        problem_description: problemDescription,
        error_message: errorMessage || undefined,
        expected_behavior: expectedBehavior || undefined,
        actual_behavior: actualBehavior || undefined,
        days_lookback: daysLookback,
        created_by: 'Suporte'
      });
      
      setCurrentTicket(ticket);
      loadHistory(); // Atualiza histórico
    } catch (err) {
      console.error('Erro ao criar ticket:', err);
    } finally {
      setIsCreatingTicket(false);
    }
  };

  // Carrega histórico de diagnósticos
  const loadHistory = async () => {
    try {
      const data = await api.getDiagnosticHistory({ 
        repository_name: repositoryName,
        limit: 20 
      });
      setHistory(data);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  };

  // Copia link/log para clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  // Carrega histórico ao abrir
  const handleToggleHistory = () => {
    if (!showHistory && !history) {
      loadHistory();
    }
    setShowHistory(!showHistory);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const pulseAnimation = {
    scale: [1, 1.02, 1],
    transition: { duration: 2, repeat: Infinity }
  };

  return (
    <div className="space-y-6">
      {/* Header com gradiente */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 border border-slate-700/50"
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>
        
        <div className="relative">
          <div className="flex items-center gap-4 mb-4">
            <motion.div 
              animate={pulseAnimation}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20"
            >
              <Target className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-white">Diagnóstico Inteligente</h2>
              <p className="text-sm text-slate-400">Análise de problemas com IA</p>
            </div>
          </div>

          {/* Input principal */}
          <div className="relative">
            <textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Descreva o problema que está ocorrendo..."
              className="w-full h-28 px-4 py-3 bg-slate-800/50 backdrop-blur border border-slate-600/50 rounded-xl text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
            />
            <div className="absolute bottom-3 right-3 text-xs text-slate-500">
              {problemDescription.length} caracteres
            </div>
          </div>
        </div>
      </motion.div>

      {/* Detalhes avançados */}
      <motion.div
        initial={false}
        animate={{ height: showAdvanced ? 'auto' : 'auto' }}
      >
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors mb-3"
        >
          <motion.div
            animate={{ rotate: showAdvanced ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
          <span>Detalhes adicionais</span>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Mensagem de erro */}
              <div className="relative">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <MessageSquare className="w-4 h-4 text-red-400" />
                  Mensagem de erro
                </label>
                <textarea
                  value={errorMessage}
                  onChange={(e) => setErrorMessage(e.target.value)}
                  placeholder="Cole a mensagem de erro aqui..."
                  className="w-full h-20 px-4 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl text-slate-300 placeholder-slate-600 resize-none font-mono text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/30 transition-all"
                />
              </div>

              {/* Comportamentos lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Comportamento esperado
                  </label>
                  <textarea
                    value={expectedBehavior}
                    onChange={(e) => setExpectedBehavior(e.target.value)}
                    placeholder="O que deveria acontecer..."
                    className="w-full h-20 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-slate-300 placeholder-slate-600 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Comportamento atual
                  </label>
                  <textarea
                    value={actualBehavior}
                    onChange={(e) => setActualBehavior(e.target.value)}
                    placeholder="O que está acontecendo..."
                    className="w-full h-20 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-slate-300 placeholder-slate-600 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all"
                  />
                </div>
              </div>

              {/* Período */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Período de análise
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 1, label: '1 dia' },
                    { value: 7, label: '7 dias' },
                    { value: 14, label: '14 dias' },
                    { value: 30, label: '30 dias' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setDaysLookback(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        daysLookback === option.value
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Botão de diagnóstico */}
      <motion.button
        onClick={handleDiagnose}
        disabled={isAnalyzing || !problemDescription.trim()}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
          isAnalyzing || !problemDescription.trim()
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50'
        }`}
      >
        {isAnalyzing ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="w-5 h-5" />
            </motion.div>
            <span>Analisando commits e código...</span>
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            <span>Diagnosticar Problema</span>
          </>
        )}
      </motion.button>

      {/* Botão de histórico */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleToggleHistory}
        className="w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600/50"
      >
        <History className="w-5 h-5" />
        <span>Histórico ({history?.total || 0})</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Histórico de diagnósticos */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-3">
              <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Diagnósticos Anteriores
              </h4>
              
              {!history || history.tickets.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  Nenhum diagnóstico salvo ainda.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.tickets.map((ticket) => (
                    <a
                      key={ticket.id}
                      href={`/diagnostic/ticket/${ticket.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg bg-slate-900/50 border border-slate-700/30 hover:border-cyan-500/50 hover:bg-slate-800/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-cyan-400">{ticket.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          ticket.status === 'open' ? 'bg-amber-500/20 text-amber-300' :
                          ticket.status === 'investigating' ? 'bg-blue-500/20 text-blue-300' :
                          ticket.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        {ticket.problem_description}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-slate-500">
                          {new Date(ticket.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <span className="text-xs text-cyan-400/70">Abrir →</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state com animação */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 border border-slate-700/50"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-12 h-12 rounded-full border-2 border-amber-500/30 border-t-amber-500"
                />
                <Activity className="w-5 h-5 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div>
                <h3 className="text-white font-medium">Processando análise...</h3>
                <p className="text-sm text-slate-400">Buscando commits, analisando código e correlacionando mudanças</p>
              </div>
            </div>
            
            {/* Progress bar animada */}
            <div className="mt-4 h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="h-full w-1/3 bg-gradient-to-r from-transparent via-amber-500 to-transparent"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-400">Erro no diagnóstico</h4>
              <p className="text-sm text-red-300/70">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resultado */}
      <AnimatePresence>
        {result && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {/* Card principal do veredito */}
            {/* 3 estados: Refatoração (azul), Problema (vermelho), Sem relação (verde) */}
            <motion.div
              variants={itemVariants}
              className={`relative overflow-hidden rounded-2xl p-6 ${
                result.is_refactoring
                  ? 'bg-gradient-to-br from-blue-950/50 to-blue-900/30 border border-blue-500/30'
                  : result.found_cause
                  ? 'bg-gradient-to-br from-red-950/50 to-red-900/30 border border-red-500/30'
                  : 'bg-gradient-to-br from-emerald-950/50 to-emerald-900/30 border border-emerald-500/30'
              }`}
            >
              {/* Glow effect */}
              <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 ${
                result.is_refactoring ? 'bg-blue-500' : result.found_cause ? 'bg-red-500' : 'bg-emerald-500'
              }`} />
              
              <div className="relative">
                <div className="flex items-start gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      result.is_refactoring
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : result.found_cause
                        ? 'bg-red-500/20 border border-red-500/30'
                        : 'bg-emerald-500/20 border border-emerald-500/30'
                    }`}
                  >
                    {result.is_refactoring ? (
                      <RefreshCw className="w-7 h-7 text-blue-400" />
                    ) : result.found_cause ? (
                      <AlertTriangle className="w-7 h-7 text-red-400" />
                    ) : (
                      <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                    )}
                  </motion.div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h3 className={`text-xl font-bold ${
                        result.is_refactoring ? 'text-blue-400' : result.found_cause ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {result.is_refactoring ? 'Refatoração Detectada' : result.found_cause ? 'Causa Identificada' : 'Sem Relação'}
                      </h3>
                      
                      {/* Badge do tipo */}
                      {result.found_cause && result.root_cause_type && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                            result.root_cause_type === 'instruction'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : result.root_cause_type === 'code'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                          }`}
                        >
                          {result.root_cause_type === 'instruction' && <Shield className="w-3 h-3" />}
                          {result.root_cause_type === 'code' && <Code className="w-3 h-3" />}
                          {result.root_cause_type === 'config' && <Settings className="w-3 h-3" />}
                          {result.root_cause_type === 'instruction' && 'Instruções'}
                          {result.root_cause_type === 'code' && 'Código'}
                          {result.root_cause_type === 'config' && 'Configuração'}
                          {result.root_cause_type === 'external' && 'Externo'}
                        </motion.span>
                      )}
                      
                      {/* Badge de confiança */}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        result.confidence === 'high'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : result.confidence === 'medium'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-500/20 text-slate-300'
                      }`}>
                        {result.confidence === 'high' ? 'Alta confiança' : 
                         result.confidence === 'medium' ? 'Média confiança' : 'Baixa confiança'}
                      </span>
                    </div>
                    
                    <p className={`text-sm ${
                      result.is_refactoring ? 'text-blue-200/80' : result.found_cause ? 'text-red-200/80' : 'text-emerald-200/80'
                    }`}>
                      {result.verdict}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Resumo do diagnóstico */}
            <motion.div
              variants={itemVariants}
              className="p-5 rounded-xl bg-slate-800/50 backdrop-blur border border-slate-700/50"
            >
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-slate-400" />
                <h4 className="font-medium text-white">Análise Detalhada</h4>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{result.diagnosis_summary}</p>
            </motion.div>

            {/* Código problemático - se encontrou causa */}
            {result.found_cause && result.code_location && (
              <motion.div
                variants={itemVariants}
                className="rounded-xl bg-slate-900 border border-red-500/20 overflow-hidden"
              >
                <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-red-400" />
                    <span className="font-medium text-white">Código Identificado</span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 font-mono">
                    {result.code_location.file}
                  </span>
                </div>
                
                <div className="p-4 space-y-3">
                  {result.code_location.line_removed && (
                    <div>
                      <p className="text-xs text-red-400 mb-2 font-medium flex items-center gap-1">
                        <span className="w-4 h-4 rounded bg-red-500/20 flex items-center justify-center text-red-400">−</span>
                        Removido
                      </p>
                      <pre className="p-3 bg-red-950/30 rounded-lg border border-red-500/10 overflow-x-auto">
                        <code className="text-sm text-red-300 font-mono">{result.code_location.line_removed}</code>
                      </pre>
                    </div>
                  )}
                  
                  {result.code_location.line_added && (
                    <div>
                      <p className="text-xs text-emerald-400 mb-2 font-medium flex items-center gap-1">
                        <span className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400">+</span>
                        Adicionado
                      </p>
                      <pre className="p-3 bg-emerald-950/30 rounded-lg border border-emerald-500/10 overflow-x-auto">
                        <code className="text-sm text-emerald-300 font-mono">{result.code_location.line_added}</code>
                      </pre>
                    </div>
                  )}
                  
                  {result.code_location.explanation && (
                    <div className="p-3 bg-amber-500/10 rounded-lg border-l-2 border-amber-500 mt-4">
                      <p className="text-sm text-slate-200">
                        <Lightbulb className="w-4 h-4 text-amber-400 inline mr-2" />
                        {result.code_location.explanation}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Seções colapsáveis */}
            <motion.div variants={itemVariants} className="space-y-2">
              {/* Commits analisados */}
              {result.recent_commits.length > 0 && (
                <CollapsibleCard
                  title="Commits Analisados"
                  icon={<GitCommit className="w-4 h-4" />}
                  count={result.recent_commits.length}
                  isExpanded={expandedSections.has('commits')}
                  onToggle={() => toggleSection('commits')}
                  accentColor="blue"
                >
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.recent_commits.map((commit, idx) => (
                      <div key={idx} className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <GitCommit className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{commit.message}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              <span className="font-mono">{commit.sha}</span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {commit.author}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(commit.date)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleCard>
              )}

              {/* Recomendações */}
              {result.recommendations.length > 0 && (
                <CollapsibleCard
                  title="Recomendações"
                  icon={<Lightbulb className="w-4 h-4" />}
                  count={result.recommendations.length}
                  isExpanded={expandedSections.has('recommendations')}
                  onToggle={() => toggleSection('recommendations')}
                  accentColor="amber"
                >
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 bg-amber-500/5 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-amber-400">
                          {idx + 1}
                        </div>
                        <p className="text-sm text-slate-300">{rec}</p>
                      </li>
                    ))}
                  </ul>
                </CollapsibleCard>
              )}

              {/* Próximos passos */}
              {result.next_steps.length > 0 && (
                <CollapsibleCard
                  title="Próximos Passos"
                  icon={<ArrowRight className="w-4 h-4" />}
                  count={result.next_steps.length}
                  isExpanded={expandedSections.has('nextsteps')}
                  onToggle={() => toggleSection('nextsteps')}
                  accentColor="cyan"
                >
                  <ol className="space-y-2">
                    {result.next_steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 bg-cyan-500/5 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                        </div>
                        <p className="text-sm text-slate-300">{step}</p>
                      </li>
                    ))}
                  </ol>
                </CollapsibleCard>
              )}

              {/* Card de compartilhamento/ticket */}
              <motion.div
                variants={itemVariants}
                className="p-5 rounded-xl bg-gradient-to-br from-purple-950/30 to-purple-900/20 border border-purple-500/30"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-purple-300">Compartilhar Diagnóstico</h4>
                    <p className="text-xs text-purple-400/70">Crie um ticket para enviar ao time responsável</p>
                  </div>
                </div>

                {currentTicket ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-purple-500/10 rounded-lg">
                      <Ticket className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-mono text-purple-300">{currentTicket.id}</span>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                        currentTicket.status === 'open' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {currentTicket.status}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/diagnostic/ticket/${currentTicket.id}`)}
                        className="flex-1 py-2 px-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copiado!' : 'Copiar Link'}
                      </button>
                      <button
                        onClick={() => copyToClipboard(currentTicket.debug_log)}
                        className="flex-1 py-2 px-3 rounded-lg bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Copiar Log
                      </button>
                    </div>

                    {/* Preview do log */}
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1">
                        <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                        Ver log de debug
                      </summary>
                      <pre className="mt-2 p-3 bg-slate-900/50 rounded-lg text-xs text-slate-400 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {currentTicket.debug_log}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <button
                    onClick={handleCreateTicket}
                    disabled={isCreatingTicket}
                    className="w-full py-3 px-4 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isCreatingTicket ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Criando ticket...
                      </>
                    ) : (
                      <>
                        <Ticket className="w-4 h-4" />
                        Criar Ticket de Diagnóstico
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Componente de card colapsável
function CollapsibleCard({
  title,
  icon,
  count,
  isExpanded,
  onToggle,
  accentColor,
  children
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  isExpanded: boolean;
  onToggle: () => void;
  accentColor: 'blue' | 'amber' | 'cyan' | 'purple';
  children: React.ReactNode;
}) {
  const colors = {
    blue: 'from-blue-500/10 to-transparent border-blue-500/20 text-blue-400',
    amber: 'from-amber-500/10 to-transparent border-amber-500/20 text-amber-400',
    cyan: 'from-cyan-500/10 to-transparent border-cyan-500/20 text-cyan-400',
    purple: 'from-purple-500/10 to-transparent border-purple-500/20 text-purple-400'
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${colors[accentColor].split(' ').slice(1).join(' ')}`}>
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r ${colors[accentColor].split(' ')[0]} to-transparent hover:bg-slate-800/50 transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className={colors[accentColor].split(' ').slice(-1)[0]}>{icon}</span>
          <span className="font-medium text-white">{title}</span>
          {count !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{count}</span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-slate-400" />
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
            <div className="p-4 bg-slate-900/50">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
