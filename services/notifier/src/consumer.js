import { Kafka, logLevel } from "kafkajs";
import { config, TOPICS } from "./config.js";
import { sendMail, templates } from "./mailer.js";

const kafka = new Kafka({ clientId: "cytech-notifier", brokers: config.brokers, logLevel: logLevel.WARN });
const consumer = kafka.consumer({ groupId: config.group });

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";
const WA_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

async function askAgent(text, sessionId, channel = "whatsapp") {
  const r = await fetch(`${BACKEND}/api/v1/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text, session_id: sessionId, channel }),
  });
  const data = await r.json();
  return data.reply || "Gracias por escribir a Cytech. Te contactaremos pronto.";
}

async function sendWhatsapp(to, text) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text.slice(0, 4000) } }),
  });
  if (!r.ok) throw new Error(`WhatsApp ${r.status}`);
  console.log(`[whatsapp] respondido a ${to}`);
}

async function handle(topic, payload) {
  switch (topic) {
    case "cytech.donations.created": {
      const t = templates.donation(payload);
      await sendMail(payload.email, t.subject, t.text);
      break;
    }
    case "cytech.subscriptions.created": {
      const t = templates.subscription(payload);
      await sendMail(payload.email, t.subject, t.text);
      break;
    }
    case "cytech.users.registered": {
      const t = templates.welcome(payload);
      await sendMail(payload.email, t.subject, t.text);
      break;
    }
    case "cytech.webhooks.received":
      console.log(`[webhook] ${payload.provider} verified=${payload.verified} event=${payload.event_type || payload.event_id}`);
      break;
    case "cytech.whatsapp.incoming": {
      console.log(`[WhatsApp RAG]: Procesando mensaje de ${payload.from}: "${payload.text}"`);
      try {
        // Sesión por número: el agente recuerda el flujo (ej. pidió el correo
        // en el turno anterior) aunque el usuario responda en otro mensaje.
        const sessionId = `wa:${payload.from}`;
        const answer = await askAgent(payload.text, sessionId, "whatsapp");
        await sendWhatsapp(payload.from, answer);
        console.log(`[WhatsApp RAG]: Respuesta enviada exitosamente a ${payload.from}`);
      } catch (err) {
        console.error(`[❌ Error RAG/WhatsApp]: ${err.message}`);
        await sendWhatsapp(payload.from, "Lo siento, estoy teniendo problemas para procesar tu solicitud. Por favor, intenta de nuevo en unos minutos.");
      }
      break;
    }
    default:
      console.log(`[skip] ${topic}`);
  }
}

async function main() {
  await consumer.connect();
  await consumer.subscribe({ topics: TOPICS, fromBeginning: false });
  console.log(`[notifier] escuchando ${TOPICS.join(", ")} en ${config.brokers}`);
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        await handle(topic, JSON.parse(message.value.toString()));
      } catch (e) {
        console.error(`[error] ${topic}:`, e.message);
      }
    },
  });
}

main().catch((e) => {
  console.error("[fatal] Kafka no disponible:", e.message);
  process.exitCode = 1;
});
