import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cloud, 
  LogIn, 
  LogOut, 
  Loader2, 
  ChevronRight,
  ChevronDown,
  Building2,
  FolderKanban,
  X,
  Check,
  RefreshCw,
  AlertCircle,
  Search,
  ChevronDownCircle
} from 'lucide-react';
import { weniApi, WeniOrganization, WeniProject } from '../services/api';

interface WeniProjectSelectorProps {
  onSelect: (uuid: string, name: string) => void;
  selectedUuid?: string;
}

// Organização com projetos carregados sob demanda
interface OrgWithProjects {
  org_name: string;
  org_uuid: string;
  projects: WeniProject[];
  projectsLoaded: boolean;
  loadingProjects: boolean;
  error?: string | null;
}

const ORGS_PER_PAGE = 10;

export function WeniProjectSelector({ onSelect, selectedUuid }: WeniProjectSelectorProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [organizations, setOrganizations] = useState<OrgWithProjects[]>([]);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  
  // Busca e paginação
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleOrgsCount, setVisibleOrgsCount] = useState(ORGS_PER_PAGE);

  // Verifica status de conexão
  const checkStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await weniApi.getStatus();
      setIsConnected(status.connected);
    } catch (err) {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listener para mensagens do popup de login
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'weni-auth-callback-success') {
        console.log('Login callback received');
      } else if (event.data?.type === 'weni-auth-callback-error') {
        setError(event.data.error || 'Erro no login');
        setLoggingIn(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Filtra organizações baseado na busca
  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) {
      return organizations;
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    return organizations.filter(org => {
        // Verifica se o nome da org contém a busca
        const orgMatches = org.org_name.toLowerCase().includes(query);
        
      // Se projetos foram carregados, verifica se algum projeto combina
      if (org.projectsLoaded) {
        const projectMatches = org.projects.some(
          p => p.name.toLowerCase().includes(query) || 
               p.uuid.toLowerCase().includes(query)
        );
        return orgMatches || projectMatches;
        }
        
      return orgMatches;
    });
  }, [organizations, searchQuery]);

  // Organizações visíveis (paginadas)
  const visibleOrgs = useMemo(() => {
    return filteredOrgs.slice(0, visibleOrgsCount);
  }, [filteredOrgs, visibleOrgsCount]);

  // Conta total de projetos carregados
  const totalProjectsCount = useMemo(() => {
    return organizations.reduce((acc, org) => acc + (org.projectsLoaded ? org.projects.length : 0), 0);
  }, [organizations]);

  // Reset visível quando busca muda
  useEffect(() => {
    setVisibleOrgsCount(ORGS_PER_PAGE);
  }, [searchQuery]);

  // Inicia login OAuth com servidor de callback
  const handleLogin = async () => {
    try {
      setError(null);
      setLoggingIn(true);
      
      const { login_url } = await weniApi.startAuth();
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        login_url,
        'weni-login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );
      
      const result = await weniApi.waitAuth();
      
      if (result.success) {
        await checkStatus();
        setShowModal(true);
        loadOrganizations();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Erro no login');
    } finally {
      setLoggingIn(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await weniApi.logout();
      setIsConnected(false);
      setOrganizations([]);
      setSearchQuery('');
      setVisibleOrgsCount(ORGS_PER_PAGE);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Carrega apenas as organizações (sem projetos)
  const loadOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      setError(null);
      const data = await weniApi.listOrganizations();
      
      // Transforma organizações em OrgWithProjects (sem projetos carregados)
      const orgsWithProjects: OrgWithProjects[] = (data.results || []).map((org: WeniOrganization) => ({
        org_name: org.name,
        org_uuid: org.uuid,
        projects: [],
        projectsLoaded: false,
        loadingProjects: false,
        error: null
      }));
      
      setOrganizations(orgsWithProjects);
      setVisibleOrgsCount(ORGS_PER_PAGE);
      setExpandedOrgs(new Set());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingOrgs(false);
    }
  };

  // Carrega projetos de uma organização específica
  const loadProjectsForOrg = async (orgUuid: string) => {
    // Marca como carregando
    setOrganizations(prev => prev.map(org => 
      org.org_uuid === orgUuid 
        ? { ...org, loadingProjects: true, error: null }
        : org
    ));

    try {
      const data = await weniApi.listProjects(orgUuid);
      const projects: WeniProject[] = (data.results || []).map((p: any) => ({
        name: p.name,
        uuid: p.uuid
      }));

      // Atualiza org com projetos carregados
      setOrganizations(prev => prev.map(org => 
        org.org_uuid === orgUuid 
          ? { ...org, projects, projectsLoaded: true, loadingProjects: false }
          : org
      ));
    } catch (err: any) {
      // Marca erro
      setOrganizations(prev => prev.map(org => 
        org.org_uuid === orgUuid 
          ? { ...org, loadingProjects: false, error: err.message }
          : org
      ));
    }
  };

  // Abre modal e carrega organizações
  const handleOpenModal = () => {
    setShowModal(true);
    setSearchQuery('');
    if (isConnected && organizations.length === 0) {
      loadOrganizations();
    }
  };

  // Toggle expansão de org - carrega projetos se necessário
  const toggleOrg = async (orgUuid: string) => {
    const org = organizations.find(o => o.org_uuid === orgUuid);
    
    if (expandedOrgs.has(orgUuid)) {
      // Fecha org
    setExpandedOrgs(prev => {
      const next = new Set(prev);
        next.delete(orgUuid);
        return next;
      });
      } else {
      // Abre org
      setExpandedOrgs(prev => {
        const next = new Set(prev);
        next.add(orgUuid);
      return next;
    });
      
      // Carrega projetos se ainda não foram carregados
      if (org && !org.projectsLoaded && !org.loadingProjects) {
        loadProjectsForOrg(orgUuid);
      }
    }
  };

  // Seleciona projeto
  const handleSelectProject = (project: WeniProject) => {
    onSelect(project.uuid, project.name);
    setShowModal(false);
  };

  // Carregar mais organizações
  const handleLoadMore = () => {
    setVisibleOrgsCount(prev => prev + ORGS_PER_PAGE);
  };

  const hasMoreOrgs = visibleOrgsCount < filteredOrgs.length;

  return (
    <>
      {/* Botão para abrir seletor */}
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={loading}
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
          isConnected 
            ? 'bg-[#00DED2]/10 border-[#00DED2]/30 text-[#00DED2] hover:bg-[#00DED2]/20' 
            : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Cloud className="w-4 h-4" />
        )}
        {isConnected ? 'Buscar na Weni Cloud' : 'Conectar com Weni'}
      </button>

      {/* Modal de seleção */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-xl flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#00DED2]/10">
                    <Cloud className="w-5 h-5 text-[#00DED2]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Weni Cloud</h2>
                    <p className="text-xs text-gray-500">
                      {isConnected ? 'Selecione um projeto' : 'Faça login para continuar'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Error */}
                {error && (
                  <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm flex-shrink-0">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Not connected - Login */}
                {!isConnected && (
                  <div className="text-center py-8 px-4">
                    <Cloud className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Conecte-se à Weni Cloud
                    </h3>
                    <p className="text-gray-500 mb-6 text-sm">
                      Faça login para ver seus projetos e selecionar o UUID automaticamente
                    </p>
                    <button
                      onClick={handleLogin}
                      disabled={loggingIn}
                      className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      {loggingIn ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Aguardando login...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          Fazer Login
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Connected - Organization list */}
                {isConnected && (
                  <>
                    {/* Search & Actions Bar */}
                    <div className="p-4 space-y-3 flex-shrink-0 border-b border-gray-100">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar organização ou projeto..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00DED2]/50 focus:border-[#00DED2]"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={loadOrganizations}
                            disabled={loadingOrgs}
                            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                          >
                            <RefreshCw className={`w-4 h-4 ${loadingOrgs ? 'animate-spin' : ''}`} />
                            Atualizar
                          </button>
                          {!loadingOrgs && organizations.length > 0 && (
                            <span className="text-xs text-gray-400">
                              {filteredOrgs.length} org{filteredOrgs.length !== 1 ? 's' : ''}
                              {totalProjectsCount > 0 && ` · ${totalProjectsCount} projeto${totalProjectsCount !== 1 ? 's' : ''} carregados`}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={handleLogout}
                          className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                        >
                          <LogOut className="w-4 h-4" />
                          Sair
                        </button>
                      </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto p-4">
                      {/* Loading */}
                      {loadingOrgs && (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin text-[#00DED2]" />
                          <span className="ml-3 text-gray-500">Carregando organizações...</span>
                        </div>
                      )}

                      {/* Empty state */}
                      {!loadingOrgs && organizations.length === 0 && (
                        <div className="text-center py-8">
                          <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                          <p className="text-gray-500">Nenhuma organização encontrada</p>
                          <button
                            onClick={loadOrganizations}
                            className="mt-4 text-sm text-[#00DED2] hover:underline"
                          >
                            Carregar organizações
                          </button>
                        </div>
                      )}

                      {/* No search results */}
                      {!loadingOrgs && organizations.length > 0 && filteredOrgs.length === 0 && (
                        <div className="text-center py-8">
                          <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                          <p className="text-gray-500">Nenhum resultado para "{searchQuery}"</p>
                          <button
                            onClick={() => setSearchQuery('')}
                            className="mt-2 text-sm text-[#00DED2] hover:underline"
                          >
                            Limpar busca
                          </button>
                        </div>
                      )}

                      {/* Organizations */}
                      {!loadingOrgs && visibleOrgs.length > 0 && (
                        <div className="space-y-2">
                          {visibleOrgs.map((org) => (
                            <div 
                              key={org.org_uuid} 
                              className={`border rounded-xl overflow-hidden ${
                                org.error 
                                  ? 'border-orange-200 bg-orange-50/50' 
                                  : 'border-gray-200'
                              }`}
                            >
                              {/* Org header */}
                              <button
                                onClick={() => toggleOrg(org.org_uuid)}
                                className={`w-full flex items-center gap-3 p-3 transition-colors text-left ${
                                  org.error 
                                    ? 'bg-orange-50 hover:bg-orange-100' 
                                    : 'bg-gray-50 hover:bg-gray-100'
                                }`}
                              >
                                {org.loadingProjects ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-[#00DED2]" />
                                ) : org.error ? (
                                  <AlertCircle className="w-4 h-4 text-orange-500" />
                                ) : expandedOrgs.has(org.org_uuid) ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                                <Building2 className={`w-4 h-4 ${org.error ? 'text-orange-400' : 'text-[#00DED2]'}`} />
                                <span className={`font-medium flex-1 truncate ${org.error ? 'text-orange-700' : 'text-gray-900'}`}>
                                  {org.org_name}
                                </span>
                                {org.error ? (
                                  <span className="text-xs text-orange-500 flex-shrink-0">
                                    Clique para tentar novamente
                                  </span>
                                ) : org.projectsLoaded ? (
                                  <span className="text-xs text-gray-400 flex-shrink-0">
                                    {org.projects.length} projeto{org.projects.length !== 1 ? 's' : ''}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400 flex-shrink-0">
                                    Clique para ver projetos
                                  </span>
                                )}
                              </button>

                              {/* Projects */}
                              <AnimatePresence>
                                {expandedOrgs.has(org.org_uuid) && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <div className="border-t border-gray-200 max-h-[200px] overflow-y-auto">
                                      {/* Loading projects */}
                                      {org.loadingProjects && (
                                        <div className="p-4 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Carregando projetos...
                                        </div>
                                      )}
                                      
                                      {/* Error loading projects */}
                                      {org.error && !org.loadingProjects && (
                                        <div className="p-4 text-center">
                                          <p className="text-orange-500 text-sm mb-2">{org.error}</p>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              loadProjectsForOrg(org.org_uuid);
                                            }}
                                            className="text-xs text-[#00DED2] hover:underline"
                                          >
                                            Tentar novamente
                                          </button>
                                        </div>
                                      )}
                                      
                                      {/* No projects */}
                                      {org.projectsLoaded && !org.loadingProjects && !org.error && org.projects.length === 0 && (
                                        <div className="p-4 text-center text-gray-400 text-sm">
                                          Nenhum projeto nesta organização
                                        </div>
                                      )}
                                      
                                      {/* Project list */}
                                      {org.projectsLoaded && !org.loadingProjects && !org.error && org.projects.length > 0 && (
                                        org.projects.map((project) => (
                                          <button
                                            key={project.uuid}
                                            onClick={() => handleSelectProject(project)}
                                            className={`w-full flex items-center gap-3 p-3 pl-11 hover:bg-[#00DED2]/5 transition-colors text-left ${
                                              selectedUuid === project.uuid ? 'bg-[#00DED2]/10' : ''
                                            }`}
                                          >
                                            <FolderKanban className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-gray-900 truncate">{project.name}</p>
                                              <p className="text-xs text-gray-400 font-mono truncate">{project.uuid}</p>
                                            </div>
                                            {selectedUuid === project.uuid && (
                                              <Check className="w-4 h-4 text-[#00DED2] flex-shrink-0" />
                                            )}
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}

                          {/* Load More Button */}
                          {hasMoreOrgs && (
                            <button
                              onClick={handleLoadMore}
                              className="w-full py-3 flex items-center justify-center gap-2 text-sm text-[#00DED2] hover:bg-[#00DED2]/5 rounded-xl border border-dashed border-[#00DED2]/30 transition-colors"
                            >
                              <ChevronDownCircle className="w-4 h-4" />
                              Carregar mais ({filteredOrgs.length - visibleOrgsCount} restantes)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {isConnected && !loadingOrgs && organizations.length > 0 && (
                <div className="p-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <p className="text-xs text-gray-500 text-center">
                    💡 Clique em uma organização para ver seus projetos
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
