"""
Serviço do Agente de Análise de Repositórios.
"""
import asyncio
from pathlib import Path
from typing import List, Dict, Optional, AsyncGenerator
from datetime import datetime
import json
import os

from ..models import (
    KnowledgeBase, 
    TechnicalKnowledgeBase,
    BusinessKnowledgeBase,
    FileAnalysis, 
    ServiceInfo, 
    IntegrationInfo,
    BusinessRule,
    APIEndpoint,
    ExternalAPIConsumed,
    AnalysisStatus
)
from ..core import settings
from .ai_service import ai_service
from .github_service import github_service
from .metrics_service import metrics_service
import time


class AgentService:
    """Agente para análise de repositórios e geração de base de conhecimento."""
    
    def __init__(self):
        self.knowledge_bases: Dict[str, KnowledgeBase] = {}
        self.analysis_status: Dict[str, AnalysisStatus] = {}
        self._load_knowledge_bases()
    
    def _get_kb_file_path(self) -> Path:
        """Retorna o caminho do arquivo de knowledge bases."""
        return settings.REPOS_BASE_DIR.parent / "knowledge_bases.json"
    
    def _load_knowledge_bases(self):
        """Carrega knowledge bases salvas."""
        kb_file = self._get_kb_file_path()
        if kb_file.exists():
            try:
                with open(kb_file, "r") as f:
                    data = json.load(f)
                    for name, kb_data in data.items():
                        # Handle nested technical/business KBs
                        if "technical" in kb_data and kb_data["technical"]:
                            tech_data = kb_data["technical"]
                            # Convert old format external_apis_consumed (list of strings) to new format
                            if "external_apis_consumed" in tech_data:
                                converted_apis = []
                                for api in tech_data["external_apis_consumed"]:
                                    if isinstance(api, str):
                                        converted_apis.append({"name": api})
                                    else:
                                        converted_apis.append(api)
                                tech_data["external_apis_consumed"] = converted_apis
                            kb_data["technical"] = TechnicalKnowledgeBase(**tech_data)
                        if "business" in kb_data and kb_data["business"]:
                            kb_data["business"] = BusinessKnowledgeBase(**kb_data["business"])
                        self.knowledge_bases[name] = KnowledgeBase(**kb_data)
            except Exception as e:
                print(f"Erro ao carregar KBs: {e}")
                import traceback
                traceback.print_exc()
    
    def _save_knowledge_bases(self):
        """Salva knowledge bases."""
        kb_file = self._get_kb_file_path()
        kb_file.parent.mkdir(parents=True, exist_ok=True)
        
        data = {}
        for name, kb in self.knowledge_bases.items():
            kb_dict = kb.model_dump(mode="json")
            data[name] = kb_dict
        
        with open(kb_file, "w") as f:
            json.dump(data, f, indent=2, default=str)
    
    def _should_analyze_file(self, file_path: Path) -> bool:
        """Verifica se um arquivo deve ser analisado."""
        try:
            if file_path.stat().st_size > settings.MAX_FILE_SIZE:
                return False
        except OSError:
            return False
        
        if file_path.suffix.lower() not in settings.SUPPORTED_EXTENSIONS:
            return False
        
        path_str = str(file_path)
        ignore_patterns = [
            "node_modules", "__pycache__", ".git", ".venv", "venv",
            "dist", "build", ".next", ".nuxt", "coverage", ".pytest_cache",
            "vendor", "packages", ".idea", ".vscode"
        ]
        
        for pattern in ignore_patterns:
            if f"/{pattern}/" in path_str or path_str.endswith(f"/{pattern}"):
                return False
        
        return True
    
    def _get_file_language(self, file_path: Path) -> str:
        """Determina a linguagem do arquivo."""
        extension_map = {
            ".py": "python",
            ".js": "javascript",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".jsx": "javascript",
            ".vue": "vue",
            ".java": "java",
            ".go": "go",
            ".rs": "rust",
            ".json": "json",
            ".yaml": "yaml",
            ".yml": "yaml",
            ".md": "markdown",
            ".sql": "sql",
            ".sh": "bash",
        }
        return extension_map.get(file_path.suffix.lower(), "text")
    
    def _collect_files(self, repo_path: Path, folder_path: Optional[str] = None) -> List[Dict]:
        """Coleta arquivos relevantes do repositório ou de uma pasta específica."""
        files = []
        agent_definition = None
        
        # Se folder_path for especificado, analisa apenas essa pasta
        base_path = repo_path / folder_path if folder_path else repo_path
        
        if not base_path.exists():
            return files
        
        for file_path in base_path.rglob("*"):
            if file_path.is_file():
                file_name_lower = file_path.name.lower()
                
                # Detecta agent_definition (pode ser .md, .txt, .json ou sem extensão)
                if "agent_definition" in file_name_lower or "agent-definition" in file_name_lower:
                    try:
                        agent_definition = file_path.read_text(encoding="utf-8", errors="ignore")
                    except Exception:
                        pass
                
                if self._should_analyze_file(file_path):
                    try:
                        content = file_path.read_text(encoding="utf-8", errors="ignore")
                        relative_path = file_path.relative_to(repo_path)
                        
                        files.append({
                            "path": str(relative_path),
                            "content": content,
                            "language": self._get_file_language(file_path),
                            "size": len(content),
                            "is_agent_definition": "agent_definition" in file_name_lower
                        })
                    except Exception:
                        continue
        
        # Se encontrou agent_definition, marca como prioridade máxima
        priority_files = [
            "agent_definition", "agent-definition",  # Prioridade máxima
            "package.json", "requirements.txt", "pyproject.toml", "Cargo.toml",
            "docker-compose.yml", "Dockerfile", "README.md", "readme.md",
            ".env.example", "config.py", "settings.py", "main.py", "index.ts",
            "app.py", "server.py", "api.py"
        ]
        
        def sort_key(f):
            name = Path(f["path"]).name.lower()
            # Agent definition tem prioridade máxima
            if f.get("is_agent_definition"):
                return (-1, 0)
            for i, pf in enumerate(priority_files):
                if pf in name:
                    return (0, i)
            return (1, -f["size"])
        
        files.sort(key=sort_key)
        return files
    
    def _get_agent_definition(self, repo_path: Path, folder_path: Optional[str] = None) -> Optional[str]:
        """Busca e retorna o conteúdo do agent_definition."""
        base_path = repo_path / folder_path if folder_path else repo_path
        
        if not base_path.exists():
            return None
        
        # Possíveis nomes para o arquivo de definição
        possible_names = [
            "agent_definition", "agent_definition.md", "agent_definition.txt", "agent_definition.json",
            "agent-definition", "agent-definition.md", "agent-definition.txt", "agent-definition.json",
            "AGENT_DEFINITION", "AGENT_DEFINITION.md"
        ]
        
        for name in possible_names:
            file_path = base_path / name
            if file_path.exists():
                try:
                    return file_path.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
        
        # Busca recursiva
        for file_path in base_path.rglob("*"):
            if file_path.is_file() and "agent_definition" in file_path.name.lower():
                try:
                    return file_path.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
        
        return None
    
    async def analyze_repository(
        self, 
        repo_full_name: str,
        folder_path: Optional[str] = None,
        generate_technical: bool = True,
        generate_business: bool = True,
        progress_callback: Optional[callable] = None
    ) -> KnowledgeBase:
        """Analisa um repositório (ou pasta específica) e gera a base de conhecimento."""
        
        # Nome único para a análise (repo ou repo/pasta)
        analysis_name = f"{repo_full_name}/{folder_path}" if folder_path else repo_full_name
        
        # Tracking de tempo e métricas
        start_time = time.time()
        files_count = 0
        
        # Reseta contadores de tokens para esta análise
        ai_service.reset_token_counters()
        
        self.analysis_status[analysis_name] = AnalysisStatus(
            repository=analysis_name,
            status="cloning",
            progress=5,
            message="Iniciando análise..."
        )
        
        if progress_callback:
            await progress_callback(self.analysis_status[analysis_name])
        
        # Clona o repositório
        owner, repo = repo_full_name.split("/")
        repo_info = await github_service.get_repository(owner, repo)
        
        repo_path = settings.REPOS_BASE_DIR / repo_full_name.replace("/", "_")
        
        success = github_service.clone_repository(
            repo_info.clone_url,
            repo_path
        )
        
        if not success:
            self.analysis_status[analysis_name] = AnalysisStatus(
                repository=analysis_name,
                status="error",
                progress=0,
                message="Erro ao clonar repositório"
            )
            raise Exception("Erro ao clonar repositório")
        
        self.analysis_status[analysis_name] = AnalysisStatus(
            repository=analysis_name,
            status="analyzing",
            progress=15,
            message=f"Coletando arquivos{' da pasta ' + folder_path if folder_path else ''}..."
        )
        
        if progress_callback:
            await progress_callback(self.analysis_status[analysis_name])
        
        # Coleta arquivos (da pasta específica se informada)
        files = self._collect_files(repo_path, folder_path)
        files_count = len(files)
        
        self.analysis_status[analysis_name] = AnalysisStatus(
            repository=analysis_name,
            status="analyzing",
            progress=20,
            message=f"Encontrados {len(files)} arquivos para análise..."
        )
        
        if progress_callback:
            await progress_callback(self.analysis_status[analysis_name])
        
        technical_kb = None
        business_kb = None
        
        # Gera KB Técnica
        if generate_technical:
            self.analysis_status[analysis_name] = AnalysisStatus(
                repository=analysis_name,
                status="analyzing",
                progress=25,
                message="Preparando análise técnica..."
            )
            
            if progress_callback:
                await progress_callback(self.analysis_status[analysis_name])
            
            self.analysis_status[analysis_name] = AnalysisStatus(
                repository=analysis_name,
                status="analyzing",
                progress=30,
                message="Enviando código para IA (análise técnica)..."
            )
            
            if progress_callback:
                await progress_callback(self.analysis_status[analysis_name])
            
            try:
                tech_start = time.time()
                tech_data = await ai_service.generate_technical_kb(analysis_name, files)
                tech_duration = int((time.time() - tech_start) * 1000)
                
                # Registra uso de tokens para a análise técnica
                input_tokens, output_tokens = ai_service.last_tokens
                if input_tokens > 0 or output_tokens > 0:
                    metrics_service.record_token_usage(
                        operation="technical_analysis",
                        model=ai_service.model or "unknown",
                        provider=str(ai_service.provider_type or "unknown"),
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        duration_ms=tech_duration,
                        repository=repo_full_name,
                        folder=folder_path
                    )
                
                self.analysis_status[analysis_name] = AnalysisStatus(
                    repository=analysis_name,
                    status="analyzing",
                    progress=45,
                    message="Processando resposta técnica da IA..."
                )
                
                if progress_callback:
                    await progress_callback(self.analysis_status[analysis_name])
                
                # Processa external_apis_consumed (pode ser lista de strings ou objetos)
                external_apis = []
                for api in tech_data.get("external_apis_consumed", []):
                    if isinstance(api, str):
                        external_apis.append(ExternalAPIConsumed(name=api))
                    elif isinstance(api, dict):
                        # Normaliza campos (a IA pode usar 'url' em vez de 'name')
                        name = api.get("name") or api.get("url") or api.get("service") or "API"
                        external_apis.append(ExternalAPIConsumed(
                            name=name,
                            base_url=api.get("base_url") or api.get("url"),
                            endpoints_used=api.get("endpoints_used", []),
                            authentication=api.get("authentication"),
                            purpose=api.get("purpose") or api.get("description")
                        ))
                
                # Processa integrations (pode ser lista de strings ou objetos)
                integrations = []
                for i in tech_data.get("integrations", []):
                    if isinstance(i, str):
                        integrations.append(IntegrationInfo(name=i, type="unknown", description=i, endpoints=[], authentication=None))
                    elif isinstance(i, dict):
                        integrations.append(IntegrationInfo(
                            name=i.get("name", ""),
                            type=i.get("type", "unknown"),
                            description=i.get("description", ""),
                            endpoints=i.get("endpoints", []),
                            authentication=i.get("authentication")
                        ))
                
                # Processa api_endpoints (pode ser lista de strings ou objetos com diferentes campos)
                api_endpoints = []
                for ep in tech_data.get("api_endpoints", []):
                    if isinstance(ep, str):
                        api_endpoints.append(APIEndpoint(method="GET", path=ep, description=ep, parameters=[], response_type=None))
                    elif isinstance(ep, dict):
                        # Normaliza campos (a IA pode usar 'url' ou 'endpoint' em vez de 'path')
                        path = ep.get("path") or ep.get("url") or ep.get("endpoint") or ""
                        api_endpoints.append(APIEndpoint(
                            method=ep.get("method", "GET"),
                            path=path,
                            description=ep.get("description", ""),
                            parameters=ep.get("parameters", []),
                            response_type=ep.get("response_type")
                        ))
                
                # Processa services (pode ser lista de strings ou objetos)
                services = []
                for s in tech_data.get("services", []):
                    if isinstance(s, str):
                        services.append(ServiceInfo(name=s, type="unknown", description=s, technologies=[], endpoints=[], integrations=[]))
                    elif isinstance(s, dict):
                        services.append(ServiceInfo(
                            name=s.get("name", ""),
                            type=s.get("type", "unknown"),
                            description=s.get("description", ""),
                            technologies=s.get("technologies", []),
                            endpoints=s.get("endpoints", []),
                            integrations=s.get("integrations", [])
                        ))
                
                # Processa business_rules (pode ser lista de strings ou objetos)
                business_rules = []
                for br in tech_data.get("business_rules", []):
                    if isinstance(br, str):
                        business_rules.append(BusinessRule(name=br, description=br, conditions=[], actions=[], code_location=None))
                    elif isinstance(br, dict):
                        business_rules.append(BusinessRule(
                            name=br.get("name", ""),
                            description=br.get("description", ""),
                            conditions=br.get("conditions", []),
                            actions=br.get("actions", []),
                            code_location=br.get("code_location")
                        ))
                
                # Processa handlers_detail (NOVO)
                handlers_detail = tech_data.get("handlers_detail", [])
                if not isinstance(handlers_detail, list):
                    handlers_detail = []
                
                # Processa data_sources (NOVO)
                data_sources = tech_data.get("data_sources", [])
                if not isinstance(data_sources, list):
                    data_sources = []
                
                # Processa validation_flows (NOVO)
                validation_flows = tech_data.get("validation_flows", [])
                if not isinstance(validation_flows, list):
                    validation_flows = []
                
                # Processa dependencies (pode vir como lista de objetos ou strings)
                raw_dependencies = tech_data.get("dependencies", [])
                dependencies = []
                if isinstance(raw_dependencies, list):
                    for dep in raw_dependencies:
                        if isinstance(dep, str):
                            dependencies.append(dep)
                        elif isinstance(dep, dict):
                            # Converte objeto para string legível
                            name = dep.get("name", dep.get("dependency", ""))
                            purpose = dep.get("purpose", dep.get("description", ""))
                            if name and purpose:
                                dependencies.append(f"{name}: {purpose}")
                            elif name:
                                dependencies.append(name)
                
                # Processa technologies (pode vir como lista de objetos ou strings)
                raw_technologies = tech_data.get("technologies", [])
                technologies = []
                if isinstance(raw_technologies, list):
                    for tech in raw_technologies:
                        if isinstance(tech, str):
                            technologies.append(tech)
                        elif isinstance(tech, dict):
                            name = tech.get("name", tech.get("technology", ""))
                            if name:
                                technologies.append(name)
                
                technical_kb = TechnicalKnowledgeBase(
                    repository_name=analysis_name,
                    technical_summary=tech_data.get("technical_summary", ""),
                    architecture_diagram=tech_data.get("architecture_diagram", ""),
                    handlers_detail=handlers_detail,
                    data_sources=data_sources,
                    validation_flows=validation_flows,
                    api_endpoints=api_endpoints,
                    external_apis_consumed=external_apis,
                    technologies=technologies,
                    dependencies=dependencies,
                    services=services,
                    integrations=integrations,
                    business_rules=business_rules,
                    validation_rules=tech_data.get("validation_rules", []),
                    code_patterns=tech_data.get("code_patterns", []),
                    naming_conventions=tech_data.get("naming_conventions", []),
                    environment_variables=tech_data.get("environment_variables", []),
                    configuration_files=tech_data.get("configuration_files", []),
                    webhooks=tech_data.get("webhooks", []),
                    technical_documentation=tech_data.get("technical_documentation", ""),
                    generated_at=datetime.now()
                )
            except Exception as e:
                print(f"Erro ao gerar KB técnica: {e}")
                import traceback
                traceback.print_exc()
        
        # Gera KB de Negócio
        if generate_business:
            self.analysis_status[analysis_name] = AnalysisStatus(
                repository=analysis_name,
                status="analyzing",
                progress=55,
                message="Preparando análise de negócio..."
            )
            
            if progress_callback:
                await progress_callback(self.analysis_status[analysis_name])
            
            self.analysis_status[analysis_name] = AnalysisStatus(
                repository=analysis_name,
                status="analyzing",
                progress=60,
                message="Enviando código para IA (análise de negócio)..."
            )
            
            if progress_callback:
                await progress_callback(self.analysis_status[analysis_name])
            
            try:
                biz_start = time.time()
                biz_data = await ai_service.generate_business_kb(analysis_name, files)
                biz_duration = int((time.time() - biz_start) * 1000)
                
                # Registra uso de tokens para a análise de negócio
                input_tokens, output_tokens = ai_service.last_tokens
                if input_tokens > 0 or output_tokens > 0:
                    metrics_service.record_token_usage(
                        operation="business_analysis",
                        model=ai_service.model or "unknown",
                        provider=str(ai_service.provider_type or "unknown"),
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        duration_ms=biz_duration,
                        repository=repo_full_name,
                        folder=folder_path
                    )
                
                self.analysis_status[analysis_name] = AnalysisStatus(
                    repository=analysis_name,
                    status="analyzing",
                    progress=80,
                    message="Processando resposta de negócio da IA..."
                )
                
                if progress_callback:
                    await progress_callback(self.analysis_status[analysis_name])
                
                # Converte campos que podem vir em formato diferente
                def to_string_list(items):
                    """Converte lista de objetos/strings para lista de strings."""
                    if items is None:
                        return []
                    if isinstance(items, dict):
                        # Se for dict, converte para lista de strings
                        return [f"{k}: {v}" for k, v in items.items()]
                    result = []
                    for item in items:
                        if isinstance(item, str):
                            result.append(item)
                        elif isinstance(item, dict):
                            # Tenta extrair descrição ou nome
                            result.append(item.get("description") or item.get("name") or str(item))
                    return result
                
                def to_dict_list(items):
                    """Converte para lista de dicts (para faq/glossary)."""
                    if items is None:
                        return []
                    if isinstance(items, dict):
                        # Se for dict direto, converte para lista de dicts
                        return [{"term": k, "definition": v} for k, v in items.items()]
                    result = []
                    for item in items:
                        if isinstance(item, dict):
                            result.append(item)
                        elif isinstance(item, str):
                            result.append({"term": item, "definition": item})
                    return result
                
                # Processa capabilities (NOVO)
                capabilities = biz_data.get("capabilities", [])
                if not isinstance(capabilities, list):
                    capabilities = []
                
                # Processa detailed_flows (NOVO)
                detailed_flows = biz_data.get("detailed_flows", [])
                if not isinstance(detailed_flows, list):
                    detailed_flows = []
                
                # Processa integrations_summary (pode ser lista de strings ou objetos)
                integrations_summary = []
                for item in biz_data.get("integrations_summary", []):
                    if isinstance(item, str):
                        integrations_summary.append({"system": item, "purpose": item, "data_involved": []})
                    elif isinstance(item, dict):
                        integrations_summary.append(item)
                
                business_kb = BusinessKnowledgeBase(
                    repository_name=analysis_name,
                    product_name=biz_data.get("product_name", repo),
                    product_description=biz_data.get("product_description", ""),
                    capabilities=capabilities,
                    detailed_flows=detailed_flows,
                    main_features=to_string_list(biz_data.get("main_features", [])),
                    use_cases=to_string_list(biz_data.get("use_cases", [])),
                    target_users=to_string_list(biz_data.get("target_users", [])),
                    user_personas=to_string_list(biz_data.get("user_personas", [])),
                    main_flows=to_string_list(biz_data.get("main_flows", [])),
                    integrations_summary=integrations_summary,
                    faq=to_dict_list(biz_data.get("faq", [])),
                    glossary=to_dict_list(biz_data.get("glossary", [])),
                    user_documentation=biz_data.get("user_documentation", ""),
                    generated_at=datetime.now()
                )
            except Exception as e:
                print(f"Erro ao gerar KB de negócio: {e}")
        
        self.analysis_status[analysis_name] = AnalysisStatus(
            repository=analysis_name,
            status="analyzing",
            progress=90,
            message="Finalizando..."
        )
        
        # Cria KB completa
        knowledge_base = KnowledgeBase(
            repository_name=analysis_name,
            technical=technical_kb,
            business=business_kb,
            summary=technical_kb.technical_summary if technical_kb else "",
            architecture_overview=technical_kb.architecture_diagram if technical_kb else "",
            services=technical_kb.services if technical_kb else [],
            integrations=technical_kb.integrations if technical_kb else [],
            technologies=technical_kb.technologies if technical_kb else [],
            documentation=technical_kb.technical_documentation if technical_kb else "",
            generated_at=datetime.now()
        )
        
        # Salva
        self.knowledge_bases[analysis_name] = knowledge_base
        self._save_knowledge_bases()
        
        # Calcula métricas finais
        duration_seconds = int(time.time() - start_time)
        kb_types = []
        if generate_technical:
            kb_types.append("technical")
        if generate_business:
            kb_types.append("business")
        
        # Registra análise no histórico
        try:
            # provider_type pode ser string ou enum
            provider = ai_service.provider_type
            if provider and hasattr(provider, 'value'):
                provider = provider.value
            elif not provider:
                provider = "unknown"
            
            # Captura tokens usados na análise
            input_tokens, output_tokens = ai_service.total_tokens
            total_tokens = input_tokens + output_tokens
            
            # Calcula custo estimado
            estimated_cost = metrics_service.calculate_cost(
                provider=str(provider),
                model=ai_service.model or "unknown",
                input_tokens=input_tokens,
                output_tokens=output_tokens
            )
            
            metrics_service.record_analysis(
                repository=repo_full_name,
                folder=folder_path,
                status="completed",
                kb_types=kb_types,
                model_used=ai_service.model or "unknown",
                provider=str(provider),
                duration_seconds=duration_seconds,
                files_analyzed=files_count,
                tokens_used=total_tokens,
                estimated_cost=estimated_cost
            )
            print(f"✅ Análise registrada: {repo_full_name}/{folder_path} | Tokens: {total_tokens:,} | Custo: ${estimated_cost:.4f}")
        except Exception as e:
            print(f"❌ Erro ao registrar métricas: {e}")
            import traceback
            traceback.print_exc()
        
        self.analysis_status[analysis_name] = AnalysisStatus(
            repository=analysis_name,
            status="completed",
            progress=100,
            message=f"Análise concluída em {duration_seconds}s!"
        )
        
        return knowledge_base
    
    async def analyze_multiple(
        self, 
        repo_names: List[str],
        progress_callback: Optional[callable] = None
    ) -> Dict[str, KnowledgeBase]:
        """Analisa múltiplos repositórios."""
        results = {}
        
        for repo_name in repo_names:
            try:
                kb = await self.analyze_repository(repo_name, progress_callback=progress_callback)
                results[repo_name] = kb
            except Exception as e:
                self.analysis_status[repo_name] = AnalysisStatus(
                    repository=repo_name,
                    status="error",
                    progress=0,
                    message=str(e)
                )
        
        return results
    
    def get_knowledge_base(self, repo_name: str) -> Optional[KnowledgeBase]:
        """Retorna a base de conhecimento de um repositório."""
        return self.knowledge_bases.get(repo_name)
    
    def list_knowledge_bases(self) -> List[str]:
        """Lista todas as bases de conhecimento."""
        return list(self.knowledge_bases.keys())
    
    def get_status(self, repo_name: str) -> Optional[AnalysisStatus]:
        """Retorna o status da análise de um repositório."""
        return self.analysis_status.get(repo_name)
    
    async def chat(
        self, 
        message: str, 
        context_repos: List[str] = [],
        mode: str = "technical"
    ) -> str:
        """Chat com o agente sobre os repositórios."""
        context_parts = []
        
        repos_to_use = context_repos if context_repos else list(self.knowledge_bases.keys())
        
        for repo_name in repos_to_use:
            kb = self.knowledge_bases.get(repo_name)
            if not kb:
                continue
            
            if mode == "technical" and kb.technical:
                tech = kb.technical
                context_parts.append(f"""
## Repositório: {repo_name} (Documentação Técnica)

**Resumo Técnico:** {tech.technical_summary}

**Arquitetura:** {tech.architecture_diagram}

**Tecnologias:** {', '.join(tech.technologies)}

**Dependências:** {', '.join(tech.dependencies[:10])}

**APIs Expostas:**
{chr(10).join([f"- {ep.method} {ep.path}: {ep.description}" for ep in tech.api_endpoints[:10]])}

**APIs Externas Consumidas:** {', '.join(tech.external_apis_consumed[:5])}

**Serviços:**
{chr(10).join([f"- {s.name} ({s.type}): {s.description}" for s in tech.services])}

**Integrações:**
{chr(10).join([f"- {i.name} ({i.type}): {i.description}" for i in tech.integrations])}

**Regras de Negócio:**
{chr(10).join([f"- {br.name}: {br.description}" for br in tech.business_rules])}

**Variáveis de Ambiente:** {', '.join(tech.environment_variables[:10])}
""")
            elif mode == "business" and kb.business:
                biz = kb.business
                context_parts.append(f"""
## Produto: {biz.product_name}

**Descrição:** {biz.product_description}

**Principais Funcionalidades:**
{chr(10).join([f"- {f}" for f in biz.main_features])}

**Casos de Uso:**
{chr(10).join([f"- {u}" for u in biz.use_cases])}

**Usuários:** {', '.join(biz.target_users)}

**Fluxos Principais:**
{chr(10).join([f"- {f}" for f in biz.main_flows])}

**Integrações:** {', '.join(biz.integrations_summary)}

**Perguntas Frequentes:**
{chr(10).join([f"P: {faq.get('question', '')} R: {faq.get('answer', '')}" for faq in biz.faq[:5]])}
""")
            else:
                # Fallback para KB antiga
                context_parts.append(f"""
## Repositório: {kb.repository_name}

**Resumo:** {kb.summary}

**Arquitetura:** {kb.architecture_overview}

**Tecnologias:** {', '.join(kb.technologies)}

**Serviços:**
{chr(10).join([f"- {s.name}: {s.description}" for s in kb.services])}

**Integrações:**
{chr(10).join([f"- {i.name}: {i.description}" for i in kb.integrations])}
""")
        
        context = "\n\n---\n\n".join(context_parts) if context_parts else "Nenhuma base de conhecimento disponível."
        
        if mode == "technical":
            system_prompt = f"""Você é um assistente técnico especializado em desenvolvimento de software.
Você tem acesso às seguintes documentações técnicas:

{context}

Use essas informações para:
- Explicar como o sistema funciona internamente
- Detalhar APIs e endpoints
- Descrever integrações e fluxos de dados
- Explicar regras de negócio implementadas
- Ajudar na criação de novas funcionalidades

Seja técnico e detalhado. Cite trechos de código quando relevante."""
        else:
            system_prompt = f"""Você é um assistente amigável que ajuda pessoas a entender produtos e sistemas.
Você tem acesso às seguintes informações de produtos:

{context}

Use linguagem SIMPLES e ACESSÍVEL para:
- Explicar o que o sistema faz
- Descrever funcionalidades de forma prática
- Responder dúvidas sobre uso
- Dar exemplos do dia a dia

Evite jargões técnicos. Explique como se fosse para alguém que não é da área de tecnologia."""

        chat_start = time.time()
        response = await ai_service.generate(message, system_prompt)
        chat_duration = int((time.time() - chat_start) * 1000)
        
        # Registra uso de tokens para chat
        input_tokens, output_tokens = ai_service.last_tokens
        if input_tokens > 0 or output_tokens > 0:
            metrics_service.record_token_usage(
                operation="chat",
                model=ai_service.model or "unknown",
                provider=str(ai_service.provider_type or "unknown"),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                duration_ms=chat_duration
            )
        
        return response
    
    async def chat_stream(
        self, 
        message: str, 
        context_repos: List[str] = [],
        mode: str = "technical"
    ) -> AsyncGenerator[str, None]:
        """Chat com streaming."""
        context_parts = []
        
        repos_to_use = context_repos if context_repos else list(self.knowledge_bases.keys())
        
        for repo_name in repos_to_use:
            kb = self.knowledge_bases.get(repo_name)
            if kb:
                if mode == "technical" and kb.technical:
                    context_parts.append(f"## {kb.repository_name}\n{kb.technical.technical_summary}\nTecnologias: {', '.join(kb.technical.technologies)}")
                elif mode == "business" and kb.business:
                    context_parts.append(f"## {kb.business.product_name}\n{kb.business.product_description}")
                else:
                    context_parts.append(f"## {kb.repository_name}\n{kb.summary}")
        
        context = "\n".join(context_parts) if context_parts else "Nenhuma base de conhecimento."
        
        if mode == "technical":
            system_prompt = f"""Assistente técnico. Contexto:\n{context}\n\nResponda de forma técnica e detalhada."""
        else:
            system_prompt = f"""Assistente amigável. Contexto:\n{context}\n\nResponda de forma simples e acessível."""

        async for chunk in ai_service.generate_stream(message, system_prompt):
            yield chunk
    
    async def chat_rag(
        self, 
        message: str, 
        mode: str = "technical",
        use_rag: bool = True
    ) -> str:
        """
        Chat usando RAG (Retrieval Augmented Generation).
        Busca automaticamente os agentes relevantes à pergunta.
        """
        from .vector_service import vector_service
        
        if use_rag:
            # Busca contexto relevante via embeddings
            context = vector_service.get_relevant_context(message, n_results=3)
            
            if "Nenhum agente encontrado" in context:
                # Fallback para método tradicional se não houver índice
                return await self.chat(message, mode=mode)
        else:
            # Usa todas as KBs (método antigo)
            return await self.chat(message, mode=mode)
        
        if mode == "technical":
            system_prompt = f"""Você é um especialista em desenvolvimento que conhece profundamente os agentes da empresa.
Use APENAS o contexto abaixo para responder. Se a informação não estiver no contexto, diga que não sabe.

**Contexto dos Agentes Relevantes:**
{context}

**Suas capacidades:**
- Explicar arquitetura e funcionamento dos agentes
- Detalhar APIs, integrações e fluxos
- Identificar agentes que fazem tarefas específicas
- Sugerir se já existe um agente para determinada funcionalidade
- Comparar funcionalidades entre agentes

Seja preciso e cite os agentes pelo nome."""
        else:
            system_prompt = f"""Você é um assistente amigável que ajuda a entender os produtos e sistemas.
Use APENAS o contexto abaixo para responder.

**Produtos/Agentes Disponíveis:**
{context}

Use linguagem simples para explicar o que cada agente faz e como pode ajudar."""

        response = await ai_service.generate(message, system_prompt)
        return response
    
    async def chat_rag_stream(
        self, 
        message: str, 
        mode: str = "technical"
    ) -> AsyncGenerator[str, None]:
        """Chat RAG com streaming."""
        from .vector_service import vector_service
        
        # Busca contexto relevante
        context = vector_service.get_relevant_context(message, n_results=3)
        
        if mode == "technical":
            system_prompt = f"""Especialista em agentes. Contexto:\n{context}\n\nResponda tecnicamente."""
        else:
            system_prompt = f"""Assistente amigável. Contexto:\n{context}\n\nExplique de forma simples."""

        async for chunk in ai_service.generate_stream(message, system_prompt):
            yield chunk
    
    async def find_existing_agent(self, description: str) -> dict:
        """
        Verifica se já existe um agente que faz o que foi descrito.
        Retorna análise detalhada com recomendações.
        """
        from .vector_service import vector_service
        
        # Busca agentes similares
        similar = vector_service.search_similar_agents(description, n_results=5)
        
        if not similar:
            return {
                "found": False,
                "message": "Nenhum agente similar encontrado na base. Você pode criar um novo!",
                "similar_agents": [],
                "recommendation": "criar_novo"
            }
        
        # Usa IA para análise mais profunda
        context = vector_service.get_relevant_context(description, n_results=5)
        
        analysis_prompt = f"""Você é um arquiteto de software experiente analisando se existe um agente que atende uma necessidade específica.

## NECESSIDADE DO USUÁRIO:
{description}

## AGENTES DISPONÍVEIS NA BASE:
{context}

## INSTRUÇÕES DE ANÁLISE:
1. Compare CADA funcionalidade solicitada com as funcionalidades dos agentes existentes
2. Um agente SÓ "atende completamente" se cobre 100% das funcionalidades pedidas
3. Se o agente cobre 70-99%, ele "atende parcialmente"
4. Se cobre menos de 70%, não atende
5. Seja CRITERIOSO: prefira recomendar "criar_novo" se houver dúvida

## RESPONDA APENAS EM JSON VÁLIDO:
{{
    "exists": true se existe agente que atende 100% do pedido,
    "matching_agents": ["agentes que atendem 100% - incluir nome exato"],
    "partial_matches": ["agentes que atendem 70-99% - incluir nome exato"],
    "coverage_percentage": número de 0-100 indicando quanto os melhores agentes cobrem,
    "missing_features": ["funcionalidades que NENHUM agente existente oferece"],
    "recommendation": "reutilizar" (se exists=true) | "estender" (se partial 70%+) | "criar_novo" (se <70%),
    "explanation": "Explicação em português detalhando: 1) O que foi pedido, 2) O que cada agente oferece, 3) Por que a recomendação faz sentido"
}}"""

        try:
            search_start = time.time()
            response = await ai_service.generate(analysis_prompt, """Você é um analista de sistemas criterioso. 
REGRAS:
- Responda APENAS em JSON válido (sem markdown, sem texto extra)
- Seja conservador: na dúvida, recomende criar novo
- Um agente só "atende" se tiver TODAS as funcionalidades pedidas
- Explique claramente o racional da decisão""")
            search_duration = int((time.time() - search_start) * 1000)
            
            # Registra uso de tokens para busca de agentes
            input_tokens, output_tokens = ai_service.last_tokens
            if input_tokens > 0 or output_tokens > 0:
                metrics_service.record_token_usage(
                    operation="agent_search",
                    model=ai_service.model or "unknown",
                    provider=str(ai_service.provider_type or "unknown"),
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    duration_ms=search_duration
                )
            
            import json
            # Tenta extrair JSON da resposta
            response_clean = response.strip()
            if response_clean.startswith("```"):
                response_clean = response_clean.split("```")[1]
                if response_clean.startswith("json"):
                    response_clean = response_clean[4:]
            
            analysis = json.loads(response_clean)
            analysis["similar_agents"] = similar
            return analysis
            
        except Exception as e:
            # Fallback se a IA não retornar JSON válido
            high_similarity = [a for a in similar if a["similarity"] > 0.6]
            return {
                "found": bool(high_similarity),
                "message": f"Encontrei {len(similar)} agentes potencialmente relevantes.",
                "similar_agents": similar,
                "recommendation": "verificar" if high_similarity else "criar_novo"
            }
    
    def _decode_escaped_json(self, text: str) -> str:
        """Decodifica JSON escapado (com \\\" em vez de \")."""
        if not text:
            return text
        
        # Remove prefixo "text :" se existir
        if text.strip().startswith('text'):
            text = text.strip()
            if ':' in text:
                text = text.split(':', 1)[1].strip()
        
        # Remove aspas externas se existirem
        text = text.strip()
        if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
            text = text[1:-1]
        
        # Decodifica escapes
        try:
            # Tenta decodificar como string JSON escapada
            import codecs
            decoded = codecs.decode(text, 'unicode_escape')
            
            # Verifica se é um JSON válido após decodificação
            json.loads(decoded)
            return decoded
        except:
            pass
        
        # Tenta substituição manual de escapes comuns
        try:
            decoded = text.replace('\\"', '"').replace('\\n', '\n').replace('\\t', '\t').replace('\\\\', '\\')
            json.loads(decoded)
            return decoded
        except:
            pass
        
        # Retorna original se não conseguir decodificar
        return text
    
    async def debug_problem(
        self,
        repository: str,
        folder_path: str,
        problem_description: str,
        output_json: Optional[str] = None
    ) -> dict:
        """
        Investiga um problema reportado, analisando:
        - O agent_definition (instruções do agente)
        - O código Python
        - O JSON de retorno (se fornecido)
        """
        # Decodifica JSON se estiver escapado
        if output_json:
            output_json = self._decode_escaped_json(output_json)
        
        # Monta o nome completo
        analysis_name = f"{repository}/{folder_path}" if folder_path else repository
        
        # Busca a base de conhecimento existente
        kb = self.knowledge_bases.get(analysis_name)
        
        # Busca o agent_definition
        owner, repo = repository.split("/")
        local_path = settings.REPOS_BASE_DIR / f"{owner}_{repo}"
        
        agent_definition = None
        code_snippets = []
        
        if local_path.exists():
            agent_definition = self._get_agent_definition(local_path, folder_path)
            
            # Coleta código relevante
            files = self._collect_files(local_path, folder_path)
            # Filtra apenas arquivos Python
            python_files = [f for f in files if f["language"] == "python"][:20]
            code_snippets = [{"path": f["path"], "content": f["content"][:3000]} for f in python_files]
        
        # Monta contexto para a IA investigar
        context_parts = []
        
        if agent_definition:
            context_parts.append(f"""
## INSTRUÇÕES DO AGENTE (agent_definition):
```
{agent_definition[:5000]}
```
""")
        
        if kb and kb.technical:
            context_parts.append(f"""
## BASE DE CONHECIMENTO TÉCNICA:
**Resumo:** {kb.technical.technical_summary}

**Handlers/Funções:**
{json.dumps(kb.technical.handlers_detail[:10], indent=2, ensure_ascii=False) if kb.technical.handlers_detail else 'Não disponível'}

**Fontes de Dados:**
{json.dumps(kb.technical.data_sources, indent=2, ensure_ascii=False) if kb.technical.data_sources else 'Não disponível'}

**Regras de Negócio:**
{chr(10).join([f"- {br.name}: {br.description}" for br in kb.technical.business_rules[:10]])}
""")
        
        if code_snippets:
            code_context = "\n\n".join([
                f"### {s['path']}\n```python\n{s['content']}\n```" 
                for s in code_snippets[:10]
            ])
            context_parts.append(f"""
## CÓDIGO RELEVANTE:
{code_context}
""")
        
        if output_json:
            context_parts.append(f"""
## JSON DE RETORNO QUE CAUSOU O PROBLEMA:
```json
{output_json[:10000]}
```
""")
        
        context = "\n".join(context_parts)
        
        # Prompt de investigação
        system_prompt = """Você é um especialista em debugging de agentes de IA/chatbots para e-commerce (VTEX).
Sua tarefa é fazer uma investigação PROFUNDA do problema reportado.

## ANÁLISE DO JSON DE RETORNO (CRÍTICO):
Quando receber um JSON da VTEX, analise DETALHADAMENTE:

1. **Seller vs Lojas de Retirada**: 
   - Quem é o seller do pedido? (campo `sellers[].id` ou `items[].seller`)
   - Quais lojas foram oferecidas para retirada? (`shippingData.logisticsInfo[].slas[]` onde `deliveryChannel`="pickup-in-point")
   - A tool retornou MAIS lojas do que deveria? O seller é diferente das lojas oferecidas?

2. **Dados de Endereço**:
   - Qual endereço de entrega? (`shippingData.address`)
   - Quais endereços de pickup? (`pickupStoreInfo.address`)
   - Há inconsistência entre endereço selecionado e opções mostradas?

3. **Lógica da Tool**:
   - A tool filtrou corretamente os dados?
   - Retornou dados demais? De menos?
   - Usou o campo correto para filtrar?

## NÍVEL DE ANÁLISE ESPERADO:
- NÃO apenas diga "dados vieram do campo X"
- IDENTIFIQUE se a tool deveria ter filtrado esses dados
- EXPLIQUE por que retornou informação errada/excessiva
- SUGIRA qual lógica de filtro está faltando

Responda em JSON:
{
    "problem_summary": "Resumo claro do problema",
    "root_cause": "Causa raiz ESPECÍFICA (ex: 'A tool retornou todas as lojas com estoque ao invés de apenas a loja do seller')",
    "data_analysis": {
        "seller_info": "Identificação do seller no JSON",
        "data_returned": "O que foi retornado ao usuário",
        "data_expected": "O que DEVERIA ter sido retornado",
        "discrepancy": "A diferença/erro identificado"
    },
    "data_flow": "Caminho dos dados: de onde vieram → como foram processados → o que foi retornado",
    "tool_logic_issue": "Problema específico na lógica da tool/função",
    "affected_handlers": ["handlers/funções envolvidos"],
    "affected_code_locations": ["arquivo.py - descrição do que fazer"],
    "evidence": ["evidências do JSON que comprovam o problema"],
    "suggestions": ["correções específicas na lógica"],
    "confidence": "low/medium/high"
}"""

        investigation_prompt = f"""
PROBLEMA REPORTADO:
{problem_description}

CONTEXTO PARA INVESTIGAÇÃO:
{context}

Investigue e identifique a causa raiz do problema.
"""

        try:
            debug_start = time.time()
            # Para debug, sempre usa o máximo de tokens possível
            response = await ai_service.generate(investigation_prompt, system_prompt, force_max_tokens=True)
            debug_duration = int((time.time() - debug_start) * 1000)
            
            # Registra uso de tokens para debug
            input_tokens, output_tokens = ai_service.last_tokens
            if input_tokens > 0 or output_tokens > 0:
                metrics_service.record_token_usage(
                    operation="debug",
                    model=ai_service.model or "unknown",
                    provider=str(ai_service.provider_type or "unknown"),
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    duration_ms=debug_duration,
                    repository=repository,
                    folder=folder_path
                )
            
            # Tenta parsear JSON
            response_clean = response.strip()
            if response_clean.startswith("```"):
                lines = response_clean.split("\n")
                response_clean = "\n".join(lines[1:-1])
                if response_clean.startswith("json"):
                    response_clean = response_clean[4:]
            
            result = json.loads(response_clean)
            result["agent_definition_found"] = bool(agent_definition)
            result["knowledge_base_found"] = bool(kb)
            return result
            
        except Exception as e:
            # Fallback se não conseguir parsear JSON
            return {
                "problem_summary": problem_description,
                "root_cause": "Não foi possível identificar automaticamente. Veja a análise abaixo.",
                "data_flow": response if 'response' in dir() else "Erro na análise",
                "affected_handlers": [],
                "affected_code_locations": [],
                "suggestions": ["Revise manualmente o código dos handlers"],
                "confidence": "low",
                "agent_definition_found": bool(agent_definition),
                "knowledge_base_found": bool(kb),
                "error": str(e)
            }


# Instância global
agent_service = AgentService()
