import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock,
  LogOut,
  BarChart3,
  History,
  FileText,
  Settings,
  DollarSign,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
  ChevronRight,
  Database,
  TrendingUp
} from 'lucide-react';
import { 
  adminApi, 
  TokenUsageSummary, 
  TokenUsageRecord, 
  AnalysisHistory
} from '../services/api';
import { PromptAdmin } from './PromptAdmin';

type AdminTab = 'dashboard' | 'prompts' | 'history' | 'settings';

// Componente de Login
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const result = await adminApi.login(password);
      if (result.success) {
        onLogin();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#00DED2] to-cyan-600 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Agentic Helper</h1>
            <p className="text-gray-500 mt-1">Acesso Administrativo</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00DED2] focus:border-transparent pr-12"
                  placeholder="••••••••"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}
            
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-gradient-to-r from-[#00DED2] to-cyan-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Entrar'
              )}
            </button>
          </form>
          
          <p className="text-xs text-gray-400 text-center mt-6">
            Senha padrão: admin123 (altere após o primeiro acesso)
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// Dashboard de Métricas
function MetricsDashboard() {
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null);
  const [recentUsage, setRecentUsage] = useState<TokenUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  
  useEffect(() => {
    loadData();
  }, [days]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, usageData] = await Promise.all([
        adminApi.getMetricsSummary(days),
        adminApi.getRecentUsage(20)
      ]);
      setSummary(summaryData);
      setRecentUsage(usageData.records);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-[#00DED2] animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Métricas de Uso</h2>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                days === d 
                  ? 'bg-[#00DED2] text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d} dias
            </button>
          ))}
          <button onClick={loadData} className="p-2 text-gray-400 hover:text-[#00DED2]">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Cards de resumo */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Total Requisições</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{summary?.total_requests || 0}</p>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Database className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Total Tokens</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {((summary?.total_tokens || 0) / 1000).toFixed(1)}K
          </p>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Custo Estimado</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ${(summary?.total_estimated_cost || 0).toFixed(2)}
          </p>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">Média/Dia</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ${((summary?.total_estimated_cost || 0) / days).toFixed(3)}
          </p>
        </div>
      </div>
      
      {/* Uso por operação */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Por Operação</h3>
          <div className="space-y-3">
            {Object.entries(summary?.by_operation || {}).map(([op, data]) => (
              <div key={op} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    op.includes('technical') ? 'bg-blue-500' :
                    op.includes('business') ? 'bg-green-500' :
                    op.includes('debug') ? 'bg-red-500' :
                    op.includes('chat') ? 'bg-purple-500' : 'bg-gray-500'
                  }`} />
                  <span className="text-sm text-gray-700">{op.replace('_', ' ')}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900">{data.count}x</span>
                  <span className="text-xs text-gray-400 ml-2">${data.cost.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Por Modelo</h3>
          <div className="space-y-3">
            {Object.entries(summary?.by_model || {}).map(([model, data]) => (
              <div key={model} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{model}</span>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900">{(data.tokens / 1000).toFixed(1)}K tok</span>
                  <span className="text-xs text-gray-400 ml-2">${data.cost.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Uso recente */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Uso Recente</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-3 font-medium">Data/Hora</th>
                <th className="pb-3 font-medium">Operação</th>
                <th className="pb-3 font-medium">Modelo</th>
                <th className="pb-3 font-medium text-right">Tokens</th>
                <th className="pb-3 font-medium text-right">Custo</th>
                <th className="pb-3 font-medium text-right">Duração</th>
              </tr>
            </thead>
            <tbody>
              {recentUsage.slice(0, 10).map(record => (
                <tr key={record.id} className="border-b border-gray-50">
                  <td className="py-3 text-gray-600">
                    {new Date(record.timestamp).toLocaleString('pt-BR', { 
                      day: '2-digit', 
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      record.operation.includes('technical') ? 'bg-blue-100 text-blue-700' :
                      record.operation.includes('business') ? 'bg-green-100 text-green-700' :
                      record.operation.includes('debug') ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {record.operation}
                    </span>
                  </td>
                  <td className="py-3 text-gray-700">{record.model}</td>
                  <td className="py-3 text-right text-gray-700">{record.total_tokens.toLocaleString()}</td>
                  <td className="py-3 text-right text-gray-700">${record.estimated_cost.toFixed(4)}</td>
                  <td className="py-3 text-right text-gray-500">{(record.duration_ms / 1000).toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Histórico de Análises
function AnalysisHistoryPanel() {
  const [history, setHistory] = useState<AnalysisHistory | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadHistory();
  }, []);
  
  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAnalysisHistory(100);
      setHistory(data);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-[#00DED2] animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Histórico de Análises</h2>
        <button onClick={loadHistory} className="p-2 text-gray-400 hover:text-[#00DED2]">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{history?.total_analyses || 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-500">Sucesso</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{history?.successful || 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm text-gray-500">Falhas</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{history?.failed || 0}</p>
        </div>
      </div>
      
      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50">
                <th className="px-5 py-3 font-medium">Data/Hora</th>
                <th className="px-5 py-3 font-medium">Operação</th>
                <th className="px-5 py-3 font-medium">Repositório</th>
                <th className="px-5 py-3 font-medium">Pasta</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Modelo</th>
                <th className="px-5 py-3 font-medium text-right">Arquivos</th>
                <th className="px-5 py-3 font-medium text-right">Tokens</th>
                <th className="px-5 py-3 font-medium text-right">Custo</th>
                <th className="px-5 py-3 font-medium text-right">Duração</th>
              </tr>
            </thead>
            <tbody>
              {history?.records.map(record => (
                <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-4 text-gray-600">
                    {new Date(record.timestamp).toLocaleString('pt-BR', { 
                      day: '2-digit', 
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      record.operation === 'repository_analysis' ? 'bg-blue-100 text-blue-700' :
                      record.operation === 'debug' ? 'bg-orange-100 text-orange-700' :
                      record.operation === 'agent_search' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {record.operation === 'repository_analysis' ? '📊 Análise' :
                       record.operation === 'debug' ? '🔍 Debug' :
                       record.operation === 'agent_search' ? '🔎 Busca' :
                       record.operation || 'Análise'}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-medium text-gray-900">{record.repository}</td>
                  <td className="px-5 py-4 text-gray-600">{record.folder || '-'}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      record.status === 'completed' ? 'bg-green-100 text-green-700' :
                      record.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {record.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                      {record.status === 'failed' && <XCircle className="w-3 h-3" />}
                      {record.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-700">{record.model_used}</td>
                  <td className="px-5 py-4 text-right text-gray-700">{record.files_analyzed}</td>
                  <td className="px-5 py-4 text-right text-gray-700">{record.tokens_used.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right text-gray-700">${record.estimated_cost.toFixed(4)}</td>
                  <td className="px-5 py-4 text-right text-gray-500">{record.duration_seconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {(!history?.records || history.records.length === 0) && (
          <div className="text-center py-12 text-gray-400">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma análise registrada ainda</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Configurações do Admin
function AdminSettings({ onLogout }: { onLogout: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não conferem' });
      return;
    }
    
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres' });
      return;
    }
    
    setLoading(true);
    try {
      const result = await adminApi.changePassword(currentPassword, newPassword);
      setMessage({ type: 'success', text: result.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Logout após trocar senha
      setTimeout(() => {
        onLogout();
      }, 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Configurações de Segurança</h2>
      
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-gray-400" />
          Alterar Senha
        </h3>
        
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Senha Atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00DED2] focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nova Senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00DED2] focus:border-transparent"
              required
              minLength={6}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Nova Senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00DED2] focus:border-transparent"
              required
            />
          </div>
          
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg flex items-center gap-2 ${
                message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-sm">{message.text}</span>
            </motion.div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#00DED2] text-white rounded-xl font-medium hover:bg-[#00c9be] transition-colors disabled:opacity-50"
          >
            {loading ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </form>
      </div>
      
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Sessão</h3>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Encerrar Sessão
        </button>
      </div>
    </div>
  );
}

// Componente Principal
export function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  const checkAuth = async () => {
    const valid = await adminApi.verifyToken();
    setIsAuthenticated(valid);
    setChecking(false);
  };
  
  const handleLogout = async () => {
    await adminApi.logout();
    setIsAuthenticated(false);
  };
  
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-[#00DED2] animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;
  }
  
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'prompts', label: 'Prompts', icon: FileText },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ] as const;
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 text-white p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00DED2] to-cyan-600 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold">Agentic Helper</h1>
            <p className="text-xs text-gray-400">Administração</p>
          </div>
        </div>
        
        <nav className="space-y-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-[#00DED2] text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
        
        <div className="absolute bottom-6 left-6 right-6">
          <a
            href="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Voltar ao App
          </a>
        </div>
      </aside>
      
      {/* Main content */}
      <main className="ml-64 p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <MetricsDashboard />}
            {activeTab === 'prompts' && <PromptAdmin />}
            {activeTab === 'history' && <AnalysisHistoryPanel />}
            {activeTab === 'settings' && <AdminSettings onLogout={handleLogout} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

