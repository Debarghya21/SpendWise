package com.spendwise.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.spendwise.client.BudgetClient;
import com.spendwise.client.BudgetDecision;
import com.spendwise.client.SupplierClient;
import com.spendwise.client.SupplierValidation;
import com.spendwise.dto.CreatePurchaseOrderRequest;
import com.spendwise.dto.DecisionRequest;
import com.spendwise.dto.ItemRequest;
import com.spendwise.dto.PurchaseOrderResponse;
import com.spendwise.entity.*;
import com.spendwise.exception.ApiException;
import com.spendwise.messaging.PurchaseOrderEventType;
import com.spendwise.repository.OutboxEventRepository;
import com.spendwise.repository.POApprovalRepository;
import com.spendwise.repository.POStatusHistoryRepository;
import com.spendwise.repository.PurchaseOrderRepository;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
public class PurchaseOrderService {

    private final PurchaseOrderRepository poRepository;
    private final POStatusHistoryRepository historyRepository;
    private final POApprovalRepository approvalRepository;
    private final OutboxEventRepository outboxRepository;
    private final SupplierClient supplierClient;
    private final BudgetClient budgetClient;
    private final CircuitBreakerRegistry circuitBreakerRegistry;
    private final ObjectMapper objectMapper;

    public PurchaseOrderService(PurchaseOrderRepository poRepository,
                                POStatusHistoryRepository historyRepository,
                                POApprovalRepository approvalRepository,
                                OutboxEventRepository outboxRepository,
                                SupplierClient supplierClient,
                                BudgetClient budgetClient,
                                CircuitBreakerRegistry circuitBreakerRegistry,
                                ObjectMapper objectMapper) {
        this.poRepository = poRepository;
        this.historyRepository = historyRepository;
        this.approvalRepository = approvalRepository;
        this.outboxRepository = outboxRepository;
        this.supplierClient = supplierClient;
        this.budgetClient = budgetClient;
        this.circuitBreakerRegistry = circuitBreakerRegistry;
        this.objectMapper = objectMapper;
    }

    // ------------------------------------------------------------------ Commands

    @Transactional
    public PurchaseOrderResponse create(CreatePurchaseOrderRequest req) {
        SupplierValidation supplier = requireEligibleSupplier(req.supplierId());

        PurchaseOrder po = new PurchaseOrder();
        po.setSupplierId(supplier.supplierId());
        po.setSupplierName(supplier.name());
        po.setCategory(supplier.category());
        po.setDepartment(req.department().trim());
        po.setDescription(req.description());
        po.setRequestedBy(req.requestedBy() == null ? "department.manager" : req.requestedBy());

        List<ItemRequest> items = req.items();
        if (items != null && !items.isEmpty()) {
            items.forEach(i -> po.addItem(new PurchaseOrderItem(i.itemName(), i.quantity(), i.unitPrice())));
        } else if (req.amount() != null) {
            String name = req.description() == null ? "General procurement" : req.description();
            po.addItem(new PurchaseOrderItem(name, 1, req.amount()));
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Provide either items or amount");
        }
        po.recalculateTotal();

        poRepository.save(po);
        po.setPoNumber("PO-" + (1000 + po.getId()));
        historyRepository.save(new POStatusHistory(po.getId(), null, POStatus.DRAFT, "Purchase order created"));

        String message = "Purchase order saved as draft.";
        if (req.shouldSubmit()) {
            message = reserveBudget(po);
        }
        enqueueEvent(po, PurchaseOrderEventType.CREATED);
        return toResponse(po, message);
    }

    /** Submit a DRAFT or retry a PENDING_BUDGET_REVIEW order. */
    @Transactional
    public PurchaseOrderResponse submit(String id) {
        PurchaseOrder po = load(id);
        if (po.getStatus() != POStatus.DRAFT && po.getStatus() != POStatus.PENDING_BUDGET_REVIEW) {
            throw new ApiException(HttpStatus.CONFLICT, "Only DRAFT or PENDING_BUDGET_REVIEW orders can be submitted");
        }
        SupplierValidation supplier = supplierClient.validate(po.getSupplierId());
        String message;
        if (!supplier.eligible()) {
            transition(po, POStatus.REJECTED, "Supplier not eligible: " + supplier.reason());
            message = po.getStatusReason();
            enqueueEvent(po, PurchaseOrderEventType.REJECTED);
        } else {
            message = reserveBudget(po);
            enqueueEvent(po, po.getStatus() == POStatus.REJECTED
                    ? PurchaseOrderEventType.REJECTED : PurchaseOrderEventType.SUBMITTED);
        }
        return toResponse(po, message);
    }

    @Transactional
    public PurchaseOrderResponse approve(String id, DecisionRequest decision) {
        PurchaseOrder po = load(id);
        if (po.getStatus() != POStatus.PENDING_APPROVAL) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Only PENDING_APPROVAL orders can be approved (current: " + po.getStatus() + "). "
                            + "Orders without a confirmed budget reservation can never be approved.");
        }
        String approver = decision == null ? "procurement.manager" : decision.approverOrDefault();
        String comment = decision == null ? null : decision.comment();
        approvalRepository.save(new POApproval(po.getId(), approver, "APPROVED", comment));
        transition(po, POStatus.APPROVED, "Approved by " + approver);
        enqueueEvent(po, PurchaseOrderEventType.APPROVED);
        return toResponse(po, "Purchase order approved.");
    }

    @Transactional
    public PurchaseOrderResponse reject(String id, DecisionRequest decision) {
        PurchaseOrder po = load(id);
        if (po.getStatus() != POStatus.PENDING_APPROVAL && po.getStatus() != POStatus.PENDING_BUDGET_REVIEW) {
            throw new ApiException(HttpStatus.CONFLICT, "Order cannot be rejected in status " + po.getStatus());
        }
        String approver = decision == null ? "procurement.manager" : decision.approverOrDefault();
        String comment = decision == null || decision.comment() == null ? "Rejected" : decision.comment();
        approvalRepository.save(new POApproval(po.getId(), approver, "REJECTED", comment));
        transition(po, POStatus.REJECTED, comment);
        enqueueEvent(po, PurchaseOrderEventType.REJECTED); // Budget Service releases the reservation
        return toResponse(po, "Purchase order rejected.");
    }

    @Transactional
    public PurchaseOrderResponse cancel(String id, DecisionRequest decision) {
        PurchaseOrder po = load(id);
        String reason = decision == null || decision.comment() == null ? "Cancelled by requester" : decision.comment();
        transition(po, POStatus.CANCELLED, reason);
        enqueueEvent(po, PurchaseOrderEventType.CANCELLED); // Budget Service releases the reservation
        return toResponse(po, "Purchase order cancelled.");
    }

    @Transactional
    public PurchaseOrderResponse complete(String id) {
        PurchaseOrder po = load(id);
        transition(po, POStatus.COMPLETED, "Goods/services received");
        enqueueEvent(po, PurchaseOrderEventType.COMPLETED);
        return toResponse(po, "Purchase order completed.");
    }

    // ------------------------------------------------------------------ Queries

    @Transactional(readOnly = true)
    public List<PurchaseOrderResponse> list(String status, String department) {
        List<PurchaseOrder> orders;
        if (status != null && !status.isBlank()) {
            POStatus s;
            try {
                s = POStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown status " + status);
            }
            orders = poRepository.findByStatusOrderByCreatedAtDesc(s);
        } else {
            orders = poRepository.findAllByOrderByCreatedAtDesc();
        }
        return orders.stream()
                .filter(po -> department == null || department.isBlank() || po.getDepartment().equalsIgnoreCase(department))
                .map(po -> toResponse(po, null))
                .toList();
    }

    @Transactional(readOnly = true)
    public PurchaseOrderResponse get(String id) {
        return toResponse(load(id), null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> history(String id) {
        PurchaseOrder po = load(id);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("purchaseOrderId", po.getPoNumber());
        result.put("statusHistory", historyRepository.findByPoIdOrderByChangedAtAsc(po.getId()));
        result.put("approvals", approvalRepository.findByPoIdOrderByDecidedAtAsc(po.getId()));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> outboxStatus() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pendingEvents", outboxRepository.countByPublishedAtIsNull());
        result.put("recentEvents", outboxRepository.findTop20ByOrderByCreatedAtDesc().stream().map(e -> Map.of(
                "eventId", e.getId(),
                "eventType", e.getEventType(),
                "purchaseOrderId", e.getAggregateId(),
                "createdAt", e.getCreatedAt().toString(),
                "published", e.getPublishedAt() != null,
                "attempts", e.getAttempts())).toList());
        return result;
    }

    public String circuitBreakerState() {
        return circuitBreakerRegistry.circuitBreaker(BudgetClient.CIRCUIT_BREAKER).getState().name();
    }

    // ------------------------------------------------------------------ Internals

    private SupplierValidation requireEligibleSupplier(String supplierId) {
        SupplierValidation supplier = supplierClient.validate(supplierId);
        if (!supplier.eligible()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Supplier " + supplierId + " is not eligible: " + supplier.reason());
        }
        return supplier;
    }

    /**
     * Calls Budget Service through the circuit breaker.
     * Budget unavailable => PENDING_BUDGET_REVIEW. The order is NEVER auto-approved.
     */
    private String reserveBudget(PurchaseOrder po) {
        BudgetDecision decision = budgetClient.reserve(po.getDepartment(), po.getPoNumber(), po.getTotalAmount());
        switch (decision.outcome()) {
            case RESERVED -> {
                po.setBudgetReservationId(decision.reservationId());
                transition(po, POStatus.PENDING_APPROVAL, "Budget reserved");
                return "Budget reserved. Purchase order is pending approval.";
            }
            case REJECTED -> {
                transition(po, POStatus.REJECTED, decision.message());
                return decision.message();
            }
            default -> {
                if (po.getStatus() == POStatus.PENDING_BUDGET_REVIEW) {
                    po.setStatusReason(decision.message());
                    po.setUpdatedAt(Instant.now());
                } else {
                    transition(po, POStatus.PENDING_BUDGET_REVIEW, decision.message());
                }
                return "Budget validation is temporarily unavailable.";
            }
        }
    }

    private void transition(PurchaseOrder po, POStatus target, String reason) {
        POStatus current = po.getStatus();
        if (!current.canTransitionTo(target)) {
            throw new ApiException(HttpStatus.CONFLICT, "Invalid status transition " + current + " -> " + target);
        }
        po.setStatus(target);
        po.setStatusReason(reason);
        po.setUpdatedAt(Instant.now());
        historyRepository.save(new POStatusHistory(po.getId(), current, target, reason));
    }

    private void enqueueEvent(PurchaseOrder po, PurchaseOrderEventType type) {
        String eventId = UUID.randomUUID().toString();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventId", eventId);
        payload.put("eventType", type.eventName());
        payload.put("occurredAt", Instant.now().toString());
        payload.put("purchaseOrderId", po.getPoNumber());
        payload.put("id", po.getId());
        payload.put("supplierId", po.getSupplierId());
        payload.put("supplierName", po.getSupplierName());
        payload.put("category", po.getCategory());
        payload.put("department", po.getDepartment());
        payload.put("totalAmount", po.getTotalAmount());
        payload.put("currency", po.getCurrency());
        payload.put("status", po.getStatus().name());
        payload.put("reason", po.getStatusReason());
        payload.put("budgetReservationId", po.getBudgetReservationId());
        payload.put("requestedBy", po.getRequestedBy());
        payload.put("itemCount", po.getItems().size());
        payload.put("createdAt", po.getCreatedAt().toString());
        try {
            outboxRepository.save(new OutboxEvent(eventId, po.getPoNumber(), type.eventName(), type.routingKey(),
                    objectMapper.writeValueAsString(payload)));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialise event", e);
        }
    }

    private PurchaseOrder load(String id) {
        Optional<PurchaseOrder> po = id.toUpperCase().startsWith("PO-")
                ? poRepository.findByPoNumber(id.toUpperCase())
                : parseId(id).flatMap(poRepository::findById);
        return po.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Purchase order " + id + " not found"));
    }

    private Optional<Long> parseId(String id) {
        try {
            return Optional.of(Long.parseLong(id));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private PurchaseOrderResponse toResponse(PurchaseOrder po, String message) {
        List<PurchaseOrderResponse.Item> items = po.getItems().stream()
                .map(i -> new PurchaseOrderResponse.Item(i.getId(), i.getItemName(), i.getQuantity(), i.getUnitPrice(), i.getLineTotal()))
                .toList();
        return new PurchaseOrderResponse(
                po.getId(), po.getPoNumber(), po.getSupplierId(), po.getSupplierName(), po.getCategory(),
                po.getDepartment(), po.getDescription(), po.getTotalAmount() == null ? BigDecimal.ZERO : po.getTotalAmount(),
                po.getCurrency(), po.getStatus().name(), po.getStatusReason(), po.getBudgetReservationId(),
                po.getRequestedBy(), po.getCreatedAt(), po.getUpdatedAt(), items, message,
                message == null ? null : Boolean.FALSE,
                message == null ? null : circuitBreakerState());
    }
}
