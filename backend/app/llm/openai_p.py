"""
OpenAIProvider — Fallback LLM provider for DATAClaw.
Only invoked by LLMManager when GeminiProvider fails (rate limit or key issue).

Uses response_format={"type":"json_object"} + Pydantic validation.
Temperature: 0.2 — matches Gemini for consistent outputs.
"""

import json
from typing import Type, TypeVar
import openai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random,
)
from pydantic import BaseModel, ValidationError

from app.llm.schemas import DiscrepancyExplanation, BatchSummary
from app.llm.gemini import SYSTEM_PROMPT_EXPLAIN, SYSTEM_PROMPT_BATCH

T = TypeVar("T", bound=BaseModel)

# Safe fallback when JSON parse fails
_FALLBACK_EXPLANATION = {
    "likely_cause": "LLM returned an unexpected format. Manual review required.",
    "business_impact": "Unable to assess impact automatically.",
    "action_items": ["Review this discrepancy manually with your finance team."],
    "urgency": "MEDIUM",
    "confidence": "LOW",
}

_FALLBACK_SUMMARY = {
    "headline": "Summary unavailable — LLM returned unexpected format.",
    "total_at_risk_usd": 0.0,
    "key_findings": ["Manual review of discrepancies required."],
    "top_priority": "Review HIGH severity discrepancies first.",
    "recommended_actions": ["Contact finance team for manual reconciliation."],
    "overall_severity": "MEDIUM",
}


class OpenAIProvider:

    def __init__(self, api_key: str, default_model: str):
        self.client = openai.OpenAI(api_key=api_key, timeout=60.0)
        self.model = default_model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_random(min=0.5, max=1.5),
        retry=(
            retry_if_exception_type(openai.APIConnectionError)
            | retry_if_exception_type(openai.APITimeoutError)
        ),
        reraise=True,
    )
    def _call(self, system_prompt: str, user_prompt: str, schema: Type[T]) -> T | None:
        """Call OpenAI with JSON mode. Returns parsed Pydantic model or None."""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            top_p=1,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or ""
        try:
            return schema.model_validate_json(raw)
        except (ValidationError, json.JSONDecodeError):
            return None

    def explain_discrepancy(self, discrepancy: dict) -> tuple[dict, str]:
        user_prompt = f"""Discrepancy record:
  Type:            {discrepancy.get('discrepancy_type')}
  Order ID:        {discrepancy.get('order_id', 'N/A')}
  Transaction Ref: {discrepancy.get('transaction_ref', 'N/A')}
  Order Amount:    {discrepancy.get('order_amount')} {discrepancy.get('currency', '')}
  Payment Amount:  {discrepancy.get('payment_amount', 'N/A')}
  Difference:      {discrepancy.get('difference', 'N/A')}
  Risk Amount:     ${discrepancy.get('risk_amount', 0)}
  Severity:        {discrepancy.get('severity')}
  Details:         {json.dumps(discrepancy.get('details', {}))}
"""
        result = self._call(SYSTEM_PROMPT_EXPLAIN, user_prompt, DiscrepancyExplanation)
        if result is None:
            return {**_FALLBACK_EXPLANATION, "is_partial": True}, self.model
        return result.model_dump(), self.model

    def summarize_all(self, discrepancies: list[dict]) -> tuple[dict, str]:
        condensed = [
            {"type": d.get("discrepancy_type"), "risk_amount": d.get("risk_amount", 0), "severity": d.get("severity")}
            for d in discrepancies
        ]
        total_risk = sum(float(d.get("risk_amount", 0)) for d in discrepancies)
        user_prompt = f"Here are {len(condensed)} discrepancies (total risk ${total_risk:.2f}):\n{json.dumps(condensed, indent=2)}\n\nProvide the executive summary."
        result = self._call(SYSTEM_PROMPT_BATCH, user_prompt, BatchSummary)
        if result is None:
            return {**_FALLBACK_SUMMARY, "total_at_risk_usd": total_risk, "is_partial": True}, self.model
        return result.model_dump(), self.model

    @property
    def name(self) -> str:
        return "openai"
