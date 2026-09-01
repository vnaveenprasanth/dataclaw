"""
LLMManager — orchestrates Gemini.

Provider chain:
  1. GeminiProvider (gemini-2.5-flash → gemini-2.0-flash internally)

If provider fails, the Flask route returns HTTP 503 with a clear error message.
"""

import google.api_core.exceptions as google_exc

from app.llm.gemini import GeminiProvider


class LLMManager:

    def __init__(self, config: dict):
        self._gemini: GeminiProvider | None = None

        gemini_key = config.get("GEMINI_API_KEY", "")
        if gemini_key:
            self._gemini = GeminiProvider(
                api_key=gemini_key,
                default_model=config.get("GEMINI_DEFAULT_MODEL", "gemini-2.5-flash"),
                fallback_model=config.get("GEMINI_FALLBACK_MODEL", "gemini-2.0-flash"),
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
        Try Gemini. Raises RuntimeError if provider fails (routes surface as 503).
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

        raise RuntimeError(f"All LLM providers failed: {'; '.join(errors)}")
