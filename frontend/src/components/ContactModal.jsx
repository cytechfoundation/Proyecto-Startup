import { useState } from "react";
import { X, Send } from "lucide-react";

const TO = "cytechfoundation@gmail.com";

/** Formulario de contacto: compone el correo y lo abre en Gmail o app local. */
export default function ContactModal({ open, onClose }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");

  if (!open) return null;

  const subject = `Contacto desde Cytech Web — ${name || "visitante"}`;
  const body = `${message}\n\n— ${name}\n${from}`;
  const gmail = `https://mail.google.com/mail/?view=cm&to=${TO}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const mailto = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const valid = name.trim() && message.trim();

  const input = "w-full rounded-lg bg-[var(--l-surface2)] px-3 py-2.5 text-sm text-[var(--l-text)] ring-1 ring-[var(--l-border)] focus:outline-none focus:ring-[var(--l-accent)]";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="relative w-full max-w-md rounded-2xl border border-[var(--l-border)] bg-[var(--l-bg)] p-8 shadow-2xl">
        <button onClick={onClose} aria-label="Cerrar"
                className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--l-muted)] hover:bg-[var(--l-surface2)] hover:text-[var(--l-text)]">
          <X className="h-5 w-5" />
        </button>
        <h3 className="text-xl font-bold">Escríbeme un correo</h3>
        <p className="mt-1 text-sm text-[var(--l-muted)]">Para: {TO}</p>

        <div className="mt-5 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className={input} />
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Tu correo (opcional)" className={input} />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Cuéntame de tu proyecto…"
                    rows={4} className={`${input} resize-none`} />
        </div>

        <div className="mt-5 space-y-2">
          <button
            disabled={!valid}
            onClick={() => { window.open(gmail, "_blank"); onClose(); }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] disabled:opacity-40"
          >
            <Send className="h-4 w-4" /> Enviar con Gmail
          </button>
          <a
            href={valid ? mailto : undefined}
            onClick={(e) => { if (!valid) e.preventDefault(); else onClose(); }}
            className={`block rounded-lg border border-[var(--l-border)] px-4 py-3 text-center text-sm font-semibold transition-all hover:border-[var(--l-accent)] ${valid ? "text-[var(--l-text)]" : "cursor-not-allowed opacity-40"}`}
          >
            Abrir en mi app de correo
          </a>
        </div>
      </div>
    </div>
  );
}
