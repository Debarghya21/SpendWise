import mongomock

from app.services import analytics_service as svc


def event(event_id, event_type, po="PO-1001", amount=150000, status="PENDING_APPROVAL"):
    return {
        "eventId": event_id,
        "eventType": event_type,
        "occurredAt": "2026-11-20T10:00:00Z",
        "purchaseOrderId": po,
        "supplierId": "SUP-101",
        "supplierName": "ABC Technologies",
        "category": "IT Equipment",
        "department": "Engineering",
        "totalAmount": amount,
        "status": status,
    }


def test_approved_event_updates_reports():
    db = mongomock.MongoClient().db
    assert svc.process_event(db, event("e1", "PurchaseOrderCreated")) == "status-updated"
    assert svc.process_event(db, event("e2", "PurchaseOrderApproved", status="APPROVED")) == "spend-recorded"

    ov = svc.overview(db)
    assert ov["totalSpend"] == 150000
    assert ov["approvedPurchaseOrders"] == 1
    assert ov["topDepartment"] == "Engineering"
    assert svc.departments(db)[0]["department"] == "Engineering"


def test_duplicate_event_is_ignored():
    db = mongomock.MongoClient().db
    e = event("e2", "PurchaseOrderApproved", status="APPROVED")
    svc.process_event(db, e)
    assert svc.process_event(db, e) == "duplicate"
    assert svc.overview(db)["totalSpend"] == 150000
