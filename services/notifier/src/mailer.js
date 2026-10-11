import nodemailer from "nodemailer";
import { config } from "./config.js";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (!config.smtp.host) {
      transporter = nodemailer.createTransport({ jsonTransport: true }); // dev: solo log
    } else {
      transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      });
    }
  }
  return transporter;
}

export async function sendMail(to, subject, text) {
  const info = await getTransporter().sendMail({ from: config.smtp.from, to, subject, text });
  console.log(`[mail] to=${to} subject="${subject}" id=${info.messageId || "log"}`);
  return info;
}

export const templates = {
  donation: (d) => ({
    subject: `¡Gracias por tu donación #${d.id}! — Cytech Foundation`,
    text: `Hola ${d.name}, registramos tu aporte de $${Number(d.amount).toLocaleString("es-CO")} para ${d.cause}. ¡Gracias por tu generosidad!`,
  }),
  subscription: (s) => ({
    subject: "¡Suscripción confirmada! — Cytech",
    text: "Quedaste suscrito a las novedades de Cytech. Te avisaremos de noticias y demos.",
  }),
  welcome: (u) => ({
    subject: "Bienvenido a Cytech",
    text: `Hola ${u.name}, tu cuenta (${u.email}) quedó creada con rol ${u.role}. Ingresa en la demo controlada.`,
  }),
};
