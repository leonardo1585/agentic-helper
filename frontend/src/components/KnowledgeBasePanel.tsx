import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Server, 
  Link, 
  Code, 
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  Sparkles,
  Users,
  Zap,
  BookOpen,
  HelpCircle,
  Terminal,
  Globe,
  Folder,
  Key,
  Layers,
  GitBranch,
  CheckCircle,
  XCircle,
  Settings,
  Play
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '../stores/appStore';

type KBViewType = 'technical' | 'business';

export function KnowledgeBasePanel() {
  const { 
    knowledgeBases, 
    currentKB, 
    isLoading,
    status,
    fetchKnowledgeBases, 
    loadKnowledgeBase 
  } = useAppStore();
  
  const [viewType, setViewType] = useState<KBViewType>('technical');
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);
  
  // Agrupa KBs por repositório
  const groupedKBs = useMemo(() => {
    const groups: Map<string, string[]> = new Map();
    
    for (const kb of knowledgeBases) {
      // Formato: owner/repo/folder ou owner/repo
      const parts = kb.split('/');
      const repoName = `${parts[0]}/${parts[1]}`;
      const folderPath = parts.slice(2).join('/');
      
      if (!groups.has(repoName)) {
        groups.set(repoName, []);
      }
      
      if (folderPath) {
        groups.get(repoName)!.push(kb);
      }
    }
    
    return Array.from(groups.entries()).map(([repoName, folders]) => ({
      repoName,
      folders
    }));
  }, [knowledgeBases]);
  
  const toggleRepo = (repoName: string) => {
    const newExpanded = new Set(expandedRepos);
    if (newExpanded.has(repoName)) {
      newExpanded.delete(repoName);
    } else {
      newExpanded.add(repoName);
    }
    setExpandedRepos(newExpanded);
  };
  
  // Extrai o nome da pasta do KB name
  const getFolderName = (kbName: string): string => {
    const parts = kbName.split('/');
    return parts.slice(2).join('/') || parts[1];
  };
  
  if (!status?.ai_configured) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Sparkles className="w-8 h-8" />
        </div>
        <h3 className="empty-state-title">Configure a IA</h3>
        <p className="empty-state-description">
          Configure OpenAI ou Gemini nas configurações para analisar repositórios.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Base de Conhecimento</h1>
          <p className="page-subtitle">
            {knowledgeBases.length} pasta(s) analisada(s) em {groupedKBs.length} repositório(s)
          </p>
        </div>
        
        {/* View Type Selector */}
        {currentKB && (
          <div className="tabs">
            <button
              onClick={() => setViewType('technical')}
              className={`tab flex items-center gap-2 ${viewType === 'technical' ? 'active' : ''}`}
            >
              <Terminal className="w-4 h-4" />
              Técnica
            </button>
            <button
              onClick={() => setViewType('business')}
              className={`tab flex items-center gap-2 ${viewType === 'business' ? 'active' : ''}`}
            >
              <Users className="w-4 h-4" />
              Negócio
            </button>
          </div>
        )}
      </div>
      
      {knowledgeBases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Database className="w-8 h-8" />
          </div>
          <h3 className="empty-state-title">Nenhuma base criada</h3>
          <p className="empty-state-description">
            Selecione um repositório na aba "Repositórios", escolha uma pasta e clique em "Analisar".
          </p>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Sidebar */}
          <div className="w-80 flex-shrink-0 space-y-2">
            {groupedKBs.map(({ repoName, folders }) => (
              <div key={repoName} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                {/* Repo Header */}
                <button
                  onClick={() => toggleRepo(repoName)}
                  className="w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <Database className="w-4 h-4 text-[#00DED2] flex-shrink-0" />
                  <span className="truncate text-sm font-medium text-gray-900 flex-1">
                    {repoName.split('/')[1]}
                  </span>
                  <span className="text-xs text-gray-400 mr-1">
                    {folders.length} {folders.length === 1 ? 'pasta' : 'pastas'}
                  </span>
                  {expandedRepos.has(repoName) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                
                {/* Folders List */}
                <AnimatePresence>
                  {expandedRepos.has(repoName) && folders.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100"
                    >
                      {folders.map((kbName) => (
                        <button
                          key={kbName}
                          onClick={() => loadKnowledgeBase(kbName)}
                          className={`w-full text-left p-3 pl-10 flex items-center gap-3 transition-colors ${
                            currentKB?.repository_name === kbName
                              ? 'bg-[#00DED2]/10 text-[#00a89d]'
                              : 'hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          <Folder className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate text-sm">
                            {getFolderName(kbName)}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card text-center py-12"
                >
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#00DED2]" />
                </motion.div>
              ) : currentKB ? (
                <motion.div
                  key={`${currentKB.repository_name}-${viewType}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Header com nome da pasta */}
                  <div className="card bg-gradient-to-r from-[#00DED2]/5 to-purple-500/5 border-[#00DED2]/20">
                    <div className="flex items-center gap-3">
                      <Folder className="w-6 h-6 text-[#00DED2]" />
                      <div>
                        <h2 className="font-semibold text-gray-900">
                          {getFolderName(currentKB.repository_name)}
                        </h2>
                        <p className="text-sm text-gray-500 font-mono">
                          {currentKB.repository_name}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {viewType === 'technical' ? (
                    <TechnicalView kb={currentKB} />
                  ) : (
                    <BusinessView kb={currentKB} />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="card text-center py-12"
                >
                  <Folder className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">
                    Clique em um repositório e selecione uma pasta para ver os detalhes
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

function TechnicalView({ kb }: { kb: any }) {
  const tech = kb.technical;
  
  if (!tech) {
    return (
      <div className="card text-center py-8">
        <Terminal className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        <p className="text-gray-500">Documentação técnica não disponível</p>
        <p className="text-sm text-gray-400 mt-1">Analise o repositório novamente para gerar</p>
      </div>
    );
  }
  
  return (
    <>
      {/* Resumo Técnico */}
      {tech.technical_summary && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00DED2]" />
            Resumo Técnico
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{tech.technical_summary}</p>
        </div>
      )}
      
      {/* Arquitetura */}
      {tech.architecture_diagram && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-500" />
            Arquitetura
          </h3>
          <pre className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg overflow-x-auto">{tech.architecture_diagram}</pre>
        </div>
      )}
      
      {/* NOVO: Handlers Detalhados */}
      {tech.handlers_detail?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            Handlers/Funções Detalhados ({tech.handlers_detail.length})
          </h3>
          <div className="space-y-4">
            {tech.handlers_detail.map((handler: any, i: number) => (
              <div key={i} className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <code className="font-medium text-indigo-900 text-base">{handler.name}</code>
                  {handler.file && (
                    <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">{handler.file}</span>
                  )}
                </div>
                
                {handler.purpose && (
                  <p className="text-sm text-gray-700 mb-3">{handler.purpose}</p>
                )}
                
                {/* Parâmetros de Entrada */}
                {handler.input_parameters?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Parâmetros Necessários:</p>
                    <div className="space-y-1">
                      {handler.input_parameters.map((param: any, j: number) => (
                        <div key={j} className="flex items-start gap-2 text-sm">
                          <code className="text-indigo-700 font-medium">{param.name || param}</code>
                          {param.type && <span className="text-gray-500">({param.type})</span>}
                          {param.required && <span className="text-red-500 text-xs">*obrigatório</span>}
                          {param.description && <span className="text-gray-600">- {param.description}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Passos do Processo */}
                {handler.process_steps?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Fluxo de Execução:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      {handler.process_steps.map((step: string, j: number) => (
                        <li key={j} className="text-sm text-gray-700">{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                
                {/* Chamadas Externas */}
                {handler.external_calls?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Chamadas Externas:</p>
                    <div className="space-y-1">
                      {handler.external_calls.map((call: any, j: number) => (
                        <div key={j} className="flex items-center gap-2 text-sm">
                          <Globe className="w-3 h-3 text-purple-500" />
                          <span className="font-medium text-purple-700">{call.service || call}</span>
                          {call.endpoint && <code className="text-xs bg-purple-100 px-1 rounded">{call.endpoint}</code>}
                          {call.purpose && <span className="text-gray-600">→ {call.purpose}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Validações */}
                {handler.validations?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Validações:</p>
                    <ul className="space-y-1">
                      {handler.validations.map((v: string, j: number) => (
                        <li key={j} className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Output */}
                {handler.output && (
                  <div className="mt-2 pt-2 border-t border-indigo-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Retorno:</p>
                    <p className="text-sm text-gray-700">{handler.output}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* NOVO: Fontes de Dados */}
      {tech.data_sources?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-500" />
            Fontes de Dados ({tech.data_sources.length})
          </h3>
          <div className="space-y-3">
            {tech.data_sources.map((source: any, i: number) => (
              <div key={i} className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-emerald-900">{source.name}</span>
                  <span className="badge badge-teal">{source.type}</span>
                </div>
                
                {source.connection && (
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Conexão:</span> {source.connection}
                  </p>
                )}
                
                {source.data_provided?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Dados Fornecidos:</p>
                    <div className="flex flex-wrap gap-1">
                      {source.data_provided.map((d: string, j: number) => (
                        <span key={j} className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">{d}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {source.used_by?.length > 0 && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Usado por:</span> {source.used_by.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* NOVO: Fluxos de Validação */}
      {tech.validation_flows?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-amber-500" />
            Fluxos de Validação ({tech.validation_flows.length})
          </h3>
          <div className="space-y-3">
            {tech.validation_flows.map((flow: any, i: number) => (
              <div key={i} className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <span className="font-medium text-amber-900">{flow.name}</span>
                <p className="text-sm text-gray-600 mt-1">{flow.description}</p>
                
                {flow.data_source && (
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="font-medium">Fonte:</span> {flow.data_source}
                  </p>
                )}
                
                <div className="flex items-center gap-4 mt-2 text-xs">
                  {flow.on_success && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-3 h-3" /> Sucesso: {flow.on_success}
                    </span>
                  )}
                  {flow.on_failure && (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="w-3 h-3" /> Falha: {flow.on_failure}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* APIs Expostas */}
      {tech.api_endpoints?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            APIs Expostas ({tech.api_endpoints.length})
          </h3>
          <div className="space-y-2">
            {tech.api_endpoints.map((ep: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${
                    ep.method === 'GET' ? 'badge-teal' :
                    ep.method === 'POST' ? 'badge-blue' :
                    ep.method === 'PUT' ? 'badge-orange' :
                    'badge-gray'
                  }`}>{ep.method}</span>
                  <code className="text-sm font-mono text-gray-700">{ep.path}</code>
                </div>
                <p className="text-sm text-gray-600">{ep.description}</p>
                {ep.parameters?.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Parâmetros: {ep.parameters.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* APIs Externas Consumidas */}
      {tech.external_apis_consumed?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-500" />
            APIs Externas Consumidas ({tech.external_apis_consumed.length})
          </h3>
          <div className="space-y-2">
            {tech.external_apis_consumed.map((api: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{api.name || api}</span>
                  {api.authentication && (
                    <span className="badge badge-gray">{api.authentication}</span>
                  )}
                </div>
                {api.base_url && (
                  <code className="text-xs text-purple-600 block mb-1">{api.base_url}</code>
                )}
                {api.purpose && (
                  <p className="text-sm text-gray-600">{api.purpose}</p>
                )}
                {api.data_exchanged?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Dados trocados:</p>
                    <div className="flex flex-wrap gap-1">
                      {api.data_exchanged.map((d: string, j: number) => (
                        <span key={j} className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">{d}</span>
                      ))}
                    </div>
                  </div>
                )}
                {api.endpoints_used?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Endpoints usados:</p>
                    <div className="flex flex-wrap gap-1">
                      {api.endpoints_used.map((ep: string, j: number) => (
                        <code key={j} className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">{ep}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Regras de Negócio */}
      {tech.business_rules?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            Regras de Negócio ({tech.business_rules.length})
          </h3>
          <div className="space-y-3">
            {tech.business_rules.map((rule: any, i: number) => (
              <div key={i} className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                <span className="font-medium text-orange-900">{rule.name}</span>
                <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                
                {rule.trigger && (
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="font-medium">Gatilho:</span> {rule.trigger}
                  </p>
                )}
                
                {rule.conditions?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-500">Condições:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {rule.conditions.map((c: string, j: number) => (
                        <li key={j}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {rule.actions?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-500">Ações:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {rule.actions.map((a: string, j: number) => (
                        <li key={j}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {rule.handler && (
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="font-medium">Implementada em:</span> <code>{rule.handler}</code>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Tecnologias */}
      {tech.technologies?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Code className="w-5 h-5 text-[#00DED2]" />
            Tecnologias
          </h3>
          <div className="flex flex-wrap gap-2">
            {tech.technologies.map((t: string, i: number) => (
              <span key={i} className="badge badge-teal">{t}</span>
            ))}
          </div>
        </div>
      )}
      
      {/* Variáveis de Ambiente */}
      {tech.environment_variables?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-500" />
            Variáveis de Ambiente ({tech.environment_variables.length})
          </h3>
          <div className="grid gap-2">
            {tech.environment_variables.map((v: string, i: number) => {
              const parts = v.split(':');
              const name = parts[0].trim();
              const description = parts.slice(1).join(':').trim();
              
              return (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <code className="text-sm font-mono font-medium text-amber-800 flex-shrink-0">
                    {name}
                  </code>
                  {description && (
                    <span className="text-sm text-gray-600">{description}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Documentação Técnica */}
      {tech.technical_documentation && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            Documentação Técnica Completa
          </h3>
          <div className="markdown-content">
            <ReactMarkdown>{tech.technical_documentation}</ReactMarkdown>
          </div>
        </div>
      )}
    </>
  );
}

function BusinessView({ kb }: { kb: any }) {
  const biz = kb.business;
  
  if (!biz) {
    return (
      <div className="card text-center py-8">
        <Users className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        <p className="text-gray-500">Documentação de negócio não disponível</p>
        <p className="text-sm text-gray-400 mt-1">Analise o repositório novamente para gerar</p>
      </div>
    );
  }
  
  return (
    <>
      {/* Produto */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-1">{biz.product_name}</h3>
        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{biz.product_description}</p>
      </div>
      
      {/* NOVO: Capacidades Detalhadas */}
      {biz.capabilities?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" />
            Capacidades do Sistema ({biz.capabilities.length})
          </h3>
          <div className="space-y-4">
            {biz.capabilities.map((cap: any, i: number) => (
              <div key={i} className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <Play className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-indigo-900">{cap.name}</span>
                </div>
                
                <p className="text-sm text-gray-700 mb-3">{cap.description}</p>
                
                {cap.when_to_use && (
                  <div className="mb-2 p-2 bg-blue-100 rounded">
                    <p className="text-xs font-semibold text-blue-800 uppercase mb-1">Quando Usar:</p>
                    <p className="text-sm text-blue-700">{cap.when_to_use}</p>
                  </div>
                )}
                
                {cap.required_info?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Informações Necessárias:</p>
                    <div className="flex flex-wrap gap-1">
                      {cap.required_info.map((info: string, j: number) => (
                        <span key={j} className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">{info}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {cap.process && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">O que acontece:</p>
                    <p className="text-sm text-gray-600">{cap.process}</p>
                  </div>
                )}
                
                {cap.possible_outcomes?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Resultados Possíveis:</p>
                    <ul className="space-y-1">
                      {cap.possible_outcomes.map((outcome: string, j: number) => (
                        <li key={j} className="flex items-center gap-2 text-sm">
                          {outcome.toLowerCase().includes('erro') || outcome.toLowerCase().includes('falha') ? (
                            <XCircle className="w-3 h-3 text-red-500" />
                          ) : (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          )}
                          <span className="text-gray-600">{outcome}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {cap.dependencies?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-indigo-200">
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Depende de:</span> {cap.dependencies.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* NOVO: Fluxos Detalhados */}
      {biz.detailed_flows?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-emerald-500" />
            Fluxos Detalhados ({biz.detailed_flows.length})
          </h3>
          <div className="space-y-4">
            {biz.detailed_flows.map((flow: any, i: number) => (
              <div key={i} className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="font-semibold text-emerald-900 text-lg">{flow.name}</span>
                
                {flow.trigger && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Início:</span> {flow.trigger}
                  </p>
                )}
                
                {flow.prerequisites?.length > 0 && (
                  <div className="mt-2 p-2 bg-amber-100 rounded">
                    <p className="text-xs font-semibold text-amber-800 uppercase mb-1">Pré-requisitos:</p>
                    <ul className="list-disc list-inside text-sm text-amber-700">
                      {flow.prerequisites.map((p: string, j: number) => (
                        <li key={j}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {flow.steps?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Passo a Passo:</p>
                    <ol className="space-y-2">
                      {flow.steps.map((step: string, j: number) => (
                        <li key={j} className="flex items-start gap-3 text-sm">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                            {j + 1}
                          </span>
                          <span className="text-gray-700 pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                
                {flow.possible_errors?.length > 0 && (
                  <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                    <p className="text-xs font-semibold text-red-800 uppercase mb-1">Possíveis Erros:</p>
                    <ul className="space-y-1">
                      {flow.possible_errors.map((err: string, j: number) => (
                        <li key={j} className="flex items-center gap-2 text-sm text-red-700">
                          <XCircle className="w-3 h-3" />
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {flow.external_systems?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-emerald-200">
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Sistemas envolvidos:</span> {flow.external_systems.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Funcionalidades */}
      {biz.main_features?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#00DED2]" />
            Principais Funcionalidades
          </h3>
          <ul className="space-y-2">
            {biz.main_features.map((f: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00DED2] mt-2 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* NOVO: Integrações Resumidas */}
      {biz.integrations_summary?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Link className="w-5 h-5 text-purple-500" />
            Integrações
          </h3>
          <div className="space-y-2">
            {biz.integrations_summary.map((int: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                {typeof int === 'string' ? (
                  <p className="text-sm text-gray-700">{int}</p>
                ) : (
                  <>
                    <span className="font-medium text-purple-900">{int.system}</span>
                    <p className="text-sm text-gray-600 mt-1">{int.purpose}</p>
                    {int.data_involved?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {int.data_involved.map((d: string, j: number) => (
                          <span key={j} className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">{d}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Casos de Uso */}
      {biz.use_cases?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Casos de Uso
          </h3>
          <ul className="space-y-2">
            {biz.use_cases.map((u: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                {u}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* FAQ */}
      {biz.faq?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-orange-500" />
            Perguntas Frequentes ({biz.faq.length})
          </h3>
          <div className="space-y-3">
            {biz.faq.map((item: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="font-medium text-gray-900 text-sm flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  {item.question}
                </p>
                <p className="text-sm text-gray-600 mt-2 pl-6">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Glossário */}
      {biz.glossary?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#00DED2]" />
            Glossário
          </h3>
          <div className="grid gap-2">
            {biz.glossary.map((item: any, i: number) => (
              <div key={i} className="flex gap-2 text-sm p-2 rounded-lg bg-gray-50">
                <span className="font-medium text-gray-900 min-w-[120px]">{item.term}:</span>
                <span className="text-gray-600">{item.definition}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Documentação */}
      {biz.user_documentation && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            Documentação do Usuário
          </h3>
          <div className="markdown-content">
            <ReactMarkdown>{biz.user_documentation}</ReactMarkdown>
          </div>
        </div>
      )}
    </>
  );
}
