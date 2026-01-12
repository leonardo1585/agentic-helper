/**
 * Componente para mostrar diferenças entre indexações com visual premium.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, 
  GitCompare, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  PlusCircle,
  MinusCircle,
  Edit3,
  ChevronDown,
  Loader2,
  Shield,
  Code,
  Settings,
  Sparkles,
  TrendingUp,
  FileCode,
  Zap
} from 'lucide-react';
import { api, UpdatesDiff, ChangeItem } from '../services/api';

interface UpdatesDiffPanelProps {
  repositoryName: string;
  onCreateSnapshot?: () => void;
}

export function UpdatesDiffPanel({ repositoryName, onCreateSnapshot }: UpdatesDiffPanelProps) {
  const [diff, setDiff] = useState<UpdatesDiff | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Começa como true
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['instructions', 'code']));
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (repositoryName) {
      loadDiff();
    } else {
      setIsLoading(false);
      setHasData(false);
      setMessage('Nenhum repositório selecionado');
    }
  }, [repositoryName]);

  const loadDiff = async () => {
    setIsLoading(true);
    setError(null);
    setDiff(null);
    
    try {
      const result = await api.getUpdatesDiff(repositoryName);
      
      if (result.has_diff && result.diff) {
        setDiff(result.diff);
        setHasData(true);
        setMessage(null);
      } else {
        setDiff(null);
        setHasData(false);
        setMessage(result.message || 'Não há snapshots suficientes para comparação. Faça pelo menos 2 indexações.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar diff');
      setHasData(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    try {
      await api.createSnapshot(repositoryName, 'user');
      await loadDiff();
      onCreateSnapshot?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar snapshot');
    } finally {
      setIsCreatingSnapshot(false);
    }
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

  const toggleDiff = (changeId: string) => {
    const newExpanded = new Set(expandedDiffs);
    if (newExpanded.has(changeId)) {
      newExpanded.delete(changeId);
    } else {
      newExpanded.add(changeId);
    }
    setExpandedDiffs(newExpanded);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Loading state
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 border border-slate-700/50"
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 rounded-full border-2 border-cyan-500/30 border-t-cyan-500"
            />
            <GitCompare className="w-6 h-6 text-cyan-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <h3 className="text-white font-medium">Carregando atualizações...</h3>
            <p className="text-sm text-slate-400">Comparando commits e mudanças</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-red-400 mb-1">Erro ao carregar</h4>
            <p className="text-sm text-red-300/70 mb-3">{error}</p>
            <button
              onClick={loadDiff}
              className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // No data state (includes null - API not yet responded or no snapshots)
  if (hasData === false || hasData === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 border border-slate-700/50"
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10 bg-cyan-500" />
        
        <div className="relative text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
            <GitCompare className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Histórico de Atualizações</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">{message}</p>
          <button
            onClick={handleCreateSnapshot}
            disabled={isCreatingSnapshot}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold flex items-center gap-2 mx-auto hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
          >
            {isCreatingSnapshot ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Criar Primeiro Snapshot
              </>
            )}
          </button>
        </div>
      </motion.div>
    );
  }

  // Has diff data
  if (diff) {
    return (
      <div className="space-y-4 text-white">
        {/* Header com período */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <GitCompare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Atualizações Recentes</h3>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{formatDate(diff.from_timestamp)} → {formatDate(diff.to_timestamp)}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={loadDiff}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-cyan-400"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
          <div className={`p-4 rounded-xl border ${
            diff.impact_level === 'critical' || diff.impact_level === 'high'
              ? 'bg-red-500/10 border-red-500/30'
              : diff.impact_level === 'medium'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className={`w-4 h-4 ${
                diff.impact_level === 'critical' || diff.impact_level === 'high'
                  ? 'text-red-400'
                  : diff.impact_level === 'medium'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`} />
              <span className="text-xs text-slate-400">Impacto</span>
            </div>
            <p className={`font-bold ${
              diff.impact_level === 'critical' || diff.impact_level === 'high'
                ? 'text-red-400'
                : diff.impact_level === 'medium'
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {diff.impact_level === 'critical' ? 'Crítico' :
               diff.impact_level === 'high' ? 'Alto' :
               diff.impact_level === 'medium' ? 'Médio' : 'Baixo'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <FileCode className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Alterações</span>
            </div>
            <p className="font-bold text-white">{diff.total_changes}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-slate-400">Commits</span>
            </div>
            <p className="font-bold text-white">{diff.from_commit_sha?.slice(0, 7) || '-'}</p>
          </div>
        </motion.div>

        {/* AI Analysis */}
        {diff.ai_analysis && (
          <motion.div
            variants={itemVariants}
            className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 overflow-hidden"
          >
            <div className="px-5 py-4 bg-gradient-to-r from-cyan-500/10 to-transparent border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h4 className="font-semibold text-white">Análise Inteligente</h4>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              {diff.ai_analysis.split('\n\n').map((paragraph, idx) => {
                const isTecnico = paragraph.includes('**Técnico:**') || paragraph.startsWith('Técnico:');
                const isImpacto = paragraph.includes('**Impacto:**') || paragraph.startsWith('Impacto:');
                
                let content = paragraph
                  .replace(/\*\*Técnico:\*\*\s*/g, '')
                  .replace(/\*\*Impacto:\*\*\s*/g, '')
                  .replace(/^Técnico:\s*/g, '')
                  .replace(/^Impacto:\s*/g, '');
                
                if (isTecnico) {
                  return (
                    <div key={idx} className="flex gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Code className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Técnico</span>
                        <p className="text-sm text-slate-200 mt-1 leading-relaxed">{content}</p>
                      </div>
                    </div>
                  );
                }
                
                if (isImpacto) {
                  return (
                    <div key={idx} className="flex gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Impacto no Negócio</span>
                        <p className="text-sm text-slate-200 mt-1 leading-relaxed">{content}</p>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <p key={idx} className="text-sm text-slate-300 leading-relaxed">{paragraph}</p>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Potential Issues */}
        {diff.potential_issues && diff.potential_issues.length > 0 && (
          <motion.div
            variants={itemVariants}
            className="rounded-2xl bg-red-500/5 border border-red-500/20 overflow-hidden"
          >
            <div className="px-5 py-4 bg-red-500/10 border-b border-red-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h4 className="font-semibold text-white">Possíveis Problemas</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">{diff.potential_issues.length}</span>
              </div>
            </div>
            
            <div className="p-5 space-y-3">
              {diff.potential_issues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                  <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-sm text-slate-200 leading-relaxed">{issue}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Changes Sections */}
        {diff.total_changes > 0 && (
          <motion.div variants={itemVariants} className="space-y-3">
            <ChangeSection
              title="Instruções e Guardrails"
              icon={<Shield className="w-4 h-4" />}
              changes={diff.instructions_changes}
              accentColor="purple"
              isExpanded={expandedSections.has('instructions')}
              onToggle={() => toggleSection('instructions')}
              expandedDiffs={expandedDiffs}
              onToggleDiff={toggleDiff}
              sectionKey="instructions"
            />
            
            <ChangeSection
              title="Código e Skills"
              icon={<Code className="w-4 h-4" />}
              changes={diff.code_changes}
              accentColor="blue"
              isExpanded={expandedSections.has('code')}
              onToggle={() => toggleSection('code')}
              expandedDiffs={expandedDiffs}
              onToggleDiff={toggleDiff}
              sectionKey="code"
            />
            
            <ChangeSection
              title="Configurações"
              icon={<Settings className="w-4 h-4" />}
              changes={diff.config_changes}
              accentColor="slate"
              isExpanded={expandedSections.has('config')}
              onToggle={() => toggleSection('config')}
              expandedDiffs={expandedDiffs}
              onToggleDiff={toggleDiff}
              sectionKey="config"
            />
          </motion.div>
        )}

        {/* No changes */}
        {diff.total_changes === 0 && (
          <motion.div
            variants={itemVariants}
            className="p-8 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h4 className="font-semibold text-emerald-400 mb-1">Tudo em ordem!</h4>
            <p className="text-sm text-slate-400">Nenhuma mudança detectada desde a última indexação.</p>
          </motion.div>
        )}
      </div>
    );
  }

  // Fallback - quando não há diff nem dados para mostrar
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 border border-slate-700/50"
    >
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10 bg-cyan-500" />
      
      <div className="relative text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
          <GitCompare className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Comparação de Atualizações</h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          {message || 'Para ver o histórico de atualizações, crie um snapshot após cada indexação. Assim você poderá comparar as mudanças entre versões.'}
        </p>
        <button
          onClick={handleCreateSnapshot}
          disabled={isCreatingSnapshot}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold flex items-center gap-2 mx-auto hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
        >
          {isCreatingSnapshot ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Criando...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Criar Snapshot Agora
            </>
          )}
        </button>
        <p className="text-xs text-slate-500 mt-4">
          💡 Dica: Snapshots são criados automaticamente quando você indexa um repositório.
        </p>
      </div>
    </motion.div>
  );
}

// Componente de seção de mudanças
function ChangeSection({
  title,
  icon,
  changes,
  accentColor,
  isExpanded,
  onToggle,
  expandedDiffs,
  onToggleDiff,
  sectionKey
}: {
  title: string;
  icon: React.ReactNode;
  changes: ChangeItem[];
  accentColor: 'purple' | 'blue' | 'slate';
  isExpanded: boolean;
  onToggle: () => void;
  expandedDiffs: Set<string>;
  onToggleDiff: (id: string) => void;
  sectionKey: string;
}) {
  if (changes.length === 0) return null;

  const colors = {
    purple: {
      bg: 'from-purple-500/10',
      border: 'border-purple-500/20',
      text: 'text-purple-400',
      iconBg: 'bg-purple-500/20'
    },
    blue: {
      bg: 'from-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      iconBg: 'bg-blue-500/20'
    },
    slate: {
      bg: 'from-slate-500/10',
      border: 'border-slate-500/20',
      text: 'text-slate-400',
      iconBg: 'bg-slate-500/20'
    }
  };

  const c = colors[accentColor];

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r ${c.bg} to-transparent hover:bg-slate-800/50 transition-colors`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center ${c.text}`}>
            {icon}
          </div>
          <span className="font-medium text-white">{title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{changes.length}</span>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
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
            <div className="p-4 space-y-3 bg-slate-900/50">
              {changes.map((change, idx) => {
                const changeId = `${sectionKey}-${idx}`;
                const isDiffExpanded = expandedDiffs.has(changeId);
                const hasPatch = change.patch && change.patch.length > 0;

                return (
                  <div key={idx} className="rounded-xl bg-slate-800/50 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          change.type === 'added' ? 'bg-emerald-500/20' :
                          change.type === 'removed' ? 'bg-red-500/20' :
                          'bg-amber-500/20'
                        }`}>
                          {change.type === 'added' ? <PlusCircle className="w-4 h-4 text-emerald-400" /> :
                           change.type === 'removed' ? <MinusCircle className="w-4 h-4 text-red-400" /> :
                           <Edit3 className="w-4 h-4 text-amber-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200">{change.description}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              change.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                              change.impact === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {change.impact === 'high' ? 'Alto' : change.impact === 'medium' ? 'Médio' : 'Baixo'}
                            </span>
                            
                            {change.has_breaking_change && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-600/30 text-red-300 font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Breaking Change
                              </span>
                            )}
                            
                            {(change.additions || change.deletions) && (
                              <div className="flex items-center gap-1 text-xs">
                                {change.additions ? <span className="text-emerald-400">+{change.additions}</span> : null}
                                {change.deletions ? <span className="text-red-400">-{change.deletions}</span> : null}
                              </div>
                            )}
                            
                            {hasPatch && (
                              <button
                                onClick={() => onToggleDiff(changeId)}
                                className="ml-auto text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                              >
                                <ChevronDown className={`w-3 h-3 transition-transform ${isDiffExpanded ? 'rotate-180' : ''}`} />
                                {isDiffExpanded ? 'Ocultar' : 'Ver código'}
                              </button>
                            )}
                          </div>
                          
                          {/* Referências cruzadas - onde variáveis removidas são usadas */}
                          {change.has_breaking_change && change.cross_references && change.cross_references.length > 0 && (
                            <div className="mt-3 p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                <span className="text-sm font-semibold text-red-400">
                                  ❌ Problema Confirmado
                                </span>
                              </div>
                              <p className="text-xs text-red-300 mb-2">
                                {change.removed_identifiers?.length ? (
                                  <>Variável(is) removida(s): <code className="bg-red-900/30 px-1 rounded">{change.removed_identifiers.join(', ')}</code></>
                                ) : 'Identificadores removidos são usados em:'}
                              </p>
                              <div className="space-y-1">
                                {change.cross_references.slice(0, 5).map((ref, refIdx) => (
                                  <div key={refIdx} className="text-xs bg-slate-900/50 rounded p-2 font-mono">
                                    <span className="text-cyan-400">{ref.file_path}</span>
                                    <span className="text-slate-500">:</span>
                                    <span className="text-amber-400">{ref.line_number}</span>
                                    <span className="text-slate-500 ml-2">→</span>
                                    <span className="text-slate-300 ml-2 break-all">{ref.line_content}</span>
                                  </div>
                                ))}
                                {change.cross_references.length > 5 && (
                                  <p className="text-xs text-slate-500 italic">
                                    ... e mais {change.cross_references.length - 5} referência(s)
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isDiffExpanded && hasPatch && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          <div className="border-t border-slate-700 bg-slate-950 overflow-x-auto max-h-80 overflow-y-auto">
                            {change.patch?.split('\n').map((line, lineIdx) => {
                              const isAddition = line.startsWith('+') && !line.startsWith('+++');
                              const isDeletion = line.startsWith('-') && !line.startsWith('---');
                              const isHeader = line.startsWith('@@');

                              return (
                                <div
                                  key={lineIdx}
                                  className={`px-3 py-0.5 font-mono text-xs ${
                                    isAddition ? 'bg-emerald-900/30 text-emerald-400' :
                                    isDeletion ? 'bg-red-900/30 text-red-400' :
                                    isHeader ? 'bg-blue-900/30 text-blue-400' :
                                    'text-slate-400'
                                  }`}
                                >
                                  {line || ' '}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
