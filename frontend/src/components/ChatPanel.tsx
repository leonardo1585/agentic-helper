import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Trash2,
  MessageSquare,
  Sparkles,
  Terminal,
  Users,
  Wand2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '../stores/appStore';

export function ChatPanel() {
  const { 
    messages, 
    isChatLoading, 
    knowledgeBases,
    status,
    chatMode,
    useRag,
    sendMessage, 
    setChatMode,
    setUseRag,
    clearChat 
  } = useAppStore();
  
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSend = async () => {
    if (!input.trim() || isChatLoading) return;
    
    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  if (!status?.ai_configured) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="empty-state-title">Configure a IA</h3>
        <p className="empty-state-description">
          Configure OpenAI ou Gemini para usar o chat.
        </p>
      </div>
    );
  }
  
  if (knowledgeBases.length === 0 && !useRag) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Sparkles className="w-8 h-8" />
        </div>
        <h3 className="empty-state-title">Analise Repositórios</h3>
        <p className="empty-state-description">
          Analise alguns repositórios primeiro para conversar sobre eles,
          ou ative o modo RAG se já tiver agentes indexados.
        </p>
        <button
          onClick={() => setUseRag(true)}
          className="btn-secondary mt-4 flex items-center gap-2 mx-auto"
        >
          <Wand2 className="w-4 h-4" />
          Ativar modo RAG
        </button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="page-title">Chat com Agente</h1>
          <p className="page-subtitle">
            {useRag ? '🪄 RAG Ativo' : `${knowledgeBases.length} repositório(s)`} • {chatMode === 'technical' ? 'Técnico' : 'Negócio'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* RAG Toggle */}
          <button
            onClick={() => setUseRag(!useRag)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              useRag 
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={useRag 
              ? 'RAG: Busca automática de contexto relevante' 
              : 'Clique para ativar busca inteligente'}
          >
            <Wand2 className="w-4 h-4" />
            {useRag ? 'RAG' : 'RAG Off'}
          </button>
          
          {/* Mode Selector */}
          <div className="tabs">
            <button
              onClick={() => setChatMode('technical')}
              className={`tab flex items-center gap-2 ${chatMode === 'technical' ? 'active' : ''}`}
            >
              <Terminal className="w-4 h-4" />
              Técnico
            </button>
            <button
              onClick={() => setChatMode('business')}
              className={`tab flex items-center gap-2 ${chatMode === 'business' ? 'active' : ''}`}
            >
              <Users className="w-4 h-4" />
              Negócio
            </button>
          </div>
          
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="btn-secondary flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#00DED2] to-purple-500 flex items-center justify-center">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {chatMode === 'technical' ? 'Modo Técnico' : 'Modo Negócio'}
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-2">
              {chatMode === 'technical' 
                ? 'Pergunte sobre APIs, arquitetura, integrações e código.'
                : 'Pergunte sobre funcionalidades, fluxos e casos de uso.'}
            </p>
            
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {chatMode === 'technical' ? (
                <>
                  <SuggestionButton text="Quais APIs estão disponíveis?" onClick={setInput} />
                  <SuggestionButton text="Como funciona a arquitetura?" onClick={setInput} />
                  <SuggestionButton text="Quais integrações existem?" onClick={setInput} />
                  <SuggestionButton text="Quais regras de negócio existem?" onClick={setInput} />
                </>
              ) : (
                <>
                  <SuggestionButton text="O que este sistema faz?" onClick={setInput} />
                  <SuggestionButton text="Quais são as funcionalidades?" onClick={setInput} />
                  <SuggestionButton text="Como usar este produto?" onClick={setInput} />
                  <SuggestionButton text="Quem são os usuários?" onClick={setInput} />
                </>
              )}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00DED2] to-purple-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={`max-w-[80%] rounded-xl p-4 ${
                  message.role === 'user'
                    ? 'bg-[#00DED2] text-gray-900'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {message.role === 'assistant' ? (
                    <div className="markdown-content text-sm">
                      <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>
                
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        
        {isChatLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Pensando...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatMode === 'technical' 
              ? "Pergunte sobre APIs, código, arquitetura..." 
              : "Pergunte sobre funcionalidades, fluxos..."}
            rows={1}
            className="input flex-1 resize-none min-h-[48px] max-h-[120px]"
          />
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || isChatLoading}
            className="btn-primary px-4 disabled:opacity-50"
          >
            {isChatLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuggestionButton({ text, onClick }: { text: string; onClick: (text: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="text-sm px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-[#00DED2] hover:text-[#00a89d] transition-colors"
    >
      {text}
    </button>
  );
}
