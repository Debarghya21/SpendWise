package com.spendwise.client;

import java.math.BigDecimal;

/** Outcome of a budget reservation attempt. */
public record BudgetDecision(Outcome outcome, Long reservationId, BigDecimal availableAmount, String message) {

    public enum Outcome {
        /** Funds reserved successfully. */
        RESERVED,
        /** Budget Service answered but refused (insufficient funds / unknown department). */
        REJECTED,
        /** Budget Service unreachable or circuit OPEN -> fallback. */
        UNAVAILABLE
    }

    public static BudgetDecision reserved(Long reservationId, BigDecimal available) {
        return new BudgetDecision(Outcome.RESERVED, reservationId, available, "Budget reserved");
    }

    public static BudgetDecision rejected(String message) {
        return new BudgetDecision(Outcome.REJECTED, null, null, message);
    }

    public static BudgetDecision unavailable(String message) {
        return new BudgetDecision(Outcome.UNAVAILABLE, null, null, message);
    }
}
