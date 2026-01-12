# 🤖 Agentic Helper v2.0

Uma plataforma completa para **criar, gerenciar e analisar agentes de IA inteligentes**.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![Node](https://img.shields.io/badge/node-18+-green)

---

## 📋 Índice

- [Novidades v2.0](#-novidades-v20)
- [Funcionalidades](#-funcionalidades)
- [Arquitetura](#-arquitetura)
- [Requisitos](#-requisitos)
- [Instalação](#-instalação)
- [Execução](#-execução)
- [Uso](#-uso)
- [Configuração](#-configuração)
- [API](#-api)
- [Estrutura do Projeto](#-estrutura-do-projeto)

---

## 🎉 Novidades v2.0

### 🆕 Criação de Agentes
- **Wizard com IA**: Crie agentes descrevendo o objetivo e a IA sugere instruções e habilidades
- **Editor YAML**: Edição direta do `weni.yaml` com validação automática
- **Estrutura de Projeto**: Cada agente tem sua pasta com tools organizadas

### 🔧 Geração de Ferramentas (Tools)
- **Biblioteca Oficial**: 12+ tools prontas para uso (VTEX, Zendesk, Correios, etc.)
- **Gerador via IA**: Crie tools a partir de documentação de APIs ou URLs
- **Código Pronto**: Python gerado seguindo as melhores práticas

### 📦 Gerenciamento de Projetos
- **CRUD Completo**: Criar, editar, deletar projetos
- **Versionamento**: Controle de versão local de cada agente
- **Multi-projeto**: Gerencie vários agentes simultaneamente

---

## ✨ Funcionalidades

### 🤖 Gerenciamento de Projetos
- **Criação de Agentes**: Wizard com preview IA para criar novos agentes
- **Editor YAML**: Edição direta do `weni.yaml` com validação
- **Estrutura Organizada**: Projetos com tools separadas por diretório

### 🔧 Biblioteca de Ferramentas (Tools)
- **12+ Tools Oficiais**: VTEX, Zendesk, Google Sheets, Correios, Intelipost, WhatsApp, etc.
- **Gerador via URL**: Cria tools a partir de documentação de APIs
- **Gerador via Texto**: Cole a documentação e gere o código
- **Categorias**: E-commerce, Suporte, Logística, Messaging, Data, Integration

### 📦 Gerenciamento de Repositórios
- Listagem de todos os repositórios GitHub acessíveis
- Filtro automático por repositórios contendo "agents" no nome
- Seleção múltipla de repositórios e pastas para análise
- Visualização do status de análise (processando, pendente, concluído, erro)

### 🧠 Análise Inteligente com IA
- **Base de Conhecimento Técnica**: APIs, endpoints, integrações, webhooks, regras de negócio, fluxos de dados, handlers, validações
- **Base de Conhecimento de Negócio**: Funcionalidades, casos de uso, personas, fluxos detalhados, FAQ, glossário
- Suporte a múltiplos provedores de IA:
  - OpenAI (GPT-4o, GPT-4, GPT-3.5, o1, o3)
  - Google Gemini (2.0, 1.5, Pro)
  - Anthropic (Claude Sonnet 4.0, Claude 3.5, Claude 3)

### 🔍 Busca Semântica de Agentes (RAG)
- Indexação de todas as bases de conhecimento em banco vetorial (ChromaDB)
- Busca por similaridade usando embeddings (sentence-transformers)
- Encontre agentes existentes antes de criar novos
- Recomendações inteligentes baseadas em descrição

### 💬 Chat Inteligente
- Perguntas e respostas sobre os agentes analisados
- Modo técnico ou de negócio
- Contexto RAG opcional para respostas mais precisas
- Streaming de respostas em tempo real

### 🐛 Debug de Agentes
- Análise de problemas em agentes existentes
- Upload do JSON de retorno do agente
- Identificação automática de discrepâncias
- Sugestões de correção na lógica das tools

### ⚙️ Administração
- **Gerenciamento de Prompts**: Criar, editar, testar prompts dinâmicos
- **Métricas**: Histórico de análises, tokens utilizados, custos estimados
- **Configurações por prompt**: Modelo, temperatura, max_tokens específicos
- **Login protegido** para área administrativa

---

## 🏗 Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React/Vite)                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐│
│  │Projects │ │ Tools   │ │Analyzer │ │  Chat   │ │   Admin/Debug   ││
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └───────┬─────────┘│
└───────┼──────────┼──────────┼──────────┼─────────────────┼──────────┘
        │          │          │          │                 │
        ▼          ▼          ▼          ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI)                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ ProjectsAPI  │ │  Tools API   │ │  GitHub API  │ │  Chat API   │ │
│  │  (weni.yaml) │ │  (Generate)  │ │  (Repos)     │ │  (RAG)      │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │  AI Service  │ │VectorService │ │AgentAnalyzer │ │  Metrics    │ │
│  │ (Multi-LLM)  │ │  (ChromaDB)  │ │  (KB Gen)    │ │  (History)  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐        ┌───────────┐        ┌───────────┐
   │  JSON   │        │  ChromaDB │        │   APIs    │
   │(Config) │        │ (Vectors) │        │ (OpenAI,  │
   │         │        │           │        │  Gemini)  │
   └─────────┘        └───────────┘        └───────────┘
```

---

## 📋 Requisitos

- **Python** 3.10 ou superior
- **Node.js** 18 ou superior
- **npm** ou **yarn**
- **Git**
- Token de acesso GitHub (com permissão de leitura de repos)
- API Key de pelo menos um provedor de IA (OpenAI, Gemini ou Anthropic)

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/agentic-helper.git
cd agentic-helper
```

### 2. Configure o Backend

```bash
cd backend

# Crie o ambiente virtual
python -m venv venv

# Ative o ambiente virtual
source venv/bin/activate  # Linux/Mac
# ou
.\venv\Scripts\activate  # Windows

# Instale as dependências
pip install -r requirements.txt
```

### 3. Configure o Frontend

```bash
cd frontend

# Instale as dependências
npm install
```

---

## ▶️ Execução

### Opção 1: Script automático

```bash
# Na raiz do projeto
chmod +x start.sh
./start.sh
```

### Opção 2: Manual

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Acesse a aplicação

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs
- **Admin**: http://localhost:5173/admin

---

## 📖 Uso

### 1. Configuração Inicial

1. Clique no ícone de **engrenagem** (⚙️) no menu lateral
2. Insira seu **GitHub Token** (necessário para listar repositórios)
3. Selecione o **Provedor de IA** (OpenAI, Gemini ou Anthropic)
4. Insira a **API Key** do provedor escolhido
5. Selecione o **Modelo** desejado
6. Clique em **Salvar**

### 2. Criar Novo Projeto (v2.0)

1. Na aba **Projetos**, clique em **"+ Novo Projeto"**
2. Preencha o **Nome** do agente
3. (Opcional) Insira o **UUID** do projeto na Weni Cloud
4. Descreva o **Objetivo** do agente
5. Clique em **"Gerar Preview com IA"**
6. Revise as instruções e habilidades sugeridas
7. Clique em **"Aprovar e Criar"**

### 3. Adicionar Ferramentas (Tools) - v2.0

1. Vá para a aba **"Ferramentas"**
2. Explore a **Biblioteca Oficial** por categoria
3. Clique em uma tool para ver detalhes e gerar código
4. Ou clique em **"Gerar Ferramenta"** para criar via IA:
   - Selecione o projeto de destino
   - Cole documentação ou URL da API
   - Clique em **"Gerar Código"**
5. Salve a tool no projeto

### 4. Análise de Repositórios

1. Na aba **Repositórios**, os repos com "agents" são listados automaticamente
2. Use o campo de busca para filtrar repositórios específicos
3. Selecione um ou mais repositórios
4. Clique em **Analisar Selecionados**
5. No popup, selecione as **pastas/agentes** que deseja analisar
6. Clique em **Iniciar Análise**
7. Acompanhe o progresso na lista de repositórios

### 5. Visualização da Base de Conhecimento

1. Vá para a aba **Base de Conhecimento**
2. Selecione entre visão **Técnica** ou **Negócio**
3. Navegue pelos repositórios e pastas analisados
4. Visualize APIs, integrações, fluxos, regras, etc.

### 6. Busca de Agentes

1. Vá para a aba **Buscar Agentes**
2. Primeiro, clique em **Indexar Agentes** na aba Indexação
3. Descreva o agente que você precisa
4. O sistema buscará agentes similares já existentes
5. Veja recomendações e porcentagem de cobertura

### 7. Chat

1. Vá para a aba **Chat**
2. Selecione o modo (Técnico/Negócio)
3. Ative o **RAG** para respostas contextualizadas
4. Faça perguntas sobre os agentes analisados

### 8. Debug

1. Vá para a aba **Debug**
2. Selecione o repositório e pasta do agente
3. Descreva o problema encontrado
4. Cole o JSON de retorno do agente
5. Receba análise detalhada com sugestões de correção

---

## ⚙️ Configuração

### Variáveis de Ambiente (opcional)

Crie um arquivo `.env` na pasta `backend/`:

```env
# GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Google Gemini
GEMINI_API_KEY=AIzaxxxxxxxxxxxxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# Weni Cloud Integration (opcional - valores padrão funcionam para produção)
WENI_API_URL=https://api.weni.ai
WENI_ACCOUNTS_URL=https://accounts.weni.ai
WENI_CLIENT_ID=weni-cli
WENI_REALM=weni
```

### Arquivos de Configuração

- `app_config.json` - Configurações persistentes (tokens, modelo)
- `knowledge_bases.json` - Bases de conhecimento geradas
- `prompts.json` - Prompts customizados
- `analysis_history.json` - Histórico de análises
- `metrics.json` - Métricas de uso
- `projects/` - Diretório com projetos de agentes (v2.0)

---

## 🔌 API

### Projetos (v2.0)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/projects` | Lista projetos |
| POST | `/api/projects` | Cria projeto |
| GET | `/api/projects/{uuid}` | Obtém projeto |
| PATCH | `/api/projects/{uuid}` | Atualiza projeto |
| DELETE | `/api/projects/{uuid}` | Deleta projeto |
| GET | `/api/projects/{uuid}/yaml` | Obtém YAML |
| POST | `/api/projects/{uuid}/yaml` | Salva YAML |
| GET | `/api/projects/{uuid}/tools` | Lista tools |
| POST | `/api/projects/{uuid}/tools` | Adiciona tool |
| DELETE | `/api/projects/{uuid}/tools/{slug}` | Remove tool |
| POST | `/api/projects/preview` | Preview com IA |

### Ferramentas (v2.0)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/tools/official` | Lista tools oficiais |
| GET | `/api/tools/official/{slug}` | Obtém tool oficial |
| POST | `/api/tools/official/{slug}/generate` | Gera código da tool |
| POST | `/api/tools/generate` | Gera tool via IA |
| POST | `/api/tools/improve` | Melhora código |
| GET | `/api/tools/categories` | Lista categorias |

### Repositórios

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/repos` | Lista repositórios |
| GET | `/api/repos/{owner}/{repo}/folders` | Lista pastas de um repo |

### Análise

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/analysis/analyze/{owner}/{repo}` | Inicia análise |
| GET | `/api/analysis/knowledge-bases` | Lista bases de conhecimento |

### Chat e Busca

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/analysis/chat` | Chat com contexto |
| POST | `/api/analysis/debug` | Debug de agente |
| POST | `/api/search/find-agent` | Busca agentes similares |
| POST | `/api/search/index-all` | Indexa todas as KBs |

### Admin

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/prompts` | Lista prompts |
| POST | `/api/prompts` | Cria prompt |
| GET | `/api/admin/metrics` | Métricas de uso |
| GET | `/api/admin/history` | Histórico de análises |

Documentação completa: http://localhost:8001/docs

---

## 📁 Estrutura do Projeto

```
agentic-helper/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   └── config.py          # Configurações
│   │   ├── models/
│   │   │   └── schemas.py         # Schemas Pydantic
│   │   ├── routers/
│   │   │   ├── analysis.py        # Endpoints de análise
│   │   │   ├── config.py          # Endpoints de config
│   │   │   ├── repositories.py    # Endpoints de repos
│   │   │   ├── search.py          # Endpoints de busca
│   │   │   ├── prompts.py         # Endpoints de prompts
│   │   │   ├── admin.py           # Endpoints admin
│   │   │   ├── projects.py        # Endpoints de projetos (v2.0)
│   │   │   └── tools.py           # Endpoints de tools (v2.0)
│   │   ├── services/
│   │   │   ├── ai_service.py      # Integração com IAs
│   │   │   ├── agent_service.py   # Lógica de análise
│   │   │   ├── github_service.py  # Integração GitHub
│   │   │   ├── vector_service.py  # ChromaDB/RAG
│   │   │   ├── prompt_service.py  # Gerenciamento de prompts
│   │   │   ├── auth_service.py    # Autenticação
│   │   │   ├── metrics_service.py # Métricas
│   │   │   ├── project_service.py # Gerenciamento de projetos (v2.0)
│   │   │   └── tool_service.py    # Geração de tools (v2.0)
│   │   └── main.py                # App FastAPI
│   ├── requirements.txt
│   └── venv/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── RepositoryList.tsx
│   │   │   ├── KnowledgeBasePanel.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── AgentFinder.tsx
│   │   │   ├── IndexPanel.tsx
│   │   │   ├── DebugPanel.tsx
│   │   │   ├── PromptAdmin.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── SettingsModal.tsx
│   │   │   ├── ProjectsView.tsx   # Projetos (v2.0)
│   │   │   └── ToolsView.tsx      # Ferramentas (v2.0)
│   │   ├── services/
│   │   │   └── api.ts             # Cliente API
│   │   ├── stores/
│   │   │   └── appStore.ts        # Estado global (Zustand)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── projects/                       # Projetos de agentes (v2.0)
│   └── accounts/
│       └── default/
│           └── {agent-slug}/
│               ├── weni.yaml
│               ├── requirements.txt
│               ├── README.md
│               └── tools/
│                   └── {tool-slug}/
│                       ├── main.py
│                       └── requirements.txt
├── start.sh                        # Script de inicialização
└── README.md
```

---

## 🔒 Segurança

- Tokens são armazenados localmente no servidor
- Área administrativa protegida por login
- Credenciais padrão admin: `admin` / `admin123` (altere em produção)
- Não exponha a aplicação diretamente na internet sem HTTPS

---

## 📝 Changelog

### v2.0.0 (2025-01-06)
- ✅ **Criação de Agentes** com wizard + IA
- ✅ **Editor YAML** com validação
- ✅ **Biblioteca de Tools Oficiais** (12+ tools)
- ✅ **Gerador de Tools via IA** (documentação/URL)
- ✅ **Gerenciamento de Projetos** (CRUD completo)
- ✅ **Estrutura de Projetos** organizada
- ✅ Nova sidebar com seção "Criação"
- ✅ Interface modernizada

### v1.0.0 (2025-01-06)
- ✅ Gerenciamento de repositórios GitHub
- ✅ Análise com IA (OpenAI, Gemini, Anthropic)
- ✅ Base de conhecimento técnica e de negócio
- ✅ Busca semântica de agentes (RAG)
- ✅ Chat inteligente com contexto
- ✅ Debug de agentes
- ✅ Administração de prompts
- ✅ Métricas e histórico
- ✅ Interface moderna e responsiva

---

## 🤝 Contribuição

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👨‍💻 Autor

Desenvolvido com ❤️ para facilitar o gerenciamento de agentes de IA.
