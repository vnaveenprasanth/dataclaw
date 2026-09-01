from datetime import datetime, timezone
from app import db


class UploadSession(db.Model):
    """One upload session = one pair of CSVs ingested by a user."""
    __tablename__ = "upload_sessions"

    id = db.Column(db.Integer, primary_key=True)
    clerk_user_id = db.Column(db.String(64), nullable=False, index=True)
    uploaded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    orders_filename = db.Column(db.Text)
    payments_filename = db.Column(db.Text)
    # status: processing | complete | error
    status = db.Column(db.String(20), default="processing")
    orders_count = db.Column(db.Integer)
    payments_count = db.Column(db.Integer)

    orders = db.relationship("Order", backref="session", lazy="dynamic", cascade="all, delete-orphan")
    payments = db.relationship("Payment", backref="session", lazy="dynamic", cascade="all, delete-orphan")
    results = db.relationship("ReconciliationResult", backref="session", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "uploaded_at": self.uploaded_at.isoformat(),
            "orders_filename": self.orders_filename,
            "payments_filename": self.payments_filename,
            "status": self.status,
            "orders_count": self.orders_count,
            "payments_count": self.payments_count,
        }


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("upload_sessions.id"), nullable=False, index=True)
    clerk_user_id = db.Column(db.String(64), nullable=False, index=True)

    order_id = db.Column(db.String(50), nullable=False)
    order_date = db.Column(db.DateTime)
    customer_email = db.Column(db.String(255))
    currency = db.Column(db.String(3))
    gross_amount = db.Column(db.Numeric(12, 2))
    discount = db.Column(db.Numeric(12, 2))
    net_amount = db.Column(db.Numeric(12, 2))
    status = db.Column(db.String(20))
    row_index = db.Column(db.Integer)  # original CSV row for auditability

    def to_dict(self):
        return {
            "order_id": self.order_id,
            "order_date": self.order_date.isoformat() if self.order_date else None,
            "customer_email": self.customer_email,
            "currency": self.currency,
            "gross_amount": float(self.gross_amount) if self.gross_amount is not None else None,
            "discount": float(self.discount) if self.discount is not None else None,
            "net_amount": float(self.net_amount) if self.net_amount is not None else None,
            "status": self.status,
        }


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("upload_sessions.id"), nullable=False, index=True)
    clerk_user_id = db.Column(db.String(64), nullable=False, index=True)

    transaction_ref = db.Column(db.String(50))
    processed_at = db.Column(db.DateTime)
    order_reference = db.Column(db.String(50))  # normalized to uppercase + stripped
    currency = db.Column(db.String(3))
    amount = db.Column(db.Numeric(12, 2))
    fee = db.Column(db.Numeric(12, 2))
    net_settled = db.Column(db.Numeric(12, 2))
    payment_type = db.Column(db.String(20))   # charge | refund
    status = db.Column(db.String(20))          # settled | pending | failed
    row_index = db.Column(db.Integer)

    def to_dict(self):
        return {
            "transaction_ref": self.transaction_ref,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "order_reference": self.order_reference,
            "currency": self.currency,
            "amount": float(self.amount) if self.amount is not None else None,
            "fee": float(self.fee) if self.fee is not None else None,
            "net_settled": float(self.net_settled) if self.net_settled is not None else None,
            "payment_type": self.payment_type,
            "status": self.status,
        }


class ReconciliationResult(db.Model):
    __tablename__ = "reconciliation_results"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("upload_sessions.id"), nullable=False, index=True)
    clerk_user_id = db.Column(db.String(64), nullable=False, index=True)

    discrepancy_type = db.Column(db.String(40), nullable=False)
    order_id = db.Column(db.String(50))
    transaction_ref = db.Column(db.String(50))
    order_amount = db.Column(db.Numeric(12, 2))
    payment_amount = db.Column(db.Numeric(12, 2))
    difference = db.Column(db.Numeric(12, 2))
    currency = db.Column(db.String(10))
    risk_amount = db.Column(db.Numeric(12, 2))
    # severity: HIGH | MEDIUM | LOW
    severity = db.Column(db.String(10))
    details = db.Column(db.JSON)   # type-specific extra data
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    explanation = db.relationship("LLMExplanation", backref="result", uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "discrepancy_type": self.discrepancy_type,
            "order_id": self.order_id,
            "transaction_ref": self.transaction_ref,
            "order_amount": float(self.order_amount) if self.order_amount is not None else None,
            "payment_amount": float(self.payment_amount) if self.payment_amount is not None else None,
            "difference": float(self.difference) if self.difference is not None else None,
            "currency": self.currency,
            "risk_amount": float(self.risk_amount) if self.risk_amount is not None else None,
            "severity": self.severity,
            "details": self.details or {},
            "has_explanation": self.explanation is not None,
        }


class LLMExplanation(db.Model):
    __tablename__ = "llm_explanations"

    id = db.Column(db.Integer, primary_key=True)
    result_id = db.Column(db.Integer, db.ForeignKey("reconciliation_results.id"), nullable=False, unique=True)

    provider = db.Column(db.String(20))      # gemini | openai
    model_used = db.Column(db.String(60))
    prompt_tokens = db.Column(db.Integer)
    completion_tokens = db.Column(db.Integer)

    likely_cause = db.Column(db.Text)
    business_impact = db.Column(db.Text)
    action_items = db.Column(db.JSON)        # list[str]
    urgency = db.Column(db.String(10))       # HIGH | MEDIUM | LOW
    confidence = db.Column(db.String(10))    # HIGH | MEDIUM | LOW
    is_partial = db.Column(db.Boolean, default=False)  # True if LLM returned malformed output

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "provider": self.provider,
            "model_used": self.model_used,
            "likely_cause": self.likely_cause,
            "business_impact": self.business_impact,
            "action_items": self.action_items or [],
            "urgency": self.urgency,
            "confidence": self.confidence,
            "is_partial": self.is_partial,
            "created_at": self.created_at.isoformat(),
        }
