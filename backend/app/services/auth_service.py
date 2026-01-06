"""
Serviço de autenticação para o admin.
"""
import json
import secrets
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional


class AuthService:
    """Serviço de autenticação simples para o admin."""
    
    def __init__(self):
        base_dir = Path(__file__).parent.parent.parent.parent
        self.auth_file = base_dir / "admin_auth.json"
        self._config = self._load_config()
    
    def _load_config(self) -> dict:
        """Carrega configuração de autenticação."""
        if self.auth_file.exists():
            try:
                return json.loads(self.auth_file.read_text())
            except:
                pass
        
        # Configuração padrão - senha inicial: "admin123" (deve ser trocada!)
        default_config = {
            "password_hash": self._hash_password("admin123"),
            "sessions": {},
            "failed_attempts": {},
            "lockout_until": None
        }
        self._save_config(default_config)
        return default_config
    
    def _save_config(self, config: dict):
        """Salva configuração."""
        self.auth_file.write_text(json.dumps(config, indent=2, default=str))
    
    def _hash_password(self, password: str) -> str:
        """Hash seguro da senha."""
        # Usando SHA-256 com salt fixo por simplicidade
        # Em produção, usar bcrypt ou argon2
        salt = "gth_admin_salt_2024"
        return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    
    def login(self, password: str) -> tuple[bool, str, str]:
        """
        Tenta fazer login.
        Retorna: (sucesso, token, mensagem)
        """
        # Verificar lockout
        if self._config.get("lockout_until"):
            lockout = datetime.fromisoformat(self._config["lockout_until"])
            if datetime.now() < lockout:
                remaining = (lockout - datetime.now()).seconds // 60
                return False, "", f"Muitas tentativas. Aguarde {remaining} minutos."
            else:
                # Limpar lockout
                self._config["lockout_until"] = None
                self._config["failed_attempts"] = {}
                self._save_config(self._config)
        
        # Verificar senha
        if self._hash_password(password) == self._config["password_hash"]:
            # Gerar token de sessão
            token = secrets.token_urlsafe(32)
            expires = datetime.now() + timedelta(hours=24)
            
            self._config["sessions"][token] = {
                "created": datetime.now().isoformat(),
                "expires": expires.isoformat()
            }
            self._config["failed_attempts"] = {}
            self._save_config(self._config)
            
            return True, token, "Login realizado com sucesso!"
        else:
            # Registrar tentativa falha
            ip = "local"  # Em produção, usar IP real
            attempts = self._config.get("failed_attempts", {})
            attempts[ip] = attempts.get(ip, 0) + 1
            
            if attempts[ip] >= 5:
                self._config["lockout_until"] = (datetime.now() + timedelta(minutes=15)).isoformat()
                self._save_config(self._config)
                return False, "", "Muitas tentativas falhas. Conta bloqueada por 15 minutos."
            
            self._config["failed_attempts"] = attempts
            self._save_config(self._config)
            
            remaining = 5 - attempts[ip]
            return False, "", f"Senha incorreta. {remaining} tentativas restantes."
    
    def validate_token(self, token: str) -> bool:
        """Valida se um token de sessão é válido."""
        if not token or token not in self._config.get("sessions", {}):
            return False
        
        session = self._config["sessions"][token]
        expires = datetime.fromisoformat(session["expires"])
        
        if datetime.now() > expires:
            # Token expirado
            del self._config["sessions"][token]
            self._save_config(self._config)
            return False
        
        return True
    
    def logout(self, token: str) -> bool:
        """Invalida um token de sessão."""
        if token in self._config.get("sessions", {}):
            del self._config["sessions"][token]
            self._save_config(self._config)
            return True
        return False
    
    def change_password(self, current_password: str, new_password: str) -> tuple[bool, str]:
        """
        Troca a senha do admin.
        Retorna: (sucesso, mensagem)
        """
        if self._hash_password(current_password) != self._config["password_hash"]:
            return False, "Senha atual incorreta."
        
        if len(new_password) < 6:
            return False, "Nova senha deve ter pelo menos 6 caracteres."
        
        self._config["password_hash"] = self._hash_password(new_password)
        # Invalidar todas as sessões existentes
        self._config["sessions"] = {}
        self._save_config(self._config)
        
        return True, "Senha alterada com sucesso! Faça login novamente."
    
    def cleanup_sessions(self):
        """Remove sessões expiradas."""
        now = datetime.now()
        sessions = self._config.get("sessions", {})
        valid_sessions = {}
        
        for token, data in sessions.items():
            expires = datetime.fromisoformat(data["expires"])
            if now <= expires:
                valid_sessions[token] = data
        
        self._config["sessions"] = valid_sessions
        self._save_config(self._config)


auth_service = AuthService()

