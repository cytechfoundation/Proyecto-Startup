import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, BellRing, Repeat, AlertCircle } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import ImportedEventsPanel from "../components/ImportedEventsPanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { CAL2026 } from "../data/tributary2026.js";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTO = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11, enero:0 };
const DIAS_SEM = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const start = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Índice de mes a partir de un rótulo corto tipo "feb" o "ene 2027". */
function mesIndex(raw) {
  const token = String(raw || "").trim().slice(0, 3).toLowerCase();
  return MESES_CORTO[token] ?? -1;
}

export default function BillingCalendar() {
  const { token } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(now.getFullYear() === 2026 ? now.getMonth() : 9);
  const [view, setView] = useState("mes");
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState("todos");
  const [error, setError] = useState(null);
  // Eventos importados desde la BD (públicos, guardados por año).
  const [imported, setImported] = useState([]);

  useEffect(() => {
    let alive = true;
    api.taxEvents(year)
      .then((d) => alive && setImported(d))
      .catch(() => {});
    return () => { alive = false; };
  }, [year]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    Promise.all([
      api.transactions(token, { kind: "invoice", page_size: 50 }).catch(() => ({ items: [] })),
      api.transactions(token, { kind: "payment", page_size: 50 }).catch(() => ({ items: [] })),
    ])
      .then(([i, p]) => {
        if (!alive) return;
        setInvoices(i.items || []);
        setPayments(p.items || []);
      })
      .catch(() => alive && setError("No fue posible cargar tus transacciones."));
    return () => { alive = false; };
  }, [token]);

  /** Eventos DIAN 2026: soporta filas con `dias`, `dia` (único), `grupos` y `periodos`. */
  const dianMap = useMemo(() => {
    const m = {};
    const push = (mi, day, ev) => {
      if (mi < 0 || mi > 11 || !day) return;
      const k = `${mi}-${Number(day)}`;
      (m[k] = m[k] || []).push(ev);
    };
    CAL2026.forEach((sec) => {
      const base = { tipo: "dian", titulo: `${sec.grupo} ${sec.etiqueta}`.trim().replace(/\s+/g, " ") };
      sec.filas.forEach((f) => {
        const mi = MESES.indexOf(f.mes);
        if (Array.isArray(f.dias)) {
          f.dias.forEach((d) => push(mi, d, { ...base, detalle: f.tramite }));
        } else if (f.dia) {
          push(mi, f.dia, { ...base, detalle: f.tramite });
        } else if (Array.isArray(f.periodos)) {
          f.periodos.forEach((p) => push(mesIndex(p.m), p.d, { ...base, detalle: `${f.tramite} ${p.p}`.trim() }));
        }
      });
    });
    return m;
  }, []);

  /** Eventos importados desde la BD (`tax_calendar`), ya etiquetados por año. */
  const impMap = useMemo(() => {
    const m = {};
    imported.forEach((e) => {
      const [y, mo, d] = e.event_date.split("-").map(Number);
      if (y !== year || mo - 1 !== month) return;
      const k = `${month}-${d}`;
      (m[k] = m[k] || []).push({
        tipo: "importado",
        titulo: e.obligation,
        detalle: e.category || "DIAN",
        fuente: e.source,
      });
    });
    return m;
  }, [imported, month, year]);

  const txMap = useMemo(() => {
    const m = {};
    const push = (iso, ev) => {
      if (!iso) return;
      const d = new Date(iso);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const k = `${month}-${d.getDate()}`;
      (m[k] = m[k] || []).push(ev);
    };
    invoices.forEach((f) => push(f.created_at, { tipo: "factura", titulo: f.external_id || "Factura", detalle: `$ ${(f.amount / 100).toLocaleString("es-CO")} · ${f.status}` }));
    payments.forEach((p) => push(p.created_at, { tipo: "pago", titulo: p.external_id || "Pago", detalle: `$ ${(p.amount / 100).toLocaleString("es-CO")} · ${p.status}` }));
    if (invoices.length === 0 && payments.length === 0) {
      [["factura","FV-1042 · $ 1.250.000",15],["pago","PAY-881 · Conciliado",16],["factura","FV-1040 · Contingencia",21]].forEach(([t, title, day]) => {
        const k = `${month}-${day}`;
        (m[k] = m[k] || []).push({ tipo: t, titulo: title, detalle: "Demo recurrente", recurrente: true });
      });
    }
    return m;
  }, [invoices, payments, month, year]);

  const cells = monthMatrix(year, month);
  const isCurrent = year === now.getFullYear() && month === now.getMonth();

  const eventosDia = (d) => {
    if (!d) return [];
    const key = `${month}-${d}`;
    const dian = year === 2026 ? (dianMap[key] || []) : [];
    const imp = impMap[key] || [];
    const all = [...dian, ...imp, ...(txMap[key] || [])];
    if (filter === "todos") return all;
    return all.filter((e) => e.tipo === filter);
  };

  const step = (dir) => {
    setMonth((m) => {
      const next = m + dir;
      if (next > 11) { setYear((y) => y + 1); return 0; }
      if (next < 0) { setYear((y) => y - 1); return 11; }
      return next;
    });
  };

  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  const color = (t) =>
    t === "dian" ? "bg-blue-500/10 text-blue-600 ring-blue-500/20"
    : t === "importado" ? "bg-violet-500/10 text-violet-600 ring-violet-500/20"
    : t === "factura" ? "bg-amber-500/10 text-amber-600 ring-amber-500/20"
    : "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20";

  /** Vista semanal: la semana que contiene al día de referencia (hoy o el 1 del mes). */
  const weekCells = useMemo(() => {
    const ref = isCurrent ? now.getDate() : 1;
    const refDow = (new Date(year, month, ref).getDay() + 6) % 7;
    const startDay = ref - refDow;
    return Array.from({ length: 7 }, (_, i) => {
      const d = startDay + i;
      return d >= 1 && d <= cells.filter(Boolean).length ? d : null;
    });
  }, [year, month, isCurrent, cells]);

  const totalEventos = cells.filter(Boolean).reduce((n, d) => n + eventosDia(d).length, 0);

  return (
    <div className="min-h-screen bg-[var(--l-bg)] text-[var(--l-text)]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        {/* Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--l-accent)]">Facturación · Calendario</p>
            <h1 className="text-3xl font-extrabold">Calendario de Facturación</h1>
            <p className="mt-1 text-sm text-[var(--l-muted)]">Vencimientos DIAN, facturas, pagos recurrentes y alertas programadas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => step(-1)} aria-label="Mes anterior" className="rounded-lg bg-[var(--l-surface)] p-2 ring-1 ring-[var(--l-border)] transition hover:ring-[var(--l-accent)]"><ChevronLeft className="h-4 w-4" /></button>
            <span className="flex items-center gap-2 px-2 font-bold"><CalendarDays className="h-4 w-4 text-[var(--l-accent)]" />{MESES[month]} {year}</span>
            <button onClick={() => step(1)} aria-label="Mes siguiente" className="rounded-lg bg-[var(--l-surface)] p-2 ring-1 ring-[var(--l-border)] transition hover:ring-[var(--l-accent)]"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={goToday} className="rounded-lg bg-[var(--l-surface)] px-3 py-2 text-xs font-semibold ring-1 ring-[var(--l-border)] transition hover:ring-[var(--l-accent)]">Hoy</button>
            <div className="ml-1 flex rounded-lg bg-[var(--l-surface)] p-1 ring-1 ring-[var(--l-border)]">
              {["mes", "semana"].map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-all duration-200 ${view===v?"bg-[var(--l-accent)] text-white":"text-[var(--l-muted)]"}`}>{v}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Filtros + leyenda */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {[["todos","Todos"],["dian","Vencimientos DIAN"],["importado","Importados de la BD"],["factura","Facturas"],["pago","Pagos / promesas"]].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`rounded-full px-3 py-1.5 font-semibold ring-1 transition-all duration-200 ${filter===v?"bg-[var(--l-accent)] text-white ring-[var(--l-accent)]":"bg-[var(--l-surface)] text-[var(--l-muted)] ring-[var(--l-border)]"}`}>{l}</button>
          ))}
          <span className="ml-auto text-[var(--l-muted)]">{totalEventos} eventos en {MESES[month].toLowerCase()}</span>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-600 ring-1 ring-amber-500/20">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {view === "mes" ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)]">
            <div className="grid grid-cols-7 bg-[var(--l-surface2)] text-center text-xs font-bold uppercase text-[var(--l-muted)]">
              {DIAS_SEM.map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                const evs = eventosDia(d);
                const today = isCurrent && d === now.getDate();
                return (
                  <div key={i} className={`min-h-[96px] border-t border-l border-[var(--l-border)] p-1.5 transition-colors ${d ? (today ? "bg-[var(--l-accent)]/5" : "hover:bg-[var(--l-surface2)]/50") : "bg-[var(--l-surface2)]/40"}`}>
                    {d && (<>
                      <p className={`text-xs font-bold ${today ? "inline-block rounded-full bg-[var(--l-accent)] px-1.5 text-white" : ""}`}>{d}</p>
                      <div className="mt-1 space-y-1">
                        {evs.slice(0,3).map((e, j) => (
                          <p key={j} title={`${e.titulo} · ${e.detalle}`} className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${color(e.tipo)}`}>
                            {e.recurrente && <Repeat className="h-2.5 w-2.5 shrink-0" />}{e.titulo}
                          </p>
                        ))}
                        {evs.length > 3 && <p className="text-[10px] font-semibold text-[var(--l-muted)]">+{evs.length - 3} más</p>}
                      </div>
                    </>)}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {weekCells.map((d, i) => {
              const evs = eventosDia(d);
              const today = isCurrent && d === now.getDate();
              return (
                <div key={i} className={`flex gap-3 rounded-xl border p-3 transition-colors ${today ? "border-[var(--l-accent)] bg-[var(--l-accent)]/5" : "border-[var(--l-border)] bg-[var(--l-surface)]"}`}>
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-[10px] font-semibold uppercase text-[var(--l-muted)]">{d ? DIAS_SEM[i] : "—"}</p>
                    <p className={`text-lg font-extrabold ${today ? "text-[var(--l-accent)]" : ""}`}>{d || "·"}</p>
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    {!d && <span className="text-xs text-[var(--l-muted)]">Fuera del mes</span>}
                    {d && evs.length === 0 && <span className="text-xs text-[var(--l-muted)]">Sin eventos</span>}
                    {evs.map((e, j) => (
                      <span key={j} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${color(e.tipo)}`}><BellRing className="h-3 w-3" />{e.titulo} · {e.detalle}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-xs text-[var(--l-muted)]">
          Tip: los eventos DIAN vienen de <Link to="/calendario-tributario" className="font-semibold text-[var(--l-accent)]">/calendario-tributario</Link>.
          Los <b className="text-violet-600">importados</b> se guardan en la base de datos por año.
          {!token ? " Inicia sesión para ver tus facturas y pagos reales." : " Facturas y pagos se leen de tus transacciones reales."}
        </p>

        {/* Listado completo de lo importado desde la BD, organizado por año */}
        <div className="mt-8">
          <ImportedEventsPanel initialYear={year} title="Base de datos tributaria" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
