package com.spendwise.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.util.List;

/**
 * Either provide {@code items} or a single {@code amount}.
 * {@code submit} (default true) immediately validates the supplier and reserves budget.
 */
public record CreatePurchaseOrderRequest(
        @NotBlank String supplierId,
        @NotBlank String department,
        String description,
        @DecimalMin(value = "0.01") BigDecimal amount,
        @Valid List<ItemRequest> items,
        String requestedBy,
        Boolean submit
) {
    public boolean shouldSubmit() {
        return submit == null || submit;
    }
}
