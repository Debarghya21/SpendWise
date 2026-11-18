"""RabbitMQ consumer running in a background thread.

Reliability features:
  * durable queues + persistent messages
  * manual acknowledgements
  * retry with exponential backoff (per-message TTL on a retry queue that dead-letters back)
  * dead-letter queue after MAX_RETRIES
  * idempotent processing (eventId stored in analytics_events)
"""
import json
import logging
import threading
import time

import pika

from app import config
from app.db import get_db
from app.services.analytics_service import process_event

log = logging.getLogger("analytics.consumer")


class PurchaseOrderConsumer:
    def __init__(self) -> None:
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._connection: pika.BlockingConnection | None = None
        self.state = {"connected": False, "consumed": 0, "duplicates": 0, "retried": 0, "deadLettered": 0, "lastError": None}

    # ------------------------------------------------------------------ lifecycle
    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name="po-consumer", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        conn = self._connection
        if conn and conn.is_open:
            try:
                conn.add_callback_threadsafe(conn.close)
            except Exception:  # noqa: BLE001
                pass

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                params = pika.URLParameters(config.RABBITMQ_URL)
                params.heartbeat = 30
                self._connection = pika.BlockingConnection(params)
                channel = self._connection.channel()
                self._declare_topology(channel)
                channel.basic_qos(prefetch_count=10)
                channel.basic_consume(queue=config.QUEUE, on_message_callback=self._on_message, auto_ack=False)
                self.state["connected"] = True
                log.info("Consuming from %s", config.QUEUE)
                channel.start_consuming()
            except Exception as exc:  # noqa: BLE001
                self.state["connected"] = False
                self.state["lastError"] = str(exc)
                if not self._stop.is_set():
                    log.warning("RabbitMQ consumer error (%s); reconnecting in 5s", exc)
                    time.sleep(5)

    @staticmethod
    def _declare_topology(ch) -> None:
        ch.exchange_declare(config.EXCHANGE, exchange_type="topic", durable=True)
        ch.exchange_declare(config.DLX, exchange_type="topic", durable=True)
        ch.queue_declare(config.QUEUE, durable=True, arguments={
            "x-dead-letter-exchange": config.DLX,
            "x-dead-letter-routing-key": config.DLQ,
        })
        for key in config.BINDINGS:
            ch.queue_bind(config.QUEUE, config.EXCHANGE, routing_key=key)
        ch.queue_declare(config.DLQ, durable=True)
        ch.queue_bind(config.DLQ, config.DLX, routing_key=config.DLQ)
        ch.queue_declare(config.RETRY_QUEUE, durable=True, arguments={
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": config.QUEUE,
        })

    # ------------------------------------------------------------------ message handling
    def _on_message(self, ch, method, props, body) -> None:
        headers = dict(props.headers or {})
        retries = int(headers.get("x-retry-count", 0))
        try:
            event = json.loads(body)
        except json.JSONDecodeError:
            self.state["deadLettered"] += 1
            ch.basic_nack(method.delivery_tag, requeue=False)
            return

        try:
            result = process_event(get_db(), event)
            if result == "duplicate":
                self.state["duplicates"] += 1
            self.state["consumed"] += 1
            log.info("%s %s -> %s", event.get("eventType"), event.get("purchaseOrderId"), result)
            ch.basic_ack(method.delivery_tag)
        except Exception as exc:  # noqa: BLE001
            self.state["lastError"] = str(exc)
            if retries >= config.MAX_RETRIES:
                self.state["deadLettered"] += 1
                log.error("Dead-lettering %s after %d retries: %s", event.get("eventId"), retries, exc)
                ch.basic_nack(method.delivery_tag, requeue=False)
                return
            delay = config.RETRY_BASE_MS * (2 ** retries)
            headers["x-retry-count"] = retries + 1
            ch.basic_publish(
                exchange="",
                routing_key=config.RETRY_QUEUE,
                body=body,
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    content_type="application/json",
                    message_id=props.message_id,
                    type=props.type,
                    headers=headers,
                    expiration=str(delay),
                ),
            )
            self.state["retried"] += 1
            ch.basic_ack(method.delivery_tag)


consumer = PurchaseOrderConsumer()
