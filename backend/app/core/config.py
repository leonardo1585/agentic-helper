"""
Configurações da aplicação.
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    """Configurações globais da aplicação."""
    
    APP_NAME: str = "Agentic Helper"
    APP_VERSION: str = "3.0.0"  # v3 - Suporte a agentes customizados
    DEBUG: bool = True
    
    # Diretório base para repositórios
    REPOS_BASE_DIR: Path = Path(__file__).parent.parent.parent.parent / "repositories"
    
    # GitHub
    GITHUB_TOKEN: Optional[str] = None
    
    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4-turbo-preview"
    
    # Google Gemini
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-pro"
    
    # AI Provider selecionado
    AI_PROVIDER: str = "openai"  # "openai" ou "gemini"
    
    # Weni Cloud Integration
    WENI_API_URL: str = os.getenv("WENI_API_URL", "https://api.weni.ai")
    WENI_ACCOUNTS_URL: str = os.getenv("WENI_ACCOUNTS_URL", "https://accounts.weni.ai")
    WENI_CLIENT_ID: str = os.getenv("WENI_CLIENT_ID", "weni-cli")
    WENI_REALM: str = os.getenv("WENI_REALM", "weni")
    # Redirect URI registrado no Keycloak - não altere a menos que tenha um novo registro
    WENI_REDIRECT_URI: str = os.getenv("WENI_REDIRECT_URI", "http://localhost:50051/sso-callback")
    
    # Configurações de análise
    MAX_FILE_SIZE: int = 100000  # 100KB max por arquivo
    SUPPORTED_EXTENSIONS: list = [
        ".py", ".js", ".ts", ".tsx", ".jsx", ".vue", ".java", ".go", ".rs",
        ".json", ".yaml", ".yml", ".toml", ".md", ".txt", ".env.example",
        ".dockerfile", ".docker-compose.yml", ".sh", ".sql"
    ]
    
    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

