import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";
import Pagination from "./Pagination.jsx";

/** Donaciones recibidas (solo admin): lista paginada de aportes registrados. */
export default function DonationList({ token, onError }) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    try {
      const data = await api.donations(token, { page, page_size: pageSize });
      const items = Array.isArray(data) ? data : data.items;
      setRows(items);
      setTotal(Array.isArray(data) ? items.length : data.total);
      setPages(Array.isArray(data) ? 1 : data.pages);
      if (!Array.isArray(data) && data.page !== page) setPage(data.page);
    } catch (e) {
      onError(e.message);
    }
  }, [token, page, pageSize, onError]);

  useEffect(() => { load(); }, [load]);

  const sum = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Donaciones recibidas</h2>
        <span className="text-sm text-[var(--t-muted)]">
          {total} aportes · <b className="text-amber-300">$ {sum.toLocaleString("es-CO")}</b> en página
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--t-muted)]">Aún no hay aportes registrados.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-[var(--t-muted)]">
            <tr><th>Nombre</th><th>Correo</th><th>Causa</th><th>Monto</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--t-border)]">
                <td className="py-2 pr-3">{r.name}</td>
                <td className="pr-3">{r.email}</td>
                <td className="pr-3 capitalize">{r.cause}</td>
                <td className="pr-3 font-semibold text-amber-300">$ {r.amount.toLocaleString("es-CO")}</td>
                <td className="text-[var(--t-muted)]">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pagination page={page} pages={pages} total={total} pageSize={pageSize}
                  onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} label="aportes" />
    </section>
  );
}
