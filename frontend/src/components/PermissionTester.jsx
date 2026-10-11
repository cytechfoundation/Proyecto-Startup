import { useState } from "react";
import { CheckCircle2, FileBarChart2, Loader2, MonitorSmartphone, Play, ScrollText, Terminal, XCircle } from "lucide-react";
import { api } from "../services/api.js";
import { roleMeta } from "../data/roles.js";

/**
 * Motor de Contenidos: prueba en vivo qué permite tu rol (paso 1+2).
 *
 * Mismo acabado que la Matriz RBAC: los probes se agrupan por módulo en bandas
 * (POS, DIAN, Pagos), la cabecera muestra el chip del rol con su color y los
 * resultados aparecen con icono de OK / denegado.
 */

/** Módulos del probador, en el mismo orden/estilo que la matriz. */
const GRUPOS = [
  { id: "pos", nombre: "Módulo POS", icon: MonitorSmartphone },
  { id: "dian", nombre: "Reportes DIAN", icon: FileBarChart2 },
  { id: "pagos", nombre: "Pagos / PayPal", icon: ScrollText },
];

/** Pruebas en vivo: cada botón dispara una llamada real al backend. */
const probes = [
  { label: "Ver POS", grupo: "pos", run: api.content.pos },
  { label: "Crear ruta POS (solo admin)", grupo: "pos", run: api.content.createPos },
  { label: "Ver DIAN", grupo: "dian", run: api.content.dian },
  { label: "Crear reporte DIAN (admin/editor)", grupo: "dian", run: api.content.createDian },
  { label: "Eliminar reporte (solo admin)", grupo: "dian", run: api.content.deleteDian },
  { label: "Ver pagos", grupo: "pagos", run: api.content.payments },
  { label: "Reembolsar (solo admin)", grupo: "pagos", run: api.content.refund },
  { label: "Crear orden PayPal $25 (solo admin)", grupo: "pagos", run: (t) => api.paypalCreateOrder(t, { amount: "25.00" }) },
  { label: "Transaction Search (admin/editor)", grupo: "pagos", run: (t) => api.paypalSearch(t, "2025-01-01T00:00:00Z", "2025-01-31T23:59:59Z") },
];

export default function PermissionTester({ token, role }) {
  const [results, setResults] = useState({});
  const [corriendo, setCorriendo] = useState("");

  const run = async (p) => {
    setCorriendo(p.label);
    try {
      const data = await p.run(token);
      setResults((r) => ({ ...r, [p.label]: { ok: true, detail: JSON.stringify(data) } }));
    } catch (e) {
      setResults((r) => ({ ...r, [p.label]: { ok: false, detail: e.message } }));
    } finally {
      setCorriendo("");
    }
  };

  const meta = roleMeta(role);
  const IconRol = meta.icon;
  const lista = Object.entries(results);
  const oks = lista.filter(([, r]) => r.ok).length;
  const denegados = lista.length - oks;

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5">
      {/* ------------------------------ cabecera ------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Motor de Contenidos — probador</h2>
          <p className="mt-1 text-sm text-[var(--t-muted)]">
            Cada botón ejecuta identificación federada + autorización por matriz con tu rol actual.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${meta.chip}`}>
            <IconRol className="h-3.5 w-3.5" /> {role}
          </span>
          {lista.length > 0 && (
            <span title="Resultados de esta sesión"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-[var(--t-muted)] ring-1 ring-white/10">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono">{oks}</span>
              <XCircle className="ml-1 h-3.5 w-3.5 text-red-400" />
              <span className="font-mono">{denegados}</span>
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------ pruebas por módulo ------------------------------ */}
      <div className="mt-4">
        {GRUPOS.map((g) => {
          const btns = probes.filter((p) => p.grupo === g.id);
          if (!btns.length) return null;
          return (
            <div key={g.id} className="mt-3 first:mt-0">
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 ring-1 ring-white/5">
                <g.icon className="h-4 w-4 text-[var(--t-accent)]" />
                <span className="text-sm font-bold">{g.nombre}</span>
                <span className="text-xs text-[var(--t-muted)]">{btns.length} pruebas</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 pl-1">
                {btns.map((p) => (
                  <button key={p.label} onClick={() => run(p)} disabled={corriendo !== ""}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] transition-all hover:ring-[var(--t-accent)] disabled:opacity-60">
                    {corriendo === p.label
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--t-accent)]" />
                      : <Play className="h-3.5 w-3.5 text-[var(--t-muted)]" />}
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ------------------------------ resultados ------------------------------ */}
      {lista.length === 0 ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-[var(--t-muted)] ring-1 ring-white/5">
          <Terminal className="h-4 w-4" /> Toca un botón para ejecutar una prueba con tu rol.
        </p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {lista.map(([label, r]) => (
            <li key={label}
                className={`flex items-start gap-2.5 rounded-lg p-3 ring-1 ${r.ok ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20" : "bg-red-500/10 text-red-300 ring-red-400/20"}`}>
              {r.ok
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="min-w-0">
                <b>{label}</b>
                <span className="mt-0.5 block break-all font-mono text-xs opacity-80">{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
