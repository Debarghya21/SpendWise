from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PurchaseOrderEvent(BaseModel):
    """Contract of events published by the Purchase Order Service."""

    model_config = ConfigDict(extra="allow")

    eventId: str
    eventType: str
    occurredAt: datetime
    purchaseOrderId: str
    supplierId: Optional[str] = None
    supplierName: Optional[str] = None
    category: Optional[str] = None
    department: Optional[str] = None
    totalAmount: float = 0
    status: Optional[str] = None
    reason: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[datetime] = None


class Overview(BaseModel):
    totalSpend: float
    totalPurchaseOrders: int
    approvedPurchaseOrders: int
    pendingPurchaseOrders: int
    rejectedPurchaseOrders: int
    cancelledPurchaseOrders: int
    activeSuppliers: int
    averageOrderValue: float
    topDepartment: Optional[str]
    eventsProcessed: int
    lastUpdated: datetime
