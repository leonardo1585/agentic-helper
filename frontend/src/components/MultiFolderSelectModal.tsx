import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Folder,
  Check,
  Loader2,
  FileCode,
  Play,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GitBranch
} from 'lucide-react';
import { api } from '../services/api';

interface FolderInfo {
  name: string;
  path: string;
  depth: number;
  code_files: number;
}

interface RepoFolders {
  repository: string;
  folders: FolderInfo[];
  isLoading: boolean;
  isExpanded: boolean;
  error?: string;
}

interface SelectedFolder {
  repository: string;
  folderPath: string;
  folderName: string;
}

interface MultiFolderSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  repositories: string[];
  onAnalyze: (selections: SelectedFolder[]) => void;
}

export function MultiFolderSelectModal({ 
  isOpen, 
  onClose, 
  repositories,
  onAnalyze 
}: MultiFolderSelectModalProps) {
  const [repoFolders, setRepoFolders] = useState<RepoFolders[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<SelectedFolder[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  useEffect(() => {
    if (isOpen && repositories.length > 0) {
      loadAllFolders();
    }
  }, [isOpen, repositories]);
  
  // Reset quando fechar
  useEffect(() => {
    if (!isOpen) {
      setSelectedFolders([]);
      setRepoFolders([]);
    }
  }, [isOpen]);
  
  const loadAllFolders = async () => {
    setIsInitialLoading(true);
    
    // Inicializa estado para cada repositório
    const initialState: RepoFolders[] = repositories.map(repo => ({
      repository: repo,
      folders: [],
      isLoading: true,
      isExpanded: true, // Todos expandidos por padrão
    }));
    setRepoFolders(initialState);
    
    // Carrega pastas de cada repositório em paralelo
    const promises = repositories.map(async (repo, index) => {
      try {
        const [owner, repoName] = repo.split('/');
        const result = await api.listFolders(owner, repoName);
        // Mostra todas as pastas com pelo menos 1 arquivo de código
        const validFolders = result.folders.filter(f => f.code_files >= 1);
        
        setRepoFolders(prev => prev.map((r, i) => 
          i === index 
            ? { ...r, folders: validFolders, isLoading: false }
            : r
        ));
      } catch (err) {
        setRepoFolders(prev => prev.map((r, i) => 
          i === index 
            ? { ...r, isLoading: false, error: (err as Error).message }
            : r
        ));
      }
    });
    
    await Promise.all(promises);
    setIsInitialLoading(false);
  };
  
  const toggleRepoExpanded = (index: number) => {
    setRepoFolders(prev => prev.map((r, i) => 
      i === index ? { ...r, isExpanded: !r.isExpanded } : r
    ));
  };
  
  const toggleFolderSelection = (repository: string, folder: FolderInfo) => {
    setSelectedFolders(prev => {
      const exists = prev.find(
        s => s.repository === repository && s.folderPath === folder.path
      );
      
      if (exists) {
        return prev.filter(
          s => !(s.repository === repository && s.folderPath === folder.path)
        );
      } else {
        return [...prev, {
          repository,
          folderPath: folder.path,
          folderName: folder.name
        }];
      }
    });
  };
  
  const isFolderSelected = (repository: string, folderPath: string) => {
    return selectedFolders.some(
      s => s.repository === repository && s.folderPath === folderPath
    );
  };
  
  const selectAllFromRepo = (repository: string, folders: FolderInfo[]) => {
    const repoSelections = folders.map(f => ({
      repository,
      folderPath: f.path,
      folderName: f.name
    }));
    
    // Remove todas do repo e adiciona todas novamente
    setSelectedFolders(prev => {
      const withoutRepo = prev.filter(s => s.repository !== repository);
      const currentRepoCount = prev.filter(s => s.repository === repository).length;
      
      // Se já tinha todas selecionadas, remove todas
      if (currentRepoCount === folders.length) {
        return withoutRepo;
      }
      
      // Senão, seleciona todas
      return [...withoutRepo, ...repoSelections];
    });
  };
  
  const handleAnalyze = () => {
    if (selectedFolders.length > 0) {
      onAnalyze(selectedFolders);
    }
  };
  
  const getSelectedCountForRepo = (repository: string) => {
    return selectedFolders.filter(s => s.repository === repository).length;
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-[#00DED2]/5 to-purple-500/5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Selecione as Pastas para Analisar
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {repositories.length} repositório(s) • {selectedFolders.length} pasta(s) selecionada(s)
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {isInitialLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#00DED2]" />
                <p className="text-sm text-gray-500 mt-3">Carregando pastas dos repositórios...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {repoFolders.map((repoData, repoIndex) => {
                  const selectedCount = getSelectedCountForRepo(repoData.repository);
                  const allSelected = selectedCount === repoData.folders.length && repoData.folders.length > 0;
                  
                  return (
                    <div 
                      key={repoData.repository}
                      className="border border-gray-200 rounded-xl overflow-hidden"
                    >
                      {/* Repo Header */}
                      <div 
                        className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${
                          selectedCount > 0 ? 'bg-[#00DED2]/5' : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => toggleRepoExpanded(repoIndex)}
                      >
                        <button className="text-gray-400">
                          {repoData.isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>
                        
                        <GitBranch className="w-5 h-5 text-[#00DED2]" />
                        
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-900">{repoData.repository}</span>
                          {repoData.isLoading && (
                            <Loader2 className="w-4 h-4 inline-block ml-2 animate-spin text-gray-400" />
                          )}
                        </div>
                        
                        {repoData.folders.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllFromRepo(repoData.repository, repoData.folders);
                            }}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${
                              allSelected 
                                ? 'bg-[#00DED2] text-gray-900' 
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {allSelected ? 'Desmarcar Todas' : 'Selecionar Todas'}
                          </button>
                        )}
                        
                        {selectedCount > 0 && (
                          <span className="px-2 py-0.5 bg-[#00DED2] text-gray-900 text-xs font-medium rounded-full">
                            {selectedCount}
                          </span>
                        )}
                      </div>
                      
                      {/* Folders List */}
                      <AnimatePresence>
                        {repoData.isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-3 pt-0 space-y-2">
                              {repoData.error ? (
                                <div className="p-3 text-red-500 text-sm flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  {repoData.error}
                                </div>
                              ) : repoData.isLoading ? (
                                <div className="p-3 text-gray-400 text-sm">
                                  Carregando pastas...
                                </div>
                              ) : repoData.folders.length === 0 ? (
                                <div className="p-3 text-gray-400 text-sm flex items-center gap-2">
                                  <Folder className="w-4 h-4" />
                                  Nenhuma pasta com código encontrada
                                </div>
                              ) : (
                                repoData.folders.map((folder) => {
                                  const isSelected = isFolderSelected(repoData.repository, folder.path);
                                  
                                  return (
                                    <button
                                      key={folder.path}
                                      onClick={() => toggleFolderSelection(repoData.repository, folder)}
                                      className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-3 ${
                                        isSelected
                                          ? 'bg-[#00DED2]/10 border border-[#00DED2]'
                                          : 'bg-white border border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                                        isSelected 
                                          ? 'bg-[#00DED2] text-gray-900' 
                                          : 'bg-gray-100 border border-gray-300'
                                      }`}>
                                        {isSelected && <Check className="w-3 h-3" />}
                                      </div>
                                      
                                      <Folder className={`w-4 h-4 flex-shrink-0 ${
                                        isSelected ? 'text-[#00DED2]' : 'text-gray-400'
                                      }`} />
                                      
                                      <div className="flex-1 min-w-0">
                                        <span className="font-medium text-gray-900 block">
                                          {folder.name}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono truncate block">
                                          {folder.path}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-500 flex-shrink-0">
                                        <FileCode className="w-3 h-3" />
                                        {folder.code_files}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Selected Summary */}
          {selectedFolders.length > 0 && (
            <div className="px-5 py-3 bg-[#00DED2]/5 border-t border-[#00DED2]/20">
              <div className="flex flex-wrap gap-2">
                {selectedFolders.slice(0, 5).map((sel, i) => (
                  <span 
                    key={i}
                    className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-700 border border-gray-200"
                  >
                    {sel.repository.split('/')[1]}/{sel.folderName}
                  </span>
                ))}
                {selectedFolders.length > 5 && (
                  <span className="px-2 py-1 bg-gray-200 rounded text-xs text-gray-500">
                    +{selectedFolders.length - 5} mais
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Footer */}
          <div className="p-5 border-t border-gray-200 bg-gray-50 flex gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleAnalyze}
              disabled={isInitialLoading || selectedFolders.length === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Analisar {selectedFolders.length > 0 ? `${selectedFolders.length} pasta(s)` : ''}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

