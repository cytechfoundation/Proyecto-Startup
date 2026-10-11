import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZES = [10, 20, 50];

/** Controles de paginación compartidos (Directorio, Donaciones). */
export default function Pagination({ page, pages, total, pageSize, onPage, onPageSize, label = "registros" }) {
  const input = "rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-[var(--t-accent)]";
  const from = (page - 1) * pageSize + (total ? 1 : 0);
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--t-muted)]">
      <span>{total === 0 ? "Sin resultados" : `Mostrando ${from}–${to} de ${total} ${label}`}</span>
      <div className="flex items-center gap-2">
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className={input} title="Por página">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / pág</option>)}
        </select>
        <button onClick={() => onPage(Math.max(page - 1, 1))} disabled={page <= 1}
                className="rounded-lg bg-[var(--t-surface2)] p-2 ring-1 ring-[var(--t-border)] disabled:opacity-40 hover:ring-[var(--t-accent)]" aria-label="Anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span>Página {page} de {pages}</span>
        <button onClick={() => onPage(Math.min(page + 1, pages))} disabled={page >= pages}
                className="rounded-lg bg-[var(--t-surface2)] p-2 ring-1 ring-[var(--t-border)] disabled:opacity-40 hover:ring-[var(--t-accent)]" aria-label="Siguiente">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
