"""LLM package for DATAClaw. Exposes get_manager() for use in routes."""
from app.llm.manager import LLMManager

_manager: LLMManager | None = None


def get_manager() -> LLMManager:
    global _manager
    if _manager is None:
        from flask import current_app
        _manager = LLMManager(current_app.config)
    return _manager
