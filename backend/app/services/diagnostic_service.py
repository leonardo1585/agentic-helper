"""
Serviço de diagnóstico de problemas.
Analisa se um problema reportado está relacionado às últimas alterações do código.
Usa API do GitHub diretamente - não depende do repositório local!
"""
import json
import subprocess
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any
from ..models.schemas import (
    DiagnosticRequest, DiagnosticResult, CommitInfo, ProblemCorrelation, 
    KnowledgeBase, FileChange, CodeLocation, DiagnosticTicket, DiagnosticHistory
)
from ..core.config import settings
from .ai_service import ai_service
from .prompt_service import prompt_service


class DiagnosticService:
    """Serviço para diagnóstico de problemas relacionados a mudanças no código."""
    
    def __init__(self):
        self.history_file = settings.REPOS_BASE_DIR.parent / "diagnostic_history.json"
        self._history: Dict[str, DiagnosticTicket] = {}
        self._load_history()
        self._ticket_counter = len(self._history)
    
    def _load_history(self):
        """Carrega histórico de diagnósticos do arquivo."""
        if self.history_file.exists():
            try:
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for ticket_id, ticket_data in data.items():
                        self._history[ticket_id] = DiagnosticTicket(**ticket_data)
            except Exception as e:
                print(f"Erro ao carregar histórico de diagnósticos: {e}")
                self._history = {}
    
    def _save_history(self):
        """Salva histórico no arquivo."""
        try:
            data = {
                ticket_id: ticket.model_dump(mode='json')
                for ticket_id, ticket in self._history.items()
            }
            with open(self.history_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Erro ao salvar histórico: {e}")
    
    def _generate_ticket_id(self) -> str:
        """Gera ID único para o ticket de diagnóstico."""
        self._ticket_counter += 1
        year = datetime.now().year
        return f"DBG-{year}-{self._ticket_counter:04d}"
    
    def _generate_debug_log(self, result: DiagnosticResult, request: DiagnosticRequest) -> str:
        """Gera log de debug formatado para compartilhamento."""
        lines = [
            "=" * 60,
            "🔍 RELATÓRIO DE DIAGNÓSTICO",
            "=" * 60,
            "",
            f"📅 Data: {result.analyzed_at.strftime('%d/%m/%Y %H:%M')}",
            f"📦 Repositório: {result.repository_name}",
            "",
            "─" * 60,
            "📋 PROBLEMA REPORTADO",
            "─" * 60,
            result.problem_description,
            "",
        ]
        
        if request.error_message:
            lines.extend([
                "─" * 60,
                "❌ MENSAGEM DE ERRO",
                "─" * 60,
                f"```",
                request.error_message,
                f"```",
                "",
            ])
        
        lines.extend([
            "─" * 60,
            f"🎯 VEREDITO: {result.verdict}",
            "─" * 60,
            f"Confiança: {result.confidence.upper()}",
            f"Tipo: {result.root_cause_type or 'N/A'}",
            f"É refatoração: {'Sim' if result.is_refactoring else 'Não'}",
            "",
        ])
        
        if result.diagnosis_summary:
            lines.extend([
                "─" * 60,
                "📊 ANÁLISE DETALHADA",
                "─" * 60,
                result.diagnosis_summary,
                "",
            ])
        
        if result.root_cause:
            lines.extend([
                "─" * 60,
                "🔴 CAUSA RAIZ",
                "─" * 60,
                result.root_cause,
                "",
            ])
        
        if result.code_location:
            loc = result.code_location
            lines.extend([
                "─" * 60,
                "📍 CÓDIGO IDENTIFICADO",
                "─" * 60,
                f"Arquivo: {loc.file}",
            ])
            if loc.line_removed:
                lines.append(f"- Removido: {loc.line_removed}")
            if loc.line_added:
                lines.append(f"+ Adicionado: {loc.line_added}")
            if loc.explanation:
                lines.append(f"Explicação: {loc.explanation}")
            lines.append("")
        
        if result.recent_commits:
            lines.extend([
                "─" * 60,
                f"📝 COMMITS RECENTES ({len(result.recent_commits)})",
                "─" * 60,
            ])
            for commit in result.recent_commits[:5]:
                lines.append(f"• {commit.sha[:7]} - {commit.message} ({commit.author})")
            lines.append("")
        
        if result.recommendations:
            lines.extend([
                "─" * 60,
                "💡 RECOMENDAÇÕES",
                "─" * 60,
            ])
            for rec in result.recommendations:
                lines.append(f"• {rec}")
            lines.append("")
        
        if result.next_steps:
            lines.extend([
                "─" * 60,
                "➡️ PRÓXIMOS PASSOS",
                "─" * 60,
            ])
            for i, step in enumerate(result.next_steps, 1):
                lines.append(f"{i}. {step}")
            lines.append("")
        
        lines.extend([
            "=" * 60,
            "Gerado automaticamente pelo GTH - GitHub To Help",
            "=" * 60,
        ])
        
        return "\n".join(lines)
    
    def create_ticket(
        self, 
        result: DiagnosticResult, 
        request: DiagnosticRequest,
        created_by: str = "Suporte"
    ) -> DiagnosticTicket:
        """Cria um ticket de diagnóstico para compartilhamento."""
        ticket_id = self._generate_ticket_id()
        
        # Extrai arquivos afetados
        affected_files = []
        if result.code_location and result.code_location.file:
            affected_files.append(result.code_location.file)
        affected_files.extend(result.instruction_changes[:3])
        affected_files.extend(result.code_changes[:3])
        
        ticket = DiagnosticTicket(
            id=ticket_id,
            created_at=datetime.now(),
            created_by=created_by,
            status="open",
            repository_name=result.repository_name,
            problem_description=result.problem_description,
            error_message=request.error_message,
            diagnosis_result=result,
            debug_log=self._generate_debug_log(result, request),
            affected_files=list(set(affected_files))[:10],
            share_url=f"/diagnostic/ticket/{ticket_id}"
        )
        
        self._history[ticket_id] = ticket
        self._save_history()
        
        return ticket
    
    def create_debug_ticket(
        self,
        repository_name: str,
        problem_description: str,
        debug_result: Dict[str, Any],
        error_message: Optional[str] = None,
        created_by: str = "Debug"
    ) -> DiagnosticTicket:
        """Cria um ticket a partir do resultado do Debug (não do Diagnóstico).
        
        IMPORTANTE: Preserva o debug_result ORIGINAL sem conversão para evitar
        perda de informações importantes como tool_logic_issue, data_analysis, etc.
        """
        ticket_id = self._generate_ticket_id()
        
        # Gera log de debug formatado para o resultado do Debug
        debug_log = self._generate_debug_log_from_debug_result(
            repository_name, problem_description, debug_result, error_message
        )
        
        # Extrai arquivos afetados
        affected_files = debug_result.get('affected_code_locations', [])[:10]
        affected_files.extend(debug_result.get('affected_handlers', []))
        
        ticket = DiagnosticTicket(
            id=ticket_id,
            created_at=datetime.now(),
            created_by=created_by,
            status="open",
            ticket_type="debug",  # Marca como ticket de debug
            repository_name=repository_name,
            problem_description=problem_description,
            error_message=error_message,
            diagnosis_result=None,  # Não converte - preserva original
            debug_result=debug_result,  # PRESERVA O RESULTADO ORIGINAL COMPLETO
            debug_log=debug_log,
            affected_files=list(set(affected_files))[:10],
            share_url=f"/diagnostic/ticket/{ticket_id}"
        )
        
        self._history[ticket_id] = ticket
        self._save_history()
        
        return ticket
    
    def _generate_debug_log_from_debug_result(
        self,
        repository_name: str,
        problem_description: str,
        debug_result: Dict[str, Any],
        error_message: Optional[str] = None
    ) -> str:
        """Gera log formatado a partir do resultado do Debug."""
        lines = [
            "=" * 60,
            "🐛 RELATÓRIO DE DEBUG",
            "=" * 60,
            "",
            f"📅 Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            f"📦 Repositório: {repository_name}",
            "",
            "─" * 60,
            "📋 PROBLEMA REPORTADO",
            "─" * 60,
            problem_description,
            "",
        ]
        
        if error_message:
            lines.extend([
                "─" * 60,
                "❌ MENSAGEM DE ERRO",
                "─" * 60,
                f"```",
                error_message,
                f"```",
                "",
            ])
        
        if debug_result.get('problem_summary'):
            lines.extend([
                "─" * 60,
                "🎯 RESUMO DO PROBLEMA",
                "─" * 60,
                debug_result['problem_summary'],
                "",
            ])
        
        if debug_result.get('root_cause'):
            lines.extend([
                "─" * 60,
                "🔴 CAUSA RAIZ IDENTIFICADA",
                "─" * 60,
                debug_result['root_cause'],
                "",
            ])
        
        if debug_result.get('tool_logic_issue'):
            lines.extend([
                "─" * 60,
                "⚙️ PROBLEMA NA LÓGICA DA TOOL",
                "─" * 60,
                debug_result['tool_logic_issue'],
                "",
            ])
        
        if debug_result.get('data_analysis'):
            analysis = debug_result['data_analysis']
            lines.extend([
                "─" * 60,
                "📊 ANÁLISE DE DADOS",
                "─" * 60,
            ])
            if analysis.get('data_returned'):
                lines.append(f"Retornado: {analysis['data_returned']}")
            if analysis.get('data_expected'):
                lines.append(f"Esperado: {analysis['data_expected']}")
            if analysis.get('discrepancy'):
                lines.append(f"Discrepância: {analysis['discrepancy']}")
            lines.append("")
        
        if debug_result.get('affected_handlers'):
            lines.extend([
                "─" * 60,
                "📍 HANDLERS AFETADOS",
                "─" * 60,
            ])
            for handler in debug_result['affected_handlers']:
                lines.append(f"• {handler}")
            lines.append("")
        
        if debug_result.get('affected_code_locations'):
            lines.extend([
                "─" * 60,
                "📁 LOCALIZAÇÕES NO CÓDIGO",
                "─" * 60,
            ])
            for loc in debug_result['affected_code_locations']:
                lines.append(f"• {loc}")
            lines.append("")
        
        if debug_result.get('evidence'):
            lines.extend([
                "─" * 60,
                "🔍 EVIDÊNCIAS",
                "─" * 60,
            ])
            for ev in debug_result['evidence']:
                lines.append(f"• {ev}")
            lines.append("")
        
        if debug_result.get('suggestions'):
            lines.extend([
                "─" * 60,
                "💡 SUGESTÕES DE CORREÇÃO",
                "─" * 60,
            ])
            for i, sug in enumerate(debug_result['suggestions'], 1):
                lines.append(f"{i}. {sug}")
            lines.append("")
        
        confidence = debug_result.get('confidence', 'medium')
        conf_emoji = "🟢" if confidence == 'high' else "🟡" if confidence == 'medium' else "🔴"
        lines.extend([
            "─" * 60,
            f"Confiança: {conf_emoji} {confidence.upper()}",
            "─" * 60,
            "",
            "=" * 60,
            "Gerado automaticamente pelo GTH - GitHub To Help (Debug)",
            "=" * 60,
        ])
        
        return "\n".join(lines)
    
    def get_ticket(self, ticket_id: str) -> Optional[DiagnosticTicket]:
        """Busca um ticket por ID."""
        return self._history.get(ticket_id)
    
    def list_tickets(
        self, 
        repository_name: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[DiagnosticTicket]:
        """Lista tickets com filtros opcionais."""
        tickets = list(self._history.values())
        
        if repository_name:
            tickets = [t for t in tickets if repository_name in t.repository_name]
        
        if status:
            tickets = [t for t in tickets if t.status == status]
        
        # Ordena por data (mais recente primeiro)
        tickets.sort(key=lambda t: t.created_at, reverse=True)
        
        return tickets[:limit]
    
    def update_ticket_status(self, ticket_id: str, status: str, note: Optional[str] = None) -> Optional[DiagnosticTicket]:
        """Atualiza status de um ticket."""
        ticket = self._history.get(ticket_id)
        if ticket:
            ticket.status = status
            if note:
                ticket.notes.append(f"[{datetime.now().strftime('%d/%m %H:%M')}] {note}")
            self._save_history()
        return ticket
    
    def get_history(self, repository_name: Optional[str] = None) -> DiagnosticHistory:
        """Retorna histórico completo de diagnósticos."""
        tickets = self.list_tickets(repository_name=repository_name)
        return DiagnosticHistory(
            total=len(tickets),
            tickets=tickets
        )
    
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
    
    def _get_repo_path(self, repository_name: str) -> Optional[Path]:
        """Obtém o caminho local do repositório (fallback)."""
        parts = repository_name.split("/")
        if len(parts) >= 2:
            repo_only = f"{parts[0]}_{parts[1]}"
        else:
            repo_only = repository_name.replace("/", "_")
        
        repo_path = settings.REPOS_BASE_DIR / repo_only
        if repo_path.exists():
            return repo_path
        
        alt_path = settings.REPOS_BASE_DIR / repository_name.replace("/", "_")
        if alt_path.exists():
            return alt_path
            
        return None
    
    async def _get_recent_commits_from_github(
        self,
        owner: str,
        repo: str,
        days: int = 7,
        folder: str = "",
        max_commits: int = 50
    ) -> List[CommitInfo]:
        """
        Obtém commits recentes diretamente da API do GitHub.
        NÃO depende do repositório local!
        """
        from .github_service import github_service
        
        commits = []
        
        try:
            client = await github_service.get_client()
            since_date = (datetime.now() - timedelta(days=days)).isoformat() + "Z"
            
            # Parâmetros da API
            params = {
                "since": since_date,
                "per_page": max_commits
            }
            
            # Se tem pasta específica, filtra por path
            if folder:
                params["path"] = folder
            
            response = await client.get(
                f"/repos/{owner}/{repo}/commits",
                params=params
            )
            
            if response.status_code != 200:
                print(f"Erro ao obter commits do GitHub: {response.status_code}")
                return []
            
            data = response.json()
            
            for commit_data in data:
                sha = commit_data.get("sha", "")[:8]
                commit_info = commit_data.get("commit", {})
                author_info = commit_info.get("author", {})
                
                message = commit_info.get("message", "").split("\n")[0]
                author = author_info.get("name", "Unknown")
                date_str = author_info.get("date", "")
                
                try:
                    commit_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except:
                    commit_date = datetime.now()
                
                # Obtém detalhes do commit (arquivos modificados + patches)
                files_changed = []
                file_details = []
                additions = 0
                deletions = 0
                
                try:
                    detail_response = await client.get(
                        f"/repos/{owner}/{repo}/commits/{commit_data.get('sha', '')}"
                    )
                    if detail_response.status_code == 200:
                        detail_data = detail_response.json()
                        
                        # Arquivos modificados com patches
                        for file in detail_data.get("files", []):
                            file_path = file.get("filename", "")
                            file_status = file.get("status", "modified")
                            file_additions = file.get("additions", 0)
                            file_deletions = file.get("deletions", 0)
                            file_patch = file.get("patch", "")
                            
                            # Se tem folder, filtra apenas arquivos desse folder
                            if folder:
                                if file_path.startswith(folder):
                                    files_changed.append(file_path)
                                    additions += file_additions
                                    deletions += file_deletions
                                    file_details.append(FileChange(
                                        filename=file_path,
                                        status=file_status,
                                        additions=file_additions,
                                        deletions=file_deletions,
                                        patch=file_patch[:2000] if file_patch else None  # Limita tamanho
                                    ))
                            else:
                                files_changed.append(file_path)
                                additions += file_additions
                                deletions += file_deletions
                                file_details.append(FileChange(
                                    filename=file_path,
                                    status=file_status,
                                    additions=file_additions,
                                    deletions=file_deletions,
                                    patch=file_patch[:2000] if file_patch else None
                                ))
                except:
                    pass
                
                # Só adiciona se tem arquivos no folder (quando filtrado)
                if not folder or files_changed:
                    commits.append(CommitInfo(
                        sha=sha,
                        message=message,
                        author=author,
                        date=commit_date,
                        files_changed=files_changed,
                        file_details=file_details,  # Inclui patches!
                        additions=additions,
                        deletions=deletions
                    ))
            
            print(f"✅ Obtidos {len(commits)} commits do GitHub (últimos {days} dias)")
            
        except Exception as e:
            print(f"❌ Erro ao obter commits do GitHub: {e}")
            import traceback
            traceback.print_exc()
        
        return commits
    
    def _get_recent_commits(
        self,
        repo_path: Path,
        days: int = 7,
        max_commits: int = 50
    ) -> List[CommitInfo]:
        """Obtém commits recentes do repositório local (FALLBACK)."""
        commits = []
        
        try:
            since_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
            
            result = subprocess.run(
                [
                    'git', 'log',
                    f'--since={since_date}',
                    '--format=%H|%s|%an|%ai',
                    f'-n{max_commits}'
                ],
                cwd=repo_path,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                return []
            
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                
                parts = line.split('|')
                if len(parts) >= 4:
                    sha = parts[0]
                    message = parts[1]
                    author = parts[2]
                    date_str = parts[3]
                    
                    files_result = subprocess.run(
                        ['git', 'diff-tree', '--no-commit-id', '--name-only', '-r', sha],
                        cwd=repo_path,
                        capture_output=True,
                        text=True
                    )
                    files_changed = files_result.stdout.strip().split('\n') if files_result.returncode == 0 else []
                    
                    stats_result = subprocess.run(
                        ['git', 'diff-tree', '--shortstat', sha],
                        cwd=repo_path,
                        capture_output=True,
                        text=True
                    )
                    additions = 0
                    deletions = 0
                    if stats_result.returncode == 0:
                        stats = stats_result.stdout
                        if 'insertion' in stats:
                            try:
                                additions = int(stats.split('insertion')[0].split()[-1])
                            except:
                                pass
                        if 'deletion' in stats:
                            try:
                                deletions = int(stats.split('deletion')[0].split()[-1])
                            except:
                                pass
                    
                    try:
                        commit_date = datetime.fromisoformat(date_str.replace(' ', 'T').split('+')[0])
                    except:
                        commit_date = datetime.now()
                    
                    commits.append(CommitInfo(
                        sha=sha[:8],
                        message=message,
                        author=author,
                        date=commit_date,
                        files_changed=[f for f in files_changed if f],
                        additions=additions,
                        deletions=deletions
                    ))
        
        except Exception as e:
            print(f"Erro ao obter commits locais: {e}")
        
        return commits
    
    def _get_file_diff(self, repo_path: Path, sha: str, file_path: str) -> str:
        """Obtém o diff de um arquivo específico em um commit."""
        try:
            result = subprocess.run(
                ['git', 'show', f'{sha}:{file_path}'],
                cwd=repo_path,
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                return result.stdout[:2000]  # Limita tamanho
        except:
            pass
        return ""
    
    def _categorize_changes(self, commits: List[CommitInfo]) -> Dict[str, List[Dict]]:
        """Categoriza as mudanças por tipo."""
        categories = {
            'instruction_changes': [],  # Mudanças em agent_definition, instruções
            'code_changes': [],  # Mudanças em handlers, funções
            'config_changes': [],  # Mudanças em configurações
            'other_changes': []
        }
        
        instruction_patterns = ['agent_definition', 'instruction', '.yaml', '.yml']
        code_patterns = ['.py', '.js', '.ts', 'handler', 'action']
        config_patterns = ['config', '.env', 'settings', '.json']
        
        for commit in commits:
            for file in commit.files_changed:
                file_lower = file.lower()
                
                change_info = {
                    'file': file,
                    'commit_sha': commit.sha,
                    'commit_message': commit.message,
                    'commit_date': commit.date,
                    'author': commit.author
                }
                
                if any(p in file_lower for p in instruction_patterns):
                    categories['instruction_changes'].append(change_info)
                elif any(p in file_lower for p in code_patterns):
                    categories['code_changes'].append(change_info)
                elif any(p in file_lower for p in config_patterns):
                    categories['config_changes'].append(change_info)
                else:
                    categories['other_changes'].append(change_info)
        
        return categories
    
    async def diagnose_problem(
        self,
        request: DiagnosticRequest,
        kb: Optional[KnowledgeBase] = None
    ) -> DiagnosticResult:
        """
        Diagnostica um problema e analisa correlação com mudanças recentes.
        Usa API do GitHub diretamente - NÃO usa fallback local!
        """
        from .github_service import github_service
        
        # Verifica se o token do GitHub está configurado
        if not settings.GITHUB_TOKEN:
            return DiagnosticResult(
                repository_name=request.repository_name,
                problem_description=request.problem_description,
                analyzed_at=datetime.now(),
                diagnosis_summary="⚠️ Token do GitHub não configurado! O diagnóstico requer acesso à API do GitHub para buscar commits atualizados.",
                confidence='low',
                recommendations=[
                    "Configure a variável GITHUB_TOKEN no arquivo .env do backend",
                    "O token precisa ter permissão de leitura em repositórios"
                ]
            )
        
        # Parse do nome do repositório
        owner, repo, folder = self._parse_repository_name(request.repository_name)
        
        if not owner or not repo:
            return DiagnosticResult(
                repository_name=request.repository_name,
                problem_description=request.problem_description,
                analyzed_at=datetime.now(),
                diagnosis_summary=f"Formato de repositório inválido: {request.repository_name}",
                confidence='low',
                recommendations=["O formato esperado é: owner/repo ou owner/repo/folder"]
            )
        
        # Obtém commits recentes DIRETAMENTE do GitHub (sem fallback local!)
        print(f"📡 Buscando commits do GitHub: {owner}/{repo}" + (f"/{folder}" if folder else ""))
        commits = await self._get_recent_commits_from_github(
            owner=owner,
            repo=repo,
            days=request.days_lookback,
            folder=folder
        )
        
        # NÃO usa fallback local - se GitHub falhar, retorna erro claro
        if not commits:
            return DiagnosticResult(
                repository_name=request.repository_name,
                problem_description=request.problem_description,
                analyzed_at=datetime.now(),
                diagnosis_summary=f"Nenhum commit encontrado no GitHub para {owner}/{repo}" + (f"/{folder}" if folder else "") + f" nos últimos {request.days_lookback} dias.",
                confidence='low',
                recent_commits=[],
                recommendations=[
                    "Verifique se o repositório existe no GitHub",
                    "Verifique se o token tem acesso ao repositório",
                    "Aumente o período de busca (days_lookback)"
                ]
            )
        
        # Categoriza as mudanças
        categorized = self._categorize_changes(commits)
        
        # Prepara contexto para IA
        context = self._build_diagnosis_context(
            request, commits, categorized, kb
        )
        
        # Usa IA para análise detalhada
        diagnosis = await self._ai_diagnose(context, request)
        
        # Monta resultado - LÓGICA CONSISTENTE
        # Novos campos do prompt atualizado
        problem_exists = diagnosis.get('problem_exists', True)  # Se há erro, problema existe
        found_cause_in_changes = diagnosis.get('found_cause_in_changes', diagnosis.get('found_cause', False))
        is_refactoring = diagnosis.get('is_refactoring', False)
        refactoring_may_have_bug = diagnosis.get('refactoring_may_have_bug', False)
        verdict = diagnosis.get('verdict', '')
        
        # REGRA CRÍTICA: Se há mensagem de erro, o problema EXISTE
        has_error_message = bool(request.error_message)
        if has_error_message:
            problem_exists = True
        
        # Se não tem veredito explícito, gera baseado na análise - NUNCA minimize o problema
        if not verdict:
            if found_cause_in_changes:
                verdict = f"PROBLEMA IDENTIFICADO: {diagnosis.get('root_cause', 'Ver detalhes abaixo')}"
            elif is_refactoring and refactoring_may_have_bug:
                verdict = f"PROBLEMA IDENTIFICADO: Possível bug introduzido na refatoração - {diagnosis.get('root_cause', 'ver detalhes')}"
            elif is_refactoring and has_error_message:
                # Mesmo sendo refatoração, se há erro, há problema
                verdict = f"PROBLEMA CONFIRMADO: Erro detectado. A refatoração pode ter introduzido um bug. {diagnosis.get('root_cause', '')}"
            elif has_error_message:
                verdict = f"PROBLEMA CONFIRMADO: {diagnosis.get('root_cause', 'Erro detectado, causa não relacionada às mudanças recentes')}"
            else:
                verdict = "ANÁLISE INCONCLUSIVA: Não foram encontradas mudanças recentes relacionadas ao problema reportado."
        
        # Garante que found_cause reflita a existência do problema
        found_cause = found_cause_in_changes or (has_error_message and problem_exists)
        
        # Extrai code_location se disponível
        code_location = None
        if diagnosis.get('code_location'):
            loc = diagnosis['code_location']
            code_location = CodeLocation(
                file=loc.get('file', ''),
                line_removed=loc.get('line_removed'),
                line_added=loc.get('line_added'),
                explanation=loc.get('explanation')
            )
        
        return DiagnosticResult(
            repository_name=request.repository_name,
            problem_description=request.problem_description,
            analyzed_at=datetime.now(),
            found_cause=found_cause,
            is_refactoring=is_refactoring,
            verdict=verdict,
            diagnosis_summary=diagnosis.get('summary', 'Análise inconclusiva'),
            confidence=diagnosis.get('confidence', 'medium'),
            root_cause=diagnosis.get('root_cause'),
            root_cause_type=diagnosis.get('root_cause_type'),
            code_location=code_location,
            correlations=[
                ProblemCorrelation(**c) for c in diagnosis.get('correlations', [])
            ],
            top_suspects=diagnosis.get('top_suspects', []),
            recent_commits=commits[:10],
            instruction_changes=[
                f"{c['file']} ({c['commit_sha']}): {c['commit_message']}"
                for c in categorized['instruction_changes'][:5]
            ],
            code_changes=[
                f"{c['file']} ({c['commit_sha']}): {c['commit_message']}"
                for c in categorized['code_changes'][:10]
            ],
            recommendations=diagnosis.get('recommendations', []),
            next_steps=diagnosis.get('next_steps', [])
        )
    
    def _build_diagnosis_context(
        self,
        request: DiagnosticRequest,
        commits: List[CommitInfo],
        categorized: Dict[str, List[Dict]],
        kb: Optional[KnowledgeBase]
    ) -> str:
        """Constrói contexto para a análise de IA, incluindo código alterado."""
        parts = []
        
        parts.append(f"## Problema Reportado\n{request.problem_description}")
        
        if request.error_message:
            parts.append(f"\n## Mensagem de Erro\n```\n{request.error_message}\n```")
        
        if request.expected_behavior:
            parts.append(f"\n## Comportamento Esperado\n{request.expected_behavior}")
        
        if request.actual_behavior:
            parts.append(f"\n## Comportamento Atual\n{request.actual_behavior}")
        
        # CÓDIGO ALTERADO - Mostra diffs reais
        parts.append("\n## CÓDIGO ALTERADO (Diffs Recentes)")
        patches_shown = 0
        max_patches = 5
        
        for commit in commits[:10]:
            if patches_shown >= max_patches:
                break
                
            for file_detail in commit.file_details:
                if patches_shown >= max_patches:
                    break
                    
                if file_detail.patch:
                    parts.append(f"\n### Commit: {commit.sha} - {commit.message}")
                    parts.append(f"**Arquivo:** `{file_detail.filename}`")
                    parts.append(f"**Alterações:** +{file_detail.additions} / -{file_detail.deletions}")
                    parts.append(f"```diff\n{file_detail.patch[:1500]}\n```")
                    patches_shown += 1
        
        if patches_shown == 0:
            parts.append("_Nenhum diff disponível_")
        
        # Mudanças em instruções
        if categorized['instruction_changes']:
            parts.append("\n## Mudanças em Instruções/Definições (ALTA PRIORIDADE)")
            for c in categorized['instruction_changes'][:5]:
                parts.append(f"- `{c['file']}` - {c['commit_message']} (por {c['author']})")
        
        # Mudanças em código
        if categorized['code_changes']:
            parts.append("\n## Mudanças em Código")
            for c in categorized['code_changes'][:10]:
                parts.append(f"- `{c['file']}` - {c['commit_message']} (por {c['author']})")
        
        # Mudanças em config
        if categorized['config_changes']:
            parts.append("\n## Mudanças em Configurações")
            for c in categorized['config_changes'][:5]:
                parts.append(f"- `{c['file']}` - {c['commit_message']} (por {c['author']})")
        
        # Contexto da KB se disponível
        if kb and kb.technical:
            tech = kb.technical
            if tech.handlers_detail:
                parts.append("\n## Handlers Conhecidos")
                for h in tech.handlers_detail[:5]:
                    parts.append(f"- {h.get('name', '')}: {h.get('purpose', '')}")
        
        return "\n".join(parts)
    
    async def _ai_diagnose(self, context: str, request: DiagnosticRequest) -> Dict:
        """Usa IA para analisar o problema."""
        if not ai_service.is_configured:
            return {
                'summary': 'Serviço de IA não configurado',
                'confidence': 'low',
                'found_cause': False,
                'recommendations': ['Configure a API de IA nas configurações']
            }
        
        system_prompt = """Você é um especialista em diagnóstico de problemas de software.

## SUA TAREFA:
1. PRIMEIRO: Reconhecer se EXISTE um problema real (baseado na mensagem de erro)
2. DEPOIS: Determinar se uma MUDANÇA RECENTE causou ou contribuiu para o problema

## REGRA ABSOLUTA - CONSISTÊNCIA:
Se houver uma MENSAGEM DE ERRO explícita, o PROBLEMA EXISTE - isso é fato.
- "'str' object has no attribute 'get'" = PROBLEMA REAL de tipo/parsing
- "AttributeError", "TypeError", "KeyError" = PROBLEMAS REAIS
- NUNCA diga "não há problema" ou "é só refatoração" quando existe erro em execução
- Sua análise das mudanças é sobre CAUSAS, não sobre se o problema existe

## LÓGICA DE ANÁLISE:

### Passo 1: CONFIRME O PROBLEMA
- Há mensagem de erro? → O problema É REAL e EXISTE
- Qual o tipo de erro? (tipo, atributo, chave, etc.)
- O erro indica falha em runtime? → Precisa ser corrigido

### Passo 2: Analise as mudanças recentes

**Mesmo que seja REFATORAÇÃO, pode ter introduzido bugs:**
- Refatoração pode mudar comportamento sutilmente
- Novos edge cases podem não estar cobertos
- Conversões de tipo podem falhar em casos específicos
- Se há erro APÓS uma mudança → a mudança PODE ser a causa, mesmo sendo "melhoria"

**Análise técnica:**
- A mudança alterou como dados são processados?
- A mudança alterou validações de tipo?
- A mudança alterou parsing de parâmetros?
- Se sim e há erro de tipo → RELACIONADO

### Passo 3: Determine a correlação

**Se há erro E há mudança na área relacionada:**
- found_cause = true
- A mudança É relevante para o problema
- Mesmo que a intenção fosse melhorar, pode ter bug

**Se há erro mas mudanças não parecem relacionadas:**
- found_cause = false (não encontrou nas mudanças)
- MAS reconheça que o problema EXISTE
- Pode ser bug pré-existente ou causa externa

### Passo 4: Análise de código (CRÍTICO)
- Se o código novo faz `isinstance(x, str)` e tenta `json.loads()` mas x pode não ser JSON válido → BUG
- Se o código assume tipo específico sem validação → BUG
- Se há tratamento de exceção genérico que mascara erro → PROBLEMA

## DIFFS:
- Linhas com `-` = REMOVIDAS 
- Linhas com `+` = ADICIONADAS
- Compare para ver O QUE MUDOU na lógica

## Formato de Resposta (JSON):
{
  "problem_exists": true,
  "found_cause_in_changes": true|false,
  "is_refactoring": true|false,
  "refactoring_may_have_bug": true|false,
  "verdict": "CAUSA ENCONTRADA: [descrição técnica]" ou "PROBLEMA CONFIRMADO: não relacionado às mudanças recentes" ou "PROBLEMA CONFIRMADO: possível bug na refatoração",
  "summary": "Resumo técnico explicando a análise - SEMPRE reconheça o problema",
  "confidence": "low|medium|high",
  "root_cause": "Descrição técnica da causa raiz do ERRO",
  "root_cause_type": "code|config|data_format|integration|external|unknown",
  "code_location": {
    "file": "arquivo",
    "line_removed": "código removido",
    "line_added": "código adicionado", 
    "explanation": "Por que isso é relevante para o ERRO"
  },
  "correlations": [],
  "top_suspects": [],
  "recommendations": ["Como resolver o problema ESPECÍFICO"],
  "next_steps": ["Próximos passos para correção"]
}

## REGRAS CRÍTICAS:
1. Se há mensagem de erro → "problem_exists": true SEMPRE
2. Refatoração pode introduzir bugs → não descarte automaticamente
3. Se erro é de tipo e mudança alterou parsing → CORRELACIONADO
4. Seja ESPECÍFICO: diga QUAL linha/lógica precisa ser corrigida
5. NUNCA minimize o problema - o usuário precisa saber que há algo a corrigir"""

        user_prompt = f"""Analise o seguinte problema e as mudanças recentes:

{context}

Responda APENAS com o JSON, sem markdown ou explicações adicionais."""

        try:
            response = await ai_service.generate(user_prompt, system_prompt)
            
            # Tenta parsear JSON
            try:
                # Remove possível markdown
                json_str = response.strip()
                if json_str.startswith('```'):
                    json_str = json_str.split('```')[1]
                    if json_str.startswith('json'):
                        json_str = json_str[4:]
                json_str = json_str.strip()
                
                return json.loads(json_str)
            except json.JSONDecodeError:
                return {
                    'summary': response[:500],
                    'confidence': 'medium',
                    'recommendations': ['Verifique os commits recentes manualmente']
                }
        
        except Exception as e:
            print(f"Erro na análise de IA: {e}")
            return {
                'summary': f'Erro na análise: {str(e)}',
                'confidence': 'low',
                'recommendations': ['Tente novamente ou verifique manualmente']
            }


# Instância global
diagnostic_service = DiagnosticService()

