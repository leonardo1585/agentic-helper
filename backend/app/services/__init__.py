# v3 - Suporte a agentes customizados (Auth via Keycloak)
from .github_service import github_service, GitHubService
from .ai_service import ai_service, AIService
from .agent_service import agent_service, AgentService
from .vector_service import vector_service, VectorService
from .auth_service import auth_service, AuthService
from .updates_service import updates_service, UpdatesService
from .diagnostic_service import diagnostic_service, DiagnosticService
from .weni_service import weni_service, WeniService
from .keycloak_auth import keycloak_auth, KeycloakAuth, get_current_user

__all__ = [
    "github_service",
    "GitHubService",
    "ai_service", 
    "AIService",
    "agent_service",
    "AgentService",
    "vector_service",
    "VectorService",
    "auth_service",
    "AuthService",
    "updates_service",
    "UpdatesService",
    "diagnostic_service",
    "DiagnosticService",
    "weni_service",
    "WeniService",
    "keycloak_auth",
    "KeycloakAuth",
    "get_current_user",
]

