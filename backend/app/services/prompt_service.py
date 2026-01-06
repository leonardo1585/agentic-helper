"""
Serviço de gerenciamento de prompts.
Permite criar, editar, testar e gerenciar prompts de forma dinâmica.
"""
import json
import uuid
import time
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List

from ..models.schemas import (
    PromptConfig, 
    PromptCreate, 
    PromptUpdate, 
    PromptCategory,
    PromptTest,
    PromptTestResult,
    AIProvider
)


class PromptService:
    """Serviço para gerenciamento de prompts."""
    
    def __init__(self):
        # Usa o mesmo diretório base do projeto
        base_dir = Path(__file__).parent.parent.parent.parent
        self.prompts_file = base_dir / "prompts.json"
        self._prompts: Dict[str, PromptConfig] = {}
        self._load_prompts()
        self._init_default_prompts()
    
    def _load_prompts(self):
        """Carrega prompts do arquivo."""
        if self.prompts_file.exists():
            try:
                data = json.loads(self.prompts_file.read_text())
                for prompt_data in data.get("prompts", []):
                    prompt = PromptConfig(**prompt_data)
                    self._prompts[prompt.id] = prompt
            except Exception as e:
                print(f"Erro ao carregar prompts: {e}")
    
    def _save_prompts(self):
        """Salva prompts no arquivo."""
        data = {
            "prompts": [p.model_dump(mode='json') for p in self._prompts.values()]
        }
        self.prompts_file.write_text(json.dumps(data, indent=2, default=str))
    
    def _init_default_prompts(self):
        """Inicializa prompts padrão se não existirem."""
        
        # Prompt de análise técnica COMPLETO
        technical_system_prompt = """Você é um arquiteto de software sênior fazendo onboarding de um novo desenvolvedor.
Analise CADA LINHA de código e extraia TODOS os detalhes técnicos. Um novo dev precisa entender TUDO sem ler o código.

REGRAS CRÍTICAS:
1. Para CADA função/handler, liste: nome, parâmetros necessários, o que faz passo a passo, o que retorna
2. Para CADA integração externa (API, planilha, banco), liste: nome, URL/conexão, para que é usada, dados trocados
3. Para CADA validação, liste: o que valida, quando é aplicada, o que acontece se falhar
4. Liste TODOS os fluxos de dados: de onde vem → para onde vai → o que acontece
5. Identifique conexões com: planilhas Google, APIs externas (VTEX, etc), bancos de dados, filas

Retorne APENAS um JSON válido (sem markdown):
{
    "technical_summary": "Resumo de 5+ parágrafos explicando: 1) O que o sistema faz, 2) Como está organizado, 3) Principais fluxos, 4) Integrações críticas, 5) Pontos de atenção",
    "architecture_diagram": "Diagrama ASCII mostrando: Entrada → Processamento → Saídas e todas as conexões externas",
    "handlers_detail": [
        {
            "name": "nome_do_handler",
            "file": "arquivo.py",
            "purpose": "O que este handler faz em detalhes",
            "input_parameters": [{"name": "param", "type": "tipo", "required": true, "description": "para que serve"}],
            "process_steps": ["Passo 1: faz X", "Passo 2: chama Y", "Passo 3: valida Z"],
            "external_calls": [{"service": "nome", "endpoint": "url/método", "purpose": "para que chama"}],
            "validations": ["Valida se X está presente", "Verifica se loja é válida"],
            "output": "O que retorna/faz ao final"
        }
    ],
    "data_sources": [
        {
            "name": "Nome da fonte (ex: Planilha de Lojas Válidas)",
            "type": "google_sheet/api/database",
            "connection": "Como se conecta (URL, credencial, etc)",
            "data_provided": ["ID de árvore", "ID de fila", "Lista de lojas válidas"],
            "used_by": ["handler1", "handler2"]
        }
    ],
    "api_endpoints": [{"method": "POST", "path": "/caminho", "description": "detalhes", "parameters": [], "response": ""}],
    "external_apis_consumed": [
        {"name": "VTEX/Planilha/etc", "base_url": "url", "endpoints_used": [], "authentication": "tipo", "purpose": "Para que é usada", "data_exchanged": ["dados enviados/recebidos"]}
    ],
    "business_rules": [
        {"name": "Regra", "trigger": "Quando é acionada", "conditions": ["Se X", "E Y"], "actions": ["Faz A", "Retorna B"], "handler": "onde está implementada"}
    ],
    "validation_flows": [
        {"name": "Validação de Loja", "description": "Verifica se loja da VTEX é válida consultando planilha", "data_source": "planilha X", "on_success": "continua", "on_failure": "retorna erro Y"}
    ],
    "technologies": [],
    "dependencies": [],
    "services": [],
    "integrations": [],
    "technical_documentation": "# Documentação Técnica Completa..."
}"""

        technical_user_template = """Repositório: {repo_name}

INSTRUÇÕES CRÍTICAS - LEIA COM ATENÇÃO:
1. Analise CADA arquivo de código linha por linha
2. Para CADA handler/função, extraia: parâmetros, passos de execução, chamadas externas
3. Identifique TODAS as conexões: planilhas Google Sheets, APIs (VTEX, etc), bancos
4. Liste TODAS as validações: o que valida, de onde vem os dados de validação
5. Documente TODOS os fluxos: troca de endereço, consulta de pedido, etc.

PERGUNTAS QUE A DOCUMENTAÇÃO DEVE RESPONDER:
- Quais parâmetros preciso passar para cada operação?
- De onde vem o ID de árvore e ID de fila? (planilha? qual?)
- Como saber se uma loja é válida? (consulta onde?)
- Quais APIs externas são chamadas e para quê?
- Quais validações são feitas antes de cada operação?

Arquivos do projeto (analise TODOS em detalhes):

{files_content}

Gere documentação COMPLETA onde um novo dev entenda TUDO sem precisar ler o código:"""

        # Prompt de análise de negócio COMPLETO
        business_system_prompt = """Você é um Product Manager explicando um sistema para a equipe de negócios e atendimento.
Analise o código e documente TUDO que o sistema faz de forma prática e clara.

REGRAS CRÍTICAS:
1. Liste CADA funcionalidade que o sistema oferece
2. Para CADA funcionalidade, explique: quando usar, que informações precisa, o que acontece
3. Documente TODOS os fluxos passo a passo (ex: troca de endereço, consulta de pedido)
4. Explique as integrações de forma simples (ex: "consulta planilha de lojas válidas")
5. Crie FAQ respondendo dúvidas reais que um atendente teria

Retorne APENAS um JSON válido (sem markdown):
{
    "product_name": "Nome claro do agente/sistema",
    "product_description": "Descrição de 5+ parágrafos: O que é, Para que serve, Quem usa, Como ajuda no dia a dia, Principais benefícios",
    "capabilities": [
        {
            "name": "Nome da Capacidade (ex: Troca de Endereço)",
            "description": "O que faz em linguagem simples",
            "when_to_use": "Em qual situação usar esta funcionalidade",
            "required_info": ["CPF do cliente", "Número do pedido", "Novo endereço"],
            "process": "Passo a passo do que acontece quando acionado",
            "possible_outcomes": ["Sucesso: endereço atualizado", "Erro: loja não permite troca"],
            "dependencies": ["Consulta planilha de lojas válidas", "Atualiza na VTEX"]
        }
    ],
    "main_features": ["Funcionalidade 1: descrição completa"],
    "detailed_flows": [
        {
            "name": "Nome do Fluxo",
            "trigger": "O que inicia este fluxo",
            "prerequisites": ["O que precisa ter/saber antes"],
            "steps": ["1. Passo", "2. Passo"],
            "possible_errors": ["Erro 1", "Erro 2"],
            "external_systems": ["Sistema 1", "Sistema 2"]
        }
    ],
    "use_cases": ["Caso real com detalhes"],
    "target_users": ["Tipo de usuário"],
    "integrations_summary": [
        {"system": "Nome", "purpose": "Para que é usado", "data_involved": ["dados"]}
    ],
    "faq": [
        {"question": "Pergunta comum?", "answer": "Resposta clara"}
    ],
    "glossary": [{"term": "termo", "definition": "explicação"}],
    "user_documentation": "# Manual do Sistema..."
}"""

        business_user_template = """Repositório: {repo_name}

OBJETIVO: Criar documentação que um atendente/analista de negócio entenda COMPLETAMENTE o sistema.

PERGUNTAS QUE A DOCUMENTAÇÃO DEVE RESPONDER:
- Quais funcionalidades o sistema oferece?
- Para cada funcionalidade: o que preciso informar? O que vai acontecer?
- Quais são os fluxos passo a passo? (ex: troca de endereço)
- Com quais sistemas externos ele se conecta? (VTEX, planilhas, etc)
- Quais validações são feitas? (ex: loja válida)
- De onde vêm dados como ID de árvore, ID de fila?
- Quais erros podem acontecer e por quê?

Arquivos do projeto (extraia TODAS as funcionalidades):

{files_content}

Gere documentação COMPLETA onde qualquer pessoa entenda o sistema sem conhecimento técnico:"""

        # Prompt de debug COMPLETO
        debug_system_prompt = """Você é um especialista em debugging de agentes de IA/chatbots para e-commerce (VTEX).
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
    "root_cause": "Causa raiz ESPECÍFICA",
    "data_analysis": {
        "seller_info": "Identificação do seller no JSON",
        "data_returned": "O que foi retornado ao usuário",
        "data_expected": "O que DEVERIA ter sido retornado",
        "discrepancy": "A diferença/erro identificado"
    },
    "data_flow": "Caminho dos dados",
    "tool_logic_issue": "Problema específico na lógica da tool/função",
    "affected_handlers": ["handlers envolvidos"],
    "affected_code_locations": ["arquivo.py - descrição"],
    "evidence": ["evidências do JSON"],
    "suggestions": ["correções específicas"],
    "confidence": "low/medium/high"
}"""

        debug_user_template = "PROBLEMA: {problem_description}\n\nCONTEXTO:\n{context}"

        default_prompts = [
            {
                "id": "technical_kb",
                "name": "Análise Técnica",
                "description": "Gera base de conhecimento técnica detalhada para desenvolvedores",
                "category": PromptCategory.ANALYSIS_TECHNICAL,
                "system_prompt": technical_system_prompt,
                "user_prompt_template": technical_user_template,
                "temperature": 0.3,
                "max_tokens": 4096
            },
            {
                "id": "business_kb",
                "name": "Análise de Negócio",
                "description": "Gera base de conhecimento para equipe de negócios e atendimento",
                "category": PromptCategory.ANALYSIS_BUSINESS,
                "system_prompt": business_system_prompt,
                "user_prompt_template": business_user_template,
                "temperature": 0.5,
                "max_tokens": 4096
            },
            {
                "id": "debug_analysis",
                "name": "Debug de Problemas",
                "description": "Analisa e identifica causa raiz de problemas em agentes",
                "category": PromptCategory.DEBUG,
                "system_prompt": debug_system_prompt,
                "user_prompt_template": debug_user_template,
                "temperature": 0.3,
                "max_tokens": 4096
            },
            {
                "id": "chat_general",
                "name": "Chat Geral",
                "description": "Responde perguntas sobre os agentes analisados",
                "category": PromptCategory.CHAT,
                "system_prompt": """Você é um assistente especializado que conhece profundamente os agentes e sistemas analisados.
Use o contexto fornecido para responder perguntas de forma clara e precisa.

REGRAS:
1. Baseie suas respostas no contexto fornecido
2. Se não souber algo, diga claramente
3. Seja objetivo e direto
4. Forneça exemplos quando apropriado
5. Use linguagem adequada ao tipo de pergunta (técnica ou negócio)""",
                "user_prompt_template": "CONTEXTO:\n{context}\n\nPERGUNTA: {question}",
                "temperature": 0.7,
                "max_tokens": 2048
            },
            {
                "id": "agent_search",
                "name": "Busca de Agentes",
                "description": "Encontra agentes similares baseado em descrição",
                "category": PromptCategory.SEARCH,
                "system_prompt": """Você é um especialista em identificar agentes de IA existentes.
Analise a descrição fornecida e compare com os agentes disponíveis.

Identifique:
1. Agentes que fazem exatamente o que foi descrito
2. Agentes que fazem algo similar
3. Funcionalidades que podem ser reutilizadas
4. Diferenças importantes entre o desejado e o existente

Responda de forma estruturada indicando matches e recomendações.""",
                "user_prompt_template": "DESCRIÇÃO DO AGENTE DESEJADO:\n{description}\n\nAGENTES DISPONÍVEIS:\n{available_agents}",
                "temperature": 0.3,
                "max_tokens": 2048
            }
        ]
        
        # Adiciona apenas prompts que não existem
        for prompt_data in default_prompts:
            if prompt_data["id"] not in self._prompts:
                prompt = PromptConfig(
                    **prompt_data,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                self._prompts[prompt.id] = prompt
        
        self._save_prompts()
    
    def list_prompts(self, category: Optional[PromptCategory] = None) -> List[PromptConfig]:
        """Lista todos os prompts, opcionalmente filtrados por categoria."""
        prompts = list(self._prompts.values())
        if category:
            prompts = [p for p in prompts if p.category == category]
        return sorted(prompts, key=lambda p: p.name)
    
    def get_prompt(self, prompt_id: str) -> Optional[PromptConfig]:
        """Retorna um prompt pelo ID."""
        return self._prompts.get(prompt_id)
    
    def get_prompt_by_category(self, category: PromptCategory) -> Optional[PromptConfig]:
        """Retorna o primeiro prompt ativo de uma categoria."""
        for prompt in self._prompts.values():
            if prompt.category == category and prompt.is_active:
                return prompt
        return None
    
    def create_prompt(self, data: PromptCreate) -> PromptConfig:
        """Cria um novo prompt."""
        prompt = PromptConfig(
            id=str(uuid.uuid4())[:8],
            name=data.name,
            description=data.description,
            category=data.category,
            system_prompt=data.system_prompt,
            user_prompt_template=data.user_prompt_template,
            model=data.model,
            provider=data.provider,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        self._prompts[prompt.id] = prompt
        self._save_prompts()
        return prompt
    
    def update_prompt(self, prompt_id: str, data: PromptUpdate) -> Optional[PromptConfig]:
        """Atualiza um prompt existente."""
        prompt = self._prompts.get(prompt_id)
        if not prompt:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if value is not None:
                setattr(prompt, key, value)
        
        prompt.updated_at = datetime.now()
        self._prompts[prompt_id] = prompt
        self._save_prompts()
        return prompt
    
    def delete_prompt(self, prompt_id: str) -> bool:
        """Deleta um prompt."""
        if prompt_id in self._prompts:
            del self._prompts[prompt_id]
            self._save_prompts()
            return True
        return False
    
    def duplicate_prompt(self, prompt_id: str, new_name: str) -> Optional[PromptConfig]:
        """Duplica um prompt existente."""
        original = self._prompts.get(prompt_id)
        if not original:
            return None
        
        new_prompt = PromptConfig(
            id=str(uuid.uuid4())[:8],
            name=new_name,
            description=f"Cópia de: {original.description}",
            category=original.category,
            system_prompt=original.system_prompt,
            user_prompt_template=original.user_prompt_template,
            model=original.model,
            provider=original.provider,
            temperature=original.temperature,
            max_tokens=original.max_tokens,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        self._prompts[new_prompt.id] = new_prompt
        self._save_prompts()
        return new_prompt
    
    async def test_prompt(self, test: PromptTest) -> PromptTestResult:
        """Testa um prompt com variáveis fornecidas."""
        from .ai_service import ai_service
        
        prompt = self._prompts.get(test.prompt_id)
        if not prompt:
            raise ValueError(f"Prompt não encontrado: {test.prompt_id}")
        
        # Renderiza o template
        try:
            rendered_prompt = prompt.user_prompt_template.format(**test.variables)
        except KeyError as e:
            raise ValueError(f"Variável não fornecida: {e}")
        
        # Executa
        start_time = time.time()
        response = await ai_service.generate(
            rendered_prompt, 
            prompt.system_prompt
        )
        duration_ms = int((time.time() - start_time) * 1000)
        
        return PromptTestResult(
            prompt_id=test.prompt_id,
            input_rendered=rendered_prompt,
            output=response,
            model_used=ai_service.model or "default",
            duration_ms=duration_ms
        )
    
    def render_prompt(self, prompt_id: str, variables: dict) -> tuple[str, str]:
        """Renderiza um prompt com variáveis e retorna (system_prompt, user_prompt)."""
        prompt = self._prompts.get(prompt_id)
        if not prompt:
            raise ValueError(f"Prompt não encontrado: {prompt_id}")
        
        try:
            rendered = prompt.user_prompt_template.format(**variables)
        except KeyError as e:
            raise ValueError(f"Variável não fornecida: {e}")
        
        return prompt.system_prompt, rendered
    
    def get_prompt_variables(self, prompt_id: str) -> List[str]:
        """Retorna lista de variáveis necessárias para um prompt."""
        prompt = self._prompts.get(prompt_id)
        if not prompt:
            return []
        
        import re
        # Encontra todas as variáveis no formato {variavel}
        variables = re.findall(r'\{(\w+)\}', prompt.user_prompt_template)
        return list(set(variables))


# Instância global
prompt_service = PromptService()

