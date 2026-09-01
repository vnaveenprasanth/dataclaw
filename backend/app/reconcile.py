"""
DATAClaw — Deterministic Reconciliation Engine
===============================================

Matching strategy
-----------------
1. Normalize order_reference in payments: UPPERCASE + STRIP whitespace
2. Primary match key: orders.order_id ↔ payments.order_reference (normalized)
3. Group payments by order_reference to handle duplicates
4. Apply rules in sequence; each order can produce multiple discrepancy types

Tolerance
---------
- Amount tolerance: ±$0.02 (covers float rounding in payment processors)
- Penny differences (≤$0.02) → ignored
- Small differences ($0.02–$1) → LOW severity AMOUNT_MISMATCH
- Medium differences ($1–$50) → MEDIUM severity AMOUNT_MISMATCH
- Large differences (>$50) → HIGH severity AMOUNT_MISMATCH
- Currency: exact match required — different currency = entirely different monetary value

Discrepancy types
-----------------
AMOUNT_MISMATCH          Payment amount ≠ order net_amount (beyond ±$0.02)
CURRENCY_MISMATCH        Order and payment currencies differ
DUPLICATE_PAYMENT        Same order_id has >1 charge-type payment
PHANTOM_PAYMENT          Payment references an order_id not in orders
MISSING_PAYMENT          Completed/active order has no corresponding payment
FAILED_PAYMENT           Payment exists but status is 'failed' or 'pending'
CANCELLED_ORDER_CHARGED  Order status=cancelled but a charge payment exists
PARTIAL_REFUND           Refund amount < original charge for a refunded order
UNEXPECTED_REFUND        Refund payment exists but order is NOT in refunded/cancelled status
DUPLICATE_ORDER          Same order_id appears >1 time in the orders file
DATA_QUALITY             Missing required fields (e.g. customer_email)

Edge cases handled
------------------
- Cancelled orders with no payment are SKIPPED (expected, not a discrepancy)
- Full refunds (refund == charge) are SKIPPED (no partial shortfall)
- Duplicate charges: excess is the sum of all charges beyond the first
- Orders with only refund payments and no charge: PHANTOM_CHARGE flag in details
"""

from __future__ import annotations
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional


# ---------------------------------------------------------------------------
# Amount tolerance
# ---------------------------------------------------------------------------
AMOUNT_TOLERANCE = Decimal("0.02")

# Order statuses that indicate the order is expected to have no payment
_INACTIVE_STATUSES = {"cancelled", "draft", "pending_approval"}

# Payment statuses that indicate failure
_FAILED_STATUSES = {"failed", "pending"}


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------
@dataclass
class Discrepancy:
    discrepancy_type: str
    order_id: Optional[str]
    transaction_ref: Optional[str]
    order_amount: Optional[Decimal]
    payment_amount: Optional[Decimal]
    difference: Optional[Decimal]
    currency: Optional[str]
    risk_amount: Decimal
    severity: str        # HIGH | MEDIUM | LOW
    details: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _normalize_ref(ref: str) -> str:
    """Uppercase + strip whitespace — applied to payments.order_reference."""
    return ref.strip().upper() if ref else ""


def _to_decimal(val) -> Optional[Decimal]:
    try:
        return Decimal(str(val)) if val is not None else None
    except Exception:
        return None


def _abs_diff(a: Optional[Decimal], b: Optional[Decimal]) -> Optional[Decimal]:
    if a is None or b is None:
        return None
    return abs(a - b)


def _amount_severity(diff: Decimal) -> str:
    """Classify a monetary difference into a severity level."""
    if diff > Decimal("50"):
        return "HIGH"
    elif diff > Decimal("1"):
        return "MEDIUM"
    else:
        return "LOW"  # penny-level just above tolerance


# ---------------------------------------------------------------------------
# Core reconciliation function
# ---------------------------------------------------------------------------
def run_reconciliation(
    orders: list[dict],
    payments: list[dict],
) -> list[Discrepancy]:
    """
    Pure function. Deterministic and repeatable — same input always produces
    same output. No randomness, no I/O, no LLM calls.

    Args:
        orders:   List of order dicts (from Order.to_dict())
        payments: List of payment dicts (from Payment.to_dict())

    Returns:
        List of Discrepancy objects, sorted by risk_amount descending.
    """
    results: list[Discrepancy] = []

    # ------------------------------------------------------------------
    # 1. Detect duplicate orders (same order_id appearing >1 time)
    # ------------------------------------------------------------------
    order_id_counts: dict[str, list[dict]] = {}
    for o in orders:
        oid = o.get("order_id", "")
        order_id_counts.setdefault(oid, []).append(o)

    for oid, dupes in order_id_counts.items():
        if len(dupes) > 1:
            net = _to_decimal(dupes[0].get("net_amount"))
            results.append(Discrepancy(
                discrepancy_type="DUPLICATE_ORDER",
                order_id=oid,
                transaction_ref=None,
                order_amount=net,
                payment_amount=None,
                difference=None,
                currency=dupes[0].get("currency"),
                risk_amount=net or Decimal("0"),
                severity="LOW",
                details={"duplicate_count": len(dupes)},
            ))

    # Deduplicated orders dict (first occurrence wins for matching)
    orders_map: dict[str, dict] = {}
    for o in orders:
        oid = o.get("order_id", "")
        if oid not in orders_map:
            orders_map[oid] = o

    # ------------------------------------------------------------------
    # 2. Data quality — collected here, enriched with payment info after
    #    payment grouping (step 3) so we can attach transaction refs.
    # ------------------------------------------------------------------
    dq_orders: list[tuple[str, dict]] = []  # (oid, order) pairs needing DQ flag
    seen_dq: set[str] = set()
    for o in orders:
        oid = o.get("order_id", "")
        if oid in seen_dq:
            continue
        missing = []
        if not o.get("customer_email"):
            missing.append("customer_email")
        if missing:
            seen_dq.add(oid)
            dq_orders.append((oid, o, missing))

    # ------------------------------------------------------------------
    # 3. Group payments by normalized order_reference
    # ------------------------------------------------------------------
    payments_by_order: dict[str, list[dict]] = {}
    for p in payments:
        ref = _normalize_ref(p.get("order_reference", ""))
        payments_by_order.setdefault(ref, []).append(p)

    # ------------------------------------------------------------------
    # 3b. Now emit DATA_QUALITY records enriched with payment context
    # ------------------------------------------------------------------
    for oid, o, missing in dq_orders:
        pmts = payments_by_order.get(oid, [])
        charges = [p for p in pmts if (p.get("payment_type") or "").lower() == "charge"]
        charge = charges[0] if charges else None
        results.append(Discrepancy(
            discrepancy_type="DATA_QUALITY",
            order_id=oid,
            transaction_ref=charge.get("transaction_ref") if charge else None,
            order_amount=_to_decimal(o.get("net_amount")),
            payment_amount=_to_decimal(charge.get("amount")) if charge else None,
            difference=None,
            currency=o.get("currency"),
            risk_amount=Decimal("0"),
            severity="LOW",
            details={
                "missing_fields": missing,
                "note": "Order has a matched payment but order record is incomplete",
            },
        ))

    # ------------------------------------------------------------------
    # 4. Phantom payments — payment references unknown order
    # ------------------------------------------------------------------
    for ref, pmts in payments_by_order.items():
        if not ref:
            continue  # payments with no order_reference — skip
        if ref not in orders_map:
            for p in pmts:
                amt = _to_decimal(p.get("amount"))
                results.append(Discrepancy(
                    discrepancy_type="PHANTOM_PAYMENT",
                    order_id=ref,   # the ref the payment claims to match
                    transaction_ref=p.get("transaction_ref"),
                    order_amount=None,
                    payment_amount=amt,
                    difference=None,
                    currency=p.get("currency"),
                    risk_amount=amt or Decimal("0"),
                    severity="MEDIUM",
                    details={
                        "payment_status": p.get("status"),
                        "payment_type": p.get("payment_type"),
                        "note": "Payment references an order_id not found in orders dataset",
                    },
                ))

    # ------------------------------------------------------------------
    # 5. Process each order against its payments
    # ------------------------------------------------------------------
    for oid, order in orders_map.items():
        pmts = payments_by_order.get(oid, [])
        order_net = _to_decimal(order.get("net_amount"))
        order_currency = (order.get("currency") or "").strip().upper()
        order_status = (order.get("status") or "").lower().strip()

        # --- 5a. Missing payment ---
        # Only flag if the order is in an active/completed state.
        # Cancelled/draft/pending_approval orders with no payment are expected.
        if not pmts:
            if order_status not in _INACTIVE_STATUSES:
                results.append(Discrepancy(
                    discrepancy_type="MISSING_PAYMENT",
                    order_id=oid,
                    transaction_ref=None,
                    order_amount=order_net,
                    payment_amount=None,
                    difference=None,
                    currency=order_currency,
                    risk_amount=order_net or Decimal("0"),
                    severity="HIGH",
                    details={"order_status": order_status},
                ))
            continue

        # Separate charge vs refund payments
        charges = [p for p in pmts if (p.get("payment_type") or "").lower() == "charge"]
        refunds = [p for p in pmts if (p.get("payment_type") or "").lower() == "refund"]

        # --- 5b. Cancelled order charged ---
        if order_status == "cancelled" and charges:
            for p in charges:
                amt = _to_decimal(p.get("amount"))
                results.append(Discrepancy(
                    discrepancy_type="CANCELLED_ORDER_CHARGED",
                    order_id=oid,
                    transaction_ref=p.get("transaction_ref"),
                    order_amount=order_net,
                    payment_amount=amt,
                    difference=amt,
                    currency=order_currency,
                    risk_amount=amt or Decimal("0"),
                    severity="HIGH",
                    details={"order_status": order_status, "payment_status": p.get("status")},
                ))
            continue  # don't run further checks on cancelled orders

        # --- 5c. Duplicate payment (>1 charge for same order) ---
        if len(charges) > 1:
            charge_amounts = [_to_decimal(p.get("amount")) for p in charges]
            valid_amounts = [a for a in charge_amounts if a is not None]
            total_charged = sum(valid_amounts, Decimal("0"))
            # Risk = total excess beyond the first (authoritative) charge
            excess = sum(valid_amounts[1:], Decimal("0"))
            results.append(Discrepancy(
                discrepancy_type="DUPLICATE_PAYMENT",
                order_id=oid,
                transaction_ref=", ".join(p.get("transaction_ref", "") for p in charges),
                order_amount=order_net,
                payment_amount=total_charged,
                difference=excess,
                currency=order_currency,
                risk_amount=excess,
                severity="HIGH",
                details={
                    "charge_count": len(charges),
                    "transaction_refs": [p.get("transaction_ref") for p in charges],
                    "charge_amounts": [float(a) for a in valid_amounts],
                    "excess_charged": float(excess),
                },
            ))
            # Continue checks against the first (authoritative) charge only
            charges = charges[:1]

        # Edge case: only refund payments, no charge at all
        if not charges:
            total_refunded = sum(
                (_to_decimal(r.get("amount")) or Decimal("0")) for r in refunds
            )
            results.append(Discrepancy(
                discrepancy_type="PHANTOM_PAYMENT",
                order_id=oid,
                transaction_ref=", ".join(r.get("transaction_ref", "") for r in refunds),
                order_amount=order_net,
                payment_amount=total_refunded,
                difference=None,
                currency=order_currency,
                risk_amount=total_refunded,
                severity="MEDIUM",
                details={
                    "note": "Refund payment(s) exist but no charge payment found for this order",
                    "refund_refs": [r.get("transaction_ref") for r in refunds],
                },
            ))
            continue

        charge = charges[0]
        charge_amt = _to_decimal(charge.get("amount"))
        charge_currency = (charge.get("currency") or "").strip().upper()
        charge_status = (charge.get("status") or "").lower().strip()

        # --- 5d. Failed / pending payment ---
        if charge_status in _FAILED_STATUSES:
            results.append(Discrepancy(
                discrepancy_type="FAILED_PAYMENT",
                order_id=oid,
                transaction_ref=charge.get("transaction_ref"),
                order_amount=order_net,
                payment_amount=charge_amt,
                difference=None,
                currency=order_currency,
                # Risk = order amount because revenue was expected but not collected
                risk_amount=order_net or Decimal("0"),
                severity="HIGH",
                details={
                    "payment_status": charge_status,
                    "order_status": order_status,
                    "note": f"Payment {charge_status} — revenue not collected",
                },
            ))
            continue  # no point checking amounts if money was never collected

        # --- 5e. Currency mismatch ---
        if charge_currency and order_currency and charge_currency != order_currency:
            results.append(Discrepancy(
                discrepancy_type="CURRENCY_MISMATCH",
                order_id=oid,
                transaction_ref=charge.get("transaction_ref"),
                order_amount=order_net,
                payment_amount=charge_amt,
                difference=None,
                currency=f"{order_currency}/{charge_currency}",
                risk_amount=charge_amt or Decimal("0"),
                severity="HIGH",
                details={
                    "order_currency": order_currency,
                    "payment_currency": charge_currency,
                    "note": "Cannot compare amounts across different currencies",
                },
            ))
            continue  # amount comparison is meaningless across currencies

        # --- 5f. Amount mismatch ---
        diff = _abs_diff(order_net, charge_amt)
        if diff is not None and diff > AMOUNT_TOLERANCE:
            results.append(Discrepancy(
                discrepancy_type="AMOUNT_MISMATCH",
                order_id=oid,
                transaction_ref=charge.get("transaction_ref"),
                order_amount=order_net,
                payment_amount=charge_amt,
                difference=(charge_amt - order_net) if (charge_amt and order_net) else diff,
                currency=order_currency,
                risk_amount=diff,
                severity=_amount_severity(diff),
                details={
                    "order_net": float(order_net) if order_net else None,
                    "payment_amount": float(charge_amt) if charge_amt else None,
                    "difference": float(diff),
                    "tolerance": float(AMOUNT_TOLERANCE),
                    "direction": "overcharged" if charge_amt and order_net and charge_amt > order_net else "undercharged",
                },
            ))

        # --- 5g. Partial refund (order=refunded but refund < charge) ---
        if order_status == "refunded" and refunds:
            total_refunded = sum(
                (_to_decimal(r.get("amount")) or Decimal("0")) for r in refunds
            )
            if charge_amt and total_refunded < charge_amt - AMOUNT_TOLERANCE:
                shortfall = charge_amt - total_refunded
                results.append(Discrepancy(
                    discrepancy_type="PARTIAL_REFUND",
                    order_id=oid,
                    transaction_ref=charge.get("transaction_ref"),
                    order_amount=charge_amt,
                    payment_amount=total_refunded,
                    difference=-shortfall,
                    currency=order_currency,
                    risk_amount=shortfall,
                    severity="MEDIUM",
                    details={
                        "original_charge": float(charge_amt),
                        "total_refunded": float(total_refunded),
                        "shortfall": float(shortfall),
                        "refund_refs": [r.get("transaction_ref") for r in refunds],
                    },
                ))
            # Full refund (total_refunded >= charge_amt - tolerance) is CLEAN — no discrepancy

        # --- 5h. Unexpected refund (refund exists but order not in refunded/cancelled state) ---
        elif order_status not in ("refunded", "cancelled") and refunds:
            total_refunded = sum(
                (_to_decimal(r.get("amount")) or Decimal("0")) for r in refunds
            )
            results.append(Discrepancy(
                discrepancy_type="UNEXPECTED_REFUND",
                order_id=oid,
                transaction_ref=", ".join(r.get("transaction_ref", "") for r in refunds),
                order_amount=order_net,
                payment_amount=total_refunded,
                difference=-total_refunded,
                currency=order_currency,
                risk_amount=total_refunded,
                severity="HIGH",
                details={
                    "note": "Refund transaction found but order status is not 'refunded' or 'cancelled'",
                    "order_status": order_status,
                    "total_refunded": float(total_refunded),
                    "refund_refs": [r.get("transaction_ref") for r in refunds],
                },
            ))

    # Sort by risk_amount descending so highest-value issues appear first
    results.sort(key=lambda d: d.risk_amount, reverse=True)
    return results
