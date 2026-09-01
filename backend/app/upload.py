"""
CSV upload endpoint for DATAClaw.

POST /api/upload
  - Accepts multipart/form-data with fields: orders_file, payments_file
  - Parses, validates, and persists both CSVs
  - Runs the deterministic reconciliation engine
  - Returns session_id + summary stats
"""

import io
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
import pandas as pd

from app import db
from app.clerk_auth import clerk_required
from app.models import UploadSession, Order, Payment, ReconciliationResult
from app.reconcile import run_reconciliation

upload_bp = Blueprint("upload", __name__)


# ── Column requirements ──────────────────────────────────────────────────────
ORDERS_REQUIRED = {"order_id", "order_date", "currency", "net_amount", "status"}
PAYMENTS_REQUIRED = {
    "transaction_ref", "order_reference", "currency", "amount", "type", "status"
}


def _parse_datetime(val):
    """Try multiple date formats; return None on failure."""
    if pd.isna(val) or val is None:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(val).strip(), fmt)
        except ValueError:
            pass
    return None


def _safe_decimal(val):
    """Convert to float-compatible value for DB; None on failure."""
    try:
        return float(str(val).strip()) if val is not None and str(val).strip() != "" else None
    except (ValueError, TypeError):
        return None


@upload_bp.post("/api/upload")
@clerk_required
def upload_csvs(clerk_user_id: str):
    # ── Validate files present ───────────────────────────────────────────────
    if "orders_file" not in request.files or "payments_file" not in request.files:
        return jsonify({"error": "Both orders_file and payments_file are required"}), 400

    orders_file = request.files["orders_file"]
    payments_file = request.files["payments_file"]

    if not orders_file.filename.endswith(".csv"):
        return jsonify({"error": "orders_file must be a .csv"}), 400
    if not payments_file.filename.endswith(".csv"):
        return jsonify({"error": "payments_file must be a .csv"}), 400

    # ── Parse CSVs ───────────────────────────────────────────────────────────
    try:
        orders_df = pd.read_csv(io.BytesIO(orders_file.read()), dtype=str, keep_default_na=False)
        payments_df = pd.read_csv(io.BytesIO(payments_file.read()), dtype=str, keep_default_na=False)
    except Exception as e:
        return jsonify({"error": f"CSV parse error: {str(e)}"}), 422

    # Strip all string columns
    orders_df = orders_df.apply(lambda col: col.str.strip() if col.dtype == object else col)
    payments_df = payments_df.apply(lambda col: col.str.strip() if col.dtype == object else col)

    # Normalize column names (lowercase + strip)
    orders_df.columns = [c.strip().lower() for c in orders_df.columns]
    payments_df.columns = [c.strip().lower() for c in payments_df.columns]

    # ── Validate required columns ────────────────────────────────────────────
    missing_order_cols = ORDERS_REQUIRED - set(orders_df.columns)
    if missing_order_cols:
        return jsonify({"error": f"orders_file missing columns: {missing_order_cols}"}), 422

    missing_payment_cols = PAYMENTS_REQUIRED - set(payments_df.columns)
    if missing_payment_cols:
        return jsonify({"error": f"payments_file missing columns: {missing_payment_cols}"}), 422

    # ── Create upload session ────────────────────────────────────────────────
    session = UploadSession(
        clerk_user_id=clerk_user_id,
        orders_filename=orders_file.filename,
        payments_filename=payments_file.filename,
        status="processing",
    )
    db.session.add(session)
    db.session.flush()  # get session.id before bulk inserts

    # ── Persist orders ───────────────────────────────────────────────────────
    order_dicts = []
    for idx, row in orders_df.iterrows():
        order_dicts.append(dict(
            session_id=session.id,
            clerk_user_id=clerk_user_id,
            order_id=row.get("order_id", "").strip().upper(),
            order_date=_parse_datetime(row.get("order_date")),
            customer_email=row.get("customer_email", "").strip() or None,
            currency=row.get("currency", "").strip().upper(),
            gross_amount=_safe_decimal(row.get("gross_amount")),
            discount=_safe_decimal(row.get("discount")),
            net_amount=_safe_decimal(row.get("net_amount")),
            status=row.get("status", "").strip().lower(),
            row_index=int(idx) + 2,  # +2: 1-indexed + header row
        ))

    db.session.bulk_insert_mappings(Order, order_dicts)

    # ── Persist payments ─────────────────────────────────────────────────────
    payment_dicts = []
    for idx, row in payments_df.iterrows():
        payment_dicts.append(dict(
            session_id=session.id,
            clerk_user_id=clerk_user_id,
            transaction_ref=row.get("transaction_ref", "").strip(),
            processed_at=_parse_datetime(row.get("processed_at")),
            # Normalize order_reference: UPPERCASE + STRIP — key for deterministic matching
            order_reference=row.get("order_reference", "").strip().upper(),
            currency=row.get("currency", "").strip().upper(),
            amount=_safe_decimal(row.get("amount")),
            fee=_safe_decimal(row.get("fee")),
            net_settled=_safe_decimal(row.get("net_settled")),
            payment_type=row.get("type", "").strip().lower(),
            status=row.get("status", "").strip().lower(),
            row_index=int(idx) + 2,
        ))

    db.session.bulk_insert_mappings(Payment, payment_dicts)
    db.session.flush()

    # ── Run reconciliation ───────────────────────────────────────────────────
    # Build plain dicts for the pure reconciliation function
    orders_for_engine = [
        {
            "order_id": r["order_id"],
            "net_amount": r["net_amount"],
            "currency": r["currency"],
            "status": r["status"],
            "customer_email": r.get("customer_email"),
        }
        for r in order_dicts
    ]
    payments_for_engine = [
        {
            "transaction_ref": r["transaction_ref"],
            "order_reference": r["order_reference"],  # already normalized
            "amount": r["amount"],
            "currency": r["currency"],
            "payment_type": r["payment_type"],
            "status": r["status"],
        }
        for r in payment_dicts
    ]

    discrepancies = run_reconciliation(orders_for_engine, payments_for_engine)

    # ── Persist reconciliation results ───────────────────────────────────────
    result_dicts = [
        dict(
            session_id=session.id,
            clerk_user_id=clerk_user_id,
            discrepancy_type=d.discrepancy_type,
            order_id=d.order_id,
            transaction_ref=d.transaction_ref,
            order_amount=float(d.order_amount) if d.order_amount is not None else None,
            payment_amount=float(d.payment_amount) if d.payment_amount is not None else None,
            difference=float(d.difference) if d.difference is not None else None,
            currency=d.currency,
            risk_amount=float(d.risk_amount),
            severity=d.severity,
            details=d.details,
        )
        for d in discrepancies
    ]
    db.session.bulk_insert_mappings(ReconciliationResult, result_dicts)

    # ── Finalise session ─────────────────────────────────────────────────────
    session.status = "complete"
    session.orders_count = len(order_dicts)
    session.payments_count = len(payment_dicts)
    db.session.commit()

    return jsonify({
        "session_id": session.id,
        "orders_count": session.orders_count,
        "payments_count": session.payments_count,
        "discrepancy_count": len(discrepancies),
        "status": "complete",
    }), 201
