"""
GeminiProvider — Primary LLM provider for DATAClaw.

Model registry (cheapest → most capable):
  gemini-2.5-flash   default — 1M token context, native Pydantic schema, cheap
  gemini-2.0-flash   escalation — faster if 2.5-flash is rate-limited

SDK: google-genai (new unified SDK — NOT deprecated google-generativeai)
Structured output: response_mime_type='application/json' + response_schema=PydanticModel
Temperature: 0.2 — consistent, auditable, prevents creative variation in financial explanations
"""

import json
from typing import Optional, Type, TypeVar
import google.api_core.exceptions as google_exc
from google import genai
from google.genai import types as genai_types
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random,
)
from pydantic import BaseModel

from app.llm.schemas import DiscrepancyExplanation, BatchSummary

T = TypeVar("T", bound=BaseModel)

# System prompt — same for both explain and summarize calls
SYSTEM_PROMPT_EXPLAIN = """You are a financial reconciliation analyst reviewing discrepancies \
between an order management system and a payment processor.
Given one discrepancy record, provide a concise, factual explanation of what likely happened \
and specific remediation steps. Base your analysis on the data provided — do not speculate beyond it.
Respond only in JSON matching the provided schema. No markdown, no commentary."""

SYSTEM_PROMPT_BATCH = """You are a senior financial controller reviewing a reconciliation report.
Given a list of discrepancies between an order system and its payment processor, \
produce a concise executive summary that a store manager could act on immediately.
Respond only in JSON matching the provided schema. No markdown, no commentary."""


class GeminiProvider:
    """
    Wraps google-genai SDK for DATAClaw's LLM calls.

    Model selection: Always starts with default_model (gemini-2.5-flash).
    Falls back to fallback_model (gemini-2.0-flash) only on ResourceExhausted.
    Cross-provider fallback (OpenAI) is handled by LLMManager, not here.
    """

    def __init__(self, api_key: str, default_model: str, fallback_model: str):
        self.client = genai.Client(api_key=api_key)
        self.default_model = default_model
        self.fallback_model = fallback_model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_random(min=0.5, max=1.5),
        retry=(
            retry_if_exception_type(google_exc.ServiceUnavailable)
            | retry_if_exception_type(google_exc.DeadlineExceeded)
        ),
        reraise=True,
    )
    def _call(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
        schema: Type[T],
        max_output_tokens: int = 1024,
    ) -> T:
        """Inner call with retry. Returns parsed Pydantic model."""
        contents = [
            genai_types.Content(
                role="user",
                parts=[genai_types.Part.from_text(
                    text=f"<system>\n{system_prompt}\n</system>\n\n{user_prompt}"
                )],
            )
        ]
        response = self.client.models.generate_content(
            model=model,
            contents=contents,
            config=genai_types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.95,
                max_output_tokens=max_output_tokens,
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
        # response.parsed is the Pydantic object when response_schema is set
        if response.parsed is not None:
            return response.parsed
        # Fallback: manual parse from response.text
        raw = response.text or ""
        return schema.model_validate_json(raw)

    def _call_with_fallback(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Type[T],
        max_output_tokens: int = 1024,
    ) -> tuple[T, str]:
        """
        Try default_model first. On ResourceExhausted (rate limit),
        try fallback_model. Returns (result, model_used).
        Raises on any other error.
        """
        for model in (self.default_model, self.fallback_model):
            try:
                result = self._call(model, system_prompt, user_prompt, schema, max_output_tokens)
                return result, model
            except google_exc.ResourceExhausted:
                if model == self.fallback_model:
                    raise  # both models rate-limited — bubble up to LLMManager
                continue  # try next model
        raise RuntimeError("All Gemini models exhausted")

    def explain_discrepancy(self, discrepancy: dict) -> tuple[dict, str]:
        """
        Generate explanation for a single discrepancy.
        Returns (explanation_dict, model_used).
        """
        user_prompt = f"""Discrepancy record:
  Type:             {discrepancy.get('discrepancy_type')}
  Order ID:         {discrepancy.get('order_id', 'N/A')}
  Transaction Ref:  {discrepancy.get('transaction_ref', 'N/A')}
  Order Amount:     {discrepancy.get('order_amount')} {discrepancy.get('currency', '')}
  Payment Amount:   {discrepancy.get('payment_amount', 'N/A')}
  Difference:       {discrepancy.get('difference', 'N/A')}
  Risk Amount:      ${discrepancy.get('risk_amount', 0)}
  Severity:         {discrepancy.get('severity')}
  Details:          {json.dumps(discrepancy.get('details', {}))}
"""
        result, model = self._call_with_fallback(
            system_prompt=SYSTEM_PROMPT_EXPLAIN,
            user_prompt=user_prompt,
            schema=DiscrepancyExplanation,
            max_output_tokens=1024,
        )
        return result.model_dump(), model

    def summarize_all(self, discrepancies: list[dict]) -> tuple[dict, str]:
        """
        Generate executive summary of all discrepancies.
        Returns (summary_dict, model_used).
        """
        # Condense to reduce token usage
        condensed = [
            {
                "type": d.get("discrepancy_type"),
                "order_id": d.get("order_id"),
                "risk_amount": d.get("risk_amount", 0),
                "severity": d.get("severity"),
            }
            for d in discrepancies
        ]
        total_risk = sum(float(d.get("risk_amount", 0)) for d in discrepancies)

        user_prompt = f"""Here are all {len(condensed)} reconciliation discrepancies:

{json.dumps(condensed, indent=2)}

Total value at risk: ${total_risk:.2f}

Provide the executive summary.
"""
        result, model = self._call_with_fallback(
            system_prompt=SYSTEM_PROMPT_BATCH,
            user_prompt=user_prompt,
            schema=BatchSummary,
            max_output_tokens=2048,
        )
        return result.model_dump(), model

    @property
    def name(self) -> str:
        return "gemini"
