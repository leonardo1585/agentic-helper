import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircleQuestion, Loader2, LogIn, Sparkles, Shield } from 'lucide-react';
import { 
  Sidebar,
  SettingsModal, 
  KnowledgeBasePanel,
  DebugPanel,
  RepositoryList,
  TicketView
} from './components';
import { useAppStore } from './stores/appStore';
import { weniApi, weniAuth } from './services/api';

type TabType = 'repos' | 'knowledge' | 'debug';

// Tela de Login com Weni Cloud
function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Inicia autenticação
      const { login_url } = await weniApi.startAuth();
      
      // Abre popup de login
      const popup = window.open(login_url, 'weni-login', 'width=500,height=700');
      
      // Aguarda autenticação
      const result = await weniApi.waitAuth();
      
      if (popup && !popup.closed) {
        popup.close();
      }
      
      if (result.success) {
        // Recarrega a página para aplicar autenticação
        window.location.reload();
      } else {
        setError('Falha na autenticação. Tente novamente.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative max-w-md w-full"
      >
        {/* Card de login */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              animate={{ 
                boxShadow: ['0 0 20px rgba(0, 222, 210, 0.3)', '0 0 40px rgba(0, 222, 210, 0.5)', '0 0 20px rgba(0, 222, 210, 0.3)']
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#00DED2] to-cyan-400 flex items-center justify-center"
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">Agentic Helper</h1>
            <p className="text-slate-400 text-sm">Suporte a Agentes Customizados</p>
          </div>
          
          {/* Info */}
          <div className="mb-8 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-[#00DED2]" />
              <span className="text-sm font-medium text-white">Acesso Seguro</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Para acessar esta ferramenta, você precisa fazer login com sua conta Weni Cloud.
              Isso garante que apenas usuários autorizados possam acessar os dados dos agentes.
            </p>
          </div>
          
          {/* Erro */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm"
            >
              {error}
            </motion.div>
          )}
          
          {/* Botão de login */}
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#00DED2] to-cyan-400 text-white font-semibold text-lg flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-[#00DED2]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Aguardando login...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Entrar com Weni Cloud</span>
              </>
            )}
          </button>
          
          {/* Footer */}
          <p className="text-center text-xs text-slate-500 mt-6">
            by Weni • v3.0
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function MainApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('repos');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { fetchStatus, status } = useAppStore();
  
  // Verifica autenticação ao carregar
  useEffect(() => {
    const checkAuth = async () => {
      // Verifica se tem token local
      if (!weniAuth.isAuthenticated()) {
        setIsAuthenticated(false);
        return;
      }
      
      // Verifica se token ainda é válido fazendo uma requisição
      try {
        await fetchStatus();
        setIsAuthenticated(true);
      } catch (err) {
        // Token inválido ou expirado
        weniAuth.clearToken();
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, [fetchStatus]);
  
  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00DED2] animate-spin" />
      </div>
    );
  }
  
  // Não autenticado - mostra tela de login
  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  
  // Autenticado - mostra aplicação
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      
      {/* Main content */}
      <main className="main-content">
        {/* Welcome banner - mostrar se não configurado */}
        {!status?.github_configured && !status?.ai_configured && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-8 rounded-2xl bg-white border border-gray-200 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#00DED2] to-cyan-400 flex items-center justify-center">
              <MessageCircleQuestion className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Suporte a Agentes Customizados
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto mb-4">
              Tire dúvidas, diagnostique problemas e acompanhe updates 
              dos seus agentes customizados. Configure o GitHub e IA para começar.
            </p>
            <button
              onClick={() => setSettingsOpen(true)}
              className="btn-primary"
            >
              Configurar
            </button>
          </motion.div>
        )}
        
        {/* Tab content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'repos' && <RepositoryList />}
          {activeTab === 'knowledge' && <KnowledgeBasePanel />}
          {activeTab === 'debug' && <DebugPanel />}
        </motion.div>
      </main>
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/diagnostic/ticket/:ticketId" element={<TicketView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
