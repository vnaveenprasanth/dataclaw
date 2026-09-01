"""
LLMManager — orchestrates Gemini (primary) and OpenAI (fallback).

Provider chain:
  1. GeminiProvider (gemini-2.5-flash → gemini-2.0-flash internally)
  2. OpenAIProvider (gpt-4o-mini) — only if Gemini fails with ResourceExhausted or PermissionDenied
     and LLM_FALLBACK_ENABLED=true

If both providers fail, the Flask route returns HTTP 503 with a clear error message.
"""

import google.api_core.exceptions as google_exc

from app.llm.gemini import GeminiProvider
from app.llm.openai_p import OpenAIProvider


class LLMManager:

    def __init__(self, config: dict):
        self._gemini: GeminiProvider | None = None
        self._openai: OpenAIProvider | None = None
        self._fallback_enabled = config.get("LLM_FALLBACK_ENABLED", True)

        gemini_key = config.get("GEMINI_API_KEY", "")
        if gemini_key:
            self._gemini = GeminiProvider(
                api_key=gemini_key,
                default_model=config.get("GEMINI_DEFAULT_MODEL", "gemini-2.5-flash"),
                fallback_model=config.get("GEMINI_FALLBACK_MODEL", "gemini-2.0-flash"),
            )

        openai_key = config.get("OPENAI_API_KEY", "")
        if openai_key and self._fallback_enabled:
            self._openai = OpenAIProvider(
                api_key=openai_key,
                default_model=config.get("OPENAI_DEFAULT_MODEL", "gpt-4o-mini"),
            )

    # ── Public interface ─────────────────────────────────────────────────────

    def explain_discrepancy(self, discrepancy: dict) -> tuple[dict, str]:
        """
        Returns (explanation_dict, provider_name).
        explanation_dict always contains: likely_cause, business_impact,
        action_items, urgency, confidence. May include is_partial=True on degraded response.
        """
        return self._run("explain_discrepancy", discrepancy)

    def summarize_all(self, discrepancies: list[dict]) -> tuple[dict, str]:
        """Returns (summary_dict, provider_name)."""
        return self._run("summarize_all", discrepancies)

    # ── Internal ─────────────────────────────────────────────────────────────

    def _run(self, method: str, payload) -> tuple[dict, str]:
        """
        Try Gemini first. Fall back to OpenAI on quota/auth errors.
        Raises RuntimeError if all providers fail (routes surface as 503).
        """
        errors = []

        if self._gemini:
            try:
                result, model = getattr(self._gemini, method)(payload)
                return result, f"gemini/{model}"
            except (google_exc.ResourceExhausted, google_exc.PermissionDenied) as e:
                errors.append(f"Gemini: {e}")
            except Exception as e:
                errors.append(f"Gemini unexpected: {e}")
                raise  # Non-quota errors are unexpected — don't silently swallow

        if self._openai and self._fallback_enabled:
            try:
                result, model = getattr(self._openai, method)(payload)
                return result, f"openai/{model}"
            except Exception as e:
                errors.append(f"OpenAI: {e}")

        raise RuntimeError(f"All LLM providers failed: {'; '.join(errors)}")
