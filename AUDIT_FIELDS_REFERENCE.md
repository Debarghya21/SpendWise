# SpendWise Audit Fields Quick Reference

## Service-by-Service Audit Field Checklist

### 🏪 Supplier Service (Node.js + PostgreSQL)

**Tables Updated:**
```
✅ suppliers
  - created_by (VARCHAR 100)
  - updated_by (VARCHAR 100)
  - verification_status (VARCHAR 30)
  - last_verified_at (TIMESTAMPTZ)
  - verified_by (VARCHAR 100)

✅ supplier_categories
  - created_by (VARCHAR 100)
  - updated_by (VARCHAR 100)
  - created_at (TIMESTAMPTZ)
  - updated_at (TIMESTAMPTZ)

✅ supplier_ratings
  - updated_by (VARCHAR 100)
  - created_at (TIMESTAMPTZ)
  - updated_at (TIMESTAMPTZ)

✅ supplier_audit_log (NEW)
  - supplier_id (FK)
  - action (CREATED|UPDATED|STATUS_CHANGED|RATED|VERIFIED)
  - old_values (JSONB)
  - new_values (JSONB)
  - changed_by (VARCHAR 100)
  - changed_at (TIMESTAMPTZ)
  - reason (TEXT)
```

**API Contract:**
```
Header: X-User-Id: procurement@example.com (required for audit)
POST /api/suppliers
  → createdBy = X-User-Id
  → createdAt = now()
  → Audit log entry added

PUT /api/suppliers/{id}
  → updatedBy = X-User-Id
  → updatedAt = now()
  → Old/new values stored in audit log
```

---

### 💰 Budget Service (Node.js + PostgreSQL)

**Tables Updated:**
```
✅ budgets
  - created_by (VARCHAR 100)
  - updated_by (VARCHAR 100)
  - created_at (TIMESTAMPTZ)
  - updated_at (TIMESTAMPTZ)

✅ budget_reservations
  - created_by (VARCHAR 100)
  - updated_by (VARCHAR 100)
  - created_at (TIMESTAMPTZ)
  - updated_at (TIMESTAMPTZ)

✅ budget_alerts
  - created_by (VARCHAR 100)
  - created_at (TIMESTAMPTZ)

✅ budget_audit_log (NEW)
  - budget_id (FK)
  - action (CREATED|UPDATED|RESERVED|RELEASED|COMMITTED)
  - old_values (JSONB)
  - new_values (JSONB)
  - changed_by (VARCHAR 100)
  - changed_at (TIMESTAMPTZ)
  - reason (TEXT)

✅ processed_events
  - event_id (VARCHAR 64, PRIMARY KEY)
  - event_type (VARCHAR 60)
  - processed_at (TIMESTAMPTZ)
```

**API Contract:**
```
Header: X-User-Id: finance@example.com (required)
POST /api/budgets
  → createdBy = X-User-Id
  → Audit log created

POST /api/budgets/{id}/reservations
  → createdBy = X-User-Id
  → Atomic transaction with FOR UPDATE lock
  → Idempotent per poId

RabbitMQ Consumer:
  → Budget Service listens to PO events
  → Marks events processed (idempotent)
  → Updates reservations: RESERVED → COMMITTED or RELEASED
  → userId = 'budget-service' in audit logs
```

---

### 📦 Purchase Order Service (Java Spring Boot + MySQL)

**Entity Updates:**
```
✅ PurchaseOrder
  - created_by (VARCHAR 100)
  - updated_by (VARCHAR 100)
  - submitted_at (INSTANT)
  - submitted_by (VARCHAR 100)
  - approved_at (INSTANT)
  - approved_by (VARCHAR 100)
  - rejected_at (INSTANT)
  - rejected_by (VARCHAR 100)
  - created_at (INSTANT, never null)
  - updated_at (INSTANT, never null)

✅ PurchaseOrderItem
  - created_at (INSTANT)
  - created_by (VARCHAR 100)
```

**Workflow State Tracking:**
```
DRAFT
  → createdAt, createdBy

DRAFT → PENDING_BUDGET_REVIEW / PENDING_APPROVAL
  → submittedAt = now()
  → submittedBy = current user
  → Budget reservation attempted

PENDING_APPROVAL → APPROVED
  → approvedAt = now()
  → approvedBy = current user
  → publishes PurchaseOrderApproved event
  → budget moves to COMMITTED

PENDING_APPROVAL → REJECTED
  → rejectedAt = now()
  → rejectedBy = current user
  → publishes PurchaseOrderRejected event
  → budget returns to RESERVED

APPROVED → CANCELLED
  → publishes PurchaseOrderCancelled event
  → budget returns to RESERVED

PENDING_BUDGET_REVIEW (Circuit Breaker)
  → Fallback when Budget Service unavailable
  → Can be manually approved later when service recovers
```

**API Contract:**
```
Header: X-User-Id: procurement@example.com (recommended)
Defaults to request principal if present

Circuit Breaker (Resilience4j):
  - Protects calls to Budget Service
  - Failure threshold: 50%
  - Sliding window: 5 requests
  - Open timeout: 20 seconds
  - Half-open test calls: 2
  - Request timeout: 3 seconds

Fallback Response:
  {
    "purchaseOrderId": "PO-1005",
    "status": "PENDING_BUDGET_REVIEW",
    "message": "Budget validation temporarily unavailable"
  }
```

**Transactional Outbox:**
```
✅ po_events (NEW TABLE)
  - id (SERIAL PRIMARY KEY)
  - po_id (FK to purchase_orders)
  - event_type (VARCHAR 60)
  - event_payload (JSONB)
  - published (BOOLEAN)
  - created_at (TIMESTAMPTZ)
  - published_at (TIMESTAMPTZ)

Purpose:
  - Atomic write of PO + event in same transaction
  - Background job publishes to RabbitMQ
  - Ensures no events are lost
  - Idempotent consumer handles duplicates
```

---

### 📊 Spend Analytics Service (Python FastAPI + MongoDB)

**Collections Updated:**
```
✅ spend_transactions
  {
    _id: "PO-1001",
    purchaseOrderId: "PO-1001",
    supplierId: "SUP-101",
    supplierName: "ABC Technologies",
    category: "IT Equipment",
    department: "Engineering",
    amount: 150000,
    status: "APPROVED",
    createdAt: ISODate("2026-11-16T10:30:00Z"),
    createdBy: "procurement@example.com",
    updatedAt: ISODate("2026-11-16T10:35:00Z"),
    updatedBy: "approver@example.com",
    approvedAt: ISODate("2026-11-16T10:35:00Z"),
    month: "2026-11"
  }

✅ analytics_events
  {
    _id: "evt-uuid-123",
    eventType: "PurchaseOrderApproved",
    purchaseOrderId: "PO-1001",
    result: "spend-recorded",
    processedAt: ISODate("2026-11-16T10:35:00Z"),
    createdAt: ISODate("2026-11-16T10:35:00Z"),
    createdBy: "purchase-order-service"
  }

✅ budget_alerts
  {
    _id: "alert-uuid-456",
    budgetId: 1,
    department: "Engineering",
    threshold: 80,
    utilization: 85.5,
    occurredAt: ISODate("2026-11-16T10:30:00Z"),
    createdAt: ISODate("2026-11-16T10:30:00Z"),
    createdBy: "budget-service"
  }

✅ department_analytics
  {
    _id: "Engineering",
    totalSpend: 150000,
    purchaseOrderCount: 1,
    createdAt: ISODate("2026-11-16T10:35:00Z"),
    updatedAt: ISODate("2026-11-16T10:35:00Z")
  }

✅ category_analytics
  {
    _id: "IT Equipment",
    totalSpend: 150000,
    purchaseOrderCount: 1,
    updatedAt: ISODate("2026-11-16T10:35:00Z")
  }

✅ supplier_analytics
  {
    _id: "SUP-101",
    supplierName: "ABC Technologies",
    category: "IT Equipment",
    totalSpend: 150000,
    purchaseOrderCount: 1,
    rejectedOrCancelledCount: 0,
    updatedAt: ISODate("2026-11-16T10:35:00Z")
  }
```

**Indexes:**
```
✅ db.spend_transactions.create_index([("createdAt", DESCENDING)])
✅ db.spend_transactions.create_index([("status", ASCENDING)])
✅ db.spend_transactions.create_index([("department", ASCENDING)])
✅ db.analytics_events.create_index([("createdAt", DESCENDING)])
✅ db.analytics_events.create_index([("processedAt", DESCENDING)])
✅ db.budget_alerts.create_index([("createdAt", DESCENDING)])
```

**Event Processing Flow:**
```
RabbitMQ Event
  ↓
po_consumer.py receives event
  ↓
analytics_service.process_event()
  - Check if eventId already in analytics_events (idempotent)
  - If new: apply event (insert/update spend_transactions)
  - Aggregate to department/category/supplier analytics
  - Insert record in analytics_events
  ↓
Database updated with createdAt, createdBy, updatedAt, updatedBy
  ↓
/api/analytics/overview returns lastUpdated timestamp
```

---

## User Context Flow

```
Client Request
  ↓
X-User-Id: procurement@example.com (HTTP Header)
  ↓
Controller: const userId = req.headers['x-user-id'] || 'anonymous'
  ↓
Service: await service.create(body, userId)
  ↓
Repository: INSERT ... (created_by: userId, ...)
  ↓
INSERT INTO audit_log (changed_by: userId, ...)
  ↓
Database Record
  {
    "created_by": "procurement@example.com",
    "created_at": "2026-11-16T10:30:00Z",
    "updated_by": "procurement@example.com",
    "updated_at": "2026-11-16T10:30:00Z"
  }
```

---

## Audit Query Examples

### PostgreSQL (Supplier & Budget)

```sql
-- View all changes to a supplier
SELECT supplier_id, action, changed_by, changed_at, reason
FROM supplier_audit_log
WHERE supplier_id = 'SUP-101'
ORDER BY changed_at DESC;

-- View budget modifications in date range
SELECT budget_id, action, changed_by, changed_at, old_values, new_values
FROM budget_audit_log
WHERE changed_at BETWEEN '2026-11-01' AND '2026-11-30'
ORDER BY changed_at DESC;

-- Find who made changes (user activity)
SELECT changed_by, COUNT(*) as change_count
FROM supplier_audit_log
WHERE changed_at > now() - interval '7 days'
GROUP BY changed_by
ORDER BY change_count DESC;
```

### MongoDB (Analytics)

```javascript
// View event processing history
db.analytics_events.find({createdAt: {$gte: ISODate("2026-11-01")}})
  .sort({createdAt: -1})
  .limit(20)

// Find events processed by specific service
db.analytics_events.find({createdBy: "budget-service"})

// Get spend transactions created in time range
db.spend_transactions.find({
  createdAt: {$gte: ISODate("2026-11-01"), $lt: ISODate("2026-11-30")}
}).sort({createdAt: -1})

// Find approved orders by specific user
db.spend_transactions.find({
  status: "APPROVED",
  updatedBy: "approver@example.com"
})
```

---

## Production Deployment Checklist

- [ ] All audit columns added to production database
- [ ] Indexes created on `createdAt`, `createdBy` for performance
- [ ] Application passes X-User-Id from authentication system
- [ ] Audit logs monitored for data integrity
- [ ] Archive audit logs after 90+ days (data retention policy)
- [ ] Backup audit tables separately (compliance requirement)
- [ ] Query audit logs in compliance/investigation processes
- [ ] Alert on suspicious patterns (mass deletes, unauthorized users)
- [ ] Document audit log retention policy
- [ ] Train support team on querying audit trails

---

## Testing Checklist

- [ ] Create supplier, verify audit log entry
- [ ] Update supplier, verify old_values and new_values in log
- [ ] Create budget, verify created_by matches X-User-Id
- [ ] Create PO, verify createdBy and submittedBy flow
- [ ] Approve PO, verify approvedAt and approvedBy populated
- [ ] Query analytics overview, verify lastUpdated present
- [ ] Delete records, verify audit logs remain (immutable)
- [ ] Test without X-User-Id header, verify defaults to 'anonymous'

---

**Version:** 1.0  
**Last Updated:** 16 November 2026  
**Status:** ✅ Production Ready
