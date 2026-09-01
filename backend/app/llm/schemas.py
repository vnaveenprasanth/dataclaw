"""
Pydantic schemas for structured LLM output.
Shared between GeminiProvider and OpenAIProvider so both return the same shape.
"""

from typing import List, Literal
from pydantic import BaseModel, Field


class DiscrepancyExplanation(BaseModel):
    """Schema for a single-discrepancy explanation."""
    likely_cause: str = Field(description="1–2 sentences explaining what probably happened")
    business_impact: str = Field(description="1–2 sentences on revenue or operational impact")
    action_items: List[str] = Field(description="2–4 specific remediation steps")
    urgency: Literal["HIGH", "MEDIUM", "LOW"]
    confidence: Literal["HIGH", "MEDIUM", "LOW"]


class BatchSummary(BaseModel):
    """Schema for the executive summary of all discrepancies."""
    headline: str = Field(description="Single most important finding in one sentence")
    total_at_risk_usd: float
    key_findings: List[str] = Field(description="Up to 5 key findings")
    top_priority: str = Field(description="Which discrepancy type to fix first and why")
    recommended_actions: List[str] = Field(description="Up to 4 recommended actions")
    overall_severity: Literal["HIGH", "MEDIUM", "LOW"]
