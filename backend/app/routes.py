"""
Dashboard data routes for DATAClaw.
All routes require Clerk auth. All DB queries scoped to clerk_user_id.
"""

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app import db
from app.clerk_auth import clerk_required
from app.models import UploadSession, ReconciliationResult, LLMExplanation, Order, Payment

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/sessions")
@clerk_required
def list_sessions(clerk_user_id: str):
    """List all upload sessions for the current user, newest first."""
    sessions = (
        UploadSession.query
        .filter_by(clerk_user_id=clerk_user_id)
        .order_by(UploadSession.uploaded_at.desc())
        .all()
    )
    return jsonify([s.to_dict() for s in sessions])


@api_bp.get("/sessions/<int:session_id>/summary")
@clerk_required
def dashboard_summary(session_id: int, clerk_user_id: str):
    """
    Headline KPI figures for the dashboard.
    Returns total counts, value reconciled, total at risk, and breakdown by type.
    """
    session = UploadSession.query.filter_by(
        id=session_id, clerk_user_id=clerk_user_id
    ).first_or_404()

    results = ReconciliationResult.query.filter_by(
        session_id=session_id, clerk_user_id=clerk_user_id
    ).all()

    total_risk = sum(float(r.risk_amount or 0) for r in results)
    total_in_dispute = sum(abs(float(r.difference or 0)) for r in results)

    # Total reconciled value = sum of all order net_amounts in this session
    reconciled_row = db.session.query(
        func.sum(Order.net_amount)
    ).filter(
        Order.session_id == session_id,
        Order.clerk_user_id == clerk_user_id
    ).scalar()
    total_reconciled = float(reconciled_row or 0)

    # Breakdown by type
    type_breakdown: dict[str, dict] = {}
    for r in results:
        t = r.discrepancy_type
        if t not in type_breakdown:
            type_breakdown[t] = {"count": 0, "total_risk": 0.0, "severities": {}}
        type_breakdown[t]["count"] += 1
        type_breakdown[t]["total_risk"] += float(r.risk_amount or 0)
        sev = r.severity or "LOW"
        type_breakdown[t]["severities"][sev] = type_breakdown[t]["severities"].get(sev, 0) + 1

    # Severity breakdown
    severity_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for r in results:
        sev = r.severity or "LOW"
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    return jsonify({
        "session": session.to_dict(),
        "total_orders": session.orders_count or 0,
        "total_payments": session.payments_count or 0,
        "total_discrepancies": len(results),
        "total_at_risk": round(total_risk, 2),
        "total_in_dispute": round(total_in_dispute, 2),
        "total_reconciled_value": round(total_reconciled, 2),
        "type_breakdown": type_breakdown,
        "severity_breakdown": severity_counts,
    })


@api_bp.get("/sessions/<int:session_id>/discrepancies")
@clerk_required
def list_discrepancies(session_id: int, clerk_user_id: str):
    """
    Filterable, searchable, paginated discrepancy list.
    Each item is enriched with full Order and Payment data for the Sheet detail view.

    Query params:
      - type:     filter by discrepancy_type (exact)
      - severity: filter by severity (HIGH|MEDIUM|LOW)
      - q:        search by order_id or transaction_ref (case-insensitive LIKE)
      - page:     page number (default 1)
      - per_page: results per page (default 50, max 200)
      - sort:     risk_amount|severity|discrepancy_type (default risk_amount)
      - order:    asc|desc (default desc)
    """
    # Verify session ownership
    UploadSession.query.filter_by(
        id=session_id, clerk_user_id=clerk_user_id
    ).first_or_404()

    query = ReconciliationResult.query.filter_by(
        session_id=session_id, clerk_user_id=clerk_user_id
    )

    # Filters
    disc_type = request.args.get("type")
    if disc_type:
        query = query.filter(ReconciliationResult.discrepancy_type == disc_type)

    severity = request.args.get("severity")
    if severity:
        query = query.filter(ReconciliationResult.severity == severity.upper())

    search = request.args.get("q", "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            db.or_(
                ReconciliationResult.order_id.ilike(pattern),
                ReconciliationResult.transaction_ref.ilike(pattern),
            )
        )

    # Sorting
    sort_col_map = {
        "risk_amount": ReconciliationResult.risk_amount,
        "severity": ReconciliationResult.severity,
        "discrepancy_type": ReconciliationResult.discrepancy_type,
    }
    sort_col = sort_col_map.get(request.args.get("sort", "risk_amount"), ReconciliationResult.risk_amount)
    sort_dir = request.args.get("order", "desc")
    if sort_dir == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    # Pagination
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(200, max(1, int(request.args.get("per_page", 50))))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    # Pre-fetch related Order and Payment rows for the enriched response
    order_ids = [r.order_id for r in pagination.items if r.order_id]
    txn_refs = [r.transaction_ref for r in pagination.items if r.transaction_ref]

    orders_map: dict[str, dict] = {}
    if order_ids:
        for o in Order.query.filter(
            Order.session_id == session_id,
            Order.clerk_user_id == clerk_user_id,
            Order.order_id.in_(order_ids),
        ).all():
            orders_map[o.order_id] = o.to_dict()

    payments_map: dict[str, dict] = {}
    if txn_refs:
        for p in Payment.query.filter(
            Payment.session_id == session_id,
            Payment.clerk_user_id == clerk_user_id,
            Payment.transaction_ref.in_(txn_refs),
        ).all():
            payments_map[p.transaction_ref] = p.to_dict()

    items = []
    for r in pagination.items:
        d = r.to_dict()
        if r.explanation:
            d["explanation"] = r.explanation.to_dict()
        # Enrich with full source rows
        if r.order_id and r.order_id in orders_map:
            d["order_detail"] = orders_map[r.order_id]
        if r.transaction_ref and r.transaction_ref in payments_map:
            d["payment_detail"] = payments_map[r.transaction_ref]
        items.append(d)

    return jsonify({
        "items": items,
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    })
