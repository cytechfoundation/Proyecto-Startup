"""Bus de eventos: publica en Kafka si hay broker, si no solo registra (log).

Ningún flujo depende del broker: ante cualquier fallo se degrada a log.
"""
import json
import logging

from app.core.config import settings

log = logging.getLogger("cytech.events")


def publish(topic: str, payload: dict) -> str:
    """Retorna 'kafka' o 'log' según el canal usado."""
    brokers = getattr(settings, "kafka_brokers", "")
    if not brokers:
        log.info("EVENT[%s] %s", topic, json.dumps(payload, default=str)[:300])
        return "log"
    try:
        from kafka import KafkaProducer

        producer = KafkaProducer(
            bootstrap_servers=[b.strip() for b in brokers.split(",")],
            value_serializer=lambda v: json.dumps(v, default=str).encode(),
            request_timeout_ms=5000,
        )
        producer.send(topic, payload).get(timeout=5)
        producer.flush()
        producer.close()
        return "kafka"
    except Exception as e:
        log.warning("EVENT[%s] broker caído (%s), degradado a log", topic, e)
        return "log"
