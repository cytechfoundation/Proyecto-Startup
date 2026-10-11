import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";

/** Matriz de Roles y Permisos: interruptores funcionales (admin) o lectura. */
export default function RbacMatrix({ token, isAdmin, myRole, onError }) {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api.rbac(token));
    } catch (e) {
      onError(e.message);
    }
  }, [token, onError]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (resource, action, role, allowed) => {
    try {
      setData(await api.setPermission(token, { resource, action, role, allowed: !allowed }));
    } catch (e) {
      onError(e.message);
    }
  };

  if (!data) return <p className="text-sm text-[var(--t-muted)]">Cargando matriz…</p>;
  const { roles, matrix, labels } = data;
  const resources = Object.keys(matrix);
  const actions = [...new Set(resources.flatMap((r) => Object.keys(matrix[r])))];
  const mine = resources.flatMap((res) => actions
    .filter((a) => matrix[res][a])
    .filter((a) => (matrix[res][a] || []).includes(myRole))
    .map((a) => `${labels[res]} · ${labels[a] || a}`));

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5">
      <h2 className="text-xl font-bold">Matriz de Roles y Permisos</h2>
      <p className="mt-1 text-sm text-[var(--t-muted)]">
        {isAdmin
          ? "Toca un interruptor para activar/desactivar el permiso. Aplica de inmediato en todo el backend."
          : `Tu rol (${myRole}) tiene ${mine.length} permisos asignados, resaltados en cyan. Solo un Administrador puede modificarlos.`}
      </p>
      {myRole && !isAdmin && mine.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {mine.map((m) => (
            <span key={m} className="rounded-full bg-[var(--t-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--t-accent)]">{m}</span>
          ))}
        </div>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="py-2 text-left text-[var(--t-muted)]">Contenido / Acción</th>
              {roles.map((r) => (
                <th key={r} className={`px-3 py-2 text-center capitalize ${r === myRole ? "rounded-t-lg bg-[var(--t-accent-soft)] text-[var(--t-accent)]" : "text-slate-200"}`}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((res) => (
              actions.filter((a) => matrix[res][a]).map((a) => (
                <tr key={`${res}-${a}`} className="border-t border-[var(--t-border)]">
                  <td className="py-2 pr-3">
                    <span className="text-[var(--t-muted)]">{labels[res]} · </span>
                    <span className="font-semibold">{labels[a] || a}</span>
                  </td>
                  {roles.map((r) => {
                    const on = (matrix[res][a] || []).includes(r);
                    const hl = r === myRole && !isAdmin;
                    return (
                      <td key={r} className={`px-3 py-2 text-center ${hl ? "bg-[var(--t-accent-soft)]" : ""}`}>
                        <button
                          onClick={() => isAdmin && toggle(res, a, r, on)}
                          disabled={!isAdmin}
                          title={on ? "Permitido" + (isAdmin ? " (clic para revocar)" : "") : "Bloqueado" + (isAdmin ? " (clic para otorgar)" : "")}
                          className={`inline-block h-5 w-9 rounded-full p-0.5 transition-colors ${on ? "bg-[var(--t-accent)]" : "bg-slate-700"} ${isAdmin ? "cursor-pointer hover:ring-2 hover:ring-[var(--t-accent)]" : "cursor-default"} ${hl && on ? "ring-1 ring-[var(--t-accent)]" : ""}`}
                        >
                          <span className={`block h-4 w-4 rounded-full bg-white transition-all ${on ? "ml-4" : "ml-0"}`} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
