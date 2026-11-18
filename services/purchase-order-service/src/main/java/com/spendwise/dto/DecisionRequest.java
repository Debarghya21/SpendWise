package com.spendwise.dto;

public record DecisionRequest(String approverId, String comment) {
    public String approverOrDefault() {
        return approverId == null || approverId.isBlank() ? "procurement.manager" : approverId;
    }
}
