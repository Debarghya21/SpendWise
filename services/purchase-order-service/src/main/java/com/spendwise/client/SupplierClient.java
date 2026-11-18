package com.spendwise.client;

import com.spendwise.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Synchronous REST client: PO Service -> Supplier Service (supplier eligibility is needed immediately). */
@Component
public class SupplierClient {

    private static final Logger log = LoggerFactory.getLogger(SupplierClient.class);
    private final RestClient restClient;

    public SupplierClient(@Value("${spendwise.services.supplier-url}") String baseUrl,
                          SimpleClientHttpRequestFactory requestFactory) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
    }

    public SupplierValidation validate(String supplierId) {
        try {
            SupplierValidation result = restClient.get()
                    .uri("/api/suppliers/{id}/validate", supplierId)
                    .retrieve()
                    .body(SupplierValidation.class);
            if (result == null) throw new ApiException(HttpStatus.BAD_GATEWAY, "Empty response from Supplier Service");
            return result;
        } catch (HttpClientErrorException.NotFound e) {
            return new SupplierValidation(supplierId, null, null, "NOT_FOUND", false, "Supplier not found");
        } catch (RestClientException e) {
            log.warn("Supplier Service call failed: {}", e.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Supplier validation is temporarily unavailable. Please retry.");
        }
    }
}
