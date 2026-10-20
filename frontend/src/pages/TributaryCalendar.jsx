import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import ImportedEventsPanel from "../components/ImportedEventsPanel.jsx";
import CalendarImporter from "../components/CalendarImporter.jsx";
import { CAL2026, DIGITOS } from "../data/tributary2026.js";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Search, ChevronUp, Download, CalendarClock, Hash, Layers, CalendarPlus, Link2, Upload } from "lucide-react";

/** Cabecera de fila: mes + trámite, con soporte para estilo "nota" (texto plano). */
function LeftCell({ mes, tramite, hint = "Hasta", compact = false }) {
  return (
    <div
      className={`relative flex items-center gap-3 overflow-hidden bg-gradient-to-r from-[#f4fbf7] to-white px-5 py-4 md:w-[320px] md:shrink-0 ${
        compact ? "" : "border-b border-[#0b7a34]/10 md:border-b-0 md:border-r"
      }`}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#0b7a34] via-[#16a34a] to-[#16a34a]" />
      <div className="pl-2">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{hint}</span>
        <span className={`block font-extrabold leading-tight text-[#0b7a34] ${compact ? "text-base" : "text-2xl md:text-3xl"}`}>
          {mes}
        </span>
      </div>
      <span className="ml-auto mt-auto whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 md:absolute md:bottom-2 md:left-1/2 md:ml-0 md:-translate-x-1/2">
        {tramite}
      </span>
    </div>
  );
}

function Shell({ children, tint = false }) {
  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl ring-1 transition-all duration-200 ease-in-out md:flex-row ${
        tint ? "bg-[#f7fcf9]" : "bg-white"
      } shadow-[0_1px_3px_rgba(11,122,52,0.08),0_8px_24px_-12px_rgba(11,122,52,0.18)] ring-[#0b7a34]/10 hover:-translate-y-0.5 hover:shadow-[0_3px_8px_rgba(11,122,52,0.10),0_16px_40px_-16px_rgba(11,122,52,0.30)] hover:ring-[#0b7a34]/25`}
    >
      {children}
    </div>
  );
}

/** Grilla de dígitos NIT (10 columnas). */
function DigitGrid({ grupos = DIGITOS, dias, header = "Último dígito del NIT" }) {
  return (
    <div className="flex flex-1 flex-col px-4 py-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <Hash className="h-3 w-3" /> {header}
      </div>
      <div className="grid flex-1 grid-cols-5 gap-1.5 text-center sm:grid-cols-10">
        {grupos.map((g, i) => (
          <div
            key={g}
            className="group/d flex flex-col items-center justify-center rounded-lg bg-[#e9f6ef] py-1.5 ring-1 ring-[#0b7a34]/10 transition-all duration-200 hover:scale-105 hover:bg-[#0b7a34] hover:ring-[#0b7a34]"
          >
            <span className="text-[11px] font-semibold text-slate-500 transition-colors group-hover/d:text-white/80">{g}</span>
            <span className="text-xl font-extrabold leading-tight text-[#0b7a34] transition-colors group-hover/d:text-white sm:text-2xl">{dias[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Fila(f) {
  if (f.kind === "grupos") {
    return (
      <Shell>
        <LeftCell mes={f.mes} tramite={f.tramite} />
        <DigitGrid grupos={f.grupos} dias={f.dias} />
      </Shell>
    );
  }
  if (f.kind === "periodos") {
    return (
      <Shell tint>
        <LeftCell mes={f.mes} tramite={f.tramite} hint="Periodo" compact />
        <div className="flex flex-1 flex-col px-4 py-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <CalendarClock className="h-3 w-3" /> Declaración bimestral
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {f.periodos.map((r) => (
              <div
                key={r.p || r.m}
                className="flex flex-col items-center rounded-lg bg-white px-1.5 py-2 ring-1 ring-[#0b7a34]/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-[#0b7a34]/40"
              >
                <span className="text-[10px] font-semibold text-slate-500">{r.p}</span>
                <span className="text-[9px] uppercase tracking-wide text-slate-400">Hasta</span>
                <span className="text-sm font-bold text-slate-700">{r.m}</span>
                <span className="text-2xl font-extrabold leading-tight text-[#0b7a34]">{r.d}</span>
              </div>
            ))}
          </div>
        </div>
      </Shell>
    );
  }
  if (f.kind === "unico") {
    return (
      <Shell>
        <LeftCell mes={f.mes} tramite={f.tramite} />
        <div className="flex flex-1 items-center gap-5 px-6 py-4">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b7a34] to-[#16a34a] text-white shadow-lg shadow-[#0b7a34]/25">
            <span className="text-2xl font-black leading-none">{f.dia}</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">{f.nota}</p>
        </div>
      </Shell>
    );
  }
  if (f.kind === "nota") {
    return (
      <Shell tint>
        <LeftCell mes={f.mes} tramite={f.tramite} hint="Obligación" compact />
        <div className="flex flex-1 items-center gap-3 px-6 py-4">
          <Layers className="h-4 w-4 shrink-0 text-[#16a34a]" />
          <p className="text-sm leading-relaxed text-slate-600">{f.texto}</p>
        </div>
      </Shell>
    );
  }
  const { mes, tramite, dias } = f;
  return (
    <Shell>
      <LeftCell mes={mes} tramite={tramite} />
      <DigitGrid dias={dias} />
    </Shell>
  );
}

export default function TributaryCalendar() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("todos");
  // Cambia tras un import para recargar los eventos de la BD.
  const [refreshKey, setRefreshKey] = useState(0);

  const groups = useMemo(() => {
    const set = new Set(CAL2026.map((s) => s.grupo).filter(Boolean));
    return [...set];
  }, []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CAL2026.filter((s) => {
      const label = `${s.grupo} ${s.etiqueta}`.toLowerCase();
      if (filter !== "todos" && s.grupo !== filter) return false;
      if (needle && !label.includes(needle)) return false;
      return true;
    });
  }, [q, filter]);

  const totalFilas = CAL2026.reduce((n, s) => n + s.filas.length, 0);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#dcefe4] text-slate-800">
      <Navbar />

      {/* Encabezado estilo portada DIAN */}
      <div className="border-b border-[#0b7a34]/15 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10 text-center md:flex-row md:gap-8 md:text-left">
          <div className="shrink-0">
            <p className="text-5xl font-black tracking-[0.2em] text-slate-800">DIAN</p>
            <div className="mt-2 h-2.5 w-32 rounded-full bg-gradient-to-r from-yellow-400 via-blue-700 to-red-600" />
          </div>
          <div className="hidden h-20 w-px bg-slate-300 md:block" />
          <div>
            <h1 className="text-4xl font-light leading-tight text-[#0b7a34] md:text-5xl">
              Calendario <span className="font-black text-[#16a34a]">2026</span> tributario
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
              Plazos para el cumplimiento de las obligaciones tributarias administradas por la Unidad
              Administrativa Especial Dirección de Impuestos y Aduanas Nacionales (UAE DIAN).
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs md:justify-start">
              <span className="rounded-full bg-[#e9f6ef] px-3 py-1 font-semibold text-[#0b7a34] ring-1 ring-[#0b7a34]/20">
                {CAL2026.length} obligaciones
              </span>
              <span className="rounded-full bg-[#e9f6ef] px-3 py-1 font-semibold text-[#0b7a34] ring-1 ring-[#0b7a34]/20">
                {totalFilas} vencimientos
              </span>
              <span className="rounded-full bg-[#e9f6ef] px-3 py-1 font-semibold text-[#0b7a34] ring-1 ring-[#16a34a]/30">
                Actualizado 2026
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de herramientas pegajosa */}
      <div className="sticky top-0 z-40 border-b border-[#0b7a34]/15 bg-[#dcefe4]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar obligación: IVA, renta, RST, gasolina…"
              className="w-full rounded-xl border border-[#0b7a34]/15 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-[#0b7a34]/30 transition placeholder:text-slate-400 focus:ring-2"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["todos", ...groups].map((g) => (
              <button
                key={g}
                onClick={() => setFilter(g)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ring-1 transition-all duration-200 ease-in-out ${
                  filter === g
                    ? "bg-[#0b7a34] text-white ring-[#0b7a34] shadow-md shadow-[#0b7a34]/25"
                    : "bg-white text-slate-600 ring-[#0b7a34]/15 hover:ring-[#0b7a34]/40"
                }`}
              >
                {g === "todos" ? "Todos" : g.split(" ")[0]}
              </button>
            ))}
          </div>
          <a
            href={`${api.base}/api/v1/tax-calendar/ics`}
            className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-[#0b7a34] px-4 py-2.5 text-xs font-semibold text-white ring-1 ring-[#0b7a34] shadow-md shadow-[#0b7a34]/25 transition hover:bg-[#065f28] md:flex"
          >
            <CalendarPlus className="h-4 w-4" /> .ics
          </a>
          <button
            onClick={() => window.print()}
            className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-[#0b7a34] ring-1 ring-[#0b7a34]/15 transition hover:bg-[#0b7a34] hover:text-white md:flex"
          >
            <Download className="h-4 w-4" /> Imprimir
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {/* Índice rápido */}
        <nav className="mt-6 flex flex-wrap gap-1.5 rounded-2xl bg-white/70 p-3 ring-1 ring-[#0b7a34]/10">
          {CAL2026.map((s, i) => (
            <button
              key={s.etiqueta + i}
              onClick={() => scrollTo(`sec-${i}`)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-200 hover:scale-105 hover:text-white"
              style={{ backgroundColor: `${s.color}14`, boxShadow: `inset 0 0 0 1px ${s.color}33` }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = s.color)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `${s.color}14`)}
            >
              {s.etiqueta}
            </button>
          ))}
        </nav>

        {visible.length === 0 && (
          <div className="mt-10 rounded-2xl bg-white p-10 text-center ring-1 ring-[#0b7a34]/10">
            <p className="font-semibold text-slate-600">Sin resultados para “{q}”.</p>
            <button onClick={() => { setQ(""); setFilter("todos"); }} className="mt-3 text-sm font-semibold text-[#0b7a34] underline">
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Eventos importados desde la BD (por año) + importador admin */}
        <div className="mt-10 space-y-6">
          {isAdmin && (
            <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-[#0b7a34]/10">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Upload className="h-3.5 w-3.5" /> Acciones de administrador
              </p>
              <CalendarImporter bare onImported={() => setRefreshKey((k) => k + 1)} />
            </div>
          )}
          <ImportedEventsPanel key={refreshKey} initialYear={2026} />
        </div>

        {/* Secciones */}
        {visible.map((sec) => {
          const idx = CAL2026.indexOf(sec);
          return (
            <section key={sec.etiqueta + idx} id={`sec-${idx}`} className="mt-10 scroll-mt-24">
              <div className="flex items-stretch gap-0 overflow-hidden rounded-t-2xl shadow-[0_2px_8px_rgba(11,122,52,0.10)]">
                <div className="flex min-w-0 flex-1 items-center gap-3 bg-white px-5 py-3">
                  <span className="text-xl font-light text-slate-700 md:text-2xl">{sec.grupo}</span>
                  <span className="hidden truncate text-xs text-slate-400 md:inline">
                    {sec.filas.length} {sec.filas.length === 1 ? "vencimiento" : "vencimientos"}
                  </span>
                </div>
                <span
                  className="flex items-center px-5 py-3 text-lg font-extrabold tracking-wide md:text-2xl"
                  style={{ background: `linear-gradient(135deg, ${sec.color}, ${sec.color}dd)`, color: sec.accent }}
                >
                  {sec.etiqueta}
                </span>
              </div>
              <div className="mt-4 space-y-4">
                {sec.filas.map((f, i) => (
                  <Fila key={sec.etiqueta + idx + i} {...f} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Exportar / suscribir en calendarios externos */}
        <div className="mt-12 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#0b7a34]/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">Llévate este calendario contigo</h2>
              <p className="mt-1 text-sm text-slate-500">
                Agrega los vencimientos DIAN a tu app de calendario (Windows Calendar, Outlook o Google Calendar).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`${api.base}/api/v1/tax-calendar/ics`}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0b7a34] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0b7a34]/25 transition hover:bg-[#065f28]"
              >
                <Download className="h-4 w-4" /> Descargar .ics
              </a>
              <a
                href={`${api.base}/api/v1/tax-calendar/ics`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#e9f6ef] px-5 py-2.5 text-sm font-semibold text-[#0b7a34] ring-1 ring-[#0b7a34]/20 transition hover:bg-[#0b7a34] hover:text-white"
              >
                <CalendarPlus className="h-4 w-4" /> Abrir en calendario
              </a>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-[#f4fbf7] p-4 ring-1 ring-[#0b7a34]/10">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0b7a34]"><CalendarPlus className="h-4 w-4" /> Windows Calendar</div>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-600">
                <li>Abre la app <b>Calendario</b> de Windows.</li>
                <li>Ve a <b>Configuración (⚙️) → Suscribirse a un calendario</b>.</li>
                <li>Pega la URL del botón “Abrir en calendario”.</li>
                <li>Windows actualizará los vencimientos automáticamente.</li>
              </ol>
            </div>
            <div className="rounded-xl bg-[#f4fbf7] p-4 ring-1 ring-[#0b7a34]/10">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0b7a34]"><Link2 className="h-4 w-4" /> Google / Outlook</div>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-600">
                <li>Descarga el archivo <b>.ics</b>.</li>
                <li>Google: <b>Ajustes → Importar y exportar → Importar</b>.</li>
                <li>Outlook: <b>Añadir calendario → Suscribirse desde la web</b> con la URL.</li>
              </ol>
            </div>
            <div className="rounded-xl bg-[#f4fbf7] p-4 ring-1 ring-[#0b7a34]/10">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0b7a34]"><Download className="h-4 w-4" /> Qué incluye</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {CAL2026.length} obligaciones y más de 60 vencimientos del Calendario Tributario DIAN 2026, en formato iCal (RFC 5545).
                Los eventos se marcan como todo el día y no bloquean tu agenda.
              </p>
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#0b7a34]/10 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500">
            <p className="font-semibold text-slate-700">Fuente: DIAN · Calendario Tributario 2026 (2 páginas).</p>
            <p className="mt-1 text-xs">Diseño replicado para consulta rápida. Los plazos en domingo o festivo se prorrogan al día hábil siguiente.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/calendario-facturacion" className="rounded-xl bg-[#e9f6ef] px-5 py-2.5 text-sm font-semibold text-[#0b7a34] ring-1 ring-[#0b7a34]/20 transition hover:bg-[#0b7a34] hover:text-white">
              Calendario de Facturación
            </Link>
            {isAdmin && (
              <Link
                to="/cuenta"
                title="Zona administraria: importar un nuevo PDF de la DIAN"
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 ring-1 ring-transparent transition hover:bg-white hover:text-[#0b7a34] hover:ring-[#0b7a34]/20"
              >
                <Upload className="h-3.5 w-3.5" /> Actualizar calendario (admin)
              </Link>
            )}
          </div>
        </div>
      </main>

      {/* Botón volver arriba */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Volver arriba"
        className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[#0b7a34] text-white shadow-xl transition-all duration-200 hover:scale-110 hover:bg-[#065f28]"
      >
        <ChevronUp className="h-5 w-5" />
      </button>

      <Footer />
    </div>
  );
}
