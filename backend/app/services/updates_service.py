"""
Serviço para gerenciamento de snapshots de indexação e diff de atualizações.
Usa API do GitHub diretamente - não depende do repositório local!
"""
import json
import asyncio
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from ..models.schemas import (
    IndexationSnapshot, UpdatesDiff, ChangeItem, KnowledgeBase, CrossReference
)
from ..core.config import settings
import re
import subprocess


class UpdatesService:
    """
    Serviço para gerenciar snapshots e diffs de atualizações.
    Usa API do GitHub para obter commits e diffs - funciona mesmo sem git pull!
    """
    
    def __init__(self):
        self.snapshots_file = settings.REPOS_BASE_DIR.parent / "indexation_snapshots.json"
        self._snapshots: Dict[str, List[IndexationSnapshot]] = {}
        self._load_snapshots()
    
    def _load_snapshots(self):
        """Carrega snapshots do arquivo."""
        if self.snapshots_file.exists():
            try:
                with open(self.snapshots_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for repo, snapshots in data.items():
                        self._snapshots[repo] = [
                            IndexationSnapshot(**s) for s in snapshots
                        ]
            except Exception as e:
                print(f"Erro ao carregar snapshots: {e}")
                self._snapshots = {}
    
    def _save_snapshots(self):
        """Salva snapshots no arquivo."""
        try:
            data = {}
            for repo, snapshots in self._snapshots.items():
                data[repo] = [s.model_dump(mode='json') for s in snapshots]
            
            with open(self.snapshots_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Erro ao salvar snapshots: {e}")
    
    def _parse_repository_name(self, repository_name: str) -> tuple[str, str, str]:
        """
        Extrai owner, repo e folder do nome completo.
        Exemplo: "weni-ai/teste-helper-agents/order_agent" -> ("weni-ai", "teste-helper-agents", "order_agent")
        """
        parts = repository_name.split("/")
        if len(parts) >= 2:
            owner = parts[0]
            repo = parts[1]
            folder = "/".join(parts[2:]) if len(parts) > 2 else ""
            return owner, repo, folder
        return "", "", ""
    
    def _is_valid_git_sha(self, sha: str) -> bool:
        """Verifica se é um SHA Git válido (7-40 caracteres hex)."""
        if not sha or sha == "unknown":
            return False
        # SHA Git é hexadecimal, geralmente 7-40 chars
        if len(sha) < 7 or len(sha) > 40:
            return False
        try:
            int(sha, 16)  # Verifica se é hexadecimal
            return True
        except ValueError:
            return False
    
    def clear_invalid_snapshots(self, repository_name: str) -> int:
        """Remove snapshots com hashes inválidos (do sistema antigo MD5)."""
        snapshots = self._snapshots.get(repository_name, [])
        valid_snapshots = []
        removed = 0
        
        for snap in snapshots:
            # SHA Git válido tem 7-40 chars hexadecimais
            if self._is_valid_git_sha(snap.content_hash):
                valid_snapshots.append(snap)
            else:
                removed += 1
                print(f"🗑️ Removendo snapshot inválido: {snap.id} (hash: {snap.content_hash})")
        
        if removed > 0:
            self._snapshots[repository_name] = valid_snapshots
            self._save_snapshots()
        
        return removed
    
    async def create_snapshot_async(
        self,
        kb: KnowledgeBase,
        indexed_by: str = "system"
    ) -> IndexationSnapshot:
        """
        Cria um snapshot da indexação atual.
        Busca o commit mais recente DIRETO DO GITHUB (não precisa de git pull).
        """
        from .github_service import github_service
        
        owner, repo, folder = self._parse_repository_name(kb.repository_name)
        
        # Busca commit atual do GitHub (via API)
        current_commit = "unknown"
        if owner and repo:
            commit_sha = await github_service.get_latest_commit(owner, repo)
            if commit_sha:
                current_commit = commit_sha
        
        snapshot = IndexationSnapshot(
            id=f"{kb.repository_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            repository_name=kb.repository_name,
            timestamp=datetime.now(),
            indexed_by=indexed_by,
            instructions=[],
            guardrails=[],
            skills=[],
            handlers=[],
            environment_variables=[],
            api_endpoints=[],
            business_rules=[],
            capabilities=[],
            content_hash=current_commit  # Commit SHA do GitHub
        )
        
        if kb.repository_name not in self._snapshots:
            self._snapshots[kb.repository_name] = []
        
        self._snapshots[kb.repository_name].append(snapshot)
        
        # Mantém apenas últimos 10 snapshots
        if len(self._snapshots[kb.repository_name]) > 10:
            self._snapshots[kb.repository_name] = self._snapshots[kb.repository_name][-10:]
        
        self._save_snapshots()
        print(f"📸 Snapshot criado com commit {current_commit} (via GitHub API)")
        return snapshot
    
    def create_snapshot(
        self,
        kb: KnowledgeBase,
        indexed_by: str = "system"
    ) -> IndexationSnapshot:
        """
        Versão síncrona do create_snapshot.
        Usa asyncio.run se não estiver em contexto async.
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Já está em contexto async, usa create_task
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(
                        asyncio.run, 
                        self.create_snapshot_async(kb, indexed_by)
                    )
                    return future.result()
            else:
                return loop.run_until_complete(
                    self.create_snapshot_async(kb, indexed_by)
                )
        except RuntimeError:
            # Não há event loop, cria um novo
            return asyncio.run(self.create_snapshot_async(kb, indexed_by))
    
    def get_snapshots(self, repository_name: str) -> List[IndexationSnapshot]:
        """Retorna todos os snapshots de um repositório."""
        return self._snapshots.get(repository_name, [])
    
    def _categorize_file(self, file_path: str) -> str:
        """Categoriza um arquivo baseado em seu caminho/nome."""
        file_lower = file_path.lower()
        
        if 'agent_definition' in file_lower or file_lower.endswith('.yaml') or file_lower.endswith('.yml'):
            if 'definition' in file_lower or 'agent' in file_lower:
                return 'instruction'
        
        if file_lower.endswith(('.py', '.js', '.ts', '.java', '.go')):
            if 'handler' in file_lower or 'action' in file_lower or 'skill' in file_lower:
                return 'handler'
            return 'code'
        
        if '.env' in file_lower or 'config' in file_lower or 'settings' in file_lower:
            return 'config'
        
        if file_lower.endswith(('.json', '.toml', '.ini')):
            return 'config'
        
        if file_lower.endswith(('.md', '.txt', '.rst')):
            return 'docs'
        
        return 'other'
    
    def _extract_identifiers_from_line(self, line_content: str) -> set:
        """Extrai identificadores de uma linha de código."""
        ids = set()
        
        # Padrão 1: Atribuição Python - variavel = valor
        match = re.match(r'^(\w+)\s*=', line_content)
        if match:
            ids.add(match.group(1))
        
        # Padrão 2: Chave de dicionário/context - ['chave'] ou ["chave"]
        matches = re.findall(r"\[(['\"])(\w+)\1\]", line_content)
        for _, key in matches:
            ids.add(key)
        
        # Padrão 3: Chave YAML - chave: valor
        match = re.match(r'^(\w+):', line_content)
        if match and not line_content.startswith('#'):
            ids.add(match.group(1))
        
        # Padrão 4: Variável de ambiente - ENV_VAR ou UPPER_CASE
        matches = re.findall(r'\b([A-Z][A-Z0-9_]{2,})\b', line_content)
        for env_var in matches:
            ids.add(env_var)
        
        return ids
    
    def _extract_removed_identifiers(self, patch: str) -> List[str]:
        """
        Extrai identificadores que foram REALMENTE removidos do patch.
        Diferencia entre 'remoção real' e 'mudança de formato'.
        """
        if not patch:
            return []
        
        removed_ids = set()
        added_ids = set()
        
        for line in patch.split('\n'):
            # Linhas removidas (começam com -)
            if line.startswith('-') and not line.startswith('---'):
                line_content = line[1:].strip()
                removed_ids.update(self._extract_identifiers_from_line(line_content))
            
            # Linhas adicionadas (começam com +)
            elif line.startswith('+') and not line.startswith('+++'):
                line_content = line[1:].strip()
                added_ids.update(self._extract_identifiers_from_line(line_content))
        
        # IMPORTANTE: Identifica o que foi REALMENTE removido vs mudança de formato
        truly_removed = removed_ids - added_ids  # Removido e NÃO adicionado de volta
        format_changed = removed_ids & added_ids  # Removido E adicionado = mudança de formato
        
        if format_changed:
            print(f"ℹ️ Identificadores com MUDANÇA DE FORMATO (não são remoções reais): {format_changed}")
        
        # Filtra identificadores muito genéricos
        generic_ids = {'if', 'else', 'for', 'while', 'def', 'class', 'import', 'from', 
                       'return', 'True', 'False', 'None', 'and', 'or', 'not', 'in',
                       'try', 'except', 'finally', 'with', 'as', 'pass', 'break', 'continue'}
        
        result = [id for id in truly_removed if id not in generic_ids and len(id) > 2]
        
        if result:
            print(f"🔑 Identificadores REALMENTE removidos: {result}")
        
        return result
    
    def _extract_format_changes(self, patch: str) -> List[str]:
        """
        Extrai identificadores que tiveram MUDANÇA DE FORMATO (não foram removidos).
        Útil para alertar sobre possíveis incompatibilidades de tipo.
        """
        if not patch:
            return []
        
        removed_ids = set()
        added_ids = set()
        
        for line in patch.split('\n'):
            if line.startswith('-') and not line.startswith('---'):
                line_content = line[1:].strip()
                removed_ids.update(self._extract_identifiers_from_line(line_content))
            elif line.startswith('+') and not line.startswith('+++'):
                line_content = line[1:].strip()
                added_ids.update(self._extract_identifiers_from_line(line_content))
        
        # Identificadores presentes em ambos = mudança de formato
        format_changed = removed_ids & added_ids
        
        generic_ids = {'if', 'else', 'for', 'while', 'def', 'class', 'import', 'from', 
                       'return', 'True', 'False', 'None', 'and', 'or', 'not', 'in',
                       'try', 'except', 'finally', 'with', 'as', 'pass', 'break', 'continue'}
        
        return [id for id in format_changed if id not in generic_ids and len(id) > 2]
    
    def _find_cross_references(
        self, 
        identifiers: List[str], 
        repo_path: Path,
        exclude_file: str = None
    ) -> Dict[str, List[CrossReference]]:
        """
        Busca referências cruzadas de identificadores no repositório.
        Retorna um dicionário {identificador: [lista de referências]}
        """
        references: Dict[str, List[CrossReference]] = {}
        
        if not identifiers or not repo_path.exists():
            return references
        
        for identifier in identifiers:
            refs = []
            
            try:
                # Usa grep para buscar eficientemente
                result = subprocess.run(
                    ['grep', '-rn', '--include=*.py', '--include=*.yaml', '--include=*.yml', 
                     '--include=*.json', identifier, str(repo_path)],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                for line in result.stdout.strip().split('\n'):
                    if not line:
                        continue
                    
                    # Formato: caminho:linha:conteúdo
                    parts = line.split(':', 2)
                    if len(parts) >= 3:
                        file_path = parts[0]
                        
                        # Ignora o arquivo que foi modificado
                        if exclude_file and exclude_file in file_path:
                            continue
                        
                        try:
                            line_num = int(parts[1])
                            content = parts[2].strip()
                            
                            # Faz path relativo ao repo
                            rel_path = file_path.replace(str(repo_path) + '/', '')
                            
                            refs.append(CrossReference(
                                file_path=rel_path,
                                line_number=line_num,
                                line_content=content[:200]  # Limita tamanho
                            ))
                        except ValueError:
                            continue
                
                if refs:
                    references[identifier] = refs[:10]  # Limita a 10 referências por identificador
                    print(f"✅ Encontradas {len(refs)} referências para '{identifier}'")
                    
            except subprocess.TimeoutExpired:
                print(f"⚠️ Timeout ao buscar referências de '{identifier}'")
            except Exception as e:
                print(f"⚠️ Erro ao buscar referências de '{identifier}': {e}")
        
        return references
    
    def _determine_impact(self, category: str, change_type: str) -> str:
        """Determina o impacto de uma mudança."""
        if category == 'instruction':
            return 'high' if change_type in ['removed', 'modified'] else 'medium'
        
        if category == 'handler':
            return 'high' if change_type == 'removed' else 'medium'
        
        if category == 'code':
            return 'medium'
        
        if category == 'config':
            return 'medium' if change_type == 'removed' else 'low'
        
        return 'low'
    
    async def _analyze_changes_with_ai(
        self,
        changes: List[ChangeItem],
        comparison: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analisa as mudanças com IA para gerar resumo técnico/negócio.
        Identifica potenciais problemas e impactos.
        """
        # Prepara contexto das mudanças
        changes_context = []
        breaking_info = []
        
        for change in changes:
            change_info = {
                "arquivo": change.description,
                "tipo": change.type,
                "categoria": change.category,
                "linhas_adicionadas": change.additions,
                "linhas_removidas": change.deletions,
            }
            if change.patch:
                # Limita o patch para não exceder contexto
                change_info["diff"] = change.patch[:2000]
            
            # Adiciona info de cross-references se houver
            if change.has_breaking_change and change.cross_references:
                change_info["ERRO_CRITICO"] = True
                change_info["variaveis_removidas"] = change.removed_identifiers
                change_info["usadas_em"] = [
                    f"{ref.file_path}:{ref.line_number}" 
                    for ref in change.cross_references[:5]
                ]
                breaking_info.append({
                    "variavel": change.removed_identifiers,
                    "arquivos_afetados": [ref.file_path for ref in change.cross_references]
                })
                
            changes_context.append(change_info)
        
        # Informações dos commits
        commits_info = []
        for commit in comparison.get("commits", [])[:5]:
            commits_info.append(f"- {commit.get('message', 'sem mensagem')}")
        
        # Alerta de breaking changes
        breaking_alert = ""
        if breaking_info:
            breaking_alert = f"""
## ⚠️ ERROS CRÍTICOS DETECTADOS (variáveis removidas mas ainda usadas):
{json.dumps(breaking_info, indent=2, ensure_ascii=False)}

ATENÇÃO: Estas variáveis foram REMOVIDAS mas são REFERENCIADAS em outros arquivos!
Isso VAI causar erros em tempo de execução!
"""
        
        prompt = f"""Analise as seguintes mudanças de código de um agente de IA e forneça:

1. **RESUMO TÉCNICO**: O que foi alterado tecnicamente (variáveis criadas/removidas, funções modificadas, etc.)
2. **IMPACTO NO NEGÓCIO**: Como essas mudanças podem afetar o comportamento do agente
3. **PROBLEMAS POTENCIAIS**: Se alguma mudança pode causar problemas (ex: variável removida que é usada em outro lugar)
{breaking_alert}
## Mudanças detectadas:
{json.dumps(changes_context, indent=2, ensure_ascii=False)}

## Commits:
{chr(10).join(commits_info) if commits_info else "Sem mensagens de commit"}

RESPONDA EM PORTUGUÊS no formato JSON:
{{
    "resumo_tecnico": "Descrição técnica clara das mudanças",
    "impacto_negocio": "Como afeta o comportamento do agente",
    "problemas_potenciais": ["lista de possíveis problemas", "se houver"]
}}

Seja conciso e direto. Se houver ERRO_CRITICO nas mudanças, SEMPRE liste como problema!
Se a mudança for trivial (como adicionar newline), diga isso claramente."""

        try:
            from .ai_service import ai_service
            
            system_prompt = "Você é um especialista em análise de código. Analise mudanças de código e identifique impactos técnicos e de negócio. Seja preciso e conciso."
            
            content = await ai_service.generate(prompt, system_prompt=system_prompt)
            
            # Tenta extrair JSON da resposta
            try:
                # Remove possíveis marcadores de código
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]
                
                result = json.loads(content.strip())
                
                # Formata o resumo
                analysis_parts = []
                if result.get("resumo_tecnico"):
                    analysis_parts.append(f"**Técnico:** {result['resumo_tecnico']}")
                if result.get("impacto_negocio"):
                    analysis_parts.append(f"**Impacto:** {result['impacto_negocio']}")
                
                return {
                    "analysis": "\n\n".join(analysis_parts),
                    "issues": result.get("problemas_potenciais", [])
                }
                
            except json.JSONDecodeError:
                # Se não conseguir parsear JSON, usa o texto direto
                return {
                    "analysis": content,
                    "issues": []
                }
                
        except Exception as e:
            print(f"Erro na análise AI: {e}")
            return {
                "analysis": None,
                "issues": []
            }
    
    async def compute_diff_async(
        self,
        repository_name: str,
        from_snapshot_id: Optional[str] = None,
        to_snapshot_id: Optional[str] = None
    ) -> Optional[UpdatesDiff]:
        """
        Computa a diferença entre dois snapshots usando a API do GitHub.
        NÃO PRECISA de git pull - busca direto do GitHub!
        """
        from .github_service import github_service
        
        # Limpa snapshots inválidos primeiro
        removed = self.clear_invalid_snapshots(repository_name)
        if removed > 0:
            print(f"✅ Removidos {removed} snapshots inválidos")
        
        snapshots = self._snapshots.get(repository_name, [])
        
        if len(snapshots) < 2:
            return None
        
        # Seleciona snapshots
        if from_snapshot_id and to_snapshot_id:
            from_snapshot = next((s for s in snapshots if s.id == from_snapshot_id), None)
            to_snapshot = next((s for s in snapshots if s.id == to_snapshot_id), None)
        else:
            from_snapshot = snapshots[-2]
            to_snapshot = snapshots[-1]
        
        if not from_snapshot or not to_snapshot:
            return None
        
        owner, repo, agent_folder = self._parse_repository_name(repository_name)
        from_commit = from_snapshot.content_hash
        to_commit = to_snapshot.content_hash
        
        # Se commits são iguais, não há mudanças
        if from_commit == to_commit:
            return UpdatesDiff(
                repository_name=repository_name,
                from_snapshot_id=from_snapshot.id,
                from_timestamp=from_snapshot.timestamp,
                to_snapshot_id=to_snapshot.id,
                to_timestamp=to_snapshot.timestamp,
                summary="Nenhuma mudança no código desde a última indexação.",
                total_changes=0,
                changes=[],
                impact_level="low",
                impact_summary="O código permanece igual."
            )
        
        # Busca diff via API do GitHub (não precisa de repo local!)
        comparison = await github_service.compare_commits(owner, repo, from_commit, to_commit)
        
        if not comparison:
            return UpdatesDiff(
                repository_name=repository_name,
                from_snapshot_id=from_snapshot.id,
                from_timestamp=from_snapshot.timestamp,
                to_snapshot_id=to_snapshot.id,
                to_timestamp=to_snapshot.timestamp,
                summary="Erro ao comparar commits via GitHub API.",
                total_changes=0,
                changes=[],
                impact_level="low",
                impact_summary="Não foi possível analisar via GitHub API."
            )
        
        # Processa arquivos modificados
        all_changes: List[ChangeItem] = []
        
        for file_info in comparison.get("files", []):
            file_path = file_info.get("filename", "")
            status = file_info.get("status", "modified")
            
            # Se tem agent_folder, filtra apenas arquivos desse agente
            if agent_folder and not file_path.startswith(agent_folder):
                continue
            
            # Mapeia status do GitHub para nosso tipo
            change_type = 'modified'
            if status == 'added':
                change_type = 'added'
            elif status == 'removed':
                change_type = 'removed'
            elif status == 'renamed':
                change_type = 'renamed'
            
            category = self._categorize_file(file_path)
            impact = self._determine_impact(category, change_type)
            
            # Gera descrição
            type_labels = {
                'added': 'Adicionado',
                'removed': 'Removido',
                'modified': 'Modificado',
                'renamed': 'Renomeado'
            }
            
            description = f"{type_labels.get(change_type, 'Alterado')}: {file_path}"
            
            # Detalhes do diff
            additions = file_info.get("additions", 0)
            deletions = file_info.get("deletions", 0)
            patch = file_info.get("patch", "")
            
            if additions or deletions:
                description += f" (+{additions}/-{deletions})"
            
            # Extrai identificadores removidos e mudanças de formato
            removed_identifiers = []
            format_changed_identifiers = []
            cross_refs = []
            has_breaking = False
            
            if deletions > 0 and patch:
                # Extrai identificadores REALMENTE removidos (não presentes nas linhas adicionadas)
                removed_identifiers = self._extract_removed_identifiers(patch)
                
                # Extrai identificadores com MUDANÇA DE FORMATO (presentes em removidos E adicionados)
                format_changed_identifiers = self._extract_format_changes(patch)
                
                if format_changed_identifiers:
                    print(f"📝 Identificadores com MUDANÇA DE FORMATO: {format_changed_identifiers}")
                
                # Busca referências apenas para identificadores REALMENTE removidos
                if removed_identifiers:
                    # Busca referências no repositório local (padrão: owner_repo)
                    repo_path = settings.REPOS_BASE_DIR / f"{owner}_{repo}"
                    
                    if not repo_path.exists():
                        # Tenta variações do nome
                        alt_path = settings.REPOS_BASE_DIR / f"{owner}-{repo}"
                        if alt_path.exists():
                            repo_path = alt_path
                        else:
                            # Lista diretórios e procura por padrão similar
                            for dir_name in settings.REPOS_BASE_DIR.iterdir():
                                if dir_name.is_dir() and repo in dir_name.name:
                                    repo_path = dir_name
                                    break
                    
                    print(f"🔍 Buscando refs em: {repo_path} (existe: {repo_path.exists()})")
                    
                    references = self._find_cross_references(
                        removed_identifiers, 
                        repo_path,
                        exclude_file=file_path
                    )
                    
                    # Converte para lista de CrossReference
                    for identifier, refs in references.items():
                        print(f"  📌 Referências para '{identifier}': {len(refs)} encontradas")
                        for ref in refs:
                            print(f"     → {ref.file_path}:{ref.line_number}")
                        cross_refs.extend(refs)
                    
                    # Se há referências para remoções reais, é breaking change
                    if cross_refs:
                        has_breaking = True
                        impact = 'high'
                        description += f" ⚠️ {len(cross_refs)} referência(s) encontrada(s)"
                        print(f"  🚨 BREAKING CHANGE: variáveis removidas ainda são usadas!")
                
                # Para mudanças de formato, adiciona alerta informativo (não é breaking change crítica)
                if format_changed_identifiers and not has_breaking:
                    description += f" ℹ️ Mudança de formato em: {', '.join(format_changed_identifiers[:3])}"
                    if len(format_changed_identifiers) > 3:
                        description += f" (+{len(format_changed_identifiers) - 3})"
            
            change_item = ChangeItem(
                type=change_type,
                category=category,
                description=description,
                old_value=file_path if change_type == 'removed' else None,
                new_value=file_path if change_type != 'removed' else None,
                impact=impact,
                additions=additions,
                deletions=deletions,
                patch=patch if patch else None,
                removed_identifiers=removed_identifiers,
                format_changed_identifiers=format_changed_identifiers,
                cross_references=cross_refs,
                has_breaking_change=has_breaking,
                has_format_change=bool(format_changed_identifiers)
            )
            all_changes.append(change_item)
        
        if not all_changes:
            return UpdatesDiff(
                repository_name=repository_name,
                from_snapshot_id=from_snapshot.id,
                from_timestamp=from_snapshot.timestamp,
                to_snapshot_id=to_snapshot.id,
                to_timestamp=to_snapshot.timestamp,
                summary="Nenhum arquivo modificado no agente desde a última indexação.",
                total_changes=0,
                changes=[],
                impact_level="low",
                impact_summary="O agente permanece igual."
            )
        
        # Agrupa por categoria
        instructions_group = [c for c in all_changes if c.category == 'instruction']
        code_group = [c for c in all_changes if c.category in ['handler', 'code']]
        config_group = [c for c in all_changes if c.category == 'config']
        
        # Verifica breaking changes (variáveis removidas que são usadas em outros lugares)
        breaking_changes = [c for c in all_changes if c.has_breaking_change]
        has_breaking = len(breaking_changes) > 0
        
        print(f"📊 Total de mudanças: {len(all_changes)}")
        print(f"🔥 Breaking changes: {len(breaking_changes)}")
        for bc in breaking_changes:
            print(f"   → {bc.description}")
            print(f"     Cross-refs: {len(bc.cross_references)}")
        
        # Calcula impacto geral - BREAKING CHANGES são sempre CRÍTICAS
        if has_breaking:
            impact_level = 'critical'  # Variável removida mas usada = ERRO CRÍTICO
            print(f"⚠️ IMPACTO CRÍTICO: há breaking changes!")
        else:
            high_impact = sum(1 for c in all_changes if c.impact == 'high')
            medium_impact = sum(1 for c in all_changes if c.impact == 'medium')
            
            if high_impact >= 3:
                impact_level = 'critical'
            elif high_impact >= 1:
                impact_level = 'high'
            elif medium_impact >= 2:
                impact_level = 'medium'
            else:
                impact_level = 'low'
        
        # Gera resumo
        summary_parts = []
        added = sum(1 for c in all_changes if c.type == 'added')
        modified = sum(1 for c in all_changes if c.type == 'modified')
        removed_count = sum(1 for c in all_changes if c.type == 'removed')
        
        if added:
            summary_parts.append(f"{added} arquivo(s) adicionado(s)")
        if modified:
            summary_parts.append(f"{modified} arquivo(s) modificado(s)")
        if removed_count:
            summary_parts.append(f"{removed_count} arquivo(s) removido(s)")
        
        # Adiciona info de commits
        total_commits = comparison.get("total_commits", 0)
        if total_commits:
            summary_parts.append(f"{total_commits} commit(s)")
        
        summary = " | ".join(summary_parts) if summary_parts else "Mudanças detectadas"
        
        # Impacto resumo
        impact_parts = []
        if instructions_group:
            impact_parts.append(f"🎯 {len(instructions_group)} mudança(s) em definições do agente")
        if code_group:
            impact_parts.append(f"💻 {len(code_group)} mudança(s) em código")
        if config_group:
            impact_parts.append(f"⚙️ {len(config_group)} mudança(s) em configurações")
        
        impact_summary = " | ".join(impact_parts) if impact_parts else "Mudanças menores"
        
        # Se há breaking changes, adiciona ao resumo de impacto
        if has_breaking:
            impact_summary = f"🚨 ERRO CRÍTICO: {len(breaking_changes)} referência(s) quebrada(s) | {impact_summary}"
        
        # Análise inteligente com IA
        ai_analysis = None
        potential_issues = []
        
        # Primeiro, adiciona problemas GARANTIDOS baseados em cross-references (REMOÇÕES REAIS)
        for change in breaking_changes:
            for ref in change.cross_references:
                issue = f"🚨 ERRO: '{change.removed_identifiers[0] if change.removed_identifiers else 'variável'}' foi REMOVIDA mas é usada em {ref.file_path}:{ref.line_number}"
                if issue not in potential_issues:
                    potential_issues.append(issue)
        
        # Segundo, adiciona ALERTAS sobre mudanças de formato (menos crítico)
        format_change_items = [c for c in all_changes if c.has_format_change]
        for change in format_change_items:
            if change.format_changed_identifiers:
                for identifier in change.format_changed_identifiers[:3]:  # Limita a 3 por arquivo
                    issue = f"ℹ️ ATENÇÃO: '{identifier}' teve MUDANÇA DE FORMATO (verifique compatibilidade de tipo)"
                    if issue not in potential_issues:
                        potential_issues.append(issue)
        
        if all_changes:
            try:
                ai_result = await self._analyze_changes_with_ai(all_changes, comparison)
                ai_analysis = ai_result.get("analysis", "")
                # Adiciona issues da IA que não sejam duplicadas
                for issue in ai_result.get("issues", []):
                    if issue not in potential_issues:
                        potential_issues.append(issue)
            except Exception as e:
                print(f"Erro na análise AI: {e}")
        
        return UpdatesDiff(
            repository_name=repository_name,
            from_snapshot_id=from_snapshot.id,
            from_timestamp=from_snapshot.timestamp,
            to_snapshot_id=to_snapshot.id,
            to_timestamp=to_snapshot.timestamp,
            summary=summary,
            total_changes=len(all_changes),
            changes=all_changes,
            instructions_changes=instructions_group,
            code_changes=code_group,
            config_changes=config_group,
            impact_level=impact_level,
            impact_summary=impact_summary,
            from_commit_sha=from_commit,
            to_commit_sha=to_commit,
            ai_analysis=ai_analysis,
            potential_issues=potential_issues
        )
    
    def compute_diff(
        self,
        repository_name: str,
        from_snapshot_id: Optional[str] = None,
        to_snapshot_id: Optional[str] = None
    ) -> Optional[UpdatesDiff]:
        """Versão síncrona do compute_diff."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(
                        asyncio.run,
                        self.compute_diff_async(repository_name, from_snapshot_id, to_snapshot_id)
                    )
                    return future.result()
            else:
                return loop.run_until_complete(
                    self.compute_diff_async(repository_name, from_snapshot_id, to_snapshot_id)
                )
        except RuntimeError:
            return asyncio.run(
                self.compute_diff_async(repository_name, from_snapshot_id, to_snapshot_id)
            )


# Instância global
updates_service = UpdatesService()
