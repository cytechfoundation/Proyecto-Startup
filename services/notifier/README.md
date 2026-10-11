# Cytech Notifier — worker de mensajería asíncrona (kafkajs + nodemailer)

Consume eventos del backend y envía emails transaccionales.

## Tópicos

| Tópico | Emisor backend | Acción |
|---|---|---|
| `cytech.donations.created` | `POST /donations` | email de agradecimiento |
| `cytech.subscriptions.created` | agente `/subscribe` | confirmación |
| `cytech.users.registered` | auto-registro federado | bienvenida |
| `cytech.webhooks.received` | `POST /webhooks/*` | log operativo |

## Uso local (sin Kafka)

```bash
cp .env.example .env
npm install
npm start   # reintenta conexión; sin broker termina con [fatal]
```

Sin `SMTP_HOST` los correos solo se registran en log (jsonTransport).

## Con Kafka (Docker)

```bash
# en la raíz del proyecto:
docker compose --profile messaging up kafka notifier
# backend con broker:
# KAFKA_BROKERS=localhost:9092 en backend/.env
```
