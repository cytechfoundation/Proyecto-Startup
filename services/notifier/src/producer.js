import { Kafka, logLevel } from "kafkajs";

/** Productor reutilizable (equivale al queueEmail del ejemplo Express). */
let producer = null;

function brokers() {
  return (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
}

async function getProducer() {
  if (!producer) {
    producer = new Kafka({ clientId: "cytech-api", brokers: brokers(), logLevel: logLevel.WARN }).producer();
    await producer.connect();
  }
  return producer;
}

export async function queueMessage(topic, payload) {
  const p = await getProducer();
  await p.send({ topic, messages: [{ value: JSON.stringify(payload) }] });
  console.log(`[queue] ${topic}`);
}

export async function queueEmail(kind, to, payload = {}) {
  return queueMessage("cytech.mail", { kind, to, ...payload });
}
