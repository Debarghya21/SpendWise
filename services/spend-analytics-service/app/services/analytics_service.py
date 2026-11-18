"""Event processing (write side) and analytics queries (read side)."""
import logging
from datetime import datetime, timezone

from pymongo.database import Database

from app.services.anomaly import detect_anomalies

log = logging.getLogger("analytics")

SPEND_STATUSES = ["APPROVED", "COMPLETED"]
PENDING_STATUSES = ["DRAFT", "PENDING_APPROVAL", "PENDING_BUDGET_REVIEW"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_time(value) -> datetime:
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return _now()


# --------------------------------------------------------------------------- write side

def process_event(db: Database, event: dict) -> str:
    """Idempotently apply one event. Returns a short result string."""
    event_id = event.get("eventId")
    event_type = event.get("eventType")
    if not event_id or not event_type:
        raise ValueError("eventId and eventType are required")

    if db.analytics_events.find_one({"_id": event_id}, {"_id": 1}):
        return "duplicate"

    if event_type == "BudgetThresholdAlert":
        db.budget_alerts.update_one(
            {"_id": event_id},
            {
                "$set": {**event, "occurredAt": _parse_time(event.get("occurredAt")), "createdAt": _now(), "createdBy": event.get("createdBy") or "system"},
                "$setOnInsert": {"createdAt": _now(), "createdBy": event.get("createdBy") or "system"}
            },
            upsert=True
        )
        result = "alert-stored"
    elif event_type.startswith("PurchaseOrder"):
        result = _apply_purchase_order_event(db, event, event_type)
    else:
        result = "ignored"

    db.analytics_events.insert_one({
        "_id": event_id,
        "eventType": event_type,
        "purchaseOrderId": event.get("purchaseOrderId"),
        "result": result,
        "processedAt": _now(),
        "createdAt": _now(),
        "createdBy": event.get("createdBy") or "system",
    })
    return result


def _apply_purchase_order_event(db: Database, event: dict, event_type: str) -> str:
    po_id = event["purchaseOrderId"]
    occurred = _parse_time(event.get("occurredAt"))
    amount = float(event.get("totalAmount") or 0)
    department = event.get("department") or "Unknown"
    category = event.get("category") or "Uncategorised"
    supplier_id = event.get("supplierId") or "UNKNOWN"
    supplier_name = event.get("supplierName") or supplier_id

    base = {
        "purchaseOrderId": po_id,
        "supplierId": supplier_id,
        "supplierName": supplier_name,
        "category": category,
        "department": department,
        "amount": amount,
        "status": event.get("status"),
        "lastEventType": event_type,
        "updatedAt": _now(),
        "updatedBy": event.get("createdBy") or "system",
    }
    update = {"$set": base, "$setOnInsert": {"createdAt": _parse_time(event.get("createdAt") or occurred), "createdBy": event.get("createdBy") or "system"}}

    if event_type == "PurchaseOrderApproved":
        month = occurred.strftime("%Y-%m")
        update["$set"].update({"approvedAt": occurred, "month": month})
        db.spend_transactions.update_one({"_id": po_id}, update, upsert=True)

        inc = {"$inc": {"totalSpend": amount, "purchaseOrderCount": 1}, "$set": {"updatedAt": _now()}}
        db.department_analytics.update_one({"_id": department}, inc, upsert=True)
        db.category_analytics.update_one({"_id": category}, inc, upsert=True)
        db.supplier_analytics.update_one(
            {"_id": supplier_id},
            {"$inc": {"totalSpend": amount, "purchaseOrderCount": 1},
             "$set": {"supplierName": supplier_name, "category": category, "updatedAt": _now()}},
            upsert=True,
        )
        return "spend-recorded"

    if event_type in ("PurchaseOrderRejected", "PurchaseOrderCancelled"):
        db.supplier_analytics.update_one(
            {"_id": supplier_id},
            {"$inc": {"rejectedOrCancelledCount": 1}, "$set": {"supplierName": supplier_name, "updatedAt": _now()}},
            upsert=True,
        )

    db.spend_transactions.update_one({"_id": po_id}, update, upsert=True)
    return "status-updated"


# --------------------------------------------------------------------------- read side

def _strip(doc: dict, key: str) -> dict:
    doc = dict(doc)
    doc[key] = doc.pop("_id")
    return doc


def overview(db: Database) -> dict:
    tx = db.spend_transactions
    total_spend = sum(d.get("totalSpend", 0) for d in db.department_analytics.find())
    approved = tx.count_documents({"status": {"$in": SPEND_STATUSES}})
    top = db.department_analytics.find_one(sort=[("totalSpend", -1)])
    return {
        "totalSpend": round(total_spend, 2),
        "totalPurchaseOrders": tx.count_documents({}),
        "approvedPurchaseOrders": approved,
        "pendingPurchaseOrders": tx.count_documents({"status": {"$in": PENDING_STATUSES}}),
        "rejectedPurchaseOrders": tx.count_documents({"status": "REJECTED"}),
        "cancelledPurchaseOrders": tx.count_documents({"status": "CANCELLED"}),
        "activeSuppliers": len(tx.distinct("supplierId", {"status": {"$in": SPEND_STATUSES}})),
        "averageOrderValue": round(total_spend / approved, 2) if approved else 0,
        "topDepartment": top["_id"] if top else None,
        "eventsProcessed": db.analytics_events.count_documents({}),
        "lastUpdated": _now(),
    }


def departments(db: Database) -> list[dict]:
    return [_strip(d, "department") for d in db.department_analytics.find().sort("totalSpend", -1)]


def categories(db: Database) -> list[dict]:
    return [_strip(d, "category") for d in db.category_analytics.find().sort("totalSpend", -1)]


def suppliers(db: Database) -> list[dict]:
    result = []
    for d in db.supplier_analytics.find().sort("totalSpend", -1):
        d = _strip(d, "supplierId")
        approved = d.get("purchaseOrderCount", 0)
        failed = d.get("rejectedOrCancelledCount", 0)
        total = approved + failed
        d.setdefault("totalSpend", 0)
        d.setdefault("purchaseOrderCount", 0)
        d["approvalRate"] = round(approved / total * 100, 1) if total else None
        result.append(d)
    return result


def monthly(db: Database) -> list[dict]:
    pipeline = [
        {"$match": {"status": {"$in": SPEND_STATUSES}, "month": {"$exists": True}}},
        {"$group": {"_id": "$month", "totalSpend": {"$sum": "$amount"}, "purchaseOrderCount": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    return [_strip(d, "month") for d in db.spend_transactions.aggregate(pipeline)]


def anomalies(db: Database) -> list[dict]:
    txs = list(db.spend_transactions.find({"status": {"$in": SPEND_STATUSES}}))
    return detect_anomalies(txs)


def recent_events(db: Database, limit: int = 25) -> list[dict]:
    return [_strip(d, "eventId") for d in db.analytics_events.find().sort("processedAt", -1).limit(limit)]


def alerts(db: Database, limit: int = 50) -> list[dict]:
    return [_strip(d, "eventId") for d in db.budget_alerts.find().sort("occurredAt", -1).limit(limit)]
