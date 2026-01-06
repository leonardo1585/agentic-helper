import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Folder,
  Check,
  Loader2,
  FileCode,
  Play,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

interface FolderInfo {
  name: string;
  path: string;
  depth: number;
  code_files: number;
}

interface FolderSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  repository: string;
  onAnalyze: (folderPath: string) => void;
}

export function FolderSelectModal({ 
  isOpen, 
  onClose, 
  repository,
  onAnalyze 
}: FolderSelectModalProps) {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen && repository) {
      loadFolders();
    }
  }, [isOpen, repository]);
  
  const loadFolders = async () => {
    setIsLoading(true);
    setError(null);
    setSelectedFolder(null);
    
    try {
      const [owner, repo] = repository.split('/');
      const result = await api.listFolders(owner, repo);
      // Filtra apenas pastas com 2 ou mais arquivos de código
      const validFolders = result.folders.filter(f => f.code_files >= 2);
      setFolders(validFolders);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAnalyze = () => {
    if (selectedFolder) {
      onAnalyze(selectedFolder);
    }
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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-[#00DED2]/5 to-purple-500/5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Selecione uma Pasta para Analisar
                </h2>
                <p className="text-sm text-gray-500 mt-0.5 font-mono">
                  {repository}
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
          <div className="p-5 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#00DED2]" />
                <p className="text-sm text-gray-500 mt-3">Carregando pastas do repositório...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="w-10 h-10 mx-auto text-red-400 mb-3" />
                <p className="text-red-500">{error}</p>
              </div>
            ) : folders.length === 0 ? (
              <div className="text-center py-12">
                <Folder className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Nenhuma pasta com código encontrada</p>
                <p className="text-sm text-gray-400 mt-1">
                  Certifique-se que o repositório contém pastas com arquivos de código
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Selecione a pasta que contém o agente/projeto que deseja analisar
                </p>
                
                {folders.map((folder) => (
                  <button
                    key={folder.path}
                    onClick={() => setSelectedFolder(folder.path)}
                    className={`w-full text-left p-4 rounded-xl transition-all flex items-center gap-4 ${
                      selectedFolder === folder.path
                        ? 'bg-[#00DED2]/10 border-2 border-[#00DED2] shadow-sm'
                        : 'bg-gray-50 border-2 border-transparent hover:border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedFolder === folder.path 
                        ? 'bg-[#00DED2] text-white' 
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {selectedFolder === folder.path ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Folder className="w-4 h-4" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 block">
                        {folder.name}
                      </span>
                      <p className="text-xs text-gray-500 font-mono truncate">
                        {folder.path}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-600 flex-shrink-0">
                      <FileCode className="w-3.5 h-3.5 text-[#00DED2]" />
                      <span className="font-medium">{folder.code_files}</span>
                      <span className="text-gray-400">arquivos</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-5 border-t border-gray-200 bg-gray-50 flex gap-3">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !selectedFolder}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {selectedFolder ? `Analisar "${selectedFolder.split('/').pop()}"` : 'Selecione uma pasta'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
