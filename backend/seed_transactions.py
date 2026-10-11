"""Seed de transacciones demo (facturas, pagos y webhooks) para los usuarios del seed."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import select

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.transaction import Transaction
from app.models.user import User

Base.metadata.create_all(bind=engine)
db = SessionLocal()

users = {u.email: u for u in db.scalars(select(User)).all()}
SAMPLES = [  # montos en centavos COP
    ("demo.retail@gmail.com", "dian", "invoice", 125000000, "accepted", "FV-1042"),
    ("demo.retail@gmail.com", "dian", "invoice", 86000000, "accepted", "FV-1041"),
    ("demo.retail@gmail.com", "paypal", "payment", 125000000, "conciliated", "PAY-881"),
    ("operador@gmail.com", "pos", "payment", 43000000, "conciliated", "POS-2091"),
    ("admin@cytech.com", "dian", "invoice", 230000000, "accepted", "FV-2001"),
    (None, "paypal", "webhook", 2500000, "verified", "WH-9F31"),
]

n = 0
for email, provider, kind, amount, status_, ext in SAMPLES:
    exists = db.scalar(
        select(Transaction).where(Transaction.external_id == ext, Transaction.provider == provider)
    )
    if exists:
        continue
    db.add(Transaction(
        user_id=users[email].id if email and email in users else None,
        provider=provider, kind=kind, amount=amount, currency="COP",
        status=status_, external_id=ext, payload="{}",
    ))
    n += 1
db.commit()
print("TX SEEDED", n)
db.close()
