from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from app import config

_client: MongoClient | None = None


def get_db() -> Database:
    global _client
    if _client is None:
        _client = MongoClient(config.MONGO_URL, serverSelectionTimeoutMS=5000)
    return _client[config.MONGO_DB]


def ensure_indexes(db: Database) -> None:
    db.spend_transactions.create_index([("status", ASCENDING)])
    db.spend_transactions.create_index([("department", ASCENDING)])
    db.spend_transactions.create_index([("month", ASCENDING)])
    db.spend_transactions.create_index([("createdAt", DESCENDING)])
    db.analytics_events.create_index([("processedAt", DESCENDING)])
    db.analytics_events.create_index([("createdAt", DESCENDING)])
    db.budget_alerts.create_index([("occurredAt", DESCENDING)])
    db.budget_alerts.create_index([("createdAt", DESCENDING)])
