"""Pure anomaly-detection logic (no I/O) so it is easy to unit test."""
from collections import defaultdict
from statistics import mean, pstdev

Z_THRESHOLD = 2.0
RATIO_THRESHOLD = 3.0
MIN_SAMPLES = 3


def detect_anomalies(transactions: list[dict]) -> list[dict]:
    """
    Flags unusual purchase orders per department using two rules:
      1. z-score > 2 (when the department has >= MIN_SAMPLES orders and non-zero spread)
      2. amount >= 3x the average of the department's OTHER orders
    """
    by_dept: dict[str, list[dict]] = defaultdict(list)
    for t in transactions:
        by_dept[t.get("department") or "Unknown"].append(t)

    anomalies: list[dict] = []
    for dept, items in by_dept.items():
        if len(items) < MIN_SAMPLES:
            continue
        amounts = [float(i.get("amount", 0)) for i in items]
        avg = mean(amounts)
        std = pstdev(amounts)
        total = sum(amounts)
        for item, amount in zip(items, amounts):
            others_avg = (total - amount) / (len(amounts) - 1)
            reasons = []
            z = (amount - avg) / std if std > 0 else 0.0
            if z > Z_THRESHOLD:
                reasons.append(f"z-score {z:.2f} exceeds {Z_THRESHOLD}")
            if others_avg > 0 and amount >= RATIO_THRESHOLD * others_avg:
                reasons.append(f"{amount / others_avg:.1f}x the department's typical order")
            if reasons:
                anomalies.append({
                    "purchaseOrderId": item.get("purchaseOrderId") or item.get("_id"),
                    "department": dept,
                    "supplierName": item.get("supplierName"),
                    "amount": amount,
                    "departmentAverage": round(avg, 2),
                    "zScore": round(z, 2),
                    "reasons": reasons,
                    "severity": "HIGH" if z > 3 or amount >= 5 * others_avg else "MEDIUM",
                })
    return sorted(anomalies, key=lambda a: a["amount"], reverse=True)
