package com.spendwise.controller;

import com.spendwise.dto.CreatePurchaseOrderRequest;
import com.spendwise.dto.DecisionRequest;
import com.spendwise.dto.PurchaseOrderResponse;
import com.spendwise.service.PurchaseOrderService;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/purchase-orders")
public class PurchaseOrderController {

    private final PurchaseOrderService service;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    public PurchaseOrderController(PurchaseOrderService service, CircuitBreakerRegistry circuitBreakerRegistry) {
        this.service = service;
        this.circuitBreakerRegistry = circuitBreakerRegistry;
    }

    @PostMapping
    public ResponseEntity<PurchaseOrderResponse> create(@Valid @RequestBody CreatePurchaseOrderRequest request) {
        PurchaseOrderResponse response = service.create(request);
        HttpStatus status = "PENDING_BUDGET_REVIEW".equals(response.status()) ? HttpStatus.ACCEPTED : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(response);
    }

    @GetMapping
    public List<PurchaseOrderResponse> list(@RequestParam(required = false) String status,
                                            @RequestParam(required = false) String department) {
        return service.list(status, department);
    }

    @GetMapping("/{id}")
    public PurchaseOrderResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @GetMapping("/{id}/history")
    public Map<String, Object> history(@PathVariable String id) {
        return service.history(id);
    }

    @PostMapping("/{id}/submit")
    public PurchaseOrderResponse submit(@PathVariable String id) {
        return service.submit(id);
    }

    @PostMapping("/{id}/approve")
    public PurchaseOrderResponse approve(@PathVariable String id, @RequestBody(required = false) DecisionRequest body) {
        return service.approve(id, body);
    }

    @PostMapping("/{id}/reject")
    public PurchaseOrderResponse reject(@PathVariable String id, @RequestBody(required = false) DecisionRequest body) {
        return service.reject(id, body);
    }

    @PostMapping("/{id}/cancel")
    public PurchaseOrderResponse cancel(@PathVariable String id, @RequestBody(required = false) DecisionRequest body) {
        return service.cancel(id, body);
    }

    @PostMapping("/{id}/complete")
    public PurchaseOrderResponse complete(@PathVariable String id) {
        return service.complete(id);
    }

    // ------------------------------------------------------------------ Observability for demos

    @GetMapping("/system/circuit-breaker")
    public Map<String, Object> circuitBreaker() {
        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("budgetService");
        CircuitBreaker.Metrics m = cb.getMetrics();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("name", cb.getName());
        result.put("state", cb.getState().name());
        result.put("failureRate", m.getFailureRate());
        result.put("bufferedCalls", m.getNumberOfBufferedCalls());
        result.put("failedCalls", m.getNumberOfFailedCalls());
        result.put("successfulCalls", m.getNumberOfSuccessfulCalls());
        result.put("notPermittedCalls", m.getNumberOfNotPermittedCalls());
        var cfg = cb.getCircuitBreakerConfig();
        result.put("config", Map.of(
                "slidingWindowSize", cfg.getSlidingWindowSize(),
                "minimumNumberOfCalls", cfg.getMinimumNumberOfCalls(),
                "failureRateThreshold", cfg.getFailureRateThreshold(),
                "permittedCallsInHalfOpenState", cfg.getPermittedNumberOfCallsInHalfOpenState()));
        return result;
    }

    @GetMapping("/system/outbox")
    public Map<String, Object> outbox() {
        return service.outboxStatus();
    }
}
