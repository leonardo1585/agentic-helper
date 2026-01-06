"""
Configurações da aplicação.
"""
from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    """Configurações globais da aplicação."""
    
    APP_NAME: str = "Agentic Helper"
    APP_VERSION: str = "1.0.0"
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

