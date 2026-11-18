import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://analytics_user:analytics_pass@localhost:27017/?authSource=admin")
MONGO_DB = os.getenv("MONGO_DB", "analytics_db")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://spendwise:spendwise_pass@localhost:5672/%2F")
CONSUMER_ENABLED = os.getenv("CONSUMER_ENABLED", "true").lower() == "true"

EXCHANGE = "spendwise.events"
DLX = "spendwise.dlx"
QUEUE = "analytics.purchase-order-events"
RETRY_QUEUE = f"{QUEUE}.retry"
DLQ = f"{QUEUE}.dlq"
BINDINGS = ["purchase-order.*", "budget.threshold-alert"]

MAX_RETRIES = int(os.getenv("MESSAGE_MAX_RETRIES", "3"))
RETRY_BASE_MS = int(os.getenv("MESSAGE_RETRY_BASE_MS", "2000"))
