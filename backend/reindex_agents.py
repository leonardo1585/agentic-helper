#!/usr/bin/env python3
"""
Script para reindexar todos os agentes com instructions do agent_definition.yaml.
Execute: python reindex_agents.py
"""
import asyncio
import sys
import os

# Adiciona o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Silencia warnings do HuggingFace
os.environ["TOKENIZERS_PARALLELISM"] = "false"

async def main():
    print("🔄 Iniciando reindexação de agentes...")
    print("=" * 50)
    
    # Importa os serviços
    from app.services.agent_service import agent_service
    
    # Mostra quantas KBs existem
    kbs = agent_service.list_knowledge_bases()
    print(f"\n📚 Encontradas {len(kbs)} bases de conhecimento:")
    for kb in kbs:
        print(f"   - {kb}")
    
    print("\n" + "=" * 50)
    print("🚀 Iniciando reindexação com instructions...")
    
    # Executa a reindexação
    results = await agent_service.reindex_all_with_instructions()
    
    print("\n" + "=" * 50)
    print("📊 RESULTADO DA REINDEXAÇÃO:")
    print(f"   Total: {results['total']}")
    print(f"   ✅ Atualizados: {results['updated']}")
    print(f"   ❌ Falhas: {results['failed']}")
    
    print("\n📝 Detalhes:")
    for detail in results['details']:
        status = detail.get('status', 'unknown')
        kb_name = detail.get('kb_name', 'unknown')
        
        if status == 'success':
            instructions = detail.get('instructions_found', 0)
            print(f"   ✅ {kb_name}: {instructions} instructions encontradas")
        elif status == 'reindexed_without_update':
            print(f"   ⚠️  {kb_name}: reindexado sem atualização (repo não local)")
        else:
            error = detail.get('error', status)
            print(f"   ❌ {kb_name}: {error}")
    
    print("\n" + "=" * 50)
    print("✨ Reindexação concluída!")
    print("Agora a busca de agentes considera as instructions do agent_definition.yaml")

if __name__ == "__main__":
    asyncio.run(main())

