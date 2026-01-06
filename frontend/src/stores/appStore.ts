import { create } from 'zustand';
import { api, Repository, KnowledgeBase, AppStatus, AIModel } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type ChatMode = 'technical' | 'business';

interface AppState {
  // Status
  status: AppStatus | null;
  isLoading: boolean;
  error: string | null;
  
  // Repositories
  repositories: Repository[];
  selectedRepos: Set<string>;
  languageFilter: string | null;
  
  // Knowledge Bases
  knowledgeBases: string[];
  currentKB: KnowledgeBase | null;
  
  // Chat
  messages: Message[];
  isChatLoading: boolean;
  chatMode: ChatMode;
  useRag: boolean;
  
  // AI Models
  aiModels: Record<string, AIModel[]>;
  
  // Analysis
  analysisProgress: Map<string, { status: string; progress: number; message: string }>;
  
  // Actions
  fetchStatus: () => Promise<void>;
  updateConfig: (config: Parameters<typeof api.updateConfig>[0]) => Promise<void>;
  fetchRepositories: () => Promise<void>;
  fetchAIModels: () => Promise<void>;
  toggleRepoSelection: (fullName: string) => void;
  selectAllRepos: (filteredRepos?: Repository[]) => void;
  clearSelection: () => void;
  setLanguageFilter: (language: string | null) => void;
  analyzeSelected: () => Promise<void>;
  analyzeWithFolder: (repoName: string, folderPath?: string) => Promise<void>;
  analyzeMultipleFolders: (selections: Array<{ repository: string; folderPath: string }>) => Promise<void>;
  fetchKnowledgeBases: () => Promise<void>;
  loadKnowledgeBase: (repoName: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  setChatMode: (mode: ChatMode) => void;
  setUseRag: (useRag: boolean) => void;
  clearChat: () => void;
  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  status: null,
  isLoading: false,
  error: null,
  repositories: [],
  selectedRepos: new Set(),
  languageFilter: null,
  knowledgeBases: [],
  currentKB: null,
  messages: [],
  isChatLoading: false,
  chatMode: 'technical',
  useRag: true, // RAG ativado por padrão
  aiModels: {},
  analysisProgress: new Map(),
  
  // Actions
  fetchStatus: async () => {
    try {
      const status = await api.getStatus();
      set({ status });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
  
  updateConfig: async (config) => {
    set({ isLoading: true, error: null });
    try {
      await api.updateConfig(config);
      await get().fetchStatus();
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchAIModels: async () => {
    try {
      const models = await api.getAIModels();
      set({ aiModels: models });
    } catch (err) {
      console.error('Error fetching AI models:', err);
    }
  },
  
  fetchRepositories: async () => {
    set({ isLoading: true, error: null });
    try {
      const { languageFilter } = get();
      const allRepos = await api.listRepositories(languageFilter || undefined);
      // Filtra apenas repositórios que contenham "agents" no nome
      const repos = allRepos.filter(repo => 
        repo.name.toLowerCase().includes('agents') || 
        repo.full_name.toLowerCase().includes('agents')
      );
      set({ repositories: repos });
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  toggleRepoSelection: (fullName) => {
    const { selectedRepos } = get();
    const newSelection = new Set(selectedRepos);
    
    if (newSelection.has(fullName)) {
      newSelection.delete(fullName);
    } else {
      newSelection.add(fullName);
    }
    
    set({ selectedRepos: newSelection });
  },
  
  selectAllRepos: (filteredRepos) => {
    const { repositories } = get();
    const reposToSelect = filteredRepos || repositories;
    set({ selectedRepos: new Set(reposToSelect.map(r => r.full_name)) });
  },
  
  clearSelection: () => {
    set({ selectedRepos: new Set() });
  },
  
  setLanguageFilter: (language) => {
    set({ languageFilter: language });
    get().fetchRepositories();
  },
  
  analyzeSelected: async () => {
    const { selectedRepos } = get();
    if (selectedRepos.size === 0) return;
    
    set({ isLoading: true, error: null });
    
    try {
      for (const repoName of selectedRepos) {
        const [owner, repo] = repoName.split('/');
        
        set(state => ({
          analysisProgress: new Map(state.analysisProgress).set(repoName, {
            status: 'analyzing',
            progress: 0,
            message: 'Iniciando análise...'
          })
        }));
        
        try {
          await api.analyzeRepository(owner, repo);
          
          set(state => ({
            analysisProgress: new Map(state.analysisProgress).set(repoName, {
              status: 'completed',
              progress: 100,
              message: 'Concluído!'
            })
          }));
        } catch (err) {
          set(state => ({
            analysisProgress: new Map(state.analysisProgress).set(repoName, {
              status: 'error',
              progress: 0,
              message: (err as Error).message
            })
          }));
        }
      }
      
      await get().fetchKnowledgeBases();
    } finally {
      set({ isLoading: false });
    }
  },
  
  analyzeWithFolder: async (repoName, folderPath) => {
    set({ isLoading: true, error: null });
    
    // Nome da análise (repo/pasta)
    const analysisName = `${repoName}/${folderPath}`;
    const [owner, repo] = repoName.split('/');
    
    set(state => ({
      analysisProgress: new Map(state.analysisProgress).set(analysisName, {
        status: 'analyzing',
        progress: 10,
        message: `Analisando "${folderPath}"...`
      })
    }));
    
    try {
      await api.analyzeRepository(owner, repo, folderPath);
      
      // Busca as KBs para verificar se foi criada
      await get().fetchKnowledgeBases();
      const { knowledgeBases } = get();
      
      // Verifica se a KB foi criada com sucesso
      const kbCreated = knowledgeBases.includes(analysisName);
      
      set(state => ({
        analysisProgress: new Map(state.analysisProgress).set(analysisName, {
          status: kbCreated ? 'completed' : 'error',
          progress: kbCreated ? 100 : 0,
          message: kbCreated ? 'Concluído!' : 'Erro ao gerar KB'
        })
      }));
      
    } catch (err) {
      // Mesmo com erro, verifica se a KB foi criada
      await get().fetchKnowledgeBases();
      const { knowledgeBases } = get();
      const kbCreated = knowledgeBases.includes(analysisName);
      
      if (kbCreated) {
        set(state => ({
          analysisProgress: new Map(state.analysisProgress).set(analysisName, {
            status: 'completed',
            progress: 100,
            message: 'Concluído!'
          })
        }));
      } else {
        set(state => ({
          analysisProgress: new Map(state.analysisProgress).set(analysisName, {
            status: 'error',
            progress: 0,
            message: (err as Error).message
          })
        }));
        set({ error: (err as Error).message });
      }
    } finally {
      set({ isLoading: false });
    }
  },
  
  analyzeMultipleFolders: async (selections) => {
    if (selections.length === 0) return;
    
    set({ isLoading: true, error: null });
    
    // Inicializa progresso para todas as seleções
    const newProgress = new Map(get().analysisProgress);
    for (const sel of selections) {
      const analysisName = `${sel.repository}/${sel.folderPath}`;
      newProgress.set(analysisName, {
        status: 'pending',
        progress: 0,
        message: 'Aguardando...'
      });
    }
    set({ analysisProgress: newProgress });
    
    // Processa cada pasta em sequência
    for (let i = 0; i < selections.length; i++) {
      const sel = selections[i];
      const analysisName = `${sel.repository}/${sel.folderPath}`;
      const [owner, repo] = sel.repository.split('/');
      
      // Atualiza status para "analyzing"
      set(state => ({
        analysisProgress: new Map(state.analysisProgress).set(analysisName, {
          status: 'analyzing',
          progress: 5,
          message: `Iniciando análise de "${sel.folderPath}" (${i + 1}/${selections.length})...`
        })
      }));
      
      // Inicia polling do status
      let pollingInterval: NodeJS.Timeout | null = null;
      let analysisComplete = false;
      
      const pollStatus = async () => {
        try {
          const status = await api.getAnalysisStatus(owner, repo, sel.folderPath);
          if (status && !analysisComplete) {
            set(state => ({
              analysisProgress: new Map(state.analysisProgress).set(analysisName, {
                status: status.status,
                progress: status.progress,
                message: status.message
              })
            }));
          }
        } catch (e) {
          // Ignora erros de polling
        }
      };
      
      // Inicia polling a cada 1.5 segundos
      pollingInterval = setInterval(pollStatus, 1500);
      
      try {
        // Faz primeira chamada de status
        await pollStatus();
        
        // Aguarda a análise
        await api.analyzeRepository(owner, repo, sel.folderPath);
        
        analysisComplete = true;
        if (pollingInterval) clearInterval(pollingInterval);
        
        // Verifica se KB foi criada
        await get().fetchKnowledgeBases();
        const { knowledgeBases } = get();
        const kbCreated = knowledgeBases.includes(analysisName);
        
        set(state => ({
          analysisProgress: new Map(state.analysisProgress).set(analysisName, {
            status: kbCreated ? 'completed' : 'error',
            progress: kbCreated ? 100 : 0,
            message: kbCreated ? 'Concluído!' : 'Erro ao gerar KB'
          })
        }));
        
      } catch (err) {
        analysisComplete = true;
        if (pollingInterval) clearInterval(pollingInterval);
        
        // Mesmo com erro, verifica se a KB foi criada
        await get().fetchKnowledgeBases();
        const { knowledgeBases } = get();
        const kbCreated = knowledgeBases.includes(analysisName);
        
        set(state => ({
          analysisProgress: new Map(state.analysisProgress).set(analysisName, {
            status: kbCreated ? 'completed' : 'error',
            progress: kbCreated ? 100 : 0,
            message: kbCreated ? 'Concluído!' : (err as Error).message
          })
        }));
      }
    }
    
    // Atualiza KBs no final
    await get().fetchKnowledgeBases();
    set({ isLoading: false });
  },
  
  fetchKnowledgeBases: async () => {
    try {
      const kbs = await api.listKnowledgeBases();
      set({ knowledgeBases: kbs });
    } catch (err) {
      console.error('Error fetching knowledge bases:', err);
    }
  },
  
  loadKnowledgeBase: async (kbName) => {
    set({ isLoading: true, error: null });
    try {
      // kbName pode ser "owner/repo" ou "owner/repo/folder"
      const parts = kbName.split('/');
      const owner = parts[0];
      const repo = parts[1];
      const folderPath = parts.slice(2).join('/') || undefined;
      
      const kb = await api.getKnowledgeBase(owner, repo, folderPath);
      set({ currentKB: kb });
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  sendMessage: async (message) => {
    const { knowledgeBases, chatMode, useRag } = get();
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    
    set(state => ({
      messages: [...state.messages, userMessage],
      isChatLoading: true,
      error: null
    }));
    
    const assistantId = (Date.now() + 1).toString();
    
    set(state => ({
      messages: [...state.messages, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }]
    }));
    
    try {
      // Usa RAG se ativado, senão usa chat tradicional
      if (useRag) {
        await api.chatRagStream(
          message,
          chatMode,
          (chunk) => {
            set(state => ({
              messages: state.messages.map(m => 
                m.id === assistantId 
                  ? { ...m, content: m.content + chunk }
                  : m
              )
            }));
          },
          (error) => {
            set(state => ({
              messages: state.messages.map(m => 
                m.id === assistantId 
                  ? { ...m, content: `Erro: ${error}` }
                  : m
              )
            }));
          }
        );
      } else {
        await api.chatStream(
          message, 
          knowledgeBases, 
          chatMode,
          (chunk) => {
            set(state => ({
              messages: state.messages.map(m => 
                m.id === assistantId 
                  ? { ...m, content: m.content + chunk }
                  : m
              )
            }));
          },
          (error) => {
            set(state => ({
              messages: state.messages.map(m => 
                m.id === assistantId 
                  ? { ...m, content: `Erro: ${error}` }
                  : m
              )
            }));
          }
        );
      }
    } catch (err) {
      // Error already handled by onError callback
      const errorMsg = (err as Error).message;
      set(state => ({
        messages: state.messages.map(m => 
          m.id === assistantId && !m.content
            ? { ...m, content: `Erro: ${errorMsg}` }
            : m
        )
      }));
    } finally {
      set({ isChatLoading: false });
    }
  },
  
  setChatMode: (mode) => {
    set({ chatMode: mode });
  },
  
  setUseRag: (useRag) => {
    set({ useRag });
  },
  
  clearChat: () => {
    set({ messages: [] });
  },
  
  clearError: () => {
    set({ error: null });
  }
}));
