"""Bus de eventos: degradación a log sin broker."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import config as _cfg
from app.services import events


def test_sin_broker_degrada_a_log():
    snap = _cfg.settings.kafka_brokers
    _cfg.settings.kafka_brokers = ""
    try:
        assert events.publish("cytech.test", {"a": 1}) == "log"
    finally:
        _cfg.settings.kafka_brokers = snap


def test_broker_caido_no_rompe():
    snap = _cfg.settings.kafka_brokers
    _cfg.settings.kafka_brokers = "localhost:9"  # puerto cerrado
    try:
        assert events.publish("cytech.test", {"a": 1}) == "log"
    finally:
        _cfg.settings.kafka_brokers = snap
