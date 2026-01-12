import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  X,
  MessageCircle,
  Sparkles,
  Minimize2,
  Maximize2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '../stores/appStore';

interface WebChatProps {
  contextKB?: string; // Nome da KB para contexto
}

export function WebChat({ contextKB }: WebChatProps) {
  const { 
    messages, 
    isChatLoading, 
    status,
    chatMode,
    useRag,
    sendMessageWithContext, 
    setUseRag,
    clearChat 
  } = useAppStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const isUserScrollingRef = useRef(false);
  
  // Scroll só quando permitido
  useEffect(() => {
    if (shouldAutoScrollRef.current && !isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Detecta scroll manual do usuário
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    // Detecta se usuário scrollou para CIMA (scrollTop diminuiu ou não está no fim)
    if (scrollTop < lastScrollTopRef.current - 10 || !isAtBottom) {
      // Usuário scrollou para cima - PARA o auto-scroll
      isUserScrollingRef.current = true;
      shouldAutoScrollRef.current = false;
    }
    
    // Se chegou no fim, reativa
    if (isAtBottom) {
      isUserScrollingRef.current = false;
      shouldAutoScrollRef.current = true;
    }
    
    lastScrollTopRef.current = scrollTop;
  };
  
  // Auto-ativar RAG quando há uma KB selecionada
  useEffect(() => {
    if (contextKB && !useRag) {
      setUseRag(true);
    }
  }, [contextKB, useRag, setUseRag]);
  
  const handleSend = async () => {
    if (!input.trim() || isChatLoading) return;
    
    const message = input.trim();
    setInput('');
    // Reseta scroll para acompanhar nova mensagem
    isUserScrollingRef.current = false;
    shouldAutoScrollRef.current = true;
    await sendMessageWithContext(message, contextKB);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setIsExpanded(false);
    }
  };
  
  if (!status?.ai_configured) {
    return null;
  }
  
  return (
    <>
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden ${
              isExpanded 
                ? 'bottom-4 right-4 left-4 top-4 md:left-auto md:top-auto md:w-[600px] md:h-[700px]' 
                : 'bottom-24 right-6 w-[380px] h-[520px]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#00DED2] to-[#00b8ae] text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Assistente GTH</h3>
                  <p className="text-xs text-white/80">
                    {contextKB ? `Contexto: ${contextKB.split('/').pop()}` : 'Pergunte sobre os agentes'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title={isExpanded ? 'Minimizar' : 'Expandir'}
                >
                  {isExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={toggleOpen}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Disclaimer */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" />
                Este assistente usa IA para responder você.
              </p>
            </div>
            
            {/* Messages */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              onWheel={(e) => {
                // Se scrollou para cima, marca como scroll manual
                if (e.deltaY < 0) {
                  isUserScrollingRef.current = true;
                  shouldAutoScrollRef.current = false;
                }
              }}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#00DED2]/20 to-purple-500/20 flex items-center justify-center">
                    <MessageCircle className="w-7 h-7 text-[#00DED2]" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2 text-sm">
                    Olá! Como posso ajudar?
                  </h3>
                  <p className="text-xs text-gray-500 max-w-[250px] mx-auto mb-4">
                    {contextKB 
                      ? `Pergunte sobre o agente "${contextKB.split('/').pop()}"` 
                      : 'Pergunte sobre APIs, funcionalidades, fluxos e mais.'}
                  </p>
                  
                  {/* Quick suggestions */}
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <QuickButton 
                      text="O que esse agente faz?" 
                      onClick={setInput} 
                    />
                    <QuickButton 
                      text="Quais APIs ele usa?" 
                      onClick={setInput} 
                    />
                    <QuickButton 
                      text="Como funciona o fluxo?" 
                      onClick={setInput} 
                    />
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-[#00DED2]" />
                        </div>
                      )}
                      
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        message.role === 'user'
                          ? 'bg-gray-900 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}>
                        {message.role === 'assistant' ? (
                          message.content ? (
                            <div className="markdown-content text-sm prose prose-sm max-w-none">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 py-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          )
                        ) : (
                          <p className="text-sm">{message.content}</p>
                        )}
                      </div>
                      
                      {message.role === 'user' && (
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </>
              )}
              
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 border border-gray-200 focus-within:border-[#00DED2] focus-within:ring-2 focus-within:ring-[#00DED2]/20 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua dúvida aqui"
                  className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isChatLoading}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-[#00DED2] disabled:hover:bg-gray-200 text-gray-500 hover:text-white disabled:text-gray-400 flex items-center justify-center transition-all disabled:cursor-not-allowed"
                >
                  {isChatLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              
              {/* Footer */}
              <p className="text-[10px] text-gray-400 text-center mt-2">
                Seus dados são tratados com segurança.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Floating Button */}
      <motion.button
        onClick={toggleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors ${
          isOpen 
            ? 'bg-gray-900 text-white' 
            : 'bg-gradient-to-r from-[#00DED2] to-[#00b8ae] text-white'
        }`}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
            >
              <MessageCircle className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
      
      {/* Pulse animation when closed */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#00DED2]/30 animate-ping" />
      )}
    </>
  );
}

function QuickButton({ text, onClick }: { text: string; onClick: (text: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-[#00DED2] hover:text-[#00DED2] transition-colors"
    >
      {text}
    </button>
  );
}

