import { useState } from "react";
import { Send, X } from "lucide-react";
import { api } from "../services/api.js";
import ConsultantAvatar from "./ConsultantAvatar.jsx";

/** Asistente Cytech: chat flotante con RAG (consultas) y suscripción. */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([
    { from: "bot", text: "Hola, soy el asistente de Cytech. Pregunta por servicios, DIAN o la demo. Para suscribirte escribe: suscribir: tu@correo.com" },
  ]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { from: "you", text }]);
    setBusy(true);
    try {
      const r = await api.agentChat(text);
      setMsgs((m) => [...m, { from: "bot", text: r.reply }]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: "No pude responder ahora. Escríbenos a cytechfoundation@gmail.com." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[90]">
      {open && (
        <div className="mb-3 flex h-96 w-80 flex-col overflow-hidden rounded-2xl border border-[var(--l-border)] bg-[var(--l-bg)] shadow-2xl">
          <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 px-4 py-3">
            <ConsultantAvatar className="h-7 w-7" />
            <div>
              <p className="text-sm font-bold text-[var(--l-text)]">Asistente Cytech</p>
              <p className="text-[11px] text-[var(--l-muted)]">Consultor en línea</p>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto text-[var(--l-muted)] hover:text-[var(--l-text)]" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {msgs.map((m, i) => (
              <p key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${m.from === "bot" ? "bg-[var(--l-surface2)] text-[var(--l-text)]" : "ml-auto bg-cyan-600 text-white"}`}>
                {m.text}
              </p>
            ))}
            {busy && <p className="text-xs text-[var(--l-muted)]">Escribiendo…</p>}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-[var(--l-border)] p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta algo…"
              className="min-w-0 flex-1 rounded-lg bg-[var(--l-surface2)] px-3 py-2 text-sm text-[var(--l-text)] focus:outline-none focus:ring-1 focus:ring-[var(--l-accent)]"
            />
            <button className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 p-2 text-[var(--l-text)]" aria-label="Enviar">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir asistente"
        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-lg shadow-cyan-500/30 ring-2 ring-white/20 transition-all hover:scale-105"
      >
        {open ? (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
            <X className="h-5 w-5" />
          </span>
        ) : (
          <ConsultantAvatar className="h-full w-full" />
        )}
      </button>
    </div>
  );
}
