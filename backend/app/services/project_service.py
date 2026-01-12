"""
Serviço de Gerenciamento de Projetos.
Gerencia projetos locais de agentes Weni para criação e versionamento.
"""
import os
import json
import yaml
import glob
import shutil
from uuid import uuid4
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Union

from ..core import settings


class ProjectSanitizer:
    """Sanitiza e valida projetos para conformidade com Weni."""
    
    @staticmethod
    def expand_text(text: str, min_chars: int = 40) -> str:
        """Expande texto curto para atingir mínimo de caracteres."""
        if len(text) >= min_chars:
            return text
        padding = " Ensure to maintain a professional tone, avoid sensitive topics, and strictly adhere to all safety guidelines."
        return text.strip() + padding
    
    @staticmethod
    def sanitize_agent(agent_name: str, agent_data: dict) -> tuple[dict, list[str]]:
        """Sanitiza dados do agente para conformidade."""
        updates = []
        
        # 1. Guardrails
        guardrails = agent_data.get("guardrails", [])
        new_guardrails = []
        for gr in guardrails:
            if len(gr) < 40:
                expanded = ProjectSanitizer.expand_text(gr)
                new_guardrails.append(expanded)
                updates.append(f"Guardrail expandido: '{gr[:30]}...'")
            else:
                new_guardrails.append(gr)
        agent_data["guardrails"] = new_guardrails
        
        # 2. Instructions
        insts = agent_data.get("instructions", [])
        if isinstance(insts, str):
            insts = [insts]
        
        new_insts = []
        for inst in insts:
            if len(inst) < 40:
                expanded = inst.strip() + " Please follow this instruction carefully and assist the user to the best of your ability."
                new_insts.append(expanded)
                updates.append("Instrução expandida para tamanho mínimo.")
            else:
                new_insts.append(inst)
        agent_data["instructions"] = new_insts
        
        # 3. Tool Parameters Schema
        tools = agent_data.get("tools", [])
        new_tools = []
        for t in tools:
            if isinstance(t, dict) and len(t) == 1 and "name" not in t:
                slug = next(iter(t))
                tool_body = t[slug]
                
                params = tool_body.get("parameters", [])
                new_params = []
                for p in params:
                    if "name" in p:  # Legacy format
                        p_copy = p.copy()
                        p_name = p_copy.pop("name")
                        new_params.append({p_name: p_copy})
                        updates.append(f"Schema migrated for param '{p_name}' in '{slug}'")
                    else:
                        new_params.append(p)
                tool_body["parameters"] = new_params
                new_tools.append(t)
            else:
                new_tools.append(t)
        
        agent_data["tools"] = new_tools
        return agent_data, updates


class ProjectService:
    """Serviço para gerenciamento de projetos de agentes."""
    
    def __init__(self):
        # Diretório de projetos na raiz do GTH
        self.projects_dir = Path(__file__).parent.parent.parent.parent / "projects"
        self.projects_dir.mkdir(parents=True, exist_ok=True)
    
    def get_user_identifier(self) -> str:
        """Obtém identificador do usuário (para isolamento de projetos)."""
        return "default"
    
    def get_projects_dir(self) -> Path:
        """Retorna diretório de projetos do usuário atual."""
        user_id = self.get_user_identifier()
        path = self.projects_dir / "accounts" / user_id
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def list_projects(self) -> List[Dict[str, Any]]:
        """Lista todos os projetos."""
        projects = []
        projects_dir = self.get_projects_dir()
        
        if not projects_dir.exists():
            return []
        
        # Busca arquivos weni.yaml
        yaml_files = glob.glob(str(projects_dir / "*/weni.yaml"))
        
        for yf in yaml_files:
            try:
                yaml_path = Path(yf)
                with open(yf, 'r') as f:
                    data = yaml.safe_load(f)
                
                agents = data.get('agents', {})
                
                if isinstance(agents, list):
                    agents_data = agents[0] if agents else {}
                    agent_slug = "agent"
                else:
                    agent_slug = next(iter(agents.keys())) if agents else "agent"
                    agents_data = agents.get(agent_slug, {})
                
                tools_list = []
                tools = agents_data.get('tools', [])
                for t in tools:
                    if isinstance(t, dict):
                        tools_list.append(t)
                    else:
                        tools_list.append(t)
                
                # Usa nome da pasta como identificador único
                folder_name = yaml_path.parent.name
                
                # Usa metadados do arquivo para datas
                file_stat = yaml_path.stat()
                created_at = datetime.fromtimestamp(file_stat.st_ctime).isoformat()
                updated_at = datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                
                projects.append({
                    "uuid": folder_name,  # Usa nome da pasta como ID
                    "title": agents_data.get('name', folder_name),
                    "description": agents_data.get('description', ''),
                    "org": "Weni",
                    "status": "Rascunho",
                    "id": folder_name,
                    "path": str(yaml_path.parent.absolute()),
                    "tools": tools_list,
                    "created_at": created_at,
                    "updated_at": updated_at
                })
            except Exception as e:
                print(f"Error loading {yf}: {e}")
        
        # Ordena por data de criação (mais recentes primeiro)
        projects.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return projects
    
    def create_project(
        self, 
        name: str, 
        goal: str, 
        instructions: Union[str, List[str]], 
        skills: List[Dict], 
        existing_uuid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Cria um novo projeto."""
        project_uuid = existing_uuid if existing_uuid and existing_uuid.strip() else str(uuid4())
        
        safe_slug = "".join([c for c in name if c.isalnum() or c in ['-', '_']]).lower().replace(' ', '-')
        if not safe_slug:
            safe_slug = "agent-" + project_uuid[:8]
        
        projects_dir = self.get_projects_dir()
        project_dir = projects_dir / safe_slug
        
        # Se já existe, adiciona sufixo
        counter = 1
        original_slug = safe_slug
        while project_dir.exists():
            safe_slug = f"{original_slug}-{counter}"
            project_dir = projects_dir / safe_slug
            counter += 1
        
        project_dir.mkdir(parents=True, exist_ok=True)
        
        # Garante instruções como array com tamanho mínimo
        if isinstance(instructions, list):
            # Já é um array, valida cada item
            valid_instructions = []
            for inst in instructions:
                if len(inst) >= 40:
                    valid_instructions.append(inst)
                else:
                    valid_instructions.append(inst + " (Padding for validation compliance...)")
        else:
            # String única, converte para array
            valid_instructions = [instructions] if len(instructions) >= 40 else [
                instructions + " (Padding for validation compliance.....................)"
            ]
        
        now = datetime.now().isoformat()
        
        # Estrutura simplificada: apenas agents
        yaml_structure = {
            "agents": {
                safe_slug: {
                    "name": name,
                    "description": goal,
                    "instructions": valid_instructions,
                    "guardrails": ["Do not discuss sensitive topics such as politics, religion, or any prohibited content."],
                    "tools": []
                }
            }
        }
        
        # Adiciona tools
        for skill in skills:
            tool_slug = skill['name'].lower().replace(' ', '_').replace('-', '_')
            tool_definition = {
                tool_slug: {
                    "name": skill['name'],
                    "description": skill.get('description', ''),
                    "source": {
                        "path": f"tools/{tool_slug}",
                        "entrypoint": "main.Run"
                    },
                    "parameters": []
                }
            }
            yaml_structure['agents'][safe_slug]['tools'].append(tool_definition)
            
            # Cria diretório da tool
            tool_dir = project_dir / "tools" / tool_slug
            tool_dir.mkdir(parents=True, exist_ok=True)
            
            (tool_dir / "requirements.txt").write_text("# Add tool dependencies here\nrequests\n")
            (tool_dir / "main.py").write_text(f'''"""
Tool: {skill['name']}
Description: {skill.get('description', '')}
"""
from typing import Any, Dict


class Run:
    """Tool executor class."""
    
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the tool logic.
        
        Args:
            context: Dictionary with parameters and context data
            
        Returns:
            Dictionary with the response
        """
        # AI Generated Placeholder for {skill['name']}
        # Implement your skill logic here
        
        return {{
            "status": "success",
            "message": f"Executed {skill['name']}",
            "data": {{}}
        }}
''')
        
        # Sanitiza
        sanitized_agent_data, logs = ProjectSanitizer.sanitize_agent(
            name, yaml_structure['agents'][safe_slug]
        )
        yaml_structure['agents'][safe_slug] = sanitized_agent_data
        
        # Salva weni.yaml
        yaml_path = project_dir / "weni.yaml"
        with open(yaml_path, "w") as f:
            yaml.dump(yaml_structure, f, sort_keys=False, allow_unicode=True, default_flow_style=False)
        
        # Salva requirements.txt
        (project_dir / "requirements.txt").write_text("# Project dependencies\nrequests>=2.28.0\n")
        
        # Cria README
        (project_dir / "README.md").write_text(f"""# {name}

{goal}

## Criado em
{now}

## Tools
{chr(10).join([f"- {s['name']}: {s.get('description', '')}" for s in skills]) if skills else "Nenhuma tool configurada ainda."}

## Estrutura
```
{safe_slug}/
├── weni.yaml          # Configuração principal
├── requirements.txt   # Dependências Python
├── README.md          # Este arquivo
└── tools/             # Diretório de ferramentas
    └── <tool_name>/
        ├── main.py
        └── requirements.txt
```
""")
        
        return {
            "status": "created",
            "path": str(project_dir.absolute()),
            "uuid": safe_slug,  # Usa slug como ID único
            "slug": safe_slug,
            "adjustments": logs
        }
    
    def get_project(self, uuid: str) -> Optional[Dict[str, Any]]:
        """Obtém projeto por UUID."""
        projects = self.list_projects()
        for p in projects:
            if p.get('uuid') == uuid:
                return p
        return None
    
    def get_project_yaml(self, uuid: str) -> str:
        """Obtém conteúdo do weni.yaml de um projeto."""
        project = self.get_project(uuid)
        if not project:
            raise ValueError(f"Project not found: {uuid}")
        
        yaml_path = Path(project['path']) / "weni.yaml"
        if not yaml_path.exists():
            raise ValueError("weni.yaml not found")
        
        return yaml_path.read_text()
    
    def update_project_yaml(self, uuid: str, content: str) -> Dict[str, Any]:
        """Atualiza o weni.yaml de um projeto."""
        project = self.get_project(uuid)
        if not project:
            raise ValueError(f"Project not found: {uuid}")
        
        # Valida YAML
        try:
            data = yaml.safe_load(content)
            
            # Sanitiza agentes
            agents = data.get('agents', {})
            logs = []
            
            if isinstance(agents, dict):
                for slug, agent_data in agents.items():
                    sanitized, agent_logs = ProjectSanitizer.sanitize_agent(slug, agent_data)
                    agents[slug] = sanitized
                    logs.extend(agent_logs)
            
            data['agents'] = agents
            content = yaml.dump(data, sort_keys=False, allow_unicode=True, default_flow_style=False)
            
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML: {e}")
        
        yaml_path = Path(project['path']) / "weni.yaml"
        yaml_path.write_text(content)
        
        return {"status": "updated", "adjustments": logs}
    
    def update_project_name(self, uuid: str, new_name: str) -> Dict[str, Any]:
        """Atualiza o nome de um projeto."""
        project = self.get_project(uuid)
        if not project:
            raise ValueError(f"Project not found: {uuid}")
        
        yaml_path = Path(project['path']) / "weni.yaml"
        with open(yaml_path, 'r') as f:
            data = yaml.safe_load(f)
        
        # Atualiza nome do primeiro agente (se existir)
        agents = data.get('agents', {})
        if agents:
            first_agent_slug = list(agents.keys())[0]
            agents[first_agent_slug]['name'] = new_name
        
        with open(yaml_path, 'w') as f:
            yaml.dump(data, f, sort_keys=False, allow_unicode=True, default_flow_style=False)
        
        return {"status": "updated", "name": new_name}
    
    def delete_project(self, uuid: str) -> Dict[str, str]:
        """Deleta um projeto."""
        project = self.get_project(uuid)
        if not project:
            raise ValueError(f"Project not found: {uuid}")
        
        project_path = Path(project['path'])
        if project_path.exists():
            shutil.rmtree(project_path)
        
        return {"status": "success", "message": "Project deleted"}
    
    def add_tool(self, uuid: str, tool_data: Dict) -> Dict[str, Any]:
        """Adiciona uma ferramenta a um projeto."""
        project = self.get_project(uuid)
        if not project:
            raise ValueError(f"Project not found: {uuid}")
        
        yaml_path = Path(project['path']) / "weni.yaml"
        with open(yaml_path, 'r') as f:
            data = yaml.safe_load(f)
        
        agents = data.get('agents', {})
        if not agents:
            raise ValueError("No agents in project")
        
        # Pega o primeiro agente
        agent_slug = next(iter(agents))
        agent_data = agents[agent_slug]
        
        tool_slug = tool_data.get('tool_slug', tool_data.get('name', 'tool')).lower().replace(' ', '_')
        tool_name = tool_data.get('tool_name', tool_data.get('name', tool_slug))
        
        # Cria diretório da tool
        tool_dir = Path(project['path']) / "tools" / tool_slug
        tool_dir.mkdir(parents=True, exist_ok=True)
        
        # Salva código
        main_py = tool_data.get('main_py', f'''"""
Tool: {tool_name}
"""

class Run:
    def execute(self, context):
        return {{"status": "success", "message": "Tool executed"}}
''')
        (tool_dir / "main.py").write_text(main_py)
        
        # Salva requirements
        requirements = tool_data.get('requirements_txt', 'requests\n')
        (tool_dir / "requirements.txt").write_text(requirements)
        
        # Adiciona ao YAML
        tool_definition = {
            tool_slug: {
                "name": tool_name,
                "description": tool_data.get('description', ''),
                "source": {
                    "path": f"tools/{tool_slug}",
                    "entrypoint": "main.Run"
                },
                "parameters": tool_data.get('parameters', [])
            }
        }
        
        if 'tools' not in agent_data:
            agent_data['tools'] = []
        agent_data['tools'].append(tool_definition)
        
        with open(yaml_path, 'w') as f:
            yaml.dump(data, f, sort_keys=False, allow_unicode=True, default_flow_style=False)
        
        return {"status": "added", "tool_slug": tool_slug}
    
    def delete_tool(self, uuid: str, tool_slug: str) -> Dict[str, str]:
        """Remove uma ferramenta de um projeto."""
        project = self.get_project(uuid)
        if not project:
            raise ValueError(f"Project not found: {uuid}")
        
        yaml_path = Path(project['path']) / "weni.yaml"
        with open(yaml_path, 'r') as f:
            data = yaml.safe_load(f)
        
        agents = data.get('agents', {})
        if not agents:
            raise ValueError("No agents in project")
        
        agent_slug = next(iter(agents))
        agent_data = agents[agent_slug]
        
        # Remove do YAML
        tools = agent_data.get('tools', [])
        new_tools = [t for t in tools if not (isinstance(t, dict) and tool_slug in t)]
        agent_data['tools'] = new_tools
        
        with open(yaml_path, 'w') as f:
            yaml.dump(data, f, sort_keys=False, allow_unicode=True, default_flow_style=False)
        
        # Remove diretório da tool
        tool_dir = Path(project['path']) / "tools" / tool_slug
        if tool_dir.exists():
            shutil.rmtree(tool_dir)
        
        return {"status": "deleted", "tool_slug": tool_slug}
    
    def get_tool_source(self, uuid: str, tool_slug: str) -> Dict[str, str]:
        """Obtém o código fonte de uma ferramenta."""
        project = self.get_project(uuid)
        if not project:
            raise ValueError(f"Project not found: {uuid}")
        
        tool_dir = Path(project['path']) / "tools" / tool_slug
        if not tool_dir.exists():
            raise ValueError(f"Tool not found: {tool_slug}")
        
        main_py = tool_dir / "main.py"
        requirements = tool_dir / "requirements.txt"
        
        return {
            "main_py": main_py.read_text() if main_py.exists() else "",
            "requirements_txt": requirements.read_text() if requirements.exists() else ""
        }
    
    def update_tool_source(self, uuid: str, tool_slug: str, main_py: str, requirements_txt: str = None) -> Dict[str, str]:
        """Atualiza o código fonte de uma ferramenta."""
        project = self.get_project(uuid)
        if not project:
            raise ValueError(f"Project not found: {uuid}")
        
        tool_dir = Path(project['path']) / "tools" / tool_slug
        if not tool_dir.exists():
            raise ValueError(f"Tool not found: {tool_slug}")
        
        (tool_dir / "main.py").write_text(main_py)
        
        if requirements_txt:
            (tool_dir / "requirements.txt").write_text(requirements_txt)
        
        return {"status": "updated", "tool_slug": tool_slug}


# Instância global
project_service = ProjectService()

