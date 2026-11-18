package com.spendwise.client;

/** Result of the Supplier Service eligibility check. */
public record SupplierValidation(
        String supplierId,
        String name,
        String category,
        String status,
        boolean eligible,
        String reason
) {
}
