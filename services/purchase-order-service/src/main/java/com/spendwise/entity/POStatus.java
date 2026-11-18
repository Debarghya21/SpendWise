package com.spendwise.entity;

/**
 * Purchase order lifecycle.
 * DRAFT -> PENDING_APPROVAL (budget reserved) | PENDING_BUDGET_REVIEW (budget service unavailable) | REJECTED
 * PENDING_BUDGET_REVIEW -> PENDING_APPROVAL (retry succeeded) | REJECTED | CANCELLED
 * PENDING_APPROVAL -> APPROVED | REJECTED | CANCELLED
 * APPROVED -> COMPLETED
 */
public enum POStatus {
    DRAFT,
    PENDING_BUDGET_REVIEW,
    PENDING_APPROVAL,
    APPROVED,
    REJECTED,
    CANCELLED,
    COMPLETED;

    public boolean canTransitionTo(POStatus target) {
        return switch (this) {
            case DRAFT -> target == PENDING_APPROVAL || target == PENDING_BUDGET_REVIEW
                    || target == REJECTED || target == CANCELLED;
            case PENDING_BUDGET_REVIEW -> target == PENDING_APPROVAL || target == REJECTED || target == CANCELLED;
            case PENDING_APPROVAL -> target == APPROVED || target == REJECTED || target == CANCELLED;
            case APPROVED -> target == COMPLETED;
            case REJECTED, CANCELLED, COMPLETED -> false;
        };
    }

    public boolean isTerminal() {
        return this == REJECTED || this == CANCELLED || this == COMPLETED;
    }
}
