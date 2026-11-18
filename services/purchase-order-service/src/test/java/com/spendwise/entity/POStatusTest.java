package com.spendwise.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class POStatusTest {

    @Test
    void budgetReviewCanNeverJumpToApproved() {
        assertFalse(POStatus.PENDING_BUDGET_REVIEW.canTransitionTo(POStatus.APPROVED));
        assertFalse(POStatus.DRAFT.canTransitionTo(POStatus.APPROVED));
    }

    @Test
    void normalApprovalPath() {
        assertTrue(POStatus.DRAFT.canTransitionTo(POStatus.PENDING_APPROVAL));
        assertTrue(POStatus.PENDING_APPROVAL.canTransitionTo(POStatus.APPROVED));
        assertTrue(POStatus.APPROVED.canTransitionTo(POStatus.COMPLETED));
    }

    @Test
    void budgetReviewCanRecover() {
        assertTrue(POStatus.DRAFT.canTransitionTo(POStatus.PENDING_BUDGET_REVIEW));
        assertTrue(POStatus.PENDING_BUDGET_REVIEW.canTransitionTo(POStatus.PENDING_APPROVAL));
    }

    @Test
    void terminalStatesAreFinal() {
        for (POStatus target : POStatus.values()) {
            assertFalse(POStatus.REJECTED.canTransitionTo(target));
            assertFalse(POStatus.CANCELLED.canTransitionTo(target));
            assertFalse(POStatus.COMPLETED.canTransitionTo(target));
        }
    }

    @Test
    void totalIsSumOfLineItems() {
        PurchaseOrder po = new PurchaseOrder();
        po.addItem(new PurchaseOrderItem("Laptop", 10, new BigDecimal("15000")));
        po.addItem(new PurchaseOrderItem("Mouse", 10, new BigDecimal("500")));
        po.recalculateTotal();
        assertEquals(0, new BigDecimal("155000").compareTo(po.getTotalAmount()));
    }
}
