package com.spendwise.client;

import com.spendwise.grpc.budget.BudgetServiceGrpc;
import com.spendwise.grpc.budget.ReserveBudgetRequest;
import com.spendwise.grpc.budget.ReserveBudgetResponse;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.grpc.ManagedChannel;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Synchronous gRPC client: PO Service -> Budget Service, protected by the
 * Resilience4j circuit breaker "budgetService".
 *
 * <ul>
 *   <li>REJECTED outcome (insufficient funds, unknown department) are business answers -> returned normally, NOT failures.</li>
 *   <li>gRPC transport errors (UNAVAILABLE, DEADLINE_EXCEEDED, etc.) are recorded as failures.</li>
 *   <li>When the breaker is OPEN, calls are short-circuited straight to the fallback.</li>
 * </ul>
 */
@Component
public class BudgetClient {

    private static final Logger log = LoggerFactory.getLogger(BudgetClient.class);
    public static final String CIRCUIT_BREAKER = "budgetService";

    private final BudgetServiceGrpc.BudgetServiceBlockingStub stub;

    public BudgetClient(@Qualifier("budgetChannel") ManagedChannel channel) {
        this.stub = BudgetServiceGrpc.newBlockingStub(channel);
    }

    @CircuitBreaker(name = CIRCUIT_BREAKER, fallbackMethod = "reserveFallback")
    public BudgetDecision reserve(String department, String poNumber, BigDecimal amount) {
        ReserveBudgetRequest request = ReserveBudgetRequest.newBuilder()
                .setDepartment(department)
                .setPoId(poNumber)
                .setAmount(amount.toPlainString())
                .build();

        ReserveBudgetResponse resp = stub.reserveBudget(request);

        return switch (resp.getOutcome()) {
            case RESERVED -> BudgetDecision.reserved(
                    resp.getReservationId(),
                    resp.getAvailableAmount().isEmpty() ? null : new BigDecimal(resp.getAvailableAmount()));
            case REJECTED -> BudgetDecision.rejected(resp.getMessage());
            default -> BudgetDecision.unavailable(resp.getMessage());
        };
    }

    @SuppressWarnings("unused")
    private BudgetDecision reserveFallback(String department, String poNumber, BigDecimal amount, Throwable t) {
        String reason;
        if (t instanceof CallNotPermittedException) {
            reason = "circuit breaker OPEN";
        } else if (t instanceof StatusRuntimeException sre) {
            reason = "gRPC " + sre.getStatus().getCode().name();
        } else {
            reason = t.getClass().getSimpleName();
        }
        log.warn("Budget reservation for {} fell back ({}): {}", poNumber, reason, t.getMessage());
        return BudgetDecision.unavailable("Budget validation is temporarily unavailable (" + reason + ").");
    }
}
