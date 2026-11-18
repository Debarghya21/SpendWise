package com.spendwise.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spendwise.client.BudgetClient;
import com.spendwise.client.BudgetDecision;
import com.spendwise.client.SupplierClient;
import com.spendwise.client.SupplierValidation;
import com.spendwise.dto.CreatePurchaseOrderRequest;
import com.spendwise.entity.PurchaseOrder;
import com.spendwise.exception.ApiException;
import com.spendwise.repository.OutboxEventRepository;
import com.spendwise.repository.POApprovalRepository;
import com.spendwise.repository.POStatusHistoryRepository;
import com.spendwise.repository.PurchaseOrderRepository;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PurchaseOrderServiceTest {

    private PurchaseOrderRepository poRepository;
    private OutboxEventRepository outboxRepository;
    private SupplierClient supplierClient;
    private BudgetClient budgetClient;
    private PurchaseOrderService service;

    @BeforeEach
    void setUp() {
        poRepository = mock(PurchaseOrderRepository.class);
        outboxRepository = mock(OutboxEventRepository.class);
        supplierClient = mock(SupplierClient.class);
        budgetClient = mock(BudgetClient.class);
        when(poRepository.save(any(PurchaseOrder.class))).thenAnswer(inv -> {
            PurchaseOrder po = inv.getArgument(0);
            po.setId(5L);
            return po;
        });
        when(supplierClient.validate("SUP-101")).thenReturn(
                new SupplierValidation("SUP-101", "ABC Technologies", "IT Equipment", "ACTIVE", true, "ok"));
        service = new PurchaseOrderService(poRepository, mock(POStatusHistoryRepository.class),
                mock(POApprovalRepository.class), outboxRepository, supplierClient, budgetClient,
                CircuitBreakerRegistry.ofDefaults(), new ObjectMapper());
    }

    private CreatePurchaseOrderRequest request() {
        return new CreatePurchaseOrderRequest("SUP-101", "Engineering", "Laptops",
                new BigDecimal("150000"), null, "eng.manager", true);
    }

    @Test
    void reservedBudgetMovesToPendingApproval() {
        when(budgetClient.reserve(eq("Engineering"), eq("PO-1005"), any())).thenReturn(BudgetDecision.reserved(9L, BigDecimal.TEN));
        var response = service.create(request());
        assertEquals("PO-1005", response.purchaseOrderId());
        assertEquals("PENDING_APPROVAL", response.status());
        assertEquals(9L, response.budgetReservationId());
        verify(outboxRepository).save(any());
    }

    @Test
    void unavailableBudgetFallsBackToPendingBudgetReview() {
        when(budgetClient.reserve(any(), any(), any())).thenReturn(BudgetDecision.unavailable("down"));
        var response = service.create(request());
        assertEquals("PENDING_BUDGET_REVIEW", response.status());
        assertEquals(Boolean.FALSE, response.automaticApproval());
    }

    @Test
    void insufficientBudgetRejects() {
        when(budgetClient.reserve(any(), any(), any())).thenReturn(BudgetDecision.rejected("Insufficient budget"));
        assertEquals("REJECTED", service.create(request()).status());
    }

    @Test
    void inactiveSupplierIsRefused() {
        when(supplierClient.validate("SUP-105")).thenReturn(
                new SupplierValidation("SUP-105", "Metro", "Facilities", "INACTIVE", false, "inactive"));
        var req = new CreatePurchaseOrderRequest("SUP-105", "Engineering", null, BigDecimal.ONE, null, null, true);
        assertThrows(ApiException.class, () -> service.create(req));
        verifyNoInteractions(budgetClient);
    }
}
