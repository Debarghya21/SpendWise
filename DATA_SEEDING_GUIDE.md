# SpendWise Data Seeding Guide

This guide explains how to seed real data into SpendWise without using dummy data.

## Overview

All services have been updated to:
- ✅ **Remove** pre-populated dummy data
- ✅ **Initialize** database schemas with audit logging fields
- ✅ **Accept** real data through API requests only
- ✅ **Track** all changes with `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

---

## 1. Start the Application

```bash
docker compose up --build
```

Verify all services are healthy:
```bash
curl http://localhost:8080/api/suppliers/health
curl http://localhost:8080/api/budgets/health
curl http://localhost:8080/api/purchase-orders/health
curl http://localhost:8080/api/analytics/health
```

---

## 2. Create Supplier Categories (Optional but Recommended)

The categories are auto-created when you create suppliers, but you can seed them explicitly:

**Using PostgreSQL directly:**
```bash
docker exec -it spendwise-supplier-db psql -U postgres -d supplier_db -c "
INSERT INTO supplier_categories (category_name, description, created_by) VALUES
('IT Equipment', 'Laptops, servers, networking hardware', 'admin'),
('Office Supplies', 'Stationery and consumables', 'admin'),
('Software & Cloud', 'Licences and cloud subscriptions', 'admin'),
('Logistics', 'Freight and courier services', 'admin'),
('Facilities', 'Maintenance and facility management', 'admin'),
('Professional Services', 'Consulting and contractors', 'admin')
ON CONFLICT DO NOTHING;
"
```

---

## 3. Create Suppliers

**API Request (with audit logging):**

```bash
curl -X POST http://localhost:8080/api/suppliers \
  -H "Content-Type: application/json" \
  -H "X-User-Id: procurement@spendwise.com" \
  -d '{
    "name": "ABC Technologies",
    "email": "vendor@abc.com",
    "phone": "+91-9876543210",
    "gstNumber": "29ABCDE1234F1Z5",
    "category": "IT Equipment",
    "address": "123 Tech Park, Bangalore"
  }'
```

**Response will include:**
```json
{
  "id": "SUP-101",
  "name": "ABC Technologies",
  "email": "vendor@abc.com",
  "category": "IT Equipment",
  "status": "ACTIVE",
  "createdAt": "2026-11-16T10:30:00Z",
  "createdBy": "procurement@spendwise.com",
  "updatedAt": "2026-11-16T10:30:00Z",
  "updatedBy": "procurement@spendwise.com"
}
```

**Bulk Create Suppliers (Bash Script):**

```bash
#!/bin/bash

SUPPLIERS=(
  '{"name":"Prime Office Supplies","email":"sales@primeoffice.in","gstNumber":"27PQRST5678K1Z2","category":"Office Supplies","address":"New Delhi"}'
  '{"name":"CloudNet Services","email":"accounts@cloudnet.io","gstNumber":"07LMNOP4321Q1Z9","category":"Software & Cloud","address":"Bangalore"}'
  '{"name":"Swift Logistics","email":"ops@swiftlogistics.in","gstNumber":"33WXYZA8765B1Z4","category":"Logistics","address":"Mumbai"}'
  '{"name":"Metro Facilities","email":"contact@metrofacilities.in","gstNumber":"19FGHIJ1111C1Z7","category":"Facilities","address":"Pune"}'
)

for supplier in "${SUPPLIERS[@]}"; do
  curl -X POST http://localhost:8080/api/suppliers \
    -H "Content-Type: application/json" \
    -H "X-User-Id: admin@spendwise.com" \
    -d "$supplier"
  sleep 1
done
```

---

## 4. Create Department Budgets

**API Request:**

```bash
curl -X POST http://localhost:8080/api/budgets \
  -H "Content-Type: application/json" \
  -H "X-User-Id: finance@spendwise.com" \
  -d '{
    "department": "Engineering",
    "fiscalYear": "2026-27",
    "allocatedAmount": 500000,
    "alertThreshold": 75
  }'
```

**Response will include:**
```json
{
  "id": 1,
  "department": "Engineering",
  "allocatedAmount": 500000,
  "consumedAmount": 0,
  "reservedAmount": 0,
  "availableAmount": 500000,
  "utilizationPercent": 0,
  "createdAt": "2026-11-16T11:00:00Z",
  "createdBy": "finance@spendwise.com",
  "updatedAt": "2026-11-16T11:00:00Z",
  "updatedBy": "finance@spendwise.com"
}
```

**Bulk Create Budgets (Bash Script):**

```bash
#!/bin/bash

BUDGETS=(
  '{"department":"Engineering","allocatedAmount":500000,"alertThreshold":75}'
  '{"department":"Marketing","allocatedAmount":200000,"alertThreshold":80}'
  '{"department":"Finance","allocatedAmount":150000,"alertThreshold":80}'
  '{"department":"Operations","allocatedAmount":300000,"alertThreshold":85}'
  '{"department":"Human Resources","allocatedAmount":100000,"alertThreshold":80}'
)

for budget in "${BUDGETS[@]}"; do
  curl -X POST http://localhost:8080/api/budgets \
    -H "Content-Type: application/json" \
    -H "X-User-Id: finance@spendwise.com" \
    -d "$budget"
  sleep 1
done
```

---

## 5. Create a Purchase Order (Complete Workflow)

**Step 1: Create PO in DRAFT status**

```bash
curl -X POST http://localhost:8080/api/purchase-orders \
  -H "Content-Type: application/json" \
  -H "X-User-Id: procurement@spendwise.com" \
  -d '{
    "supplierId": "SUP-101",
    "department": "Engineering",
    "description": "10x Laptops for new hires",
    "items": [
      {
        "itemName": "Dell XPS 15 Laptop",
        "quantity": 10,
        "unitPrice": 15000
      }
    ]
  }'
```

**Response:**
```json
{
  "id": 1,
  "poNumber": "PO-1001",
  "supplierId": "SUP-101",
  "supplierName": "ABC Technologies",
  "department": "Engineering",
  "totalAmount": 150000,
  "status": "DRAFT",
  "createdAt": "2026-11-16T12:00:00Z",
  "createdBy": "procurement@spendwise.com",
  "updatedAt": "2026-11-16T12:00:00Z",
  "updatedBy": "procurement@spendwise.com",
  "items": [...]
}
```

**Step 2: Submit for Approval**

```bash
curl -X POST http://localhost:8080/api/purchase-orders/1/submit \
  -H "X-User-Id: procurement@spendwise.com"
```

This will:
- Validate supplier is ACTIVE
- Reserve funds from the department budget
- Change status to PENDING_BUDGET_REVIEW or PENDING_APPROVAL
- Publish a RabbitMQ event
- Track `submittedAt` and `submittedBy`

**Step 3: Approve PO**

```bash
curl -X POST http://localhost:8080/api/purchase-orders/1/approve \
  -H "X-User-Id: manager@spendwise.com"
```

This will:
- Commit the budget reservation
- Publish PurchaseOrderApproved event
- Analytics service processes the event and updates spend reports
- Track `approvedAt` and `approvedBy`

---

## 6. Query Audit Logs

### View supplier audit trail:

```bash
docker exec -it spendwise-supplier-db psql -U postgres -d supplier_db -c "
SELECT 
  supplier_id,
  action,
  changed_by,
  changed_at,
  reason
FROM supplier_audit_log
WHERE supplier_id = 'SUP-101'
ORDER BY changed_at DESC;
"
```

### View budget modifications:

```bash
docker exec -it spendwise-budget-db psql -U postgres -d budget_db -c "
SELECT 
  budget_id,
  action,
  changed_by,
  changed_at,
  old_values,
  new_values
FROM budget_audit_log
WHERE budget_id = 1
ORDER BY changed_at DESC;
"
```

### View analytics events:

```bash
docker exec -it spendwise-analytics-db mongosh --eval "
db.getSiblingDB('analytics_db').analytics_events
  .find({}, {_id: 1, eventType: 1, result: 1, createdAt: 1, createdBy: 1})
  .sort({createdAt: -1})
  .limit(10)
"
```

---

## 7. Generate Realistic Test Data

**Script: `seed-test-data.sh`**

```bash
#!/bin/bash
set -e

API_GATEWAY="http://localhost:8080"
ADMIN_USER="test@spendwise.com"

echo "🌱 Seeding SpendWise test data..."

# Step 1: Create suppliers
echo "Creating suppliers..."
SUPPLIERS=(
  "ABC Tech:vendor@abc.com:29ABCDE1234F1Z5:IT Equipment"
  "Office Pro:sales@office.com:27OPRF1234Q1Z2:Office Supplies"
  "Cloud Plus:cloud@cloudplus.com:07CLPD1234Q1Z9:Software & Cloud"
)

for supplier_info in "${SUPPLIERS[@]}"; do
  IFS=: read name email gst category <<< "$supplier_info"
  echo "  Creating: $name"
  curl -s -X POST "$API_GATEWAY/api/suppliers" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: $ADMIN_USER" \
    -d "{\"name\":\"$name\",\"email\":\"$email\",\"gstNumber\":\"$gst\",\"category\":\"$category\"}" > /dev/null
  sleep 0.5
done

# Step 2: Create budgets
echo "Creating departmental budgets..."
DEPARTMENTS=("Engineering:500000" "Marketing:200000" "Finance:150000" "Operations:300000")

for dept_info in "${DEPARTMENTS[@]}"; do
  IFS=: read dept amount <<< "$dept_info"
  echo "  Creating: $dept (₹$amount)"
  curl -s -X POST "$API_GATEWAY/api/budgets" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: $ADMIN_USER" \
    -d "{\"department\":\"$dept\",\"allocatedAmount\":$amount,\"alertThreshold\":75}" > /dev/null
  sleep 0.5
done

echo "✅ Test data seeded successfully!"
echo "📊 Access API: $API_GATEWAY"
echo "👤 Recommended X-User-Id: procurement@spendwise.com, finance@spendwise.com, manager@spendwise.com"
```

**Run it:**
```bash
chmod +x seed-test-data.sh
./seed-test-data.sh
```

---

## 8. Verify Data is Being Tracked

### Check a supplier was created with audit fields:

```bash
curl http://localhost:8080/api/suppliers/SUP-101 \
  -H "X-User-Id: viewer@spendwise.com" | jq '.createdBy, .createdAt, .updatedBy, .updatedAt'
```

### Check a budget was created:

```bash
curl http://localhost:8080/api/budgets/1 | jq '.createdBy, .createdAt'
```

### Check analytics processed an event:

```bash
curl http://localhost:8080/api/analytics/overview | jq '.eventsProcessed, .lastUpdated'
```

---

## Best Practices

1. **Always provide X-User-Id header** so audit logs record who made changes
2. **Use meaningful email addresses** for user IDs: `procurement@spendwise.com`, `finance@spendwise.com`
3. **Validate before bulk seeding** - test one record first
4. **Archive old audit logs** - set a retention policy (90 days is typical)
5. **Index audit tables** for fast compliance queries
6. **Never modify audit logs** - they're read-only evidence

---

## Troubleshooting

### "Budget not found" when creating a PO?
- Ensure you've created a budget for the department in the PO

### Audit fields show NULL?
- Check the X-User-Id header is being sent with the request
- If not provided, defaults to 'anonymous'

### RabbitMQ events not being processed?
- Verify budget is successfully reserved before submission
- Check analytics service logs: `docker compose logs spend-analytics-service`

---

**Last Updated:** 16 November 2026
**Status:** Production-ready, ready for real data ingestion
