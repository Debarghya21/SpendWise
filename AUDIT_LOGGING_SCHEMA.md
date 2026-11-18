# SpendWise Audit Logging Schema

This document outlines the comprehensive audit logging fields added to all services to track data changes and user actions without dummy data.

## Core Audit Fields (All Services)

Every entity now includes:

| Field | Type | Purpose |
|-------|------|---------|
| `createdAt` | Timestamp | ISO 8601 timestamp when the record was created |
| `createdBy` | String (100 chars) | User ID or system identifier who created the record |
| `updatedAt` | Timestamp | ISO 8601 timestamp of the last modification |
| `updatedBy` | String (100 chars) | User ID who last modified the record |

---

## 1. Supplier Service (PostgreSQL)

### `suppliers` Table

**New Audit Columns:**
- `created_by` (VARCHAR 100): Initial creator user ID
- `updated_by` (VARCHAR 100): Last modifier user ID
- `verification_status` (VARCHAR 30): One of `UNVERIFIED`, `VERIFIED`, `REJECTED`
- `last_verified_at` (TIMESTAMPTZ): When supplier verification occurred
- `verified_by` (VARCHAR 100): User who performed verification

### `supplier_audit_log` Table (New)

Detailed audit trail for all supplier modifications:

```sql
CREATE TABLE supplier_audit_log (
  id              SERIAL PRIMARY KEY,
  supplier_id     VARCHAR(20) REFERENCES suppliers(id) ON DELETE CASCADE,
  action          VARCHAR(50),           -- CREATED, UPDATED, STATUS_CHANGED, RATED, VERIFIED
  old_values      JSONB,                 -- Previous values
  new_values      JSONB,                 -- New values
  changed_by      VARCHAR(100) NOT NULL, -- Who made the change
  changed_at      TIMESTAMPTZ DEFAULT now(),
  reason          TEXT                   -- Optional business reason
);
```

**Supplier Categories:**
- `created_by`, `updated_by`, `created_at`, `updated_at`

**Supplier Ratings:**
- `updated_by`, `created_at`, `updated_at`

---

## 2. Budget Service (PostgreSQL)

### `budgets` Table

**New Audit Columns:**
- `created_by` (VARCHAR 100): Budget creator
- `updated_by` (VARCHAR 100): Last modifier

### `budget_reservations` Table

**New Audit Columns:**
- `created_by` (VARCHAR 100): Who created the reservation
- `updated_by` (VARCHAR 100): Who last modified the reservation

### `budget_alerts` Table

**New Audit Columns:**
- `created_by` (VARCHAR 100): Who generated the alert

### `budget_audit_log` Table (New)

Detailed audit trail for budget changes:

```sql
CREATE TABLE budget_audit_log (
  id              SERIAL PRIMARY KEY,
  budget_id       INT REFERENCES budgets(id) ON DELETE CASCADE,
  action          VARCHAR(50),           -- CREATED, UPDATED
  old_values      JSONB,                 -- Previous allocated_amount, alert_threshold
  new_values      JSONB,                 -- New values
  changed_by      VARCHAR(100) NOT NULL,
  changed_at      TIMESTAMPTZ DEFAULT now(),
  reason          TEXT
);
```

---

## 3. Purchase Order Service (MySQL/Spring Boot)

### `purchase_orders` Table

**New Audit Columns:**
```java
@Column(name = "created_by", length = 100)
private String createdBy;

@Column(name = "updated_by", length = 100)
private String updatedBy;

@Column(name = "submitted_at")
private Instant submittedAt;

@Column(name = "submitted_by", length = 100)
private String submittedBy;

@Column(name = "approved_at")
private Instant approvedAt;

@Column(name = "approved_by", length = 100)
private String approvedBy;

@Column(name = "rejected_at")
private Instant rejectedAt;

@Column(name = "rejected_by", length = 100)
private String rejectedBy;
```

**Purpose:**
- Track exact timestamps when PO moves through workflow states
- Record who initiated each state change
- Enable complete audit trail for compliance

### `purchase_order_items` Table

**New Audit Columns:**
```java
@Column(name = "created_at", nullable = false)
private Instant createdAt = Instant.now();

@Column(name = "created_by", length = 100)
private String createdBy;
```

---

## 4. Spend Analytics Service (MongoDB)

### Collections

All documents include:

**`spend_transactions` Collection:**
```json
{
  "_id": "PO-1001",
  "purchaseOrderId": "PO-1001",
  "supplierId": "SUP-101",
  "supplierName": "ABC Technologies",
  "category": "IT Equipment",
  "department": "Engineering",
  "amount": 150000,
  "status": "APPROVED",
  "lastEventType": "PurchaseOrderApproved",
  "createdAt": "2026-11-16T10:30:00Z",
  "createdBy": "user@example.com",
  "updatedAt": "2026-11-16T10:35:00Z",
  "updatedBy": "approver@example.com",
  "approvedAt": "2026-11-16T10:35:00Z",
  "month": "2026-11"
}
```

**`analytics_events` Collection:**
```json
{
  "_id": "evt-uuid-123",
  "eventType": "PurchaseOrderApproved",
  "purchaseOrderId": "PO-1001",
  "result": "spend-recorded",
  "processedAt": "2026-11-16T10:35:00Z",
  "createdAt": "2026-11-16T10:35:00Z",
  "createdBy": "budget-service"
}
```

**`budget_alerts` Collection:**
```json
{
  "_id": "alert-uuid-456",
  "budgetId": 1,
  "department": "Engineering",
  "threshold": 80,
  "utilization": 85.5,
  "alertStatus": "OPEN",
  "message": "Engineering budget utilisation reached 85.5%...",
  "occurredAt": "2026-11-16T10:30:00Z",
  "createdAt": "2026-11-16T10:30:00Z",
  "createdBy": "budget-service"
}
```

**Indexes:**
```python
db.spend_transactions.create_index([("createdAt", DESCENDING)])
db.analytics_events.create_index([("createdAt", DESCENDING)])
db.budget_alerts.create_index([("createdAt", DESCENDING)])
```

---

## User Context Propagation

### From API Requests

The user ID is extracted from request headers:

```
X-User-Id: user@example.com
```

If not provided, defaults to `'anonymous'` or `'system'` for internal operations.

### Implementation Pattern (All Services)

**In Controllers:**
```javascript
const userId = req.headers['x-user-id'] || req.user?.id || 'anonymous';
await service.create(req.body, userId);
```

**In Services:**
```javascript
async function create(body, userId = 'system') {
  // ... validation ...
  return await repo.create(body, userId);
}
```

**In Repositories:**
```javascript
async function create(body, userId = 'system') {
  const { rows } = await pool.query(
    `INSERT INTO suppliers (..., created_by, updated_by) 
     VALUES (..., $1, $2) RETURNING *`,
    [userId, userId]
  );
  
  // Log the action
  await pool.query(
    `INSERT INTO supplier_audit_log (supplier_id, action, changed_by, reason) 
     VALUES ($1, $2, $3, $4)`,
    [supplierId, 'CREATED', userId, 'New supplier registered']
  );
}
```

---

## No Dummy Data

**All services now:**
- ✅ Initialize database schema with audit columns
- ✅ **Do NOT seed any dummy suppliers, budgets, or purchase orders**
- ✅ Ready to accept real data from API requests
- ✅ Track every operation with timestamps and user IDs
- ✅ Support audit log queries for compliance and debugging

**Example initialization output:**
```
Supplier database schema initialized. Ready to accept real data.
Budget database schema initialized. Ready to accept real data.
```

---

## Audit Log Queries

### View all changes to a supplier:
```sql
SELECT * FROM supplier_audit_log 
WHERE supplier_id = 'SUP-101' 
ORDER BY changed_at DESC;
```

### View budget modifications in a date range:
```sql
SELECT * FROM budget_audit_log 
WHERE changed_at BETWEEN '2026-11-01' AND '2026-11-30'
ORDER BY changed_at DESC;
```

### View MongoDB event processing history:
```javascript
db.analytics_events.find({createdAt: {$gte: new Date('2026-11-01')}}).sort({createdAt: -1})
```

---

## Production Considerations

1. **Retention Policy**: Archive audit logs after 90-180 days
2. **Performance**: Index `changed_at`, `createdAt`, `supplier_id`, `budget_id` for fast queries
3. **Data Sensitivity**: Mask sensitive fields in old_values/new_values (GST numbers, etc.)
4. **User Context**: Integrate with authentication system to populate X-User-Id header automatically
5. **Monitoring**: Alert on suspicious patterns (e.g., bulk deletes, unauthorized users)

---

**Last Updated:** 16 November 2026
**Status:** Production-ready audit logging without dummy data
