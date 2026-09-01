"""
Unit tests for the DATAClaw reconciliation engine.
Run: pytest tests/ -v
"""

import pytest
from decimal import Decimal
from app.reconcile import run_reconciliation, AMOUNT_TOLERANCE


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_order(order_id="ORD-001", net_amount=100.00, currency="USD",
               status="completed", customer_email="test@example.com"):
    return {"order_id": order_id, "net_amount": net_amount, "currency": currency,
            "status": status, "customer_email": customer_email}


def make_payment(order_reference="ORD-001", amount=100.00, currency="USD",
                 payment_type="charge", status="settled", transaction_ref="TXN-001"):
    return {"order_reference": order_reference, "amount": amount, "currency": currency,
            "payment_type": payment_type, "status": status, "transaction_ref": transaction_ref}


# ── Clean reconciliation ───────────────────────────────────────────────────────

class TestCleanReconciliation:
    def test_no_discrepancies(self):
        orders = [make_order()]
        payments = [make_payment()]
        results = run_reconciliation(orders, payments)
        assert results == [], f"Expected empty, got {[r.discrepancy_type for r in results]}"

    def test_within_tolerance_no_flag(self):
        """Differences ≤ $0.02 should NOT be flagged."""
        orders = [make_order(net_amount=100.00)]
        payments = [make_payment(amount=100.01)]  # $0.01 diff — within tolerance
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "AMOUNT_MISMATCH" not in types


# ── AMOUNT_MISMATCH ───────────────────────────────────────────────────────────

class TestAmountMismatch:
    def test_detects_large_underpayment(self):
        orders = [make_order(net_amount=200.00)]
        payments = [make_payment(amount=100.00)]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "AMOUNT_MISMATCH" in types

    def test_high_severity_for_diff_over_50(self):
        orders = [make_order(net_amount=200.00)]
        payments = [make_payment(amount=100.00)]  # $100 diff
        results = run_reconciliation(orders, payments)
        match = next(r for r in results if r.discrepancy_type == "AMOUNT_MISMATCH")
        assert match.severity == "HIGH"

    def test_medium_severity_for_diff_1_to_50(self):
        orders = [make_order(net_amount=105.00)]
        payments = [make_payment(amount=100.00)]  # $5 diff
        results = run_reconciliation(orders, payments)
        match = next(r for r in results if r.discrepancy_type == "AMOUNT_MISMATCH")
        assert match.severity == "MEDIUM"

    def test_risk_amount_is_absolute_difference(self):
        orders = [make_order(net_amount=200.00)]
        payments = [make_payment(amount=150.00)]
        results = run_reconciliation(orders, payments)
        match = next(r for r in results if r.discrepancy_type == "AMOUNT_MISMATCH")
        assert match.risk_amount == Decimal("50.00")


# ── MISSING_PAYMENT ───────────────────────────────────────────────────────────

class TestMissingPayment:
    def test_detects_order_with_no_payment(self):
        orders = [make_order()]
        results = run_reconciliation(orders, [])
        types = [r.discrepancy_type for r in results]
        assert "MISSING_PAYMENT" in types

    def test_severity_is_high(self):
        orders = [make_order()]
        results = run_reconciliation(orders, [])
        match = next(r for r in results if r.discrepancy_type == "MISSING_PAYMENT")
        assert match.severity == "HIGH"

    def test_risk_amount_equals_order_net(self):
        orders = [make_order(net_amount=99.99)]
        results = run_reconciliation(orders, [])
        match = next(r for r in results if r.discrepancy_type == "MISSING_PAYMENT")
        assert match.risk_amount == Decimal("99.99")


# ── PHANTOM_PAYMENT ───────────────────────────────────────────────────────────

class TestPhantomPayment:
    def test_detects_payment_with_unknown_order(self):
        orders = [make_order(order_id="ORD-001")]
        payments = [make_payment(order_reference="ORD-UNKNOWN")]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "PHANTOM_PAYMENT" in types
        assert "MISSING_PAYMENT" in types  # ORD-001 still has no payment

    def test_severity_is_medium(self):
        results = run_reconciliation([], [make_payment(order_reference="GHOST-99")])
        match = next(r for r in results if r.discrepancy_type == "PHANTOM_PAYMENT")
        assert match.severity == "MEDIUM"


# ── CURRENCY_MISMATCH ─────────────────────────────────────────────────────────

class TestCurrencyMismatch:
    def test_detects_different_currencies(self):
        orders = [make_order(currency="USD")]
        payments = [make_payment(currency="EUR")]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "CURRENCY_MISMATCH" in types

    def test_same_currency_no_flag(self):
        orders = [make_order(currency="GBP")]
        payments = [make_payment(currency="GBP")]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "CURRENCY_MISMATCH" not in types


# ── DUPLICATE_PAYMENT ─────────────────────────────────────────────────────────

class TestDuplicatePayment:
    def test_detects_two_charges_same_order(self):
        orders = [make_order()]
        payments = [
            make_payment(transaction_ref="TXN-001"),
            make_payment(transaction_ref="TXN-002"),  # duplicate charge
        ]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "DUPLICATE_PAYMENT" in types

    def test_severity_is_high(self):
        orders = [make_order()]
        payments = [make_payment(transaction_ref="TXN-001"), make_payment(transaction_ref="TXN-002")]
        results = run_reconciliation(orders, payments)
        match = next(r for r in results if r.discrepancy_type == "DUPLICATE_PAYMENT")
        assert match.severity == "HIGH"


# ── CANCELLED_ORDER_CHARGED ───────────────────────────────────────────────────

class TestCancelledOrderCharged:
    def test_detects_charge_on_cancelled(self):
        orders = [make_order(status="cancelled")]
        payments = [make_payment(payment_type="charge")]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "CANCELLED_ORDER_CHARGED" in types

    def test_no_flag_when_no_charge(self):
        """A cancelled order with no payment is MISSING_PAYMENT not CANCELLED_ORDER_CHARGED."""
        orders = [make_order(status="cancelled")]
        results = run_reconciliation(orders, [])
        types = [r.discrepancy_type for r in results]
        assert "CANCELLED_ORDER_CHARGED" not in types


# ── FAILED_PAYMENT ────────────────────────────────────────────────────────────

class TestFailedPayment:
    def test_detects_failed_status(self):
        orders = [make_order()]
        payments = [make_payment(status="failed")]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "FAILED_PAYMENT" in types

    def test_detects_pending_status(self):
        orders = [make_order()]
        payments = [make_payment(status="pending")]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "FAILED_PAYMENT" in types


# ── PARTIAL_REFUND ────────────────────────────────────────────────────────────

class TestPartialRefund:
    def test_detects_partial_refund(self):
        orders = [make_order(status="refunded", net_amount=100.00)]
        payments = [
            make_payment(payment_type="charge", amount=100.00, transaction_ref="TXN-001"),
            make_payment(payment_type="refund", amount=40.00, transaction_ref="TXN-REF-001"),
        ]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "PARTIAL_REFUND" in types

    def test_full_refund_not_flagged(self):
        orders = [make_order(status="refunded", net_amount=100.00)]
        payments = [
            make_payment(payment_type="charge", amount=100.00, transaction_ref="TXN-001"),
            make_payment(payment_type="refund", amount=100.00, transaction_ref="TXN-REF-001"),
        ]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "PARTIAL_REFUND" not in types


# ── DUPLICATE_ORDER ───────────────────────────────────────────────────────────

class TestDuplicateOrder:
    def test_detects_duplicate_order_ids(self):
        orders = [
            make_order(order_id="ORD-DUPE"),
            make_order(order_id="ORD-DUPE"),  # duplicate
        ]
        results = run_reconciliation(orders, [])
        types = [r.discrepancy_type for r in results]
        assert "DUPLICATE_ORDER" in types


# ── DATA_QUALITY ──────────────────────────────────────────────────────────────

class TestDataQuality:
    def test_detects_missing_customer_email(self):
        orders = [make_order(customer_email="")]
        payments = [make_payment()]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "DATA_QUALITY" in types

    def test_present_email_no_flag(self):
        orders = [make_order(customer_email="user@example.com")]
        payments = [make_payment()]
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "DATA_QUALITY" not in types


# ── Case-insensitive order reference matching ─────────────────────────────────

class TestNormalization:
    def test_lowercase_order_ref_matches_uppercase_order_id(self):
        """Payments with lowercase order_reference must match uppercase order_id."""
        orders = [make_order(order_id="ORD-001")]
        payments = [make_payment(order_reference="ord-001")]  # lowercase
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        # Should be clean — no mismatch
        assert "MISSING_PAYMENT" not in types
        assert "PHANTOM_PAYMENT" not in types

    def test_whitespace_in_ref_is_stripped(self):
        orders = [make_order(order_id="ORD-001")]
        payments = [make_payment(order_reference="  ORD-001  ")]  # whitespace
        results = run_reconciliation(orders, payments)
        types = [r.discrepancy_type for r in results]
        assert "MISSING_PAYMENT" not in types
