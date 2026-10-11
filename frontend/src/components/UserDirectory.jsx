import { useCallback, useEffect, useState } from "react";
import { Power, Search, UserRound, Users, X } from "lucide-react";
import { api } from "../services/api.js";
import { roleMeta } from "../data/roles.js";
import Pagination from "./Pagination.jsx";

/**
 * Directorio de Usuarios (admin): buscador + filtros + paginación del servidor,
 * cambio de rol y activación/desactivación en caliente.
 *
 * Mismo acabado que la Matriz RBAC: cabecera con chips de resumen y filtros
 * removibles, tabla con cabecera sticky, avatares con el color del rol y
 * estados de carga/vacío cuidados.
 */

// Iniciales para el avatar (hasta 2 letras, sin tildes ni ñ raras).
const iniciales = (nombre) => (nombre || "?")
  .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

/** Chip de filtro activo, con × para quitarlo. */
function FiltroChip({ etiqueta, valor, onQuitar }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--t-accent-soft)] py-1 pl-3 pr-1.5 text-xs font-semibold text-[var(--t-accent)]">
      {etiqueta}: {valor}
      <button onClick={onQuitar} aria-label={`Quitar filtro ${etiqueta}`}
              className="rounded-full p-0.5 hover:bg-[var(--t-accent)]/20">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function UserDirectory({ token, isAdmin, onError }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.users(token, { q, domain, role, status, page, page_size: pageSize });
      const items = Array.isArray(data) ? data : data.items;
      setUsers(items);
      setTotal(Array.isArray(data) ? items.length : data.total);
      setPages(Array.isArray(data) ? 1 : data.pages);
      if (!Array.isArray(data) && data.page !== page) setPage(data.page);
    } catch (e) {
      onError(e.message.includes("403") ? "Requiere rol Administrador." : e.message);
    } finally {
      setLoading(false);
    }
  }, [token, q, domain, role, status, page, pageSize, onError]);

  useEffect(() => { load(); }, [load]);

  const filter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const quitarFiltro = (setter) => () => {
    setter("");
    setPage(1);
  };

  const limpiarTodo = () => {
    setQ(""); setDomain(""); setRole(""); setStatus("");
    setPage(1);
  };

  const changeRole = async (id, next) => {
    try {
      await api.setRole(token, id, next);
      setUsers((u) => u.map((x) => (x.id === id ? { ...x, role: next } : x)));
    } catch (e) { onError(e.message); }
  };

  const toggleStatus = async (u) => {
    const next = u.status === "active" ? "inactive" : "active";
    try {
      await api.setStatus(token, u.id, next);
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, status: next } : x)));
    } catch (e) { onError(e.message); }
  };

  const input = "rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm text-[var(--t-text)] ring-1 ring-[var(--t-border)] transition focus:outline-none focus:ring-[var(--t-accent)]";
  const filtros = [
    q && <FiltroChip key="q" etiqueta="Búsqueda" valor={q} onQuitar={quitarFiltro(setQ)} />,
    domain && <FiltroChip key="d" etiqueta="Dominio" valor={domain} onQuitar={quitarFiltro(setDomain)} />,
    role && <FiltroChip key="r" etiqueta="Rol" valor={role} onQuitar={quitarFiltro(setRole)} />,
    status && <FiltroChip key="s" etiqueta="Estado" valor={status === "active" ? "Activo" : "Inactivo"} onQuitar={quitarFiltro(setStatus)} />,
  ].filter(Boolean);
  const hayFiltros = filtros.length > 0;

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5">
      {/* ------------------------------ cabecera ------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Directorio de Usuarios</h2>
          <p className="mt-1 text-sm text-[var(--t-muted)]">
            {isAdmin
              ? "Busca, filtra y cambia el rol o el estado de cada usuario. Los cambios aplican de inmediato."
              : "Consulta los usuarios registrados en la plataforma."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--t-accent)] bg-[var(--t-accent-soft)] ring-1 ring-[var(--t-accent)]/30">
            <Users className="h-3.5 w-3.5" />
            <span className="font-mono">{total}</span> registros
          </span>
          {hayFiltros && (
            <button onClick={limpiarTodo}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--t-muted)] ring-1 ring-[var(--t-border)] transition hover:text-[var(--t-text)] hover:ring-[var(--t-accent)]">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {hayFiltros && <div className="mt-3 flex flex-wrap items-center gap-2">{filtros}</div>}

      {/* ------------------------------ filtros ------------------------------ */}
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <label className="relative md:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--t-muted)]" />
          <input value={q} onChange={filter(setQ)} placeholder="Buscar nombre o correo…"
                 className={`${input} w-full pl-9`} />
        </label>
        <input value={domain} onChange={filter(setDomain)} placeholder="Dominio: cytech.com"
               className={input} />
        <select value={role} onChange={filter(setRole)} className={input}>
          <option value="">Rol: todos</option>
          <option value="admin">admin</option>
          <option value="editor">editor</option>
          <option value="client">client</option>
        </select>
        <select value={status} onChange={filter(setStatus)} className={input}>
          <option value="">Estado: todos</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </div>

      {/* ------------------------------ tabla ------------------------------ */}
      <div className="mt-4 overflow-x-auto">
        {loading && users.length === 0 ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : (
          <table className={`w-full text-sm transition-opacity ${loading ? "opacity-60" : ""}`}>
            <thead>
              <tr className="text-left">
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Usuario</th>
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Correo</th>
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">IdP</th>
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Rol</th>
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Estado</th>
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Primer login</th>
                <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 pr-3 text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Último login</th>
                {isAdmin && (
                  <th className="sticky top-0 z-10 bg-[var(--t-surface)] py-2 text-right text-xs font-bold uppercase tracking-wider text-[var(--t-muted)]">Acción</th>
                )}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const meta = roleMeta(u.role);
                const IconRol = meta.icon;
                const activo = u.status === "active";
                return (
                  <tr key={u.id} className="border-b border-[var(--t-border)]/60 transition-colors hover:bg-white/[0.03]">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2.5">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${meta.avatar}`}>
                          {iniciales(u.name)}
                        </span>
                        <span className="font-semibold text-[var(--t-text)]">{u.name}</span>
                      </span>
                    </td>
                    <td className="max-w-[15rem] truncate pr-3 text-[var(--t-text2)]" title={u.email}>{u.email}</td>
                    <td className="pr-3">
                      <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs capitalize text-[var(--t-text2)] ring-1 ring-white/10">{u.provider}</span>
                    </td>
                    <td className="pr-3">
                      {isAdmin ? (
                        <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}
                                aria-label={`Rol de ${u.name}`}
                                className={`rounded-lg px-2 py-1 text-xs font-semibold capitalize ${meta.chip}`}>
                          <option value="admin">admin</option>
                          <option value="editor">editor</option>
                          <option value="client">client</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${meta.chip}`}>
                          <IconRol className="h-3.5 w-3.5" /> {u.role}
                        </span>
                      )}
                    </td>
                    <td className="pr-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${activo ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${activo ? "bg-emerald-400" : "bg-red-400"}`} />
                        {activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="pr-3 text-xs tabular-nums text-[var(--t-muted)]">{new Date(u.created_at).toLocaleString()}</td>
                    <td className="pr-3 text-xs tabular-nums text-[var(--t-muted)]">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 text-right">
                        <button onClick={() => toggleStatus(u)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold ring-1 ring-[var(--t-border)] transition hover:ring-2 ${activo ? "text-red-300 hover:ring-red-400/60" : "text-emerald-300 hover:ring-emerald-400/60"}`}>
                          <Power className="h-3.5 w-3.5" />
                          {activo ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="py-10 text-center">
                    <UserRound className="mx-auto h-6 w-6 text-[var(--t-muted)]" />
                    <p className="mt-2 text-sm text-[var(--t-muted)]">
                      {hayFiltros ? "Ningún usuario coincide con los filtros actuales." : "Aún no hay usuarios registrados."}
                    </p>
                    {hayFiltros && (
                      <button onClick={limpiarTodo}
                              className="mt-3 rounded-full bg-[var(--t-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--t-accent)] ring-1 ring-[var(--t-accent)]/30 hover:bg-[var(--t-accent)]/20">
                        Limpiar filtros
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} pages={pages} total={total} pageSize={pageSize}
                  onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
    </section>
  );
}
