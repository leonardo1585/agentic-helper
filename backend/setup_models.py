#!/usr/bin/env python3
"""
Script de setup para baixar modelos de ML necessários.
Execute apenas uma vez: python setup_models.py
"""
import os
import sys
from pathlib import Path

def setup_models():
    """Baixa e configura os modelos necessários."""
    print("🚀 GTH - Setup de Modelos")
    print("=" * 50)
    
    # Define o diretório de cache
    cache_dir = Path(__file__).parent / "models_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"📁 Diretório de cache: {cache_dir}")
    
    # 1. Download do modelo de embeddings
    print("\n📥 Baixando modelo de embeddings (all-MiniLM-L6-v2)...")
    print("   Este é um download único de ~90MB")
    
    try:
        from sentence_transformers import SentenceTransformer
        
        model = SentenceTransformer(
            'all-MiniLM-L6-v2',
            cache_folder=str(cache_dir)
        )
        
        # Testa o modelo
        test_embedding = model.encode("teste de funcionamento")
        print(f"   ✅ Modelo baixado e testado! (embedding dim: {len(test_embedding)})")
        
    except Exception as e:
        print(f"   ❌ Erro ao baixar modelo: {e}")
        print("   💡 Verifique sua conexão com a internet")
        return False
    
    # 2. Verifica ChromaDB
    print("\n🔍 Verificando ChromaDB...")
    try:
        import chromadb
        print(f"   ✅ ChromaDB instalado (versão: {chromadb.__version__})")
    except ImportError:
        print("   ❌ ChromaDB não encontrado. Execute: pip install chromadb")
        return False
    
    print("\n" + "=" * 50)
    print("✅ Setup completo! O servidor agora iniciará instantaneamente.")
    print("\n💡 Para iniciar: python run_server.py")
    
    return True


if __name__ == "__main__":
    success = setup_models()
    sys.exit(0 if success else 1)

