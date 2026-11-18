package com.spendwise.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Synchronous REST client: PO Service -> Budget Service, protected by the
 * Resilience4j circuit breaker "budgetService".
 *
 * <ul>
 *   <li>4xx (insufficient funds, unknown department) are business answers -> returned normally, NOT failures.</li>
 *   <li>Timeouts / connection errors / 5xx are recorded as failures.</li>
 *   <li>When the breaker is OPEN, calls are short-circuited straight to the fallback.</li>
 * </ul>
 */
@Component
public class BudgetClient {

    private static final Logger log = LoggerFactory.getLogger(BudgetClient.class);
    public static final String CIRCUIT_BREAKER = "budgetService";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public BudgetClient(@Value("${spendwise.services.budget-url}") String baseUrl,
                        SimpleClientHttpRequestFactory requestFactory,
                        ObjectMapper objectMapper) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
        this.objectMapper = objectMapper;
    }

    @CircuitBreaker(name = CIRCUIT_BREAKER, fallbackMethod = "reserveFallback")
    public BudgetDecision reserve(String department, String poNumber, BigDecimal amount) {
        try {
            JsonNode body = restClient.post()
                    .uri("/api/budgets/{department}/reservations", department)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("poId", poNumber, "amount", amount))
                    .retrieve()
                    .body(JsonNode.class);
            Long reservationId = body != null && body.hasNonNull("reservationId") ? body.get("reservationId").asLong() : null;
            BigDecimal available = body != null && body.hasNonNull("availableAmount")
                    ? body.get("availableAmount").decimalValue() : null;
            return BudgetDecision.reserved(reservationId, available);
        } catch (HttpClientErrorException e) {
            return BudgetDecision.rejected(extractMessage(e));
        }
    }

    @SuppressWarnings("unused")
    private BudgetDecision reserveFallback(String department, String poNumber, BigDecimal amount, Throwable t) {
        String reason = t instanceof CallNotPermittedException ? "circuit breaker OPEN" : t.getClass().getSimpleName();
        log.warn("Budget reservation for {} fell back ({}): {}", poNumber, reason, t.getMessage());
        return BudgetDecision.unavailable("Budget validation is temporarily unavailable (" + reason + ").");
    }

    private String extractMessage(HttpClientErrorException e) {
        try {
            JsonNode node = objectMapper.readTree(e.getResponseBodyAsString());
            if (node.hasNonNull("message")) return node.get("message").asText();
        } catch (Exception ignored) {
            // fall through
        }
        return "Budget reservation refused (" + e.getStatusCode().value() + ")";
    }
}
