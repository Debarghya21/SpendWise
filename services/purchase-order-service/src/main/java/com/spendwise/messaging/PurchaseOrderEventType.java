package com.spendwise.messaging;

/** Event types and their RabbitMQ routing keys on the "spendwise.events" topic exchange. */
public enum PurchaseOrderEventType {
    CREATED("PurchaseOrderCreated", "purchase-order.created"),
    SUBMITTED("PurchaseOrderSubmitted", "purchase-order.submitted"),
    APPROVED("PurchaseOrderApproved", "purchase-order.approved"),
    REJECTED("PurchaseOrderRejected", "purchase-order.rejected"),
    CANCELLED("PurchaseOrderCancelled", "purchase-order.cancelled"),
    COMPLETED("PurchaseOrderCompleted", "purchase-order.completed");

    private final String eventName;
    private final String routingKey;

    PurchaseOrderEventType(String eventName, String routingKey) {
        this.eventName = eventName;
        this.routingKey = routingKey;
    }

    public String eventName() {
        return eventName;
    }

    public String routingKey() {
        return routingKey;
    }
}
