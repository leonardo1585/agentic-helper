# 🚀 Guia de Autodeploy para a Web

Este projeto já está configurado para ser implantado facilmente usando **Docker**. A maneira mais simples e gratuita de hospedá-lo é através do [Render.com](https://render.com).

## Pré-requisitos

1. O projeto deve estar no seu **GitHub** (faça commit e push das alterações que acabei de fazer, incluindo o `Dockerfile`).

## Passo a Passo no Render

1. Crie uma conta no [Render.com](https://render.com).
2. Clique no botão **"New +"** e selecione **"Web Service"**.
3. Conecte sua conta do GitHub e selecione o repositório deste projeto (`agentic-helper`).
4. O Render detectará automaticamente o arquivo `Dockerfile`.
5. Preencha os campos básicos:
   - **Name**: `meu-gth-app` (ou o que preferir)
   - **Region**: Escolha a mais próxima (ex: Ohio ou Frankfurt)
   - **Branch**: `main` (ou sua branch atual)
   - **Instance Type**: `Free` (para testes) ou `Starter` (para produção)

6.  ⏬ role para baixo até a seção **Environment Variables** e adicione as chaves necessárias (baseado no seu `.env`):
    *   `GITHUB_TOKEN`
    *   `OPENAI_API_KEY` (ou `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`)
    *   `WENI_CLIENT_ID` (se estiver usando autenticação Weni)
    *   `WENI_REALM`
    *   Outras variáveis que você usa no `.env` local.

7. Clique em **"Create Web Service"**.

## O que acontece agora?

1. O Render vai baixar seu código.
2. Vai criar um container Docker seguindo as instruções que criei no `Dockerfile`:
   - Compila o Frontend (React/Vite).
   - Instala as dependências do Backend (Python).
   - Junta tudo num único servidor.
3. Em alguns minutos, sua aplicação estará online em `https://meu-gth-app.onrender.com`!

## Dúvidas Comuns

- **Onde está o banco de dados?** 
  Este projeto usa ChromaDB local (dentro do container). No plano Free do Render, o disco é efêmero, então os dados indexados podem sumir se o serviço reiniciar. Para persistência real, recomenda-se configurar um volume de disco (plano pago) ou usar um banco externo.

- **Preciso configurar URL do Backend?**
  Não! O sistema foi configurado para que o Frontend e Backend rodem na mesma URL, simplificando tudo.
