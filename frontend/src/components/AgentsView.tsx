import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Wrench, 
  Loader2,
  FileCode,
  X,
  Check,
  Copy,
  ChevronRight,
  Sparkles,
  Package,
  Bot,
  Link,
  Download,
  Eye,
  Edit3
} from 'lucide-react';
import { projectsApi, toolsApi, Project, AgentPreview, OfficialTool, GeneratedTool } from '../services/api';
import { WeniProjectSelector } from './WeniProjectSelector';

type ViewTab = 'my-agents' | 'library';

export function AgentsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [officialTools, setOfficialTools] = useState<OfficialTool[]>([]);
  const [categories, setCategories] = useState<Record<string, { name: string; count: number }>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('my-agents');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Expanded agent state
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  
  // Create agent state
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [uuid, setUuid] = useState('');
  const [preview, setPreview] = useState<AgentPreview | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [creationProgress, setCreationProgress] = useState<string>('');
  
  // Skills/Tools selection for unified creation
  interface SkillConfig {
    name: string;
    description: string;
    selected: boolean;
    generateTool: boolean;
    docUrl?: string;
    docText?: string;
  }
  const [skillsConfig, setSkillsConfig] = useState<SkillConfig[]>([]);
  
  // YAML editor state
  const [showYamlEditor, setShowYamlEditor] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [yamlContent, setYamlContent] = useState('');
  const [savingYaml, setSavingYaml] = useState(false);
  const [improvingYaml, setImprovingYaml] = useState(false);
  const [improveInstructions, setImproveInstructions] = useState('');
  
  // Tool generation state
  const [showGenerateTool, setShowGenerateTool] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [docUrl, setDocUrl] = useState('');
  const [docText, setDocText] = useState('');
  const [toolName, setToolName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedTool, setGeneratedTool] = useState<GeneratedTool | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Official tool detail
  const [selectedOfficialTool, setSelectedOfficialTool] = useState<OfficialTool | null>(null);
  const [generatingOfficial, setGeneratingOfficial] = useState(false);
  const [officialToolCode, setOfficialToolCode] = useState<GeneratedTool | null>(null);
  const [targetProjectForOfficial, setTargetProjectForOfficial] = useState<string>('');
  
  // Tool code viewer state
  const [showToolViewer, setShowToolViewer] = useState(false);
  const [viewingTool, setViewingTool] = useState<{slug: string; name: string; projectUuid: string; projectName: string} | null>(null);
  
  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toolCode, setToolCode] = useState<string>('');
  const [loadingToolCode, setLoadingToolCode] = useState(false);
  const [editingToolCode, setEditingToolCode] = useState(false);
  const [savingToolCode, setSavingToolCode] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projectsData, toolsData, categoriesData] = await Promise.all([
        projectsApi.listProjects(),
        toolsApi.listOfficialTools(),
        toolsApi.listCategories()
      ]);
      setProjects(projectsData);
      setOfficialTools(toolsData);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create agent handlers
  const handlePreview = async () => {
    if (!name || !goal) return;
    setPreviewing(true);
    try {
      const result = await projectsApi.previewAgent({ name, goal, uuid });
      setPreview(result);
      
      // Initialize skills config from preview
      if (result.suggested_config.skills) {
        setSkillsConfig(result.suggested_config.skills.map(skill => ({
          name: skill.name,
          description: skill.description,
          selected: true,
          generateTool: true, // Default: generate tools for all skills
          docUrl: '',
          docText: ''
        })));
      }
    } catch (err: any) {
      alert('Erro ao gerar preview: ' + err.message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleCreate = async () => {
    if (!preview) return;
    setCreating(true);
    setCreationProgress('Criando agente...');
    
    try {
      // 1. Create the agent WITHOUT any skills (tools will be added separately)
      const createdProject = await projectsApi.createProject({
        name: preview.suggested_config.name,
        goal,
        instructions: preview.suggested_config.instructions,
        skills: [], // NEVER send skills - we'll create tools via AI
        uuid: uuid || undefined
      });
      
      // 2. Identify which tools to generate with AI
      const toolsToGenerate = skillsConfig.filter(s => s.generateTool);
      
      // 3. Generate tools with AI for selected skills
      
      if (toolsToGenerate.length > 0 && createdProject.uuid) {
        for (let i = 0; i < toolsToGenerate.length; i++) {
          const skill = toolsToGenerate[i];
          setCreationProgress(`Gerando ferramenta ${i + 1}/${toolsToGenerate.length}: ${skill.name}...`);
          
          try {
            // Build documentation text for the tool
            const docContent = skill.docText || `
# ${skill.name}

## Descrição
${skill.description}

## Objetivo do Agente
${goal}

## Funcionalidade Esperada
Esta ferramenta deve implementar a funcionalidade "${skill.name}" para o agente.
            `.trim();
            
            // Generate the tool using the tools API
            const generated = await toolsApi.generateTool({
              tool_name: skill.name,
              tool_description: skill.description,
              url: skill.docUrl || undefined,
              documentation: docContent
            });
            
            // Save the tool to the project
            if (generated) {
              setCreationProgress(`Salvando ferramenta ${i + 1}/${toolsToGenerate.length}: ${skill.name}...`);
              await projectsApi.addProjectTool(createdProject.uuid, {
                tool_slug: generated.tool_slug,
                tool_name: generated.tool_name,
                description: generated.description,
                main_py: generated.main_py,
                requirements_txt: generated.requirements_txt,
                parameters: generated.parameters
              });
            }
          } catch (toolErr: any) {
            console.error(`Erro ao gerar tool ${skill.name}:`, toolErr);
            // Continue with other tools even if one fails
          }
        }
      }
      
      setCreationProgress('Finalizando...');
      await fetchData();
      resetCreateForm();
    } catch (err: any) {
      const errorMessage = err?.message || err?.detail || (typeof err === 'string' ? err : JSON.stringify(err));
      alert('Erro ao criar agente: ' + errorMessage);
    } finally {
      setCreating(false);
      setCreationProgress('');
    }
  };

  const openDeleteConfirm = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingProject(project);
    setShowDeleteConfirm(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    setIsDeleting(true);
    try {
      await projectsApi.deleteProject(deletingProject.uuid);
      await fetchData();
      if (expandedAgentId === deletingProject.uuid) {
        setExpandedAgentId(null);
      }
      setShowDeleteConfirm(false);
      setDeletingProject(null);
    } catch (err: any) {
      alert('Erro ao deletar: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };
  
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingProject(null);
  };

  const handleOpenYaml = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { content } = await projectsApi.getProjectYaml(project.uuid);
      setYamlContent(content);
      setSelectedProject(project);
      setShowYamlEditor(true);
    } catch (err: any) {
      alert('Erro ao carregar YAML: ' + err.message);
    }
  };

  const handleSaveYaml = async () => {
    if (!selectedProject) return;
    setSavingYaml(true);
    try {
      await projectsApi.updateProjectYaml(selectedProject.uuid, yamlContent);
      await fetchData();
      setShowYamlEditor(false);
    } catch (err: any) {
      alert('Erro ao salvar YAML: ' + err.message);
    } finally {
      setSavingYaml(false);
    }
  };

  const handleImproveYaml = async () => {
    if (!selectedProject) return;
    setImprovingYaml(true);
    try {
      const result = await projectsApi.improveProjectYaml(
        selectedProject.uuid, 
        selectedProject.description || '',
        improveInstructions
      );
      setYamlContent(result.improved_yaml);
      setImproveInstructions('');
      alert('YAML melhorado com IA! Revise e salve as alterações.');
    } catch (err: any) {
      alert('Erro ao melhorar YAML: ' + err.message);
    } finally {
      setImprovingYaml(false);
    }
  };

  const resetCreateForm = () => {
    setShowCreate(false);
    setName('');
    setGoal('');
    setUuid('');
    setPreview(null);
    setSkillsConfig([]);
    setCreationProgress('');
  };
  
  // Update skill configuration
  const updateSkillConfig = (index: number, updates: Partial<SkillConfig>) => {
    setSkillsConfig(prev => prev.map((skill, i) => 
      i === index ? { ...skill, ...updates } : skill
    ));
  };

  // Tool generation handlers
  const openGenerateToolForAgent = (agentId: string) => {
    setTargetAgentId(agentId);
    setShowGenerateTool(true);
  };

  const handleGenerateTool = async () => {
    if (!targetAgentId || (!docUrl && !docText)) return;
    setGenerating(true);
    try {
      const result = await toolsApi.generateTool({
        documentation: docText,
        url: docUrl || undefined,
        tool_name: toolName || undefined
      });
      setGeneratedTool(result);
    } catch (err: any) {
      alert('Erro ao gerar: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveTool = async () => {
    if (!generatedTool || !targetAgentId) return;
    setSaving(true);
    try {
      await projectsApi.addProjectTool(targetAgentId, {
        tool_slug: generatedTool.tool_slug,
        tool_name: generatedTool.tool_name,
        description: generatedTool.description,
        main_py: generatedTool.main_py,
        requirements_txt: generatedTool.requirements_txt,
        parameters: generatedTool.parameters
      });
      await fetchData();
      resetGenerateToolForm();
      alert('Ferramenta adicionada com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetGenerateToolForm = () => {
    setShowGenerateTool(false);
    setDocUrl('');
    setDocText('');
    setToolName('');
    setGeneratedTool(null);
    setTargetAgentId('');
  };

  // Official tool handlers
  const handleGenerateOfficial = async (tool: OfficialTool) => {
    setSelectedOfficialTool(tool);
    setGeneratingOfficial(true);
    try {
      const result = await toolsApi.generateOfficialToolCode(tool.slug);
      setOfficialToolCode(result);
    } catch (err: any) {
      alert('Erro ao gerar código: ' + err.message);
    } finally {
      setGeneratingOfficial(false);
    }
  };

  const handleAddOfficialToProject = async () => {
    if (!officialToolCode || !targetProjectForOfficial) return;
    setSaving(true);
    try {
      await projectsApi.addProjectTool(targetProjectForOfficial, {
        tool_slug: officialToolCode.tool_slug,
        tool_name: officialToolCode.tool_name,
        description: officialToolCode.description,
        main_py: officialToolCode.main_py,
        requirements_txt: officialToolCode.requirements_txt,
        parameters: officialToolCode.parameters
      });
      await fetchData();
      setSelectedOfficialTool(null);
      setOfficialToolCode(null);
      setTargetProjectForOfficial('');
      alert('Ferramenta adicionada com sucesso!');
    } catch (err: any) {
      alert('Erro ao adicionar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleAgent = (agentId: string) => {
    setExpandedAgentId(expandedAgentId === agentId ? null : agentId);
  };

  const getAgentTools = (project: Project) => {
    return (project.tools || []).map((t: any) => {
      const slug = typeof t === 'string' ? t : Object.keys(t)[0];
      const data = typeof t === 'string' ? {} : t[slug] || {};
      return {
        slug,
        name: data.name || slug,
        description: data.description || ''
      };
    });
  };

  // View/Edit tool code
  const handleViewToolCode = async (tool: {slug: string; name: string}, project: Project) => {
    setViewingTool({
      slug: tool.slug,
      name: tool.name,
      projectUuid: project.uuid,
      projectName: project.title
    });
    setShowToolViewer(true);
    setLoadingToolCode(true);
    setEditingToolCode(false);
    
    try {
      const code = await projectsApi.getToolSource(project.uuid, tool.slug);
      setToolCode(code.main_py || '# Código não disponível');
    } catch (err: any) {
      setToolCode('# Erro ao carregar código: ' + err.message);
    } finally {
      setLoadingToolCode(false);
    }
  };

  const handleSaveToolCode = async () => {
    if (!viewingTool) return;
    setSavingToolCode(true);
    try {
      await projectsApi.updateToolSource(viewingTool.projectUuid, viewingTool.slug, toolCode);
      await fetchData();
      setEditingToolCode(false);
      alert('Código salvo com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSavingToolCode(false);
    }
  };

  const filteredTools = selectedCategory 
    ? officialTools.filter(t => t.category === selectedCategory)
    : officialTools;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agentes</h1>
          <p className="text-gray-500">Gerencie seus agentes e suas ferramentas</p>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Agente
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('my-agents')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'my-agents' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Bot className="w-4 h-4 inline mr-2" />
          Meus Agentes ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'library' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Biblioteca Oficial
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#00DED2]" />
        </div>
      )}

      {/* My Agents Tab */}
      {!loading && activeTab === 'my-agents' && (
        <>
          {projects.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-200 p-12 text-center"
            >
              <Bot className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum agente</h3>
              <p className="text-gray-500 mb-6">Crie seu primeiro agente inteligente</p>
              <button 
                onClick={() => setShowCreate(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Agente
              </button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const tools = getAgentTools(project);
                const isExpanded = expandedAgentId === project.uuid;
                
                return (
                  <motion.div
                    key={project.uuid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                  >
                    {/* Agent Header */}
                    <button
                      onClick={() => toggleAgent(project.uuid)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className={`p-2 rounded-xl transition-colors ${isExpanded ? 'bg-[#00DED2]/10' : 'bg-gray-100'}`}>
                        <Bot className={`w-5 h-5 ${isExpanded ? 'text-[#00DED2]' : 'text-gray-500'}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{project.title}</h3>
                        <p className="text-sm text-gray-500 truncate">{project.description || 'Sem descrição'}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-sm bg-[#00DED2]/10 text-[#00DED2] px-2.5 py-1 rounded-lg">
                          <Wrench className="w-3.5 h-3.5" />
                          {tools.length} tool{tools.length !== 1 ? 's' : ''}
                        </span>
                        
                        <button 
                          onClick={(e) => handleOpenYaml(project, e)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 hover:text-gray-800 text-sm transition-colors"
                          title="Editar Agente"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button 
                          onClick={(e) => openDeleteConfirm(project, e)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                          title="Deletar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        
                        <motion.div
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </motion.div>
                      </div>
                    </button>
                    
                    {/* Expanded Content - Tools */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="border-t border-gray-200 bg-gray-50 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-medium text-gray-700">
                                Ferramentas deste agente
                              </h4>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openGenerateToolForAgent(project.uuid)}
                                  className="text-sm text-[#00DED2] hover:text-[#00c4b8] flex items-center gap-1"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Gerar com IA
                                </button>
                                <button
                                  onClick={() => {
                                    setTargetProjectForOfficial(project.uuid);
                                    setActiveTab('library');
                                  }}
                                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                                >
                                  <Package className="w-3.5 h-3.5" />
                                  Biblioteca
                                </button>
                              </div>
                            </div>
                            
                            {tools.length === 0 ? (
                              <div className="text-center py-8 bg-white rounded-lg border border-dashed border-gray-200">
                                <Wrench className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                <p className="text-sm text-gray-500">
                                  Nenhuma ferramenta ainda
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Adicione tools da biblioteca ou gere com IA
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {tools.map((tool, idx) => (
                                  <button
                                    key={`${project.uuid}-${tool.slug}-${idx}`}
                                    onClick={() => handleViewToolCode(tool, project)}
                                    className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#00DED2]/50 hover:shadow-sm transition-all text-left group"
                                  >
                                    <div className="p-1.5 rounded-lg bg-[#00DED2]/10">
                                      <Wrench className="w-4 h-4 text-[#00DED2]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm text-gray-900 truncate">
                                        {tool.name}
                                      </p>
                                      <p className="text-xs text-gray-400 font-mono truncate">
                                        {tool.slug}
                                      </p>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-[#00DED2]">
                                      <Eye className="w-3.5 h-3.5" />
                                      Ver código
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                            
                            {/* UUID info */}
                            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                              <button 
                                onClick={() => copyToClipboard(project.uuid)}
                                className="text-xs font-mono text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                title="Copiar UUID"
                              >
                                UUID: {project.uuid?.slice(0, 16)}...
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Library Tab */}
      {!loading && activeTab === 'library' && (
        <div className="grid md:grid-cols-4 gap-6">
          {/* Categories Sidebar */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Categorias</h3>
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedCategory ? 'bg-[#00DED2]/10 text-[#00DED2]' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Todas ({officialTools.length})
            </button>
            {Object.entries(categories).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === key ? 'bg-[#00DED2]/10 text-[#00DED2]' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
            
            {/* Target agent indicator */}
            {targetProjectForOfficial && (
              <div className="mt-4 p-3 bg-[#00DED2]/10 rounded-lg border border-[#00DED2]/20">
                <p className="text-xs font-medium text-[#00DED2] mb-1">Adicionando ao agente:</p>
                <p className="text-sm text-gray-700 truncate">
                  {projects.find(p => p.uuid === targetProjectForOfficial)?.title}
                </p>
                <button
                  onClick={() => setTargetProjectForOfficial('')}
                  className="text-xs text-gray-500 hover:text-gray-700 mt-1"
                >
                  Limpar seleção
                </button>
              </div>
            )}
          </div>

          {/* Tools Grid */}
          <div className="md:col-span-3">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTools.map((tool) => (
                <motion.div
                  key={tool.slug}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#00DED2]/50 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => handleGenerateOfficial(tool)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-[#00DED2]/10">
                      <Wrench className="w-5 h-5 text-[#00DED2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{tool.name}</h4>
                      <p className="text-xs text-gray-400 font-mono">{tool.slug}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-3 line-clamp-2">
                    {tool.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {tool.category}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => resetCreateForm()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Criar Novo Agente</h2>
                <button 
                  onClick={() => resetCreateForm()}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 grid md:grid-cols-2 gap-6 max-h-[85vh] overflow-y-auto">
                {/* Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Agente
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Assistente de Vendas"
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        UUID do Projeto (opcional)
                      </label>
                      <WeniProjectSelector
                        selectedUuid={uuid}
                        onSelect={(selectedUuid, selectedName) => {
                          setUuid(selectedUuid);
                          if (!name) {
                            setName(selectedName);
                          }
                        }}
                      />
                    </div>
                    <input
                      value={uuid}
                      onChange={(e) => setUuid(e.target.value)}
                      placeholder="Ex: 52510bd3-6e1a-4e5b-aed2..."
                      className="input font-mono text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Cole manualmente ou busque na Weni Cloud
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Objetivo do Agente
                    </label>
                    <textarea
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      placeholder="Descreva o que o agente deve fazer..."
                      className="input h-32 resize-none"
                    />
                  </div>
                  
                  <button
                    onClick={handlePreview}
                    disabled={previewing || !name || !goal}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {previewing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Gerar Preview com IA
                  </button>
                </div>
                
                {/* Preview */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 overflow-y-auto max-h-[75vh]">
                  {preview ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-gray-600">
                          Gerado via {preview.source === 'ai' ? 'IA' : 'fallback'}
                        </span>
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-400 uppercase tracking-wide">
                          Instruções
                        </label>
                        <div className="mt-1 bg-white p-3 rounded-lg border border-gray-200 max-h-80 overflow-y-auto">
                          {Array.isArray(preview.suggested_config.instructions) ? (
                            <ul className="space-y-2">
                              {preview.suggested_config.instructions.map((instruction: string, idx: number) => (
                                <li key={idx} className="flex gap-2 text-sm text-gray-700">
                                  <span className="text-[#00DED2] font-medium shrink-0">{idx + 1}.</span>
                                  <span>{instruction}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {preview.suggested_config.instructions}
                        </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Guardrails */}
                      {preview.suggested_config.guardrails && preview.suggested_config.guardrails.length > 0 && (
                        <div>
                          <label className="text-xs text-gray-400 uppercase tracking-wide">
                            Guardrails
                          </label>
                          <div className="mt-1 bg-white p-3 rounded-lg border border-gray-200">
                            <ul className="space-y-2">
                              {preview.suggested_config.guardrails.map((guardrail: string, idx: number) => (
                                <li key={idx} className="flex gap-2 text-sm text-gray-700">
                                  <span className="text-amber-500 shrink-0">⚠️</span>
                                  <span>{guardrail}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-gray-400 uppercase tracking-wide">
                            Ferramentas a Criar
                          </label>
                          <span className="text-xs text-[#00DED2]">
                            {skillsConfig.filter(s => s.generateTool).length} selecionadas
                          </span>
                        </div>
                        <div className="space-y-3">
                          {skillsConfig.map((skill, i) => (
                            <div key={i} className={`bg-white rounded-lg border transition-all ${
                              skill.generateTool ? 'border-[#00DED2]/50 shadow-sm' : 'border-gray-200'
                            }`}>
                              {/* Skill Header */}
                              <div className="p-3 flex items-start gap-3">
                                <label className="flex items-center gap-2 cursor-pointer flex-1">
                                  <input
                                    type="checkbox"
                                    checked={skill.generateTool}
                                    onChange={(e) => updateSkillConfig(i, { generateTool: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-[#00DED2] focus:ring-[#00DED2]"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <Wrench className={`w-4 h-4 ${skill.generateTool ? 'text-[#00DED2]' : 'text-gray-400'}`} />
                                      <span className={`font-medium text-sm ${skill.generateTool ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {skill.name}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{skill.description}</p>
                                  </div>
                                </label>
                              </div>
                              
                              {/* Expanded Config - only when selected */}
                              {skill.generateTool && (
                                <div className="px-3 pb-3 pt-0 space-y-2 border-t border-gray-100">
                                  <div className="pt-2">
                                    <label className="text-xs text-gray-500 mb-1 block">
                                      URL da Documentação (opcional)
                                    </label>
                                    <input
                                      value={skill.docUrl || ''}
                                      onChange={(e) => updateSkillConfig(i, { docUrl: e.target.value })}
                                      placeholder="https://api.exemplo.com/docs"
                                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-[#00DED2] focus:border-[#00DED2]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">
                                      Contexto Adicional (opcional)
                                    </label>
                                    <textarea
                                      value={skill.docText || ''}
                                      onChange={(e) => updateSkillConfig(i, { docText: e.target.value })}
                                      placeholder="Cole documentação ou descreva detalhes da API..."
                                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-[#00DED2] focus:border-[#00DED2] h-16 resize-none"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Progress indicator during creation */}
                      {creating && creationProgress && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{creationProgress}</span>
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="btn-primary w-full bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        {creating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {creating 
                          ? creationProgress || 'Criando...' 
                          : `Criar Agente + ${skillsConfig.filter(s => s.generateTool).length} Tools`
                        }
                      </button>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                      <FileCode className="w-12 h-12 mb-3" />
                      <p className="text-center">
                        O preview do agente<br />aparecerá aqui
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Tool Modal */}
      <AnimatePresence>
        {showGenerateTool && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => resetGenerateToolForm()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Gerar Ferramenta com IA</h2>
                  <p className="text-sm text-gray-500">
                    Para: {projects.find(p => p.uuid === targetAgentId)?.title}
                  </p>
                </div>
                <button 
                  onClick={() => resetGenerateToolForm()}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 grid md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
                {/* Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome da Ferramenta (opcional)
                    </label>
                    <input
                      value={toolName}
                      onChange={(e) => setToolName(e.target.value)}
                      placeholder="Ex: Consultar Pedido VTEX"
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL da Documentação (opcional)
                    </label>
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={docUrl}
                        onChange={(e) => setDocUrl(e.target.value)}
                        placeholder="https://api.exemplo.com/docs"
                        className="input pl-10"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Documentação (texto)
                    </label>
                    <textarea
                      value={docText}
                      onChange={(e) => setDocText(e.target.value)}
                      placeholder="Cole a documentação da API aqui..."
                      className="input h-48 resize-none font-mono text-sm"
                    />
                  </div>
                  
                  <button
                    onClick={handleGenerateTool}
                    disabled={generating || (!docUrl && !docText)}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Gerar Código
                  </button>
                </div>
                
                {/* Preview */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  {generatedTool ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-gray-600">Código gerado com sucesso</span>
                      </div>
                      
                      <div>
                        <span className="text-xs text-gray-400 uppercase">Nome</span>
                        <p className="font-semibold">{generatedTool.tool_name}</p>
                      </div>
                      
                      <div>
                        <span className="text-xs text-gray-400 uppercase">Slug</span>
                        <p className="font-mono text-sm">{generatedTool.tool_slug}</p>
                      </div>
                      
                      {generatedTool.parameters?.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-400 uppercase">Parâmetros</span>
                          <div className="space-y-1 mt-1">
                            {generatedTool.parameters.map((p, i) => (
                              <div key={i} className="text-sm">
                                <span className="text-[#00DED2]">{p.name}</span>
                                <span className="text-gray-400"> ({p.type})</span>
                                {p.required && <span className="text-red-400 ml-1">*</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400 uppercase">Código</span>
                          <button
                            onClick={() => copyToClipboard(generatedTool.main_py)}
                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            Copiar
                          </button>
                        </div>
                        <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto max-h-48 font-mono">
                          {generatedTool.main_py}
                        </pre>
                      </div>
                      
                      <button
                        onClick={handleSaveTool}
                        disabled={saving}
                        className="btn-primary w-full bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Adicionar ao Agente
                      </button>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                      <FileCode className="w-12 h-12 mb-3" />
                      <p className="text-center">
                        O código gerado<br />aparecerá aqui
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* YAML Editor Modal */}
      <AnimatePresence>
        {showYamlEditor && selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowYamlEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-xl"
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Editor YAML</h2>
                  <p className="text-sm text-gray-500">{selectedProject.title}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveYaml}
                    disabled={savingYaml || improvingYaml}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    {savingYaml ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Salvar
                  </button>
                  <button 
                    onClick={() => setShowYamlEditor(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex h-[75vh]">
                {/* YAML Editor */}
                <div className="flex-1">
                  <textarea
                    value={yamlContent}
                    onChange={(e) => setYamlContent(e.target.value)}
                    className="w-full h-full p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none"
                    spellCheck={false}
                  />
                </div>
                
                {/* AI Improve Panel */}
                <div className="w-80 border-l border-gray-200 bg-gray-50 p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-[#00DED2]" />
                    <h3 className="font-semibold text-gray-900">Melhorar com IA</h3>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-4">
                    A IA irá analisar e melhorar a formatação, instruções e guardrails do seu agente.
                  </p>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Instruções específicas (opcional)
                    </label>
                    <textarea
                      value={improveInstructions}
                      onChange={(e) => setImproveInstructions(e.target.value)}
                      placeholder="Ex: Torne as instruções mais detalhadas, adicione guardrails de segurança..."
                      className="input h-24 resize-none text-sm"
                    />
                  </div>
                  
                  <button
                    onClick={handleImproveYaml}
                    disabled={improvingYaml || savingYaml}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {improvingYaml ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Melhorando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Melhorar YAML
                      </>
                    )}
                  </button>
                  
                  <div className="mt-auto pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-400">
                      💡 O prompt usado pode ser personalizado no Admin → Prompts → "Melhoria de YAML"
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Official Tool Detail Modal */}
      <AnimatePresence>
        {selectedOfficialTool && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => { setSelectedOfficialTool(null); setOfficialToolCode(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#00DED2]/10">
                    <Wrench className="w-5 h-5 text-[#00DED2]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedOfficialTool.name}</h2>
                    <p className="text-sm text-gray-500">{selectedOfficialTool.slug}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedOfficialTool(null); setOfficialToolCode(null); }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <p className="text-gray-600 mb-4">{selectedOfficialTool.description}</p>
                
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Parâmetros</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {selectedOfficialTool.parameters.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-[#00DED2]">{p.name}</span>
                        <span className="text-gray-400">({p.type})</span>
                        {p.required && <span className="text-red-400 text-xs">obrigatório</span>}
                        <span className="text-gray-500">- {p.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {generatingOfficial && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#00DED2]" />
                    <span className="ml-3 text-gray-500">Gerando código...</span>
                  </div>
                )}
                
                {officialToolCode && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-700">Código Gerado</h3>
                      <button
                        onClick={() => copyToClipboard(officialToolCode.main_py)}
                        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar
                      </button>
                    </div>
                    
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto max-h-60 font-mono">
                      {officialToolCode.main_py}
                    </pre>
                    
                    <div className="flex gap-3">
                      <select
                        value={targetProjectForOfficial}
                        onChange={(e) => setTargetProjectForOfficial(e.target.value)}
                        className="input flex-1"
                      >
                        <option value="">Selecione um agente</option>
                        {projects.map((p) => (
                          <option key={p.uuid} value={p.uuid}>{p.title}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddOfficialToProject}
                        disabled={saving || !targetProjectForOfficial}
                        className="btn-primary flex items-center gap-2"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        Adicionar ao Agente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tool Code Viewer Modal */}
      <AnimatePresence>
        {showToolViewer && viewingTool && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => { setShowToolViewer(false); setViewingTool(null); setEditingToolCode(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl"
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#00DED2]/10">
                    <Wrench className="w-5 h-5 text-[#00DED2]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{viewingTool.name}</h2>
                    <p className="text-sm text-gray-500">
                      <span className="font-mono">{viewingTool.slug}</span>
                      <span className="mx-2">•</span>
                      <span>{viewingTool.projectName}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!editingToolCode ? (
                    <button
                      onClick={() => setEditingToolCode(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600"
                    >
                      <Edit3 className="w-4 h-4" />
                      Editar
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveToolCode}
                      disabled={savingToolCode}
                      className="btn-primary flex items-center gap-1.5 text-sm"
                    >
                      {savingToolCode ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Salvar
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(toolCode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar
                  </button>
                  <button 
                    onClick={() => { setShowToolViewer(false); setViewingTool(null); setEditingToolCode(false); }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-0">
                {loadingToolCode ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[#00DED2]" />
                    <span className="ml-3 text-gray-500">Carregando código...</span>
                  </div>
                ) : editingToolCode ? (
                  <textarea
                    value={toolCode}
                    onChange={(e) => setToolCode(e.target.value)}
                    className="w-full h-[70vh] p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="w-full h-[70vh] p-4 font-mono text-sm bg-gray-900 text-gray-100 overflow-auto">
                    {toolCode}
                  </pre>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && deletingProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-full bg-red-100">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Deletar Agente</h3>
                    <p className="text-sm text-gray-500">Esta ação não pode ser desfeita</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-700">
                    Tem certeza que deseja deletar o agente <strong>{deletingProject.title}</strong>?
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Todas as ferramentas associadas também serão removidas.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={cancelDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deletando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Deletar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

