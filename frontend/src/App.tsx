import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircleQuestion } from 'lucide-react';
import { 
  Sidebar,
  SettingsModal, 
  AgentFinder,
  DebugPanel,
  RepositoryList,
  TicketView
} from './components';
import { useAppStore } from './stores/appStore';

type TabType = 'repos' | 'finder' | 'debug';

function MainApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('repos');
  const { fetchStatus, status } = useAppStore();
  
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);
  
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
          {activeTab === 'finder' && <AgentFinder />}
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
