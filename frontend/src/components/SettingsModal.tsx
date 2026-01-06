import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Brain, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { status, aiModels, updateConfig, fetchAIModels, isLoading, error, clearError } = useAppStore();
  
  const [githubToken, setGithubToken] = useState('');
  const [aiProvider, setAiProvider] = useState<'openai' | 'gemini' | 'anthropic'>('openai');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      fetchAIModels();
      if (status?.ai_provider) {
        setAiProvider(status.ai_provider as 'openai' | 'gemini' | 'anthropic');
      }
      if (status?.ai_model) {
        setAiModel(status.ai_model);
      }
    }
  }, [isOpen, fetchAIModels, status]);
  
  const handleSaveGithub = async () => {
    if (!githubToken) return;
    try {
      await updateConfig({ github_token: githubToken });
      setGithubToken('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Error handled by store
    }
  };
  
  const handleSaveAI = async () => {
    if (!aiApiKey) return;
    try {
      await updateConfig({
        ai_provider: aiProvider,
        ai_api_key: aiApiKey,
        ai_model: aiModel || undefined
      });
      setAiApiKey('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Error handled by store
    }
  };
  
  const availableModels = aiModels[aiProvider] || [];
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Configurações</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-sm text-red-600 flex-1">{error}</p>
                    <button onClick={clearError} className="text-red-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
                
                {/* Success */}
                {saveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200"
                  >
                    <Check className="w-5 h-5 text-emerald-500" />
                    <p className="text-sm text-emerald-600">Configuração salva com sucesso!</p>
                  </motion.div>
                )}
                
                {/* GitHub Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Key className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">GitHub Token</h3>
                      <p className="text-xs text-gray-500">
                        {status?.github_configured 
                          ? '✓ Token configurado' 
                          : 'Necessário para acessar repositórios'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxx"
                      className="input flex-1"
                    />
                    <button
                      onClick={handleSaveGithub}
                      disabled={!githubToken || isLoading}
                      className="btn-primary disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    Crie um token em{' '}
                    <a 
                      href="https://github.com/settings/tokens" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#00DED2] hover:underline"
                    >
                      github.com/settings/tokens
                    </a>
                  </p>
                </div>
                
                {/* AI Section */}
                <div className="space-y-3 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Configuração de IA</h3>
                      <p className="text-xs text-gray-500">
                        {status?.ai_configured 
                          ? `✓ ${status.ai_provider?.toUpperCase()} - ${status.ai_model}` 
                          : 'Configure OpenAI ou Gemini'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Provider Selection */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { setAiProvider('openai'); setAiModel(''); }}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        aiProvider === 'openai'
                          ? 'border-[#00DED2] bg-[#00DED2]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900">OpenAI</div>
                      <div className="text-xs text-gray-500">GPT-4, o1, o3</div>
                    </button>
                    
                    <button
                      onClick={() => { setAiProvider('gemini'); setAiModel(''); }}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        aiProvider === 'gemini'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900">Gemini</div>
                      <div className="text-xs text-gray-500">2.0, 1.5 Pro</div>
                    </button>
                    
                    <button
                      onClick={() => { setAiProvider('anthropic'); setAiModel(''); }}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        aiProvider === 'anthropic'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900">Anthropic</div>
                      <div className="text-xs text-gray-500">Claude 3.5</div>
                    </button>
                  </div>
                  
                  {/* Model Selection - APENAS select */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Modelo</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="select w-full"
                    >
                      <option value="">Selecione um modelo</option>
                      {availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400">
                      {availableModels.length} modelos disponíveis para {aiProvider.toUpperCase()}
                    </p>
                  </div>
                  
                  {/* API Key */}
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder={aiProvider === 'openai' ? 'sk-xxxx...' : aiProvider === 'anthropic' ? 'sk-ant-xxxx...' : 'AIzaSy...'}
                      className="input flex-1"
                    />
                    <button
                      onClick={handleSaveAI}
                      disabled={!aiApiKey || isLoading}
                      className="btn-primary disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
