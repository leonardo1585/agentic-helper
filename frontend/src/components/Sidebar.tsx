import { motion } from 'framer-motion';
import { 
  Settings,
  Sparkles,
  Search,
  HelpCircle,
  MessageCircleQuestion
} from 'lucide-react';

type TabType = 'finder' | 'debug';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenSettings: () => void;
}

interface MenuItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

export function Sidebar({ activeTab, onTabChange, onOpenSettings }: SidebarProps) {
  const menuItems: MenuItem[] = [
    { id: 'debug', label: 'Tirar Dúvidas', icon: MessageCircleQuestion, description: 'Diagnóstico e análise de problemas' },
    { id: 'finder', label: 'Buscar Agente', icon: Search, description: 'Encontrar agentes existentes' },
  ];

  return (
    <aside className="sidebar flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img 
            src="/logo-weni.png" 
            alt="Agentic Helper" 
            className="w-10 h-10 rounded-xl object-cover"
            onError={(e) => {
              // Fallback se a imagem não existir
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00DED2] to-cyan-400 flex items-center justify-center hidden">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Agentic Helper</h1>
            <p className="text-xs text-gray-500">by Weni</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#00DED2]/10 text-[#00DED2]' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#00DED2] rounded-r"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isActive ? 'bg-[#00DED2]/20' : 'bg-gray-100'
                }`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#00DED2]' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1 text-left">
                  <span className={`font-medium ${isActive ? 'text-[#00DED2]' : ''}`}>
                    {item.label}
                  </span>
                  {item.description && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{item.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Help section */}
        <div className="mt-8 p-4 rounded-xl bg-gradient-to-br from-[#00DED2]/5 to-cyan-50 border border-[#00DED2]/10">
          <HelpCircle className="w-6 h-6 text-[#00DED2] mb-2" />
          <h4 className="text-sm font-medium text-gray-800 mb-1">Precisa de ajuda?</h4>
          <p className="text-xs text-gray-500">
            Use "Tirar Dúvidas" para diagnóstico de problemas ou "Buscar Agente" para encontrar agentes.
          </p>
        </div>
      </nav>

      {/* Settings */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="font-medium">Configurações</span>
        </button>
      </div>
    </aside>
  );
}
