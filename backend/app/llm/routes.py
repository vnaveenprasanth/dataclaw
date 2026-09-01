"""
LLM API routes for DATAClaw.
POST /api/llm/explain/<result_id>   — explain a single discrepancy
POST /api/llm/summarize             — executive summary of a session
"""

from flask import Blueprint, jsonify, request
import google.api_core.exceptions as google_exc

from app import db
from app.clerk_auth import clerk_required
from app.models import ReconciliationResult, LLMExplanation, UploadSession
from app.llm import get_manager

llm_bp = Blueprint("llm", __name__, url_prefix="/api/llm")


@llm_bp.post("/explain/<int:result_id>")
@clerk_required
def explain(result_id: int, clerk_user_id: str):
    """
    Explain a single reconciliation discrepancy using the LLM.
    Returns cached explanation if one already exists for this result.
    """
    result = ReconciliationResult.query.filter_by(
        id=result_id, clerk_user_id=clerk_user_id  # always scope to user
    ).first_or_404()

    # Return cached explanation if already generated
    if result.explanation:
        return jsonify({"ok": True, "explanation": result.explanation.to_dict(), "cached": True})

    try:
        explanation_dict, provider = get_manager().explain_discrepancy(result.to_dict())
    except google_exc.APIError as e:
        return jsonify({"error": "LLM validation failed", "details": str(e)}), 422
    except google_exc.ResourceExhausted:
        return jsonify({"error": "LLM quota exceeded"}), 429
    except Exception as e:
        return jsonify({"ok": False, "error": "Internal server error"}), 500

    # Parse provider string e.g. "gemini/gemini-2.5-flash"
    parts = provider.split("/", 1)
    provider_name = parts[0]
    model_used = parts[1] if len(parts) > 1 else provider

    # Persist explanation
    expl = LLMExplanation(
        result_id=result.id,
        provider=provider_name,
        model_used=model_used,
        likely_cause=explanation_dict.get("likely_cause"),
        business_impact=explanation_dict.get("business_impact"),
        action_items=explanation_dict.get("action_items", []),
        urgency=explanation_dict.get("urgency", "MEDIUM"),
        confidence=explanation_dict.get("confidence", "LOW"),
        is_partial=explanation_dict.get("is_partial", False),
    )
    db.session.add(expl)
    db.session.commit()

    return jsonify({"ok": True, "explanation": expl.to_dict(), "cached": False})


@llm_bp.post("/summarize")
@clerk_required
def summarize(clerk_user_id: str):
    """
    Generate an executive summary for all discrepancies in a session.
    Body: { "session_id": <int> }
    """
    body = request.get_json(silent=True) or {}
    session_id = body.get("session_id")
    if not session_id:
        return jsonify({"ok": False, "error": "session_id is required"}), 400

    # Verify session ownership
    UploadSession.query.filter_by(
        id=session_id, clerk_user_id=clerk_user_id
    ).first_or_404()

    results = ReconciliationResult.query.filter_by(
        session_id=session_id, clerk_user_id=clerk_user_id
    ).all()

    if not results:
        return jsonify({"ok": False, "error": "No discrepancies found for this session"}), 404

    try:
        summary_dict, provider = get_manager().summarize_all([r.to_dict() for r in results])
    except google_exc.APIError as e:
        return jsonify({"error": "LLM validation failed", "details": str(e)}), 422
    except google_exc.ResourceExhausted:
        return jsonify({"error": "LLM quota exceeded"}), 429
    except Exception as e:
        return jsonify({"ok": False, "error": "Internal server error"}), 500

    return jsonify({"ok": True, "summary": summary_dict, "provider": provider})
