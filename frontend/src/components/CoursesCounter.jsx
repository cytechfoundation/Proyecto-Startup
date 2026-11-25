import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, Minus, Plus, RotateCcw } from "lucide-react";
import { api } from "../services/api.js";

const num = (n) => new Intl.NumberFormat("es-CO").format(Number(n) || 0);

/**
 * Panel admin (ruta /cuenta) del contador de cursos comprados.
 * Cada curso preparado tiene su propio contador (`curso_*` en el backend, hoy
 * solo la Ruta Frontend desde Cero) y su fila en "Cifras de la sección Donar";
 * el número grande del héroe es la suma de todos los cursos. Permite registrar
 * ventas de una en una (+1/-1) o fijar el valor a mano.
 */
export default function CoursesCounter({ token, onError }) {
  const [counters, setCounters] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState("");
  const [cursoSel, setCursoSel] = useState("");

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
      setMsg(`«${row.label}» guardado en ${num(row.value)} ${row.unit}.`);
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

  const cursos = useMemo(() => counters.filter((c) => c.key.startsWith("curso_")), [counters]);
  const total = cursos.reduce((s, c) => s + (c.value || 0), 0);
  const curso = cursos.find((c) => c.key === cursoSel) ?? cursos[0];
  const ultimo = cursos.reduce((m, c) => (c.updated_at && c.updated_at > m ? c.updated_at : m), "");
  const hayCursos = cursos.length > 0;

  return (
    <div className="space-y-4">
      {/* --------- contador principal: total de cursos comprados --------- */}
      <div className="rounded-xl bg-[var(--t-surface)] p-5 ring-1 ring-[var(--t-border)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
            <BookOpen className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold">Contador de cursos comprados</h3>
            <p className="text-sm text-[var(--t-muted)]">
              {hayCursos
                ? cursos.length === 1
                  ? <>Ventas de la <b>{cursos[0].label}</b>.</>
                  : <>Ventas de <b>{cursos.length} cursos preparados</b>.</>
                : "Ventas de los cursos preparados de la fundación."}
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
          <p className="text-5xl font-extrabold leading-none text-emerald-300">{hayCursos ? num(total) : "—"}</p>
          <p className="pb-1 text-sm text-[var(--t-muted)]">
            {hayCursos ? "cursos vendidos" : "cargando…"}
            {ultimo && (
              <>
                <br />
                Actualizado {new Date(ultimo).toLocaleString("es-CO")}
              </>
            )}
          </p>
        </div>

        {hayCursos && total === 0 && (
          <p className="mt-3 rounded-lg bg-[var(--t-surface2)] p-2.5 text-sm text-[var(--t-muted)]">
            Aún no hay ventas registradas: usa <b>Registrar 1 venta</b> la próxima vez que alguien
            compre un curso.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {cursos.length > 1 && (
            <select
              value={curso?.key ?? ""}
              onChange={(e) => setCursoSel(e.target.value)}
              aria-label="Curso sobre el que registrar la venta"
              className="rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-emerald-400"
            >
              {cursos.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => curso && ajustar(curso.key, 1)}
            disabled={!curso || busyKey === curso.key}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Registrar 1 venta
          </button>
          <button
            onClick={() => curso && ajustar(curso.key, -1)}
            disabled={!curso || busyKey === curso.key || curso.value <= 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--t-surface2)] px-4 py-2 text-sm font-semibold text-[var(--t-text2)] ring-1 ring-[var(--t-border)] transition-colors hover:text-white disabled:opacity-50"
          >
            <Minus className="h-4 w-4" /> Quitar 1
          </button>
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder={curso ? String(curso.value) : "0"}
              aria-label="Nuevo valor del contador del curso seleccionado"
              className="w-28 rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-emerald-400"
            />
            <button
              onClick={() => draft !== "" && curso && guardar(curso.key, Number(draft))}
              disabled={!curso || busyKey === curso.key || draft === ""}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--t-accent)] px-4 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>

        {msg && <p className="mt-3 rounded-lg bg-emerald-500/10 p-2.5 text-sm text-emerald-400">{msg}</p>}
      </div>

      {/* --------- cifras que publica la sección Donar: un curso por fila --------- */}
      {hayCursos && (
        <div className="rounded-xl bg-[var(--t-surface)] p-5 ring-1 ring-[var(--t-border)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--t-muted)]">
              Cifras de la sección Donar
            </h4>
            <a
              href="/#donar"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--t-accent)] hover:underline"
            >
              Ver en la página pública <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <ul className="mt-3 space-y-2">
            {cursos.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--t-surface2)] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {c.label} · <b>{num(c.value)}</b> {c.unit}
                </span>
                <button
                  onClick={() => ajustar(c.key, 1)}
                  disabled={busyKey === c.key}
                  title="Registrar 1 venta de este curso"
                  className="rounded-md bg-[var(--t-accent)]/15 px-2.5 py-1 text-xs font-bold text-[var(--t-accent)] transition-colors hover:bg-[var(--t-accent)]/25 disabled:opacity-50"
                >
                  +1
                </button>
                <button
                  onClick={() => ajustar(c.key, -1)}
                  disabled={busyKey === c.key || c.value <= 0}
                  title="Quitar 1 venta de este curso"
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
