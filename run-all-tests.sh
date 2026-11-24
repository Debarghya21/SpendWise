#!/bin/bash

# SpendWise Project - Comprehensive Test Runner
# This script runs all tests across all services

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_FILE="$PROJECT_ROOT/test-results.txt"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SpendWise Project - Test Suite Runner                ║${NC}"
echo -e "${BLUE}║   Running All Service Tests                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

# Initialize results file
> "$RESULTS_FILE"

# Function to run tests and log results
run_test_suite() {
    local service_name=$1
    local test_command=$2
    local test_path=$3
    
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Testing: $service_name${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if cd "$test_path"; then
        if eval "$test_command" 2>&1 | tee -a "$RESULTS_FILE"; then
            echo -e "${GREEN}✅ $service_name - PASSED${NC}\n"
            echo "✅ $service_name - PASSED" >> "$RESULTS_FILE"
        else
            echo -e "${RED}❌ $service_name - FAILED${NC}\n"
            echo "❌ $service_name - FAILED" >> "$RESULTS_FILE"
            return 1
        fi
        cd - > /dev/null
    else
        echo -e "${RED}❌ Failed to navigate to $test_path${NC}\n"
        echo "❌ $service_name - PATH NOT FOUND" >> "$RESULTS_FILE"
        return 1
    fi
}

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 1. Budget Service Tests
echo -e "\n${BLUE}[1/4]${NC} Running Budget Service Tests..."
if run_test_suite "Budget Service (Node.js/Jest)" "npm install -q && npm test" "$PROJECT_ROOT/services/budget-service"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# 2. Supplier Service Tests
echo -e "\n${BLUE}[2/4]${NC} Running Supplier Service Tests..."
if run_test_suite "Supplier Service (Node.js/Jest)" "npm install -q && npm test" "$PROJECT_ROOT/services/supplier-service"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# 3. Analytics Service Tests
echo -e "\n${BLUE}[3/4]${NC} Running Spend Analytics Service Tests..."
ANALYTICS_PATH="$PROJECT_ROOT/services/spend-analytics-service"
cd "$ANALYTICS_PATH"
if python3 -m venv venv-test 2>/dev/null; then
    if source venv-test/bin/activate && pip install -q pytest fastapi pika pymongo mongomock httpx 2>/dev/null && pytest tests/test_anomaly.py -v 2>&1 | tee -a "$RESULTS_FILE"; then
        echo -e "${GREEN}✅ Spend Analytics Service - PASSED${NC}\n"
        echo "✅ Spend Analytics Service - PASSED" >> "$RESULTS_FILE"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ Spend Analytics Service - FAILED${NC}\n"
        echo "❌ Spend Analytics Service - FAILED" >> "$RESULTS_FILE"
        ((FAILED_TESTS++))
    fi
    deactivate 2>/dev/null || true
    rm -rf venv-test
else
    echo -e "${RED}❌ Failed to set up Python environment${NC}\n"
    ((FAILED_TESTS++))
fi
cd - > /dev/null
((TOTAL_TESTS++))

# 4. Purchase Order Service Tests
echo -e "\n${BLUE}[4/4]${NC} Running Purchase Order Service Tests..."
if run_test_suite "Purchase Order Service (Java/Maven)" "mvn clean test -q" "$PROJECT_ROOT/services/purchase-order-service"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Print summary
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   TEST EXECUTION SUMMARY                               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

echo -e "Total Test Suites:  ${YELLOW}$TOTAL_TESTS${NC}"
echo -e "Passed:             ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:             ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}\n"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Check $RESULTS_FILE for details.${NC}\n"
    exit 1
fi
