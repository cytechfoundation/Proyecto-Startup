import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive, Ban, BadgeCheck, CircleDollarSign, FilePlus2, History, Landmark, Loader2, Plus, Send, Stamp, X,
} from "lucide-react";
import { api } from "../services/api.js";

/** Chips de estado de la hoja de vida RADIAN (misma línea que el dashboard). */
const STATUS = {
  emitida: ["Emitida", "bg-amber-500/15 text-amber-400"],
  validada: ["Validada DIAN", "bg-sky-500/15 text-sky-400"],
  aceptada: ["Aceptada", "bg-emerald-500/15 text-emerald-400"],
  endosada: ["Endosada", "bg-violet-500/15 text-violet-400"],
  rechazada: ["Rechazada", "bg-rose-500/15 text-rose-400"],
  pagada: ["Pagada", "bg-teal-500/15 text-teal-400"],
  anulada: ["Anulada", "bg-slate-500/15 text-slate-300"],
};

const EVENT_LABELS = {
  emision: "Emisión del título",
  validacion: "Validación DIAN",
  aceptacion_expresa: "Aceptación expresa",
  aceptacion_tacita: "Aceptación tácita",
  rechazo: "Rechazo del adquirente",
  endoso: "Endoso (circulación)",
  pago: "Pago",
  anulacion: "Anulación",
};

/** Espejo de la máquina de estados del backend (solo para poblar el formulario). */
const TRANSITIONS = {
  emitida: { validacion: "validada", anulacion: "anulada" },
  validada: { aceptacion_expresa: "aceptada", aceptacion_tacita: "aceptada", rechazo: "rechazada", anulacion: "anulada" },
  aceptada: { endoso: "endosada", pago: "pagada", anulacion: "anulada" },
  endosada: { pago: "pagada", anulacion: "anulada" },
  rechazada: {},
  pagada: {},
  anulada: {},
};

const EVENT_ICONS = {
  emision: Stamp, validacion: BadgeCheck, aceptacion_expresa: BadgeCheck, aceptacion_tacita: BadgeCheck,
  rechazo: Ban, endoso: Send, pago: CircleDollarSign, anulacion: Archive,
};

const fmtMoney = (cents, currency) => {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: currency || "COP" })
      .format((Number(cents) || 0) / 100);
  } catch {
    return `${((Number(cents) || 0) / 100).toFixed(2)} ${currency || ""}`.trim();
  }
};

const fmtDate = (d) => {
  if (!d) return "—";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? String(d) : t.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
};

const shortCufe = (c) => (c ? `${c.slice(0, 10)}…${c.slice(-6)}` : "—");

const input =
  "w-full rounded-lg bg-[var(--t-surface2)] px-3 py-2.5 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-[var(--t-accent)]";

const chipCls = (estado) => STATUS[estado] || [estado, "bg-slate-500/15 text-slate-300"];

/**
 * Sección «RADIAN» de Mi cuenta: registro, consulta y trazabilidad de las
 * Facturas Electrónicas de Venta como Título Valor (hoja de vida de eventos).
 */
export default function RadianPanel({ token, user }) {
  const canManage = user?.role === "admin" || user?.role === "editor";
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [filtro, setFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ numero: "", nit_emisor: "", nit_adquirente: "", valor: "" });
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [hoja, setHoja] = useState(null); // {record, eventos}
  const [evento, setEvento] = useState(null); // record sobre el que se registra un evento
  const [evForm, setEvForm] = useState({ tipo: "", detalle: "", monto: "", endosatario_nit: "" });
  const [evErr, setEvErr] = useState("");
  const [evSaving, setEvSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.radianRecords(token, {
        page_size: 50, estado: filtro || undefined, q: busqueda.trim() || undefined,
        all: isAdmin ? "true" : undefined,
      });
      setItems(data.items || []);
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, filtro, busqueda, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => items.reduce((acc, r) => {
    acc[r.estado] = (acc[r.estado] || 0) + 1;
    return acc;
  }, {}), [items]);

  const submit = async (e) => {
    e.preventDefault();
    setFormErr("");
    setSaving(true);
    try {
      await api.radianRecordCreate(token, {
        numero: form.numero.trim(),
        nit_emisor: form.nit_emisor.trim(),
        nit_adquirente: form.nit_adquirente.trim(),
        valor_total: Math.round((Number(form.valor) || 0) * 100), // pesos → centavos
        moneda: "COP",
      });
      setNotice(`Factura ${form.numero.trim()} registrada como Título Valor en RADIAN.`);
      setModal(false);
      setForm({ numero: "", nit_emisor: "", nit_adquirente: "", valor: "" });
      await load();
    } catch (e2) {
      setFormErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const abrirHoja = async (record) => {
    setBusy(`hoja:${record.id}`);
    try {
      const detail = await api.radianRecordDetail(token, record.id);
      setHoja(detail);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const abrirEvento = (record) => {
    const permitidos = Object.keys(TRANSITIONS[record.estado] || {});
    setEvento(record);
    setEvForm({ tipo: permitidos[0] || "", detalle: "", monto: "", endosatario_nit: "" });
    setEvErr("");
  };

  const submitEvento = async (e) => {
    e.preventDefault();
    setEvErr("");
    setEvSaving(true);
    try {
      await api.radianEventCreate(token, evento.id, {
        tipo: evForm.tipo,
        detalle: evForm.detalle.trim() || null,
        ...(evForm.monto !== "" ? { monto_cents: Math.round(Number(evForm.monto) * 100) } : {}),
        ...(evForm.tipo === "endoso" ? { endosatario_nit: evForm.endosatario_nit.trim() } : {}),
      });
      setNotice(`Evento «${EVENT_LABELS[evForm.tipo] || evForm.tipo}» registrado en la hoja de vida.`);
      setEvento(null);
      await load();
    } catch (e2) {
      setEvErr(e2.message);
    } finally {
      setEvSaving(false);
    }
  };

  const valid =
    form.numero.trim() && form.nit_emisor.trim().length >= 5 &&
    form.nit_adquirente.trim().length >= 5 && Number(form.valor) > 0 &&
    form.nit_emisor.trim() !== form.nit_adquirente.trim();

  const btnIcon =
    "grid h-7 w-7 place-items-center rounded-lg text-[var(--t-muted)] transition-colors hover:bg-[var(--t-surface2)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="rounded-xl bg-[var(--t-surface)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Landmark className="h-5 w-5 text-[var(--t-accent)]" /> RADIAN · Títulos valor
          </h2>
          <p className="mt-1 text-sm text-[var(--t-muted)]">
            Registro y trazabilidad de las Facturas Electrónicas de Venta (FEV): hoja de vida de
            emisión, validación, aceptación, endoso, pago y anulación.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => { setFormErr(""); setModal(true); }}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-4 py-2 text-sm font-semibold shadow-lg shadow-black/50 transition-all hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" /> Registrar FEV
          </button>
        )}
      </div>

      {notice && <p className="mt-3 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</p>}
      {err && <p className="mt-3 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{err}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-auto rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-[var(--t-accent)]"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por CUFE o número…"
          className="w-56 rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-[var(--t-accent)]"
        />
        {Object.entries(counts).slice(0, 5).map(([estado, n]) => {
          const [label, tone] = chipCls(estado);
          return (
            <span key={estado} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
              {n} {label.toLowerCase()}
            </span>
          );
        })}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-label="Cargando facturas RADIAN">
          {[0, 1, 2].map((k) => (
            <div key={k} className="h-10 animate-pulse rounded-lg bg-[var(--t-surface2)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--t-border)] p-8 text-center">
          <Stamp className="mx-auto h-8 w-8 text-[var(--t-muted)]" />
          <p className="mt-2 text-sm font-semibold">Sin facturas registradas en RADIAN</p>
          <p className="mt-1 text-sm text-[var(--t-muted)]">
            {canManage
              ? "Registra la primera FEV como Título Valor y sigue su hoja de vida."
              : "Aún no se han registrado facturas a tu nombre."}
          </p>
          {canManage && (
            <button
              onClick={() => { setFormErr(""); setModal(true); }}
              className="mt-4 rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-5 py-2 text-sm font-semibold shadow-lg shadow-black/50 transition-all hover:scale-[1.02]"
            >
              Registrar la primera FEV
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--t-surface)] text-left text-xs uppercase tracking-wide text-[var(--t-muted)]">
              <tr>
                <th className="py-2 pr-3">Factura</th>
                <th className="py-2 pr-3">Adquirente</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">CUFE</th>
                <th className="py-2 pr-3">Registrada</th>
                <th className="py-2 pr-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((rec) => {
                const [label, tone] = chipCls(rec.estado);
                const permitidos = Object.keys(TRANSITIONS[rec.estado] || {});
                return (
                  <tr key={rec.id} className="border-t border-[var(--t-border)] transition-colors hover:bg-[var(--t-surface2)]/50">
                    <td className="py-2.5 pr-3 font-semibold">{rec.numero}</td>
                    <td className="py-2.5 pr-3">{rec.nit_adquirente}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">{fmtMoney(rec.valor_total, rec.moneda)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                      {rec.endosatario_nit && (
                        <span className="ml-1 text-xs text-[var(--t-muted)]" title="Endosatario">→ {rec.endosatario_nit}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-[var(--t-muted)]" title={rec.cufe}>{shortCufe(rec.cufe)}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-[var(--t-muted)]">{fmtDate(rec.created_at)}</td>
                    <td className="py-2.5 pr-1">
                      <div className="flex items-center justify-end gap-1">
                        <button className={btnIcon} title="Ver hoja de vida"
                                disabled={busy === `hoja:${rec.id}`}
                                onClick={() => abrirHoja(rec)}>
                          {busy === `hoja:${rec.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                        </button>
                        {canManage && permitidos.length > 0 && (
                          <button className={btnIcon} title={`Registrar evento (${permitidos.length} permitido${permitidos.length > 1 ? "s" : ""})`}
                                  onClick={() => abrirEvento(rec)}>
                            <FilePlus2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-[var(--t-muted)]">
        La validación final con la DIAN exige proveedor tecnológico autorizado; en este entorno el
        CUFE es determinista (modo simulado) y la hoja de vida es completa.
      </p>

      {/* -------------------- modal: nueva FEV -------------------- */}
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <form onSubmit={submit}
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[var(--t-surface)] p-5 ring-1 ring-[var(--t-border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Registrar FEV como Título Valor</h3>
              <button type="button" onClick={() => setModal(false)} title="Cerrar"
                      className="grid h-8 w-8 place-items-center rounded-lg text-[var(--t-muted)] hover:bg-[var(--t-surface2)] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 text-sm">
              <label className="text-sm">Número de la factura de venta *
                <input required value={form.numero}
                       onChange={(e) => setForm({ ...form, numero: e.target.value })}
                       placeholder="FV-1001" className={`${input} mt-1`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">NIT emisor *
                  <input required minLength={5} value={form.nit_emisor}
                         onChange={(e) => setForm({ ...form, nit_emisor: e.target.value })}
                         placeholder="900999888-1" className={`${input} mt-1`} />
                </label>
                <label className="text-sm">NIT adquirente *
                  <input required minLength={5} value={form.nit_adquirente}
                         onChange={(e) => setForm({ ...form, nit_adquirente: e.target.value })}
                         placeholder="900111222-3" className={`${input} mt-1`} />
                </label>
              </div>
              <label className="text-sm">Valor total (COP) *
                <input required type="number" min="1" step="0.01" value={form.valor}
                       onChange={(e) => setForm({ ...form, valor: e.target.value })}
                       placeholder="1500000" className={`${input} mt-1`} />
              </label>
              <p className="text-xs text-[var(--t-muted)]">
                Al registrar se genera el CUFE y se abre la hoja de vida con el evento de emisión.
              </p>
            </div>

            {formErr && <p className="mt-3 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">{formErr}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(false)}
                      className="rounded-lg px-4 py-2 text-sm text-[var(--t-muted)] hover:text-white">
                Cancelar
              </button>
              <button type="submit" disabled={!valid || saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-5 py-2 text-sm font-semibold shadow-lg shadow-black/50 transition-all hover:scale-[1.02] disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar y emitir
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- modal: hoja de vida -------------------- */}
      {hoja && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
             onClick={() => setHoja(null)} role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-[var(--t-surface)] p-5 ring-1 ring-[var(--t-border)]"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Hoja de vida · {hoja.numero}</h3>
                <p className="mt-0.5 font-mono text-xs text-[var(--t-muted)]" title={hoja.cufe}>CUFE {hoja.cufe}</p>
              </div>
              <button onClick={() => setHoja(null)} title="Cerrar"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--t-muted)] hover:bg-[var(--t-surface2)] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--t-muted)]">
              <span>{fmtMoney(hoja.valor_total, hoja.moneda)}</span>
              <span>·</span>
              <span>Emisor {hoja.nit_emisor}</span>
              <span>→</span>
              <span>Adquirente {hoja.nit_adquirente}</span>
              {hoja.endosatario_nit && (<><span>·</span><span>Endosatario {hoja.endosatario_nit}</span></>)}
            </div>

            <ol className="mt-4 space-y-3">
              {hoja.eventos.map((ev) => {
                const Icon = EVENT_ICONS[ev.tipo] || History;
                const [label, tone] = chipCls(ev.estado_resultante);
                return (
                  <li key={ev.id} className="flex gap-3">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--t-surface2)] text-[var(--t-accent)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {EVENT_LABELS[ev.tipo] || ev.tipo}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                      </p>
                      {ev.detalle && <p className="mt-0.5 text-xs text-[var(--t-muted)]">{ev.detalle}</p>}
                      <p className="mt-0.5 text-xs text-[var(--t-muted)]">
                        {fmtDate(ev.created_at)} · {ev.actor}
                        {ev.monto_cents != null && <> · {fmtMoney(ev.monto_cents, hoja.moneda)}</>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {/* -------------------- modal: registrar evento -------------------- */}
      {evento && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <form onSubmit={submitEvento}
                className="w-full max-w-md rounded-xl bg-[var(--t-surface)] p-5 ring-1 ring-[var(--t-border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Registrar evento · {evento.numero}</h3>
              <button type="button" onClick={() => setEvento(null)} title="Cerrar"
                      className="grid h-8 w-8 place-items-center rounded-lg text-[var(--t-muted)] hover:bg-[var(--t-surface2)] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 text-sm">
              <label className="text-sm">Evento
                <select value={evForm.tipo} onChange={(e) => setEvForm({ ...evForm, tipo: e.target.value })}
                        className={`${input} mt-1`}>
                  {Object.keys(TRANSITIONS[evento.estado] || {}).map((t) => (
                    <option key={t} value={t}>{EVENT_LABELS[t] || t}</option>
                  ))}
                </select>
              </label>
              {evForm.tipo === "endoso" && (
                <label className="text-sm">NIT del endosatario *
                  <input required value={evForm.endosatario_nit}
                         onChange={(e) => setEvForm({ ...evForm, endosatario_nit: e.target.value })}
                         placeholder="800555123-4" className={`${input} mt-1`} />
                </label>
              )}
              {evForm.tipo === "pago" && (
                <label className="text-sm">Monto pagado (COP, opcional)
                  <input type="number" min="0" step="0.01" value={evForm.monto}
                         onChange={(e) => setEvForm({ ...evForm, monto: e.target.value })}
                         placeholder={String(Math.round(evento.valor_total / 100))} className={`${input} mt-1`} />
                </label>
              )}
              <label className="text-sm">Detalle (opcional)
                <textarea rows="2" value={evForm.detalle}
                          onChange={(e) => setEvForm({ ...evForm, detalle: e.target.value })}
                          placeholder="Referencia, observaciones…" className={`${input} mt-1 resize-none`} />
              </label>
              <p className="text-xs text-[var(--t-muted)]">
                Estado actual: <b>{chipCls(evento.estado)[0]}</b>. Tras registrar, la factura quedará en
                su nuevo estado y el evento se suma a la hoja de vida.
              </p>
            </div>

            {evErr && <p className="mt-3 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">{evErr}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEvento(null)}
                      className="rounded-lg px-4 py-2 text-sm text-[var(--t-muted)] hover:text-white">
                Cancelar
              </button>
              <button type="submit" disabled={!evForm.tipo || evSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-5 py-2 text-sm font-semibold shadow-lg shadow-black/50 transition-all hover:scale-[1.02] disabled:opacity-50">
                {evSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar evento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
