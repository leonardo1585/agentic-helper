import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Plus, 
  Edit2, 
  Trash2, 
  Copy, 
  Play, 
  Save,
  X,
  Sparkles,
  Settings2,
  Code,
  RefreshCw,
  Check,
  AlertCircle,
  Zap,
  BookOpen,
  MessageSquare,
  Bug,
  Search,
  Wand2,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { api, PromptConfig, PromptCreate, PromptUpdate, PromptTestResult } from '../services/api';

interface Category {
  id: string;
  name: string;
  icon: any;
  color: string;
  bgColor: string;
}

const CATEGORIES: Category[] = [
  { id: 'analysis_technical', name: 'Análise Técnica', icon: Code, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'analysis_business', name: 'Análise de Negócio', icon: BookOpen, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { id: 'chat', name: 'Chat', icon: MessageSquare, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'debug', name: 'Debug', icon: Bug, color: 'text-red-600', bgColor: 'bg-red-50' },
  { id: 'search', name: 'Busca', icon: Search, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { id: 'custom', name: 'Personalizado', icon: Wand2, color: 'text-gray-600', bgColor: 'bg-gray-50' },
];

interface AIModel {
  id: string;
  name: string;
}

interface AIModels {
  openai: AIModel[];
  gemini: AIModel[];
  anthropic: AIModel[];
}

export function PromptAdmin() {
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptConfig | null>(null);
  const [aiModels, setAiModels] = useState<AIModels | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<PromptTestResult | null>(null);
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    system: true,
    user: true,
    config: false
  });

  // Form state
  const [formData, setFormData] = useState<PromptCreate>({
    name: '',
    description: '',
    category: 'custom',
    system_prompt: '',
    user_prompt_template: '',
    temperature: 0.5,
    max_tokens: 4096
  });

  useEffect(() => {
    loadPrompts();
    loadAiModels();
  }, []);

  const loadAiModels = async () => {
    try {
      const response = await fetch('/api/config/ai-models');
      const data = await response.json();
      setAiModels(data);
    } catch (error) {
      console.error('Erro ao carregar modelos:', error);
    }
  };

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const data = await api.getAllPrompts();
      console.log('Prompts carregados:', data);
      setPrompts(data);
    } catch (error) {
      console.error('Erro ao carregar prompts:', error);
      showMessage('error', 'Erro ao carregar prompts');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPrompt = (prompt: PromptConfig) => {
    setSelectedPrompt(prompt);
    setFormData({
      name: prompt.name,
      description: prompt.description,
      category: prompt.category,
      system_prompt: prompt.system_prompt,
      user_prompt_template: prompt.user_prompt_template,
      model: prompt.model || undefined,
      provider: prompt.provider || undefined,
      temperature: prompt.temperature,
      max_tokens: prompt.max_tokens || undefined
    });
    setIsEditing(false);
    setIsCreating(false);
    setShowTest(false);
    setTestResult(null);
    
    // Load variables for testing
    loadPromptVariables(prompt.id);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setIsEditing(true);
    setSelectedPrompt(null);
    setFormData({
      name: '',
      description: '',
      category: 'custom',
      system_prompt: '',
      user_prompt_template: '',
      temperature: 0.5,
      max_tokens: 4096
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showMessage('error', 'Nome é obrigatório');
      return;
    }
    
    setSaving(true);
    try {
      if (isCreating) {
        const newPrompt = await api.createPrompt(formData);
        setPrompts([...prompts, newPrompt]);
        setSelectedPrompt(newPrompt);
        setIsCreating(false);
        setIsEditing(false);
        showMessage('success', 'Prompt criado com sucesso!');
      } else if (selectedPrompt) {
        const updated = await api.updatePrompt(selectedPrompt.id, formData as PromptUpdate);
        setPrompts(prompts.map(p => p.id === updated.id ? updated : p));
        setSelectedPrompt(updated);
        setIsEditing(false);
        showMessage('success', 'Prompt atualizado!');
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Excluir este prompt?')) return;
    
    try {
      await api.deletePrompt(promptId);
      setPrompts(prompts.filter(p => p.id !== promptId));
      if (selectedPrompt?.id === promptId) {
        setSelectedPrompt(null);
      }
      showMessage('success', 'Prompt excluído!');
    } catch (error: any) {
      showMessage('error', error.message || 'Erro ao excluir');
    }
  };

  const handleDuplicate = async (prompt: PromptConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const duplicated = await api.duplicatePrompt(prompt.id, prompt.name + ' (Cópia)');
      setPrompts([...prompts, duplicated]);
      showMessage('success', 'Prompt duplicado!');
    } catch (error: any) {
      showMessage('error', error.message || 'Erro ao duplicar');
    }
  };

  const handleTest = async () => {
    if (!selectedPrompt) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await api.testPrompt(selectedPrompt.id, testVariables);
      setTestResult(result);
    } catch (error: any) {
      showMessage('error', error.message || 'Erro ao testar');
    } finally {
      setIsTesting(false);
    }
  };

  const loadPromptVariables = async (promptId: string) => {
    try {
      const { variables } = await api.getPromptVariables(promptId);
      const initialVars: Record<string, string> = {};
      variables.forEach(v => initialVars[v] = '');
      setTestVariables(initialVars);
    } catch (error) {
      console.error('Erro ao carregar variáveis:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[5];
  };

  const filteredPrompts = selectedCategory 
    ? prompts.filter(p => p.category === selectedCategory)
    : prompts;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 -m-6 p-6">
      {/* Header com gradiente */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00DED2] to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-200">
              <Settings2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gerenciador de Prompts</h1>
              <p className="text-gray-500">Configure e otimize os prompts da aplicação</p>
            </div>
          </div>
          
          <button 
            onClick={handleCreate} 
            className="bg-gradient-to-r from-[#00DED2] to-cyan-400 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-cyan-200 hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5" />
            Novo Prompt
          </button>
        </div>
      </div>

      {/* Message Toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 z-50 px-6 py-3 rounded-xl flex items-center gap-3 shadow-xl ${
              message.type === 'success' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-red-500 text-white'
            }`}
          >
            {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Categorias e Lista */}
        <div className="col-span-4 space-y-4">
          {/* Categorias */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Categorias</h3>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  !selectedCategory 
                    ? 'bg-gradient-to-r from-[#00DED2] to-cyan-400 text-white shadow-md' 
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                <span className="font-medium">Todos os Prompts</span>
                <span className={`ml-auto text-sm ${!selectedCategory ? 'text-white/80' : 'text-gray-400'}`}>
                  {prompts.length}
                </span>
              </button>
              
              {CATEGORIES.slice(0, 5).map(cat => {
                const count = prompts.filter(p => p.category === cat.id).length;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      selectedCategory === cat.id 
                        ? `${cat.bgColor} ${cat.color}` 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{cat.name}</span>
                    {count > 0 && (
                      <span className={`ml-auto text-sm ${selectedCategory === cat.id ? 'opacity-70' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de Prompts */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Prompts {selectedCategory && `(${getCategoryInfo(selectedCategory).name})`}
              </h3>
              <button 
                onClick={loadPrompts} 
                className="p-2 text-gray-400 hover:text-[#00DED2] hover:bg-cyan-50 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-[#00DED2] animate-spin" />
                </div>
              ) : filteredPrompts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Nenhum prompt encontrado</p>
                  <p className="text-sm mt-1">Crie um novo prompt para começar</p>
                </div>
              ) : (
                filteredPrompts.map(prompt => {
                  const cat = getCategoryInfo(prompt.category);
                  const Icon = cat.icon;
                  const isSelected = selectedPrompt?.id === prompt.id;
                  
                  return (
                    <motion.div
                      key={prompt.id}
                      onClick={() => handleSelectPrompt(prompt)}
                      className={`group p-4 rounded-xl cursor-pointer transition-all border-2 ${
                        isSelected
                          ? 'bg-gradient-to-r from-cyan-50 to-teal-50 border-[#00DED2] shadow-sm'
                          : 'bg-gray-50 border-transparent hover:border-gray-200 hover:bg-white'
                      }`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg ${cat.bgColor} ${cat.color} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">{prompt.name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{prompt.description}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDuplicate(prompt, e)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                            title="Duplicar"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(prompt.id, e)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Editor Principal */}
        <div className="col-span-8">
          {(selectedPrompt || isCreating) ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Header do Editor */}
              <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {!isCreating && selectedPrompt && (
                      <div className={`w-10 h-10 rounded-lg ${getCategoryInfo(selectedPrompt.category).bgColor} ${getCategoryInfo(selectedPrompt.category).color} flex items-center justify-center`}>
                        {(() => {
                          const Icon = getCategoryInfo(selectedPrompt.category).icon;
                          return <Icon className="w-5 h-5" />;
                        })()}
                      </div>
                    )}
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {isCreating ? 'Novo Prompt' : selectedPrompt?.name}
                      </h2>
                      {!isCreating && selectedPrompt && (
                        <p className="text-sm text-gray-500">{selectedPrompt.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!isEditing && !isCreating && (
                      <>
                        <button
                          onClick={() => setShowTest(!showTest)}
                          className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                            showTest 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Play className="w-4 h-4" />
                          Testar
                        </button>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-4 py-2 bg-[#00DED2] text-white rounded-lg font-medium flex items-center gap-2 hover:bg-[#00c9be] transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Editar
                        </button>
                      </>
                    )}
                    {(isEditing || isCreating) && (
                      <>
                        <button
                          onClick={() => { setIsEditing(false); setIsCreating(false); }}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-200 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Cancelar
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="px-4 py-2 bg-gradient-to-r from-[#00DED2] to-cyan-400 text-white rounded-lg font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                        >
                          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Salvar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Conteúdo do Editor */}
              <div className="p-6 space-y-6">
                {/* Campos Básicos - Sempre visíveis em modo edição */}
                {(isEditing || isCreating) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Prompt</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00DED2] focus:border-transparent transition-all"
                        placeholder="Ex: Análise de Código Python"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00DED2] focus:border-transparent transition-all bg-white"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00DED2] focus:border-transparent transition-all"
                        placeholder="Descrição breve do que este prompt faz"
                      />
                    </div>
                  </div>
                )}

                {/* System Prompt */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('system')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-700">System Prompt</span>
                      <span className="text-xs text-gray-400 ml-2">Instruções base para o modelo</span>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.system ? 'rotate-90' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {expandedSections.system && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <textarea
                          value={isEditing || isCreating ? formData.system_prompt : selectedPrompt?.system_prompt || ''}
                          onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                          disabled={!isEditing && !isCreating}
                          className="w-full p-4 font-mono text-sm border-0 focus:ring-0 resize-none bg-gray-50/50"
                          rows={12}
                          placeholder="Digite as instruções do sistema..."
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* User Prompt Template */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('user')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-700">User Prompt Template</span>
                      <span className="text-xs text-gray-400 ml-2">Use {'{variavel}'} para placeholders</span>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.user ? 'rotate-90' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {expandedSections.user && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <textarea
                          value={isEditing || isCreating ? formData.user_prompt_template : selectedPrompt?.user_prompt_template || ''}
                          onChange={(e) => setFormData({ ...formData, user_prompt_template: e.target.value })}
                          disabled={!isEditing && !isCreating}
                          className="w-full p-4 font-mono text-sm border-0 focus:ring-0 resize-none bg-gray-50/50"
                          rows={6}
                          placeholder="Template do prompt do usuário..."
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Configurações Avançadas */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('config')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-700">Configurações Avançadas</span>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.config ? 'rotate-90' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {expandedSections.config && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden p-4"
                      >
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
                            <select
                              value={isEditing || isCreating ? (formData.model || '') : (selectedPrompt?.model || '')}
                              onChange={(e) => setFormData({ ...formData, model: e.target.value || undefined })}
                              disabled={!isEditing && !isCreating}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00DED2] focus:border-transparent disabled:bg-gray-50"
                            >
                              <option value="">Usar modelo padrão</option>
                              {aiModels && (
                                <>
                                  <optgroup label="OpenAI">
                                    {aiModels.openai.map(m => (
                                      <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Google Gemini">
                                    {aiModels.gemini.map(m => (
                                      <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Anthropic">
                                    {aiModels.anthropic.map(m => (
                                      <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                  </optgroup>
                                </>
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Temperatura</label>
                            <input
                              type="number"
                              value={isEditing || isCreating ? formData.temperature : selectedPrompt?.temperature || 0.5}
                              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                              disabled={!isEditing && !isCreating}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00DED2] focus:border-transparent disabled:bg-gray-50"
                              min="0"
                              max="2"
                              step="0.1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
                            <input
                              type="number"
                              value={isEditing || isCreating ? (formData.max_tokens || '') : (selectedPrompt?.max_tokens || '')}
                              onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || undefined })}
                              disabled={!isEditing && !isCreating}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00DED2] focus:border-transparent disabled:bg-gray-50"
                              placeholder="4096"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Área de Teste */}
                <AnimatePresence>
                  {showTest && selectedPrompt && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-2 border-purple-200 rounded-xl overflow-hidden bg-purple-50/50"
                    >
                      <div className="px-4 py-3 bg-purple-100 flex items-center gap-2">
                        <Play className="w-4 h-4 text-purple-600" />
                        <span className="font-medium text-purple-700">Testar Prompt</span>
                      </div>
                      
                      <div className="p-4 space-y-4">
                        {Object.keys(testVariables).length > 0 ? (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              {Object.keys(testVariables).map(varName => (
                                <div key={varName}>
                                  <label className="block text-sm font-medium text-purple-700 mb-1">
                                    {varName}
                                  </label>
                                  <input
                                    type="text"
                                    value={testVariables[varName]}
                                    onChange={(e) => setTestVariables({ ...testVariables, [varName]: e.target.value })}
                                    className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-white"
                                    placeholder={`Valor para {${varName}}`}
                                  />
                                </div>
                              ))}
                            </div>
                            
                            <button
                              onClick={handleTest}
                              disabled={isTesting}
                              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-purple-700 transition-colors disabled:opacity-50"
                            >
                              {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                              Executar Teste
                            </button>
                          </>
                        ) : (
                          <p className="text-purple-600 text-sm">Este prompt não possui variáveis para teste.</p>
                        )}

                        {testResult && (
                          <div className="space-y-3">
                            <div className="p-3 bg-white rounded-lg border border-purple-200">
                              <h4 className="text-xs font-medium text-purple-600 mb-2">INPUT RENDERIZADO</h4>
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{testResult.input_rendered}</pre>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-medium text-purple-700">OUTPUT</h4>
                                <span className="text-xs text-purple-600">{testResult.model_used} • {testResult.duration_ms}ms</span>
                              </div>
                              <pre className="text-xs text-purple-900 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">{testResult.output}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            /* Estado Vazio */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full min-h-[600px] flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <FileText className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Selecione um Prompt</h3>
                <p className="text-gray-500 mb-6">
                  Escolha um prompt da lista para visualizar, editar ou testar. 
                  Ou crie um novo prompt clicando no botão acima.
                </p>
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Criar Novo Prompt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
