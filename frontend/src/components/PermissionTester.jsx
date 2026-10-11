import { useState } from "react";
import { api } from "../services/api.js";

/** Motor de Contenidos: prueba en vivo qué permite tu rol (paso 1+2). */
const probes = [
  { label: "Ver POS", run: api.content.pos },
  { label: "Crear ruta POS (solo admin)", run: api.content.createPos },
  { label: "Ver DIAN", run: api.content.dian },
  { label: "Crear reporte DIAN (admin/editor)", run: api.content.createDian },
  { label: "Eliminar reporte (solo admin)", run: api.content.deleteDian },
  { label: "Ver pagos", run: api.content.payments },
  { label: "Reembolsar (solo admin)", run: api.content.refund },
  { label: "Crear orden PayPal $25 (solo admin)", run: (t) => api.paypalCreateOrder(t, { amount: "25.00" }) },
  { label: "Transaction Search (admin/editor)", run: (t) => api.paypalSearch(t, "2025-01-01T00:00:00Z", "2025-01-31T23:59:59Z") },
];

export default function PermissionTester({ token, role }) {
  const [results, setResults] = useState({});

  const run = async (p) => {
    try {
      const data = await p.run(token);
      setResults((r) => ({ ...r, [p.label]: { ok: true, detail: JSON.stringify(data) } }));
    } catch (e) {
      setResults((r) => ({ ...r, [p.label]: { ok: false, detail: e.message } }));
    }
  };

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5">
      <h2 className="text-xl font-bold">Motor de Contenidos — probador</h2>
      <p className="mt-1 text-sm text-[var(--t-muted)]">
        Tu rol actual: <b className="text-white">{role}</b>. Cada botón ejecuta identificación federada + autorización por matriz.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {probes.map((p) => (
          <button key={p.label} onClick={() => run(p)}
                  className="rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] transition-all hover:ring-[var(--t-accent)]">
            {p.label}
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {Object.entries(results).map(([label, r]) => (
          <li key={label} className={`rounded-lg p-3 ${r.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
            <b>{r.ok ? "✅" : "⛔"} {label}:</b> <span className="break-all">{r.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
