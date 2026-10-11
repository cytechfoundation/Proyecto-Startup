import { useEffect, useState } from "react";
import { api } from "../services/api.js";

/** Base de conocimiento del RAG (solo admin): lista + inyección en caliente. */
export default function KnowledgePanel({ token, onError }) {
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      setRows(await api.knowledge(token));
    } catch (e) {
      onError(e.message);
    }
  };
  useEffect(() => { load(); }, [token]);

  const add = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.addKnowledge(token, { title, content, source: "news_update" });
      setTitle("");
      setContent("");
      setMsg("Documento indexado en el RAG.");
      await load();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const input = "w-full rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-[var(--t-accent)]";

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5">
      <h2 className="text-xl font-bold">Base de conocimiento (RAG)</h2>
      <p className="mt-1 text-sm text-[var(--t-muted)]">Inyección en caliente: lo que agregues responde el asistente de inmediato.</p>
      <form onSubmit={add} className="mt-4 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título o noticia" className={input} required minLength={3} />
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Contenido (mín. 10 caracteres)" className={input} required minLength={10} />
        <button className="rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-4 py-2 text-sm font-semibold">Indexar</button>
      </form>
      {msg && <p className="mt-2 text-sm text-[var(--t-accent)]">{msg}</p>}
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg bg-[var(--t-surface2)] px-3 py-2">
            <span>{r.title}</span>
            <span className="text-xs text-[var(--t-muted)]">{r.source} · {new Date(r.created_at).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
