# 🤖 Agentic Helper v1.0

Uma ferramenta poderosa para gerenciar, analisar e criar bases de conhecimento de repositórios de agentes de IA.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![Node](https://img.shields.io/badge/node-18+-green)

---

## 📋 Índice

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

## ✨ Funcionalidades

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
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │  Repos  │ │ Análise │ │  Chat   │ │ Busca   │ │ Admin  ││
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘│
└───────┼──────────┼──────────┼──────────┼───────────┼──────┘
        │          │          │          │           │
        ▼          ▼          ▼          ▼           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ GitHub API   │ │  AI Service  │ │Vector Service│        │
│  │  (Repos)     │ │ (OpenAI/     │ │  (ChromaDB)  │        │
│  │              │ │  Gemini/     │ │              │        │
│  │              │ │  Anthropic)  │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │Agent Service │ │Prompt Service│ │Metrics Svc   │        │
│  │  (Análise)   │ │  (Prompts)   │ │ (Histórico)  │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐        ┌───────────┐        ┌───────────┐
   │  JSON   │        │  ChromaDB │        │   APIs    │
   │ (Config,│        │  (Vetores)│        │ (OpenAI,  │
   │  KBs)   │        │           │        │  Gemini)  │
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

1. Clique no ícone de **engrenagem** (⚙️) no header
2. Insira seu **GitHub Token** (necessário para listar repositórios)
3. Selecione o **Provedor de IA** (OpenAI, Gemini ou Anthropic)
4. Insira a **API Key** do provedor escolhido
5. Selecione o **Modelo** desejado
6. Clique em **Salvar**

### 2. Análise de Repositórios

1. Na aba **Repositórios**, os repos com "agents" são listados automaticamente
2. Use o campo de busca para filtrar repositórios específicos
3. Selecione um ou mais repositórios
4. Clique em **Analisar Selecionados**
5. No popup, selecione as **pastas/agentes** que deseja analisar
6. Clique em **Iniciar Análise**
7. Acompanhe o progresso na lista de repositórios

### 3. Visualização da Base de Conhecimento

1. Vá para a aba **Base de Conhecimento**
2. Selecione entre visão **Técnica** ou **Negócio**
3. Navegue pelos repositórios e pastas analisados
4. Visualize APIs, integrações, fluxos, regras, etc.

### 4. Busca de Agentes

1. Vá para a aba **Buscar Agentes**
2. Primeiro, clique em **Indexar Agentes** na aba Indexação
3. Descreva o agente que você precisa
4. O sistema buscará agentes similares já existentes
5. Veja recomendações e porcentagem de cobertura

### 5. Chat

1. Vá para a aba **Chat**
2. Selecione o modo (Técnico/Negócio)
3. Ative o **RAG** para respostas contextualizadas
4. Faça perguntas sobre os agentes analisados

### 6. Debug

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
```

### Arquivos de Configuração

- `backend/app_config.json` - Configurações persistentes (tokens, modelo)
- `backend/knowledge_bases.json` - Bases de conhecimento geradas
- `backend/prompts.json` - Prompts customizados
- `backend/analysis_history.json` - Histórico de análises
- `backend/metrics.json` - Métricas de uso

---

## 🔌 API

### Principais Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/repos` | Lista repositórios |
| GET | `/api/repos/{owner}/{repo}/folders` | Lista pastas de um repo |
| POST | `/api/analysis/analyze/{owner}/{repo}` | Inicia análise |
| GET | `/api/analysis/knowledge-bases` | Lista bases de conhecimento |
| POST | `/api/analysis/chat` | Chat com contexto |
| POST | `/api/analysis/debug` | Debug de agente |
| POST | `/api/search/find-agent` | Busca agentes similares |
| POST | `/api/search/index-all` | Indexa todas as KBs |
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
│   │   │   └── admin.py           # Endpoints admin
│   │   ├── services/
│   │   │   ├── ai_service.py      # Integração com IAs
│   │   │   ├── agent_service.py   # Lógica de análise
│   │   │   ├── github_service.py  # Integração GitHub
│   │   │   ├── vector_service.py  # ChromaDB/RAG
│   │   │   ├── prompt_service.py  # Gerenciamento de prompts
│   │   │   ├── auth_service.py    # Autenticação
│   │   │   └── metrics_service.py # Métricas
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
│   │   │   └── SettingsModal.tsx
│   │   ├── services/
│   │   │   └── api.ts             # Cliente API
│   │   ├── stores/
│   │   │   └── appStore.ts        # Estado global (Zustand)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
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
