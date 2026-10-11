import { useCallback, useEffect, useState } from "react";
import { Boxes, Eye, FileBarChart2, MonitorSmartphone, Pencil, Plus, ScrollText, SlidersHorizontal, Trash2, Download } from "lucide-react";
import { api } from "../services/api.js";
import { roleMeta } from "../data/roles.js";

/**
 * Matriz de Roles y Permisos (dashboard admin).
 *
 * Rediseño: filas agrupadas por módulo (una banda por recurso con sus acciones
 * debajo), cabeceras de rol con color propio y contador de permisos activos, y
 * interruptores coloreados por rol. El comportamiento es el mismo de siempre:
 * los admins alternan permisos en caliente (el backend devuelve la matriz nueva)
 * y el resto solo consulta, con la columna de su rol resaltada.
 *
 * La identidad de cada rol (color e icono) vive en data/roles.js, compartida
 * con el Directorio de Usuarios.
 */

// Icono por módulo (recurso) y por acción, para escanear la matriz de un vistazo.
const RECURSO_ICON = {
  pos: MonitorSmartphone,
  dian: FileBarChart2,
  payments: ScrollText,
};
const ACCION_ICON = {
  view: Eye,
  create: Plus,
  edit: Pencil,
  delete: Trash2,
  download: Download,
  manage: SlidersHorizontal,
};

const estiloRol = roleMeta;

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

  if (!data) {
    return (
      <section className="rounded-xl bg-[var(--t-surface)] p-5">
        <div className="h-6 w-64 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-white/5" />
        <div className="mt-5 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-white/5" />
          ))}
        </div>
      </section>
    );
  }

  const { roles, matrix, labels } = data;
  const resources = Object.keys(matrix);
  const mine = resources.flatMap((res) => Object.keys(matrix[res])
    .filter((a) => (matrix[res][a] || []).includes(myRole))
    .map((a) => `${labels[res]} · ${labels[a] || a}`));

  // Permisos activos por rol (global y por módulo) para los contadores.
  const activos = Object.fromEntries(roles.map((r) => [
    r,
    resources.reduce((n, res) => n + Object.keys(matrix[res]).filter((a) => (matrix[res][a] || []).includes(r)).length, 0),
  ]));
  const totalCeldas = resources.reduce((n, res) => n + Object.keys(matrix[res]).length, 0);

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5">
      {/* ------------------------------ cabecera ------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Matriz de Roles y Permisos</h2>
          <p className="mt-1 text-sm text-[var(--t-muted)]">
            {isAdmin
              ? "Toca un interruptor para activar/desactivar el permiso. Aplica de inmediato en todo el backend."
              : `Tu rol (${myRole}) tiene ${mine.length} permisos asignados. Solo un Administrador puede modificarlos.`}
          </p>
        </div>
        {/* resumen por rol: cuántos permisos tiene cada uno */}
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => {
            const Icon = estiloRol(r).icon;
            return (
              <span key={r} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${estiloRol(r).chip}`}>
                <Icon className="h-3.5 w-3.5" />
                {r}
                <span className="font-mono opacity-80">{activos[r]}/{totalCeldas}</span>
              </span>
            );
          })}
        </div>
      </div>

      {myRole && !isAdmin && mine.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {mine.map((m) => (
            <span key={m} className="rounded-full bg-[var(--t-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--t-accent)]">{m}</span>
          ))}
        </div>
      )}

      {/* ------------------------------ tabla ------------------------------ */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">
                Módulo / Acción
              </th>
              {roles.map((r) => {
                const st = estiloRol(r);
                const Icon = st.icon;
                const own = r === myRole;
                return (
                  <th key={r} className={`sticky top-0 z-10 bg-[var(--t-surface)] px-3 py-2 text-center ${own ? "text-[var(--t-accent)]" : "text-slate-200"}`}>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${own ? "bg-[var(--t-accent-soft)] ring-1 ring-[var(--t-accent)]" : st.chip}`}>
                      <Icon className="h-3.5 w-3.5" /> {r}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {resources.map((res, i) => {
              const acciones = Object.keys(matrix[res]);
              const RecursoIcon = RECURSO_ICON[res] || Boxes;
              const porRol = Object.fromEntries(roles.map((r) => [
                r,
                acciones.filter((a) => (matrix[res][a] || []).includes(r)).length,
              ]));
              return [
                // banda del módulo: icono, nombre y cuántos permisos tiene cada rol
                <tr key={`g-${res}`} className={i % 2 ? "bg-white/[0.02]" : ""}>
                  <td colSpan={roles.length + 1} className="px-1 pb-1 pt-4">
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 ring-1 ring-white/5">
                      <RecursoIcon className="h-4 w-4 text-[var(--t-accent)]" />
                      <span className="text-sm font-bold">{labels[res] || res}</span>
                      <span className="text-xs text-[var(--t-muted)]">{acciones.length} acciones</span>
                      <span className="ml-auto flex gap-1.5">
                        {roles.map((r) => (
                          <span key={r} title={`${r}: ${porRol[r]} de ${acciones.length} acciones permitidas`}
                                className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${porRol[r] === acciones.length ? estiloRol(r).chip : "bg-white/5 text-[var(--t-muted)]"}`}>
                            {porRol[r]}/{acciones.length}
                          </span>
                        ))}
                      </span>
                    </div>
                  </td>
                </tr>,
                ...acciones.map((a) => {
                  const AccionIcon = ACCION_ICON[a] || Eye;
                  return (
                    <tr key={`${res}-${a}`} className="group border-b border-[var(--t-border)]/60 transition-colors hover:bg-white/[0.03]">
                      <td className="py-2 pl-6 pr-3">
                        <span className="inline-flex items-center gap-2 text-[var(--t-text2)]">
                          <AccionIcon className="h-3.5 w-3.5 text-[var(--t-muted)]" />
                          {labels[a] || a}
                        </span>
                      </td>
                      {roles.map((r) => {
                        const on = (matrix[res][a] || []).includes(r);
                        const st = estiloRol(r);
                        const own = r === myRole && !isAdmin;
                        return (
                          <td key={r} className={`px-3 py-2 text-center ${own ? "bg-[var(--t-accent-soft)]" : ""}`}>
                            <button
                              onClick={() => isAdmin && toggle(res, a, r, on)}
                              disabled={!isAdmin}
                              role="switch"
                              aria-checked={on}
                              aria-label={`${labels[res] || res} · ${labels[a] || a} · ${r}: ${on ? "permitido" : "bloqueado"}`}
                              title={on ? "Permitido" + (isAdmin ? " (clic para revocar)" : "") : "Bloqueado" + (isAdmin ? " (clic para otorgar)" : "")}
                              className={`group/sw relative inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors
                                ${on ? st.on : "bg-white/10 ring-1 ring-inset ring-white/15"}
                                ${isAdmin ? `cursor-pointer ${st.ring}` : "cursor-default"}
                                ${own && on ? "ring-2 ring-[var(--t-accent)]/70" : ""}`}
                            >
                              <span
                                className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200
                                  ${on ? "translate-x-4" : "translate-x-0"}
                                  ${isAdmin && !on ? "group-hover/sw:translate-x-0.5" : ""}`}
                              />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
