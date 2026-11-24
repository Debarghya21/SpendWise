package com.spendwise.client;

import com.spendwise.grpc.supplier.SupplierServiceGrpc;
import com.spendwise.grpc.supplier.ValidateSupplierRequest;
import com.spendwise.grpc.supplier.SupplierValidationResponse;
import com.spendwise.exception.ApiException;
import io.grpc.ManagedChannel;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Synchronous gRPC client: PO Service -> Supplier Service.
 * Replaces the former REST-based SupplierClient.
 */
@Component
public class SupplierClient {

    private static final Logger log = LoggerFactory.getLogger(SupplierClient.class);
    private final SupplierServiceGrpc.SupplierServiceBlockingStub stub;

    public SupplierClient(@Qualifier("supplierChannel") ManagedChannel channel) {
        this.stub = SupplierServiceGrpc.newBlockingStub(channel);
    }

    public SupplierValidation validate(String supplierId) {
        try {
            ValidateSupplierRequest request = ValidateSupplierRequest.newBuilder()
                    .setSupplierId(supplierId)
                    .build();

            SupplierValidationResponse resp = stub.validateSupplier(request);

            if ("NOT_FOUND".equals(resp.getStatus())) {
                return new SupplierValidation(supplierId, null, null, "NOT_FOUND", false, "Supplier not found");
            }
            return new SupplierValidation(
                    resp.getSupplierId(),
                    resp.getName(),
                    resp.getCategory(),
                    resp.getStatus(),
                    resp.getEligible(),
                    resp.getReason()
            );
        } catch (StatusRuntimeException e) {
            log.warn("Supplier Service gRPC call failed: {} - {}", e.getStatus().getCode(), e.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Supplier validation is temporarily unavailable. Please retry.");
        }
    }
}
