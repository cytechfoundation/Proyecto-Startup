import { useEffect, useState } from "react";
import { AlertCircle, Building2, CheckCircle2, Database, FileText, Loader2, Newspaper, Server, Sparkles } from "lucide-react";
import { api } from "../services/api.js";

/**
 * Base de conocimiento del RAG (solo admin): lista + inyección en caliente.
 *
 * Mismo acabado que la Matriz RBAC: cabecera con chip de resumen, formulario
 * destacado, chips de origen con color propio y estados de carga/vacío.
 */

// Icono y color por origen (source) del documento.
const FUENTE_STYLE = {
  corporate: { icon: Building2, chip: "text-violet-300 bg-violet-500/15 ring-1 ring-violet-400/30" },
  infra: { icon: Server, chip: "text-sky-300 bg-sky-500/15 ring-1 ring-sky-400/30" },
  news_update: { icon: Newspaper, chip: "text-amber-300 bg-amber-500/15 ring-1 ring-amber-400/30" },
};
const estiloFuente = (s) => FUENTE_STYLE[s] || { icon: FileText, chip: "text-[var(--t-muted)] bg-white/5 ring-1 ring-white/10" };

export default function KnowledgePanel({ token, onError }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState("");
  const [msgTipo, setMsgTipo] = useState("ok"); // ok | error
  const [indexando, setIndexando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api.knowledge(token));
    } catch (e) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [token]);

  const add = async (e) => {
    e.preventDefault();
    setMsg("");
    setIndexando(true);
    try {
      await api.addKnowledge(token, { title, content, source: "news_update" });
      setTitle("");
      setContent("");
      setMsgTipo("ok");
      setMsg("Documento indexado en el RAG. Ya responde el asistente.");
      await load();
    } catch (err) {
      setMsgTipo("error");
      setMsg(err.message);
    } finally {
      setIndexando(false);
    }
  };

  const input = "w-full rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm text-[var(--t-text)] ring-1 ring-[var(--t-border)] transition placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-[var(--t-accent)]";

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5">
      {/* ------------------------------ cabecera ------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Base de conocimiento (RAG)</h2>
          <p className="mt-1 text-sm text-[var(--t-muted)]">
            Inyección en caliente: lo que agregues responde el asistente de inmediato.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--t-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--t-accent)] ring-1 ring-[var(--t-accent)]/30">
          <Database className="h-3.5 w-3.5" />
          <span className="font-mono">{rows.length}</span> documentos
        </span>
      </div>

      {/* ------------------------------ formulario ------------------------------ */}
      <form onSubmit={add} className="mt-4 grid gap-2 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5 md:grid-cols-[1fr_2fr_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título o noticia"
               className={input} required minLength={3} />
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Contenido (mín. 10 caracteres)"
               className={input} required minLength={10} />
        <button disabled={indexando}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-60">
          {indexando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {indexando ? "Indexando…" : "Indexar"}
        </button>
      </form>

      {msg && (
        <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${msgTipo === "ok" ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30" : "bg-red-500/15 text-red-300 ring-1 ring-red-400/30"}`}>
          {msgTipo === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {msg}
        </p>
      )}

      {/* ------------------------------ documentos ------------------------------ */}
      {loading && rows.length === 0 ? (
        <div className="mt-4 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : (
        <ul className={`mt-4 space-y-2 text-sm transition-opacity ${loading ? "opacity-60" : ""}`}>
          {rows.map((r) => {
            const st = estiloFuente(r.source);
            const Icon = st.icon;
            return (
              <li key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5 transition hover:bg-white/[0.05]">
                <span className="flex min-w-0 items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-[var(--t-muted)]" />
                  <span className="truncate font-medium text-[var(--t-text)]" title={r.content}>{r.title}</span>
                </span>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.chip}`}>
                  <Icon className="h-3 w-3" />
                  {r.source} · {new Date(r.created_at).toLocaleDateString()}
                </span>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="py-8 text-center">
              <Database className="mx-auto h-6 w-6 text-[var(--t-muted)]" />
              <p className="mt-2 text-sm text-[var(--t-muted)]">Aún no hay documentos indexados.</p>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
