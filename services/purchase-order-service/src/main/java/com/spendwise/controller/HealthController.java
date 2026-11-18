package com.spendwise.controller;

import com.spendwise.service.PurchaseOrderService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class HealthController {

    private final PurchaseOrderService service;

    public HealthController(PurchaseOrderService service) {
        this.service = service;
    }

    /** Lightweight liveness endpoint (K8s probes use /actuator/health/liveness|readiness). */
    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "purchase-order-service",
                "budgetCircuitBreaker", service.circuitBreakerState(),
                "timestamp", Instant.now().toString());
    }
}
