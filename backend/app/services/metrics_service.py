"""
Serviço de métricas, tracking de tokens e histórico de análises.
"""
import json
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from collections import defaultdict

from ..models.schemas import TokenUsageRecord, TokenUsageSummary, AnalysisRecord, AnalysisHistory


# Preços aproximados por 1K tokens (USD) - Atualizar conforme necessário
TOKEN_PRICES = {
    "openai": {
        "gpt-4o": {"input": 0.005, "output": 0.015},
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "gpt-4-turbo-preview": {"input": 0.01, "output": 0.03},
        "gpt-4": {"input": 0.03, "output": 0.06},
        "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
    },
    "gemini": {
        "gemini-pro": {"input": 0.00025, "output": 0.0005},
        "gemini-1.5-pro": {"input": 0.00125, "output": 0.005},
        "gemini-1.5-flash": {"input": 0.000075, "output": 0.0003},
    }
}


class MetricsService:
    """Serviço para tracking de métricas e histórico."""
    
    def __init__(self):
        # Path: backend/app/services/metrics_service.py -> gth/
        base_dir = Path(__file__).parent.parent.parent.parent
        self.metrics_file = base_dir / "metrics.json"
        self.history_file = base_dir / "analysis_history.json"
        self._metrics = self._load_metrics()
        self._history = self._load_history()
    
    def _load_metrics(self) -> dict:
        """Carrega métricas de tokens."""
        if self.metrics_file.exists():
            try:
                return json.loads(self.metrics_file.read_text())
            except:
                pass
        return {"records": []}
    
    def _save_metrics(self):
        """Salva métricas."""
        self.metrics_file.write_text(json.dumps(self._metrics, indent=2, default=str))
    
    def _load_history(self) -> dict:
        """Carrega histórico de análises."""
        if self.history_file.exists():
            try:
                return json.loads(self.history_file.read_text())
            except:
                pass
        return {"records": []}
    
    def _save_history(self):
        """Salva histórico."""
        self.history_file.write_text(json.dumps(self._history, indent=2, default=str))
    
    def calculate_cost(self, provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
        """Calcula custo estimado em USD."""
        provider_prices = TOKEN_PRICES.get(provider.lower(), {})
        model_prices = None
        
        # Busca preço do modelo específico ou similar
        for model_key in provider_prices:
            if model_key in model.lower():
                model_prices = provider_prices[model_key]
                break
        
        if not model_prices:
            # Preço padrão se não encontrar
            model_prices = {"input": 0.001, "output": 0.002}
        
        input_cost = (input_tokens / 1000) * model_prices["input"]
        output_cost = (output_tokens / 1000) * model_prices["output"]
        
        return round(input_cost + output_cost, 6)
    
    def record_token_usage(
        self,
        operation: str,
        model: str,
        provider: str,
        input_tokens: int,
        output_tokens: int,
        duration_ms: int,
        prompt_id: Optional[str] = None,
        repository: Optional[str] = None,
        folder: Optional[str] = None
    ) -> TokenUsageRecord:
        """Registra uso de tokens."""
        total_tokens = input_tokens + output_tokens
        estimated_cost = self.calculate_cost(provider, model, input_tokens, output_tokens)
        
        record = TokenUsageRecord(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            operation=operation,
            prompt_id=prompt_id,
            repository=repository,
            folder=folder,
            model=model,
            provider=provider,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            estimated_cost=estimated_cost,
            duration_ms=duration_ms
        )
        
        self._metrics["records"].append(record.model_dump(mode="json"))
        
        # Manter apenas últimos 1000 registros
        if len(self._metrics["records"]) > 1000:
            self._metrics["records"] = self._metrics["records"][-1000:]
        
        self._save_metrics()
        return record
    
    def get_usage_summary(self, days: int = 30) -> TokenUsageSummary:
        """Retorna resumo de uso de tokens."""
        cutoff = datetime.now() - timedelta(days=days)
        
        records = [
            r for r in self._metrics["records"]
            if datetime.fromisoformat(r["timestamp"]) > cutoff
        ]
        
        total_input = sum(r["input_tokens"] for r in records)
        total_output = sum(r["output_tokens"] for r in records)
        total_cost = sum(r["estimated_cost"] for r in records)
        
        # Agrupar por operação
        by_operation = defaultdict(lambda: {"count": 0, "tokens": 0, "cost": 0})
        for r in records:
            op = r["operation"]
            by_operation[op]["count"] += 1
            by_operation[op]["tokens"] += r["total_tokens"]
            by_operation[op]["cost"] += r["estimated_cost"]
        
        # Agrupar por modelo
        by_model = defaultdict(lambda: {"count": 0, "tokens": 0, "cost": 0})
        for r in records:
            model = r["model"]
            by_model[model]["count"] += 1
            by_model[model]["tokens"] += r["total_tokens"]
            by_model[model]["cost"] += r["estimated_cost"]
        
        # Agrupar por dia
        by_day = defaultdict(lambda: {"count": 0, "tokens": 0, "cost": 0})
        for r in records:
            day = datetime.fromisoformat(r["timestamp"]).strftime("%Y-%m-%d")
            by_day[day]["count"] += 1
            by_day[day]["tokens"] += r["total_tokens"]
            by_day[day]["cost"] += r["estimated_cost"]
        
        return TokenUsageSummary(
            total_requests=len(records),
            total_input_tokens=total_input,
            total_output_tokens=total_output,
            total_tokens=total_input + total_output,
            total_estimated_cost=round(total_cost, 4),
            by_operation=dict(by_operation),
            by_model=dict(by_model),
            by_day=dict(sorted(by_day.items()))
        )
    
    def get_recent_usage(self, limit: int = 50) -> List[TokenUsageRecord]:
        """Retorna registros recentes de uso."""
        records = self._metrics["records"][-limit:]
        return [TokenUsageRecord(**r) for r in reversed(records)]
    
    # ============================================
    # HISTÓRICO DE ANÁLISES
    # ============================================
    
    def record_analysis(
        self,
        repository: str,
        folder: Optional[str],
        status: str,
        kb_types: List[str],
        model_used: str,
        provider: str,
        duration_seconds: int,
        files_analyzed: int,
        tokens_used: int,
        estimated_cost: float,
        operation: str = "repository_analysis",
        error_message: Optional[str] = None
    ) -> AnalysisRecord:
        """Registra uma análise de repositório."""
        record = AnalysisRecord(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            repository=repository,
            folder=folder,
            status=status,
            operation=operation,
            kb_types=kb_types,
            model_used=model_used,
            provider=provider,
            duration_seconds=duration_seconds,
            files_analyzed=files_analyzed,
            tokens_used=tokens_used,
            estimated_cost=estimated_cost,
            error_message=error_message
        )
        
        self._history["records"].append(record.model_dump(mode="json"))
        
        # Manter apenas últimas 500 análises
        if len(self._history["records"]) > 500:
            self._history["records"] = self._history["records"][-500:]
        
        self._save_history()
        return record
    
    def get_analysis_history(self, limit: int = 100, repository: Optional[str] = None) -> AnalysisHistory:
        """Retorna histórico de análises."""
        records = self._history["records"]
        
        if repository:
            records = [r for r in records if r["repository"] == repository]
        
        records = records[-limit:]
        
        successful = sum(1 for r in records if r["status"] == "completed")
        failed = sum(1 for r in records if r["status"] == "failed")
        
        return AnalysisHistory(
            total_analyses=len(records),
            successful=successful,
            failed=failed,
            records=[AnalysisRecord(**r) for r in reversed(records)]
        )
    
    def update_analysis_status(self, analysis_id: str, status: str, error_message: Optional[str] = None):
        """Atualiza status de uma análise."""
        for record in self._history["records"]:
            if record["id"] == analysis_id:
                record["status"] = status
                if error_message:
                    record["error_message"] = error_message
                self._save_history()
                return True
        return False


metrics_service = MetricsService()

