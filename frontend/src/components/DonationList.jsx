import { useCallback, useEffect, useState } from "react";
import { Coins, GraduationCap, HandCoins, HeartHandshake, Laptop, Users } from "lucide-react";
import { api } from "../services/api.js";
import { FOUNDATION } from "../data/foundation.js";
import Pagination from "./Pagination.jsx";

/**
 * Donaciones recibidas (solo admin): lista paginada de aportes registrados.
 *
 * Mismo acabado que la Matriz RBAC: cabecera con chips de resumen, tabla con
 * cabecera sticky, causa con icono y color propio, y estados de carga/vacío.
 */

// Icono y color por causa (ids validados en el backend: becas | equipos | talleres).
const CAUSA_STYLE = {
  becas: { icon: GraduationCap, chip: "text-violet-300 bg-violet-500/15 ring-1 ring-violet-400/30" },
  equipos: { icon: Laptop, chip: "text-sky-300 bg-sky-500/15 ring-1 ring-sky-400/30" },
  talleres: { icon: Users, chip: "text-amber-300 bg-amber-500/15 ring-1 ring-amber-400/30" },
};
const estiloCausa = (id) => CAUSA_STYLE[id] || { icon: HeartHandshake, chip: "text-[var(--t-muted)] bg-white/5 ring-1 ring-white/10" };
const etiquetaCausa = (id) => FOUNDATION.causes.find((c) => c.id === id)?.label ?? id;

/** Chip de causa con icono y color propio. */
function CausaChip({ id }) {
  const st = estiloCausa(id);
  const Icon = st.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${st.chip}`}>
      <Icon className="h-3.5 w-3.5" /> {etiquetaCausa(id)}
    </span>
  );
}

export default function DonationList({ token, onError }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.donations(token, { page, page_size: pageSize });
      const items = Array.isArray(data) ? data : data.items;
      setRows(items);
      setTotal(Array.isArray(data) ? items.length : data.total);
      setPages(Array.isArray(data) ? 1 : data.pages);
      if (!Array.isArray(data) && data.page !== page) setPage(data.page);
    } catch (e) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, page, pageSize, onError]);

  useEffect(() => { load(); }, [load]);

  const sum = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5">
      {/* ------------------------------ cabecera ------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Donaciones recibidas</h2>
          <p className="mt-1 text-sm text-[var(--t-muted)]">
            Cada aporte queda guardado en la base de datos con su causa, monto y fecha.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--t-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--t-accent)] ring-1 ring-[var(--t-accent)]/30">
            <HandCoins className="h-3.5 w-3.5" />
            <span className="font-mono">{total}</span> aportes
          </span>
          <span title="Suma de la página actual"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/30">
            <Coins className="h-3.5 w-3.5" />
            <span className="font-mono">$ {sum.toLocaleString("es-CO")}</span> en página
          </span>
        </div>
      </div>

      {/* ------------------------------ tabla ------------------------------ */}
      <div className="mt-4 overflow-x-auto">
        {loading && rows.length === 0 ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <HeartHandshake className="mx-auto h-6 w-6 text-[var(--t-muted)]" />
            <p className="mt-2 text-sm text-[var(--t-muted)]">Aún no hay aportes registrados. ¡El primero puede ser el tuyo!</p>
          </div>
        ) : (
          <table className={`w-full text-sm transition-opacity ${loading ? "opacity-60" : ""}`}>
            <thead>
              <tr className="text-left">
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Donante</th>
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Correo</th>
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Causa</th>
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-right text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Monto</th>
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 text-right text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--t-border)]/60 transition-colors hover:bg-white/[0.03]">
                  <td className="py-2.5 pr-3 font-semibold text-[var(--t-text)]">{r.name}</td>
                  <td className="max-w-[15rem] truncate pr-3 text-[var(--t-text2)]" title={r.email}>{r.email}</td>
                  <td className="pr-3"><CausaChip id={r.cause} /></td>
                  <td className="pr-3 text-right font-bold tabular-nums text-amber-300">$ {r.amount.toLocaleString("es-CO")}</td>
                  <td className="text-right text-xs tabular-nums text-[var(--t-muted)]">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} pages={pages} total={total} pageSize={pageSize}
                  onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} label="aportes" />
    </section>
  );
}
