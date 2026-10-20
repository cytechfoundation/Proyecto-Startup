import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Database, Inbox, Loader2 } from "lucide-react";
import { api } from "../services/api.js";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const fmtFecha = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

/**
 * Panel de eventos importados desde un PDF por la DIAN, organizados por año.
 * La BD guarda cada evento con su `year` y el `source` (archivo de origen),
 * así que aquí basta con pedir un año y pintarlo.
 */
export default function ImportedEventsPanel({ initialYear, limit, title = "Eventos importados de la DIAN" }) {
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(initialYear || null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carga la lista de años disponibles (una sola vez).
  useEffect(() => {
    let alive = true;
    api.taxYears()
      .then((data) => {
        if (!alive) return;
        setYears(data);
        setYear((prev) => prev ?? (data[0]?.year ?? new Date().getFullYear()));
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const load = useCallback((anio) => {
    if (!anio) return;
    setLoading(true);
    setError(null);
    api.taxEvents(anio)
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  const porMes = useMemo(() => {
    const mapa = new Map();
    for (const e of events) {
      const m = Number(e.event_date.split("-")[1]) - 1;
      if (!mapa.has(m)) mapa.set(m, []);
      mapa.get(m).push(e);
    }
    return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
  }, [events]);

  const visibles = useMemo(
    () => (limit ? porMes.flatMap(([, evs]) => evs).slice(0, limit) : porMes),
    [porMes, limit]
  );

  return (
    <section className="rounded-2xl bg-[var(--l-surface)] p-6 shadow-sm ring-1 ring-[var(--l-border)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[var(--dian-soft)] p-2 text-[var(--dian-strong)] ring-1 ring-[var(--dian-ring)]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[var(--l-text)]">
              {title}
              <span className="rounded-full bg-[var(--dian-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--dian-strong)] ring-1 ring-[var(--dian-ring)]">
                Base de datos
              </span>
            </h2>
            <p className="mt-0.5 text-sm text-[var(--l-muted)]">
              Guardados por año desde el PDF importado. Consulta también el
              <a href={`${api.base}/api/v1/tax-calendar/ics?year=${year ?? ""}`} className="mx-1 font-semibold text-[var(--dian-strong)] underline">.ics {year}</a>
              para suscribirte.
            </p>
          </div>
        </div>

        {/* Selector de año: cada import queda etiquetado con su año en la BD. */}
        {years.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {years.map((y) => (
              <button
                key={y.year}
                onClick={() => setYear(y.year)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold ring-1 transition-all duration-200 ease-in-out ${
                  year === y.year
                    ? "bg-[var(--dian-strong)] text-white ring-[var(--dian-strong)] shadow-md"
                    : "bg-[var(--l-surface2)] text-[var(--l-text2)] ring-[var(--l-border)] hover:ring-[var(--dian-ring)]"
                }`}
                title={`${y.events} eventos importados`}
              >
                {y.year}
                <span className={`ml-1.5 ${year === y.year ? "text-white/70" : "text-[var(--l-muted)]"}`}>{y.events}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-8 flex items-center justify-center gap-2 py-10 text-sm text-[var(--l-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando eventos del {year}…
        </div>
      )}

      {!loading && error && (
        <p className="mt-8 rounded-xl bg-red-500/10 p-4 text-sm text-red-500 ring-1 ring-red-500/30">{error}</p>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--l-border)] bg-[var(--l-surface2)] py-10 text-center">
          <Inbox className="h-8 w-8 text-[var(--l-muted)]" />
          <p className="text-sm font-semibold text-[var(--l-text2)]">Aún no hay eventos importados para {year}.</p>
          <p className="max-w-md text-xs text-[var(--l-muted)]">
            Un administrador puede cargar el PDF oficial del Calendario Tributario desde la zona privada;
            quedarán guardados por año en la base de datos.
          </p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="mt-6 space-y-6">
          {(limit ? [[null, visibles]] : visibles).map(([mes, evs]) => (
            <div key={mes ?? "todos"}>
              {!limit && (
                <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--l-muted)]">
                  <CalendarCheck2 className="h-3.5 w-3.5" />
                  {MESES[mes]}
                </h3>
              )}
              <ul className="grid gap-2 md:grid-cols-2">
                {evs.map((e) => (
                  <li
                    key={e.id}
                    className="group flex items-start gap-3 rounded-xl bg-[var(--l-surface2)] px-4 py-3 ring-1 ring-[var(--l-border)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--l-surface)] hover:shadow-md hover:ring-[var(--dian-ring)]"
                  >
                    <span className="mt-0.5 shrink-0 rounded-lg bg-[var(--dian-strong)] px-2 py-1 text-[11px] font-black leading-tight text-white">
                      {e.event_date.split("-")[2]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-snug text-[var(--l-text)]">{e.obligation}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full bg-[var(--dian-soft)] px-2 py-0.5 font-semibold text-[var(--dian-strong)] ring-1 ring-[var(--dian-ring)]">
                          {e.category || "General"}
                        </span>
                        <span className="text-[var(--l-muted)]">{fmtFecha(e.event_date)}</span>
                        {e.source && (
                          <span
                            className="max-w-[160px] truncate rounded-full bg-[var(--dian-soft)] px-2 py-0.5 font-semibold text-[var(--dian-strong)] ring-1 ring-[var(--dian-ring)]"
                            title={`Importado desde ${e.source}`}
                          >
                            {e.source}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
