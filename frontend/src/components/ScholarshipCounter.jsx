import { useCallback, useEffect, useState } from "react";
import { ExternalLink, GraduationCap, Minus, Plus, RotateCcw } from "lucide-react";
import { api } from "../services/api.js";

const num = (n) => new Intl.NumberFormat("es-CO").format(Number(n) || 0);

/**
 * Panel admin (ruta /cuenta) del contador de becas: la cifra que muestra la
 * sección Donar de la página pública. Permite registrar becas de una en una
 * (+1/-1) o fijar el valor a mano; el público la ve al instante.
 */
export default function ScholarshipCounter({ token, onError }) {
  const [counters, setCounters] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.impactCounters();
      setCounters(data.counters || []);
    } catch (e) {
      onError?.(e.message || String(e));
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const aplicar = (row) => setCounters((cs) => cs.map((c) => (c.key === row.key ? { ...c, ...row } : c)));

  const guardar = async (key, value) => {
    setBusyKey(key);
    try {
      const row = await api.setImpactCounter(token, key, value);
      aplicar(row);
      setMsg(`«${row.label}» guardado en ${num(row.value)} ${row.unit}. Ya se ve en la página pública.`);
      setDraft("");
    } catch (e) {
      onError?.(e.message || String(e));
    } finally {
      setBusyKey("");
    }
  };

  const ajustar = async (key, delta) => {
    setBusyKey(key);
    try {
      const row = await api.adjustImpactCounter(token, key, delta);
      aplicar(row);
      setMsg(`${delta > 0 ? "Sumado" : "Restado"}: ${num(row.value)} ${row.unit} de «${row.label}».`);
    } catch (e) {
      onError?.(e.message || String(e));
    } finally {
      setBusyKey("");
    }
  };

  const becas = counters.find((c) => c.key === "becas");
  const otros = counters.filter((c) => c.key !== "becas");

  return (
    <div className="space-y-4">
      {/* --------- contador principal de becas --------- */}
      <div className="rounded-xl bg-[var(--t-surface)] p-5 ring-1 ring-[var(--t-border)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold">Contador de becas</h3>
            <p className="text-sm text-[var(--t-muted)]">
              Cifra que publica la sección <b>Donar</b> de la página principal.
            </p>
          </div>
          <button
            onClick={load}
            title="Recargar cifras"
            className="ml-auto rounded-lg p-2 text-[var(--t-muted)] transition-colors hover:bg-[var(--t-surface2)] hover:text-white"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <p className="text-5xl font-extrabold leading-none text-cyan-300">
            {becas ? num(becas.value) : "—"}
          </p>
          <p className="pb-1 text-sm text-[var(--t-muted)]">
            {becas ? `${becas.unit} otorgadas` : "cargando…"}
            {becas?.updated_at && (
              <>
                <br />
                Actualizado {new Date(becas.updated_at).toLocaleString("es-CO")}
              </>
            )}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => ajustar("becas", 1)}
            disabled={busyKey === "becas"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Registrar 1 beca
          </button>
          <button
            onClick={() => ajustar("becas", -1)}
            disabled={busyKey === "becas" || !becas || becas.value <= 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--t-surface2)] px-4 py-2 text-sm font-semibold text-[var(--t-text2)] ring-1 ring-[var(--t-border)] transition-colors hover:text-white disabled:opacity-50"
          >
            <Minus className="h-4 w-4" /> Quitar 1
          </button>
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder={becas ? String(becas.value) : "0"}
              aria-label="Nuevo valor del contador de becas"
              className="w-28 rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-cyan-400"
            />
            <button
              onClick={() => draft !== "" && guardar("becas", Number(draft))}
              disabled={busyKey === "becas" || draft === ""}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--t-accent)] px-4 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
          <a
            href="/#donar"
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--t-accent)] hover:underline"
          >
            Ver en la página pública <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {msg && <p className="mt-3 rounded-lg bg-emerald-500/10 p-2.5 text-sm text-emerald-400">{msg}</p>}
      </div>

      {/* --------- otros contadores de la misma sección --------- */}
      {otros.length > 0 && (
        <div className="rounded-xl bg-[var(--t-surface)] p-5 ring-1 ring-[var(--t-border)]">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--t-muted)]">
            Otras cifras de la sección Donar
          </h4>
          <ul className="mt-3 space-y-2">
            {otros.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--t-surface2)] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {c.label} · <b>{num(c.value)}</b> {c.unit}
                </span>
                <button
                  onClick={() => ajustar(c.key, 1)}
                  disabled={busyKey === c.key}
                  className="rounded-md bg-[var(--t-accent)]/15 px-2.5 py-1 text-xs font-bold text-[var(--t-accent)] transition-colors hover:bg-[var(--t-accent)]/25 disabled:opacity-50"
                >
                  +1
                </button>
                <button
                  onClick={() => ajustar(c.key, -1)}
                  disabled={busyKey === c.key || c.value <= 0}
                  className="rounded-md bg-[var(--t-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--t-text2)] ring-1 ring-[var(--t-border)] transition-colors hover:text-white disabled:opacity-50"
                >
                  −1
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
