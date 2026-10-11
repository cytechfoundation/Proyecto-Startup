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
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#0a6d9c]/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[#eef7fc] p-2 text-[#0a6d9c] ring-1 ring-[#0a6d9c]/20">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800">
              {title}
              <span className="rounded-full bg-[#eaf7e0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4a9e2b] ring-1 ring-[#7ac143]/30">
                Base de datos
              </span>
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Guardados por año desde el PDF importado. Consulta también el
              <a href={`${api.base}/api/v1/tax-calendar/ics?year=${year ?? ""}`} className="mx-1 font-semibold text-[#0a6d9c] underline">.ics {year}</a>
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
                    ? "bg-[#0a6d9c] text-white ring-[#0a6d9c] shadow-md shadow-[#0a6d9c]/25"
                    : "bg-[#f4fafd] text-slate-600 ring-[#0a6d9c]/15 hover:ring-[#0a6d9c]/40"
                }`}
                title={`${y.events} eventos importados`}
              >
                {y.year}
                <span className={`ml-1.5 ${year === y.year ? "text-white/70" : "text-slate-400"}`}>{y.events}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-8 flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando eventos del {year}…
        </div>
      )}

      {!loading && error && (
        <p className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-200">{error}</p>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#0a6d9c]/20 bg-[#f8fcfe] py-10 text-center">
          <Inbox className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">Aún no hay eventos importados para {year}.</p>
          <p className="max-w-md text-xs text-slate-500">
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
                <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <CalendarCheck2 className="h-3.5 w-3.5" />
                  {MESES[mes]}
                </h3>
              )}
              <ul className="grid gap-2 md:grid-cols-2">
                {evs.map((e) => (
                  <li
                    key={e.id}
                    className="group flex items-start gap-3 rounded-xl bg-[#f8fcfe] px-4 py-3 ring-1 ring-[#0a6d9c]/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:ring-[#0a6d9c]/30"
                  >
                    <span className="mt-0.5 shrink-0 rounded-lg bg-[#0a6d9c] px-2 py-1 text-[11px] font-black leading-tight text-white">
                      {e.event_date.split("-")[2]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-snug text-slate-700">{e.obligation}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full bg-[#eef7fc] px-2 py-0.5 font-semibold text-[#0a6d9c] ring-1 ring-[#0a6d9c]/15">
                          {e.category || "General"}
                        </span>
                        <span className="text-slate-400">{fmtFecha(e.event_date)}</span>
                        {e.source && (
                          <span
                            className="max-w-[160px] truncate rounded-full bg-[var(--t-surface2,#f1f5f9)] px-2 py-0.5 text-slate-500"
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
