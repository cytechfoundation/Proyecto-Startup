import { useState } from "react";
import { RotateCcw, Send, X } from "lucide-react";
import { api } from "../services/api.js";
import ConsultantAvatar from "./ConsultantAvatar.jsx";

const SESSION_KEY = "cytech.chat.session";
/** Chips iniciales: cada uno dispara un flujo del agente. */
const IDLE_SUGGESTIONS = ["Suscribirme", "Contactar asesor", "Calendario tributario"];

/** Id de sesión persistido: el backend (o WhatsApp) lo usa para recordar el diálogo. */
function newSessionId() {
  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* modo privado: la sesión dura solo en memoria */
  }
  return id;
}

function loadSessionId() {
  try {
    return localStorage.getItem(SESSION_KEY) || newSessionId();
  } catch {
    return newSessionId();
  }
}

/** Asistente Cytech: chat flotante multiturno (RAG + slot-filling por sesión). */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Una sesión por pestaña/usuario: el backend recuerda el flujo entre turnos.
  const [sessionId, setSessionId] = useState(loadSessionId);

  const [suggestions, setSuggestions] = useState(IDLE_SUGGESTIONS);
  const [msgs, setMsgs] = useState([
    { from: "bot", text: "Hola, soy el asistente de Cytech. Pregúntame por servicios, DIAN, facturación o la demo. También puedo suscribirte al boletín o pasar tu caso a un asesor." },
  ]);

  const nuevaSesion = () => {
    setSessionId(newSessionId());
    setSuggestions([]);
    setMsgs([{ from: "bot", text: "Empecemos de nuevo 👋 ¿En qué te ayudo hoy?" }]);
  };

  const send = async (e, quickText) => {
    e?.preventDefault();
    const text = (quickText ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { from: "you", text }]);
    setBusy(true);
    try {
      const r = await api.agentChat(text, sessionId);
      setMsgs((m) => [...m, { from: "bot", text: r.reply }]);
      setSuggestions(r.suggestions || []);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: "No pude responder ahora. Escríbenos a cytechfoundation@gmail.com." }]);
      setSuggestions([]);
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
            <button onClick={nuevaSesion} title="Nueva conversación" aria-label="Nueva conversación" className="ml-auto text-[var(--l-muted)] transition-all hover:rotate-[-180deg] hover:text-[var(--l-text)]">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button onClick={() => setOpen(false)} className="text-[var(--l-muted)] hover:text-[var(--l-text)]" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {msgs.map((m, i) => (
              <p key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${m.from === "bot" ? "bg-[var(--l-surface2)] text-[var(--l-text)]" : "ml-auto bg-cyan-600 text-white"}`}>
                {m.text}
              </p>
            ))}
            {busy && <p className="text-xs text-[var(--l-muted)]">Escribiendo…</p>}
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-[var(--l-border)] px-3 py-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={(e) => send(e, s)}
                  className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-[var(--l-text)] transition-colors hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
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
