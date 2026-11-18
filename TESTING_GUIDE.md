# SpendWise Project Testing Guide

## ✅ Test Execution Complete

All tests for the SpendWise project have been successfully executed. Here's what was tested:

## 📊 Test Results Summary

| Service | Framework | Tests | Status |
|---------|-----------|-------|--------|
| **Budget Service** | Node.js/Jest | 5 | ✅ PASSED |
| **Supplier Service** | Node.js/Jest | 8 | ✅ PASSED |
| **Spend Analytics** | Python/Pytest | 3 | ✅ PASSED |
| **Purchase Order** | Java/Maven/JUnit | 9 | ✅ PASSED |
| **TOTAL** | - | **25** | **✅ ALL PASSED** |

---

## 🚀 Quick Start Commands

### Run Individual Service Tests

**Budget Service:**
```bash
cd services/budget-service
npm install
npm test
```

**Supplier Service:**
```bash
cd services/supplier-service
npm install
npm test
```

**Spend Analytics Service:**
```bash
cd services/spend-analytics-service
python3 -m venv venv
source venv/bin/activate
pip install pytest fastapi pika pymongo mongomock httpx
pytest tests/test_anomaly.py -v
```

**Purchase Order Service:**
```bash
cd services/purchase-order-service
mvn clean test
```

### Run All Tests at Once

**Using the provided test runner:**
```bash
./run-all-tests.sh
```

This script will:
- Run all tests in sequence
- Display colored output for easy reading
- Generate a test results file (`test-results.txt`)
- Report pass/fail status for each service

---

## 📋 Test Details

### Budget Service Tests (`services/budget-service/tests/budget.test.js`)

**Test Cases:**
1. ✅ `computeAvailability` - Validates availability calculation formula
2. ✅ `computeAvailability` - Handles zero allocation edge case
3. ✅ `toBudgetDto` - Converts database records to API DTOs
4. ✅ `validateBudget` - Validates required budget fields
5. ✅ `validateReservation` - Validates PO reservation requirements

**Validates:** Budget allocation, consumption, reservation, and availability calculations

---

### Supplier Service Tests 

**Test Files:**
- `tests/supplier.test.js` - Supplier model validation and DTO mapping
- `tests/app.test.js` - Application integration tests

**Test Coverage:**
- Supplier validation (GST, email, status)
- Partial validation for updates
- Database to API DTO mapping
- Rating and review count transformations

**Validates:** Supplier data integrity and API contract compliance

---

### Spend Analytics Service Tests (`services/spend-analytics-service/tests/test_anomaly.py`)

**Test Cases:**
1. ✅ `test_no_anomalies_for_uniform_spend` - No false positives for consistent spending
2. ✅ `test_flags_outlier` - Correctly identifies spending anomalies with HIGH severity
3. ✅ `test_needs_minimum_samples` - Requires sufficient data before flagging anomalies

**Validates:** Anomaly detection algorithm accuracy and data requirements

---

### Purchase Order Service Tests 

**Test Classes:**
- `com.spendwise.entity.POStatusTest` (5 tests)
  - PO status validation and transitions
  - Enum value handling
  
- `com.spendwise.service.PurchaseOrderServiceTest` (4 tests)
  - PO service operations
  - Business logic validation

**Build:** Maven with Spring Boot, Compilation successful, all tests passing

**Validates:** PO lifecycle, status management, and service operations

---

## 🛠️ Environment Setup

### Prerequisites

- **Node.js**: v18+ (for Budget & Supplier services)
- **Python**: 3.11+ (for Analytics service)
- **Java**: OpenJDK 17+ (for Purchase Order service)
- **Maven**: 3.8+ (for Java builds)

### Dependency Installation

```bash
# Node.js services
cd services/budget-service && npm install
cd ../supplier-service && npm install

# Python service
cd ../spend-analytics-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt

# Java service (uses Maven)
cd ../purchase-order-service
mvn clean install
```

---

## 📈 Test Coverage Areas

✅ **Unit Tests**
- Budget calculations and DTO conversions
- Supplier validation rules
- PO status management
- Anomaly detection algorithms

✅ **Integration Tests**
- Service layer interactions
- API contract compliance
- Data transformation pipelines

✅ **Validation Tests**
- Input validation and error handling
- Business rule enforcement
- Status transition validation

---

## 🔄 Continuous Testing

### Manual Testing Workflow

1. **Make code changes**
2. **Run tests for affected service:**
   ```bash
   cd services/<service-name>
   npm test  # or mvn test, or pytest
   ```
3. **Review test output**
4. **Commit changes only if all tests pass**

### Pre-commit Hook Recommendation

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
./run-all-tests.sh
```

---

## 📝 Test Configuration Files

| Service | Config File | Purpose |
|---------|-------------|---------|
| Budget | `services/budget-service/package.json` | Jest configuration |
| Supplier | `services/supplier-service/package.json` | Jest configuration |
| Analytics | `services/spend-analytics-service/pytest.ini` | Pytest configuration |
| Purchase Order | `services/purchase-order-service/pom.xml` | Maven & JUnit configuration |

---

## 🚨 Troubleshooting

### Node.js Tests Fail

**Solution:**
```bash
cd services/<service>
rm -rf node_modules package-lock.json
npm install
npm test
```

### Python Tests Fail

**Solution:**
```bash
cd services/spend-analytics-service
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements-dev.txt
pytest tests/ -v
```

### Java Tests Fail

**Solution:**
```bash
cd services/purchase-order-service
mvn clean
mvn test
```

If issues persist, check Java version:
```bash
java -version  # Should be 17+
javac -version # Should be 17+
```

---

## 🎯 Next Steps

### Recommended Enhancements

1. **Frontend Testing**
   - Add Jest/Vitest for React components
   - E2E tests with Playwright or Cypress

2. **Integration Testing**
   - Docker Compose based integration tests
   - Service-to-service communication tests

3. **Coverage Reports**
   ```bash
   npm test -- --coverage  # Node.js
   pytest --cov           # Python
   mvn test jacoco:report  # Java
   ```

4. **Performance Testing**
   - Load testing with k6 or JMeter
   - Database query optimization tests

5. **Security Testing**
   - Dependency vulnerability scanning (npm audit, pip-audit)
   - OWASP security checks

---

## 📞 Support

For test-related issues:
1. Check individual service test logs
2. Review `TEST_REPORT.md` for detailed results
3. Run `./run-all-tests.sh` to verify all tests
4. Check service-specific documentation in each `services/<service>/README.md`

---

**Last Updated:** November 17, 2026  
**Test Status:** ✅ All Tests Passing
