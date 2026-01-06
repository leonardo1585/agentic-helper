"""
Serviço de Vector Store para busca semântica de agentes.
Usa ChromaDB para armazenamento local e embeddings para busca.
"""
import json
from typing import List, Dict, Optional, Any
from pathlib import Path
import hashlib

from ..core import settings


class VectorService:
    """Serviço para indexação e busca semântica de agentes."""
    
    def __init__(self):
        self._client = None
        self._collection = None
        self._embedding_fn = None
        self._initialized = False
    
    def _initialize(self):
        """Inicializa ChromaDB e modelo de embeddings."""
        if self._initialized:
            return
        
        try:
            import chromadb
            from chromadb.config import Settings
            
            # Diretório para persistência
            persist_dir = settings.REPOS_BASE_DIR.parent / "vector_db"
            persist_dir.mkdir(parents=True, exist_ok=True)
            
            # Cliente ChromaDB com persistência
            self._client = chromadb.PersistentClient(
                path=str(persist_dir),
                settings=Settings(anonymized_telemetry=False)
            )
            
            # Cria ou obtém a coleção de agentes
            self._collection = self._client.get_or_create_collection(
                name="agents",
                metadata={"description": "Agentes de repositórios analisados"}
            )
            
            self._initialized = True
            print(f"✅ Vector Store inicializado em {persist_dir}")
            
        except Exception as e:
            print(f"⚠️ Erro ao inicializar Vector Store: {e}")
            raise
    
    def _generate_embedding(self, text: str) -> List[float]:
        """Gera embedding para um texto usando sentence-transformers."""
        if self._embedding_fn is None:
            try:
                from sentence_transformers import SentenceTransformer
                # Modelo leve e eficiente para português/inglês
                self._embedding_fn = SentenceTransformer('all-MiniLM-L6-v2')
                print("✅ Modelo de embeddings carregado")
            except Exception as e:
                print(f"⚠️ Erro ao carregar modelo de embeddings: {e}")
                raise
        
        embedding = self._embedding_fn.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    
    def _create_agent_document(self, kb_name: str, kb_data: dict) -> dict:
        """Cria documento indexável a partir de uma knowledge base."""
        technical = kb_data.get("technical", {}) or {}
        business = kb_data.get("business", {}) or {}
        
        # Extrai informações relevantes para busca
        parts = kb_name.split("/")
        repo_name = f"{parts[0]}/{parts[1]}" if len(parts) >= 2 else kb_name
        folder_name = parts[-1] if len(parts) > 2 else parts[-1]
        
        # Cria texto rico para embedding
        text_parts = [
            f"Agente: {folder_name}",
            f"Repositório: {repo_name}",
        ]
        
        if technical:
            if technical.get("technical_summary"):
                text_parts.append(f"Resumo técnico: {technical['technical_summary']}")
            
            if technical.get("technologies"):
                text_parts.append(f"Tecnologias: {', '.join(technical['technologies'][:10])}")
            
            # APIs EXPOSTAS pelo agente (endpoints que ele oferece)
            api_endpoints = technical.get("api_endpoints", [])
            if api_endpoints:
                endpoint_descriptions = []
                for ep in api_endpoints[:10]:
                    if isinstance(ep, dict):
                        method = ep.get("method", "")
                        path = ep.get("path", "")
                        desc = ep.get("description", "")
                        endpoint_descriptions.append(f"{method} {path}: {desc}")
                    elif isinstance(ep, str):
                        endpoint_descriptions.append(ep)
                if endpoint_descriptions:
                    text_parts.append(f"APIs expostas: {'; '.join(endpoint_descriptions)}")
            
            # APIs externas CONSUMIDAS (serviços externos que o agente usa)
            external_apis = technical.get("external_apis_consumed", [])
            if external_apis:
                api_details = []
                for api in external_apis[:10]:
                    if isinstance(api, dict):
                        name = api.get("name", "")
                        purpose = api.get("purpose", "")
                        endpoints = api.get("endpoints_used", [])
                        detail = f"{name}"
                        if purpose:
                            detail += f" ({purpose})"
                        if endpoints:
                            detail += f" - endpoints: {', '.join(endpoints[:3])}"
                        api_details.append(detail)
                    elif isinstance(api, str):
                        api_details.append(api)
                if api_details:
                    text_parts.append(f"APIs externas consumidas: {'; '.join(api_details)}")
            
            # Integrações
            integrations = technical.get("integrations", [])
            if integrations:
                int_details = []
                for intg in integrations[:10]:
                    if isinstance(intg, dict):
                        name = intg.get("name", "")
                        desc = intg.get("description", "")
                        int_details.append(f"{name}: {desc}" if desc else name)
                    elif isinstance(intg, str):
                        int_details.append(intg)
                if int_details:
                    text_parts.append(f"Integrações: {'; '.join(int_details)}")
            
            # Serviços
            services = technical.get("services", [])
            if services:
                svc_details = []
                for svc in services[:10]:
                    if isinstance(svc, dict):
                        name = svc.get("name", "")
                        desc = svc.get("description", "")
                        svc_details.append(f"{name}: {desc}" if desc else name)
                    elif isinstance(svc, str):
                        svc_details.append(svc)
                if svc_details:
                    text_parts.append(f"Serviços: {'; '.join(svc_details)}")
            
            # Regras de negócio
            rules = technical.get("business_rules", [])
            if rules:
                rule_details = []
                for rule in rules[:10]:
                    if isinstance(rule, dict):
                        name = rule.get("name", "")
                        desc = rule.get("description", "")
                        rule_details.append(f"{name}: {desc}" if desc else name)
                    elif isinstance(rule, str):
                        rule_details.append(rule)
                if rule_details:
                    text_parts.append(f"Regras de negócio: {'; '.join(rule_details)}")
        
        if business:
            if business.get("product_description"):
                text_parts.append(f"Descrição do produto: {business['product_description']}")
            
            if business.get("main_features"):
                features = business["main_features"][:10]
                if features and isinstance(features[0], str):
                    text_parts.append(f"Funcionalidades principais: {'; '.join(features)}")
            
            if business.get("use_cases"):
                cases = business["use_cases"][:10]
                if cases and isinstance(cases[0], str):
                    text_parts.append(f"Casos de uso: {'; '.join(cases)}")
        
        document_text = "\n".join(text_parts)
        
        return {
            "id": hashlib.md5(kb_name.encode()).hexdigest(),
            "text": document_text,
            "metadata": {
                "kb_name": kb_name,
                "repo_name": repo_name,
                "folder_name": folder_name,
                "has_technical": bool(technical),
                "has_business": bool(business),
            }
        }
    
    def index_agent(self, kb_name: str, kb_data: dict) -> bool:
        """Indexa um agente no vector store."""
        self._initialize()
        
        try:
            doc = self._create_agent_document(kb_name, kb_data)
            embedding = self._generate_embedding(doc["text"])
            
            # Upsert no ChromaDB
            self._collection.upsert(
                ids=[doc["id"]],
                documents=[doc["text"]],
                embeddings=[embedding],
                metadatas=[doc["metadata"]]
            )
            
            print(f"✅ Agente indexado: {kb_name}")
            return True
            
        except Exception as e:
            print(f"❌ Erro ao indexar {kb_name}: {e}")
            return False
    
    def index_all_agents(self, knowledge_bases: Dict[str, dict]) -> dict:
        """Indexa todos os agentes de uma vez."""
        self._initialize()
        
        results = {"success": 0, "failed": 0, "agents": []}
        
        for kb_name, kb_data in knowledge_bases.items():
            try:
                doc = self._create_agent_document(kb_name, kb_data)
                embedding = self._generate_embedding(doc["text"])
                
                self._collection.upsert(
                    ids=[doc["id"]],
                    documents=[doc["text"]],
                    embeddings=[embedding],
                    metadatas=[doc["metadata"]]
                )
                
                results["success"] += 1
                results["agents"].append(kb_name)
                
            except Exception as e:
                print(f"❌ Erro ao indexar {kb_name}: {e}")
                results["failed"] += 1
        
        print(f"✅ Indexação concluída: {results['success']} sucesso, {results['failed']} falhas")
        return results
    
    def search_similar_agents(
        self, 
        query: str, 
        n_results: int = 5,
        min_similarity: float = 0.3
    ) -> List[dict]:
        """Busca agentes similares a uma descrição."""
        self._initialize()
        
        try:
            query_embedding = self._generate_embedding(query)
            
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                include=["documents", "metadatas", "distances"]
            )
            
            agents = []
            if results and results["ids"] and results["ids"][0]:
                for i, id_ in enumerate(results["ids"][0]):
                    distance = results["distances"][0][i] if results["distances"] else 1.0
                    # ChromaDB usa distância L2, convertemos para similaridade
                    similarity = 1 / (1 + distance)
                    
                    if similarity >= min_similarity:
                        agents.append({
                            "kb_name": results["metadatas"][0][i]["kb_name"],
                            "repo_name": results["metadatas"][0][i]["repo_name"],
                            "folder_name": results["metadatas"][0][i]["folder_name"],
                            "similarity": round(similarity, 3),
                            "document": results["documents"][0][i]
                        })
            
            return agents
            
        except Exception as e:
            print(f"❌ Erro na busca: {e}")
            return []
    
    def get_relevant_context(
        self, 
        query: str, 
        n_results: int = 3,
        max_tokens: int = 4000
    ) -> str:
        """Retorna contexto relevante para RAG."""
        agents = self.search_similar_agents(query, n_results=n_results)
        
        if not agents:
            return "Nenhum agente encontrado na base de conhecimento."
        
        context_parts = []
        total_chars = 0
        max_chars = max_tokens * 4  # Aproximadamente 4 chars por token
        
        for agent in agents:
            agent_text = f"""
## Agente: {agent['folder_name']} (Similaridade: {agent['similarity']:.0%})
Repositório: {agent['repo_name']}

{agent['document']}
"""
            if total_chars + len(agent_text) > max_chars:
                break
            
            context_parts.append(agent_text)
            total_chars += len(agent_text)
        
        return "\n---\n".join(context_parts)
    
    def get_stats(self) -> dict:
        """Retorna estatísticas do vector store."""
        self._initialize()
        
        try:
            count = self._collection.count()
            return {
                "total_agents": count,
                "collection_name": "agents",
                "initialized": self._initialized
            }
        except Exception as e:
            return {
                "error": str(e),
                "initialized": self._initialized
            }
    
    def clear_index(self):
        """Limpa todo o índice."""
        self._initialize()
        
        try:
            # Deleta e recria a coleção
            self._client.delete_collection("agents")
            self._collection = self._client.create_collection(
                name="agents",
                metadata={"description": "Agentes de repositórios analisados"}
            )
            print("✅ Índice limpo")
            return True
        except Exception as e:
            print(f"❌ Erro ao limpar índice: {e}")
            return False


# Instância global
vector_service = VectorService()

