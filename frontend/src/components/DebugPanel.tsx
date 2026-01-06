import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bug, 
  Search, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Code,
  FileText,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Target,
  Folder
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../services/api';

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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'cause', 'analysis', 'toollogic']));
  
  // Extrai repositórios únicos das bases de conhecimento
  const analyzedRepos = [...new Set(knowledgeBases.map(kb => {
    const parts = kb.split('/');
    return `${parts[0]}/${parts[1]}`;
  }))];
  
  // Carrega pastas quando seleciona repo
  const handleRepoChange = async (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    setSelectedFolder('');
    
    // Filtra pastas deste repo nas KBs
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
  
  const handleDebug = async () => {
    if (!selectedRepo || !selectedFolder || !problemDescription) {
      return;
    }
    
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
  
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-amber-600 bg-amber-100';
      case 'low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };
  
  if (!status?.ai_configured) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Bug className="w-8 h-8" />
        </div>
        <h3 className="empty-state-title">Configure a IA</h3>
        <p className="empty-state-description">
          Configure OpenAI ou Gemini nas configurações para usar o debug.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Bug className="w-6 h-6 text-red-500" />
          Debug de Problemas
        </h1>
        <p className="page-subtitle">
          Investigue problemas reportados em agentes analisando código, definições e outputs
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Formulário */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-red-500" />
              Selecione o Agente
            </h3>
            
            <div className="space-y-3">
              {/* Seleção de Repositório */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repositório
                </label>
                <select
                  value={selectedRepo}
                  onChange={(e) => handleRepoChange(e.target.value)}
                  className="input"
                >
                  <option value="">Selecione um repositório...</option>
                  {analyzedRepos.map(repo => (
                    <option key={repo} value={repo}>{repo}</option>
                  ))}
                </select>
              </div>
              
              {/* Seleção de Pasta */}
              {selectedRepo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pasta (Agente)
                  </label>
                  <select
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="input"
                  >
                    <option value="">Selecione uma pasta...</option>
                    {folders.map(folder => (
                      <option key={folder} value={folder}>{folder}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Descreva o Problema
            </h3>
            
            <textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Ex: O agente enviou um endereço de retirada diferente do endereço de entrega do cliente. O cliente esperava receber em casa, mas o agente disse que ele poderia retirar na loja X."
              className="input min-h-[120px] resize-none"
            />
          </div>
          
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-blue-500" />
              JSON de Retorno (Opcional)
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Cole o JSON que o agente retornou. Pode ser JSON normal ou codificado (com \" escapados)
            </p>
            
            <textarea
              value={outputJson}
              onChange={(e) => setOutputJson(e.target.value)}
              placeholder='Cole aqui o JSON (normal ou codificado com escapes)'
              className="input min-h-[150px] resize-none font-mono text-xs"
            />
          </div>
          
          <button
            onClick={handleDebug}
            disabled={isLoading || !selectedRepo || !selectedFolder || !problemDescription}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Investigando...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Investigar Problema
              </>
            )}
          </button>
        </div>
        
        {/* Resultado */}
        <div>
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Status */}
                <div className="card bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Bug className="w-5 h-5 text-red-500" />
                      Resultado da Investigação
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(result.confidence)}`}>
                      Confiança: {result.confidence === 'high' ? 'Alta' : result.confidence === 'medium' ? 'Média' : 'Baixa'}
                    </span>
                  </div>
                  
                  <div className="flex gap-3 text-sm">
                    <span className={`flex items-center gap-1 ${result.agent_definition_found ? 'text-green-600' : 'text-gray-400'}`}>
                      {result.agent_definition_found ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      agent_definition
                    </span>
                    <span className={`flex items-center gap-1 ${result.knowledge_base_found ? 'text-green-600' : 'text-gray-400'}`}>
                      {result.knowledge_base_found ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      Base de Conhecimento
                    </span>
                  </div>
                </div>
                
                {/* Resumo do Problema */}
                <div className="card">
                  <button
                    onClick={() => toggleSection('summary')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      Resumo do Problema
                    </h3>
                    {expandedSections.has('summary') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                  
                  {expandedSections.has('summary') && (
                    <p className="text-gray-600 text-sm mt-3">{result.problem_summary}</p>
                  )}
                </div>
                
                {/* Causa Raiz */}
                {result.root_cause && (
                  <div className="card border-red-200 bg-red-50">
                    <button
                      onClick={() => toggleSection('cause')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h3 className="font-semibold text-red-900 flex items-center gap-2">
                        <Target className="w-5 h-5 text-red-500" />
                        Causa Raiz
                      </h3>
                      {expandedSections.has('cause') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    
                    {expandedSections.has('cause') && (
                      <p className="text-red-800 text-sm mt-3 whitespace-pre-wrap">{result.root_cause}</p>
                    )}
                  </div>
                )}
                
                {/* Análise de Dados (NOVO) */}
                {result.data_analysis && (
                  <div className="card border-blue-200 bg-blue-50">
                    <button
                      onClick={() => toggleSection('analysis')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                        <Search className="w-5 h-5 text-blue-500" />
                        Análise Detalhada dos Dados
                      </h3>
                      {expandedSections.has('analysis') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    
                    {expandedSections.has('analysis') && (
                      <div className="mt-3 space-y-3">
                        {result.data_analysis.seller_info && (
                          <div className="p-2 bg-white rounded border border-blue-200">
                            <p className="text-xs font-semibold text-blue-800 uppercase">Seller/Origem:</p>
                            <p className="text-sm text-gray-700">{result.data_analysis.seller_info}</p>
                          </div>
                        )}
                        {result.data_analysis.data_returned && (
                          <div className="p-2 bg-white rounded border border-amber-200">
                            <p className="text-xs font-semibold text-amber-800 uppercase">O que foi retornado:</p>
                            <p className="text-sm text-gray-700">{result.data_analysis.data_returned}</p>
                          </div>
                        )}
                        {result.data_analysis.data_expected && (
                          <div className="p-2 bg-white rounded border border-green-200">
                            <p className="text-xs font-semibold text-green-800 uppercase">O que deveria retornar:</p>
                            <p className="text-sm text-gray-700">{result.data_analysis.data_expected}</p>
                          </div>
                        )}
                        {result.data_analysis.discrepancy && (
                          <div className="p-2 bg-red-100 rounded border border-red-300">
                            <p className="text-xs font-semibold text-red-800 uppercase">❌ Discrepância:</p>
                            <p className="text-sm text-red-700 font-medium">{result.data_analysis.discrepancy}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Problema na Lógica da Tool (NOVO) */}
                {result.tool_logic_issue && (
                  <div className="card border-purple-200 bg-purple-50">
                    <button
                      onClick={() => toggleSection('toollogic')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                        <Code className="w-5 h-5 text-purple-500" />
                        Problema na Lógica da Tool
                      </h3>
                      {expandedSections.has('toollogic') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    
                    {expandedSections.has('toollogic') && (
                      <p className="text-purple-800 text-sm mt-3 whitespace-pre-wrap">{result.tool_logic_issue}</p>
                    )}
                  </div>
                )}
                
                {/* Fluxo de Dados */}
                {result.data_flow && (
                  <div className="card">
                    <button
                      onClick={() => toggleSection('dataflow')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        Fluxo de Dados
                      </h3>
                      {expandedSections.has('dataflow') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    
                    {expandedSections.has('dataflow') && (
                      <p className="text-gray-600 text-sm mt-3 whitespace-pre-wrap">{result.data_flow}</p>
                    )}
                  </div>
                )}
                
                {/* Handlers Afetados */}
                {result.affected_handlers?.length > 0 && (
                  <div className="card">
                    <button
                      onClick={() => toggleSection('handlers')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Code className="w-5 h-5 text-purple-500" />
                        Handlers Afetados ({result.affected_handlers.length})
                      </h3>
                      {expandedSections.has('handlers') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    
                    {expandedSections.has('handlers') && (
                      <div className="mt-3 space-y-1">
                        {result.affected_handlers.map((handler, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <code className="px-2 py-1 bg-purple-100 text-purple-800 rounded">{handler}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Locais no Código */}
                {result.affected_code_locations?.length > 0 && (
                  <div className="card">
                    <button
                      onClick={() => toggleSection('locations')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Folder className="w-5 h-5 text-amber-500" />
                        Locais no Código ({result.affected_code_locations.length})
                      </h3>
                      {expandedSections.has('locations') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    
                    {expandedSections.has('locations') && (
                      <div className="mt-3 space-y-1">
                        {result.affected_code_locations.map((loc, i) => (
                          <div key={i} className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                            {loc}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Sugestões */}
                {result.suggestions?.length > 0 && (
                  <div className="card border-green-200 bg-green-50">
                    <button
                      onClick={() => toggleSection('suggestions')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h3 className="font-semibold text-green-900 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-green-500" />
                        Sugestões de Correção ({result.suggestions.length})
                      </h3>
                      {expandedSections.has('suggestions') ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    
                    {expandedSections.has('suggestions') && (
                      <ul className="mt-3 space-y-2">
                        {result.suggestions.map((sug, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                            <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            {sug}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </motion.div>
            )}
            
            {!result && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card text-center py-12"
              >
                <Bug className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">
                  Selecione um agente, descreva o problema e clique em "Investigar"
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Quanto mais detalhes você fornecer (incluindo o JSON de retorno), melhor será a análise
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

