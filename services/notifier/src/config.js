import "dotenv/config";

export const config = {
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  group: process.env.KAFKA_GROUP || "cytech-notifier",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Cytech <hola@cytech.com>",
  },
};

export const TOPICS = [
  "cytech.donations.created",
  "cytech.subscriptions.created",
  "cytech.users.registered",
  "cytech.webhooks.received",
  "cytech.whatsapp.incoming",
];
