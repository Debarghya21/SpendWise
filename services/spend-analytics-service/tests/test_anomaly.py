from app.services.anomaly import detect_anomalies


def tx(po, dept, amount):
    return {"purchaseOrderId": po, "department": dept, "amount": amount}


def test_no_anomalies_for_uniform_spend():
    data = [tx(f"PO-{i}", "Engineering", 10000) for i in range(5)]
    assert detect_anomalies(data) == []


def test_flags_outlier():
    data = [tx(f"PO-{i}", "Engineering", 10000) for i in range(5)] + [tx("PO-99", "Engineering", 150000)]
    result = detect_anomalies(data)
    assert len(result) == 1
    assert result[0]["purchaseOrderId"] == "PO-99"
    assert result[0]["severity"] == "HIGH"


def test_needs_minimum_samples():
    assert detect_anomalies([tx("PO-1", "HR", 10), tx("PO-2", "HR", 100000)]) == []
