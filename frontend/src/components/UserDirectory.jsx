import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../services/api.js";
import Pagination from "./Pagination.jsx";

/** Directorio de Usuarios: buscador + filtros + paginación del servidor. */
export default function UserDirectory({ token, isAdmin, onError }) {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    try {
      const data = await api.users(token, { q, domain, role, status, page, page_size: pageSize });
      const items = Array.isArray(data) ? data : data.items;
      setUsers(items);
      setTotal(Array.isArray(data) ? items.length : data.total);
      setPages(Array.isArray(data) ? 1 : data.pages);
      if (!Array.isArray(data) && data.page !== page) setPage(data.page);
    } catch (e) {
      onError(e.message.includes("403") ? "Requiere rol Administrador." : e.message);
    }
  }, [token, q, domain, role, status, page, pageSize, onError]);

  useEffect(() => { load(); }, [load]);

  const filter = (setter) => (e) => {
    setter(e.target.value);
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

  const input = "rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-[var(--t-accent)]";

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Directorio de Usuarios</h2>
        <span className="text-sm text-[var(--t-muted)]">{total} registros</span>
      </div>

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

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--t-muted)]">
            <tr><th className="py-2">Nombre</th><th>Correo</th><th>IdP</th><th>Rol</th><th>Estado</th><th>Primer login</th><th>Último login</th>{isAdmin && <th>Acción</th>}</tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[var(--t-border)]">
                <td className="py-2 pr-3">{u.name}</td>
                <td className="pr-3">{u.email}</td>
                <td className="pr-3 capitalize">{u.provider}</td>
                <td className="pr-3">
                  {isAdmin ? (
                    <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}
                            className="rounded bg-[var(--t-surface2)] px-2 py-1">
                      <option value="admin">admin</option>
                      <option value="editor">editor</option>
                      <option value="client">client</option>
                    </select>
                  ) : u.role}
                </td>
                <td className="pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                    {u.status === "active" ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="pr-3 text-[var(--t-muted)]">{new Date(u.created_at).toLocaleString()}</td>
                <td className="pr-3 text-[var(--t-muted)]">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}</td>
                {isAdmin && (
                  <td>
                    <button onClick={() => toggleStatus(u)}
                            className="rounded-lg bg-[var(--t-surface2)] px-3 py-1 text-xs ring-1 ring-[var(--t-border)] hover:ring-[var(--t-accent)]">
                      {u.status === "active" ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pages={pages} total={total} pageSize={pageSize}
                  onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
    </section>
  );
}
