package com.spendwise.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record PurchaseOrderResponse(
        Long id,
        String purchaseOrderId,
        String supplierId,
        String supplierName,
        String category,
        String department,
        String description,
        BigDecimal totalAmount,
        String currency,
        String status,
        String statusReason,
        Long budgetReservationId,
        String requestedBy,
        Instant createdAt,
        Instant updatedAt,
        List<Item> items,
        String message,
        Boolean automaticApproval,
        String circuitBreakerState
) {
    public record Item(Long id, String itemName, Integer quantity, BigDecimal unitPrice, BigDecimal lineTotal) {
    }
}
