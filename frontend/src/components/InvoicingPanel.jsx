import { useCallback, useEffect, useState } from "react";
import {
  BellRing, Copy, ExternalLink, Link2, Loader2, Plus, QrCode, Receipt, Send, Trash2, X, XCircle,
} from "lucide-react";
import { api } from "../services/api.js";

/** Chips de estado de PayPal Invoicing con color propio (misma línea que el dashboard). */
const STATUS = {
  draft: ["Borrador", "bg-slate-500/15 text-slate-300"],
  sent: ["Enviada", "bg-sky-500/15 text-sky-400"],
  payment_pending: ["Pendiente de pago", "bg-sky-500/15 text-sky-400"],
  partially_paid: ["Pago parcial", "bg-amber-500/15 text-amber-400"],
  marked_as_paid: ["Pagada", "bg-emerald-500/15 text-emerald-400"],
  paid: ["Pagada", "bg-emerald-500/15 text-emerald-400"],
  cancelled: ["Cancelada", "bg-rose-500/15 text-rose-400"],
  marked_as_refunded: ["Reembolsada", "bg-violet-500/15 text-violet-400"],
  partially_refunded: ["Reembolso parcial", "bg-violet-500/15 text-violet-400"],
  refunded: ["Reembolsada", "bg-violet-500/15 text-violet-400"],
};

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "MXN", "BRL"];

const invId = (i) => i.id || i.invoice_id || "";
const invNumber = (i) => i.invoice_number || invId(i);
const invRecipient = (i) => i.primary_recipients?.[0]?.email_address || "—";
const invAmount = (i) => i.amount?.value ?? i.amount_due?.value ?? i.total_amount?.value ?? null;
const invCurrency = (i) => i.amount?.currency_code || i.currency_code || "USD";
const invDate = (i) => i.issue_date || i.date_info?.issue_date || i.created_at || "";
const invStatus = (i) => String(i.status || "draft").toLowerCase();

const today = () => new Date().toISOString().slice(0, 10);

const money = (value, currency) => {
  if (value == null || value === "") return "—";
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: currency || "USD" })
      .format(Number(value));
  } catch {
    return `${value} ${currency || ""}`.trim();
  }
};

const fmtDate = (d) => {
  if (!d) return "—";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? String(d) : t.toLocaleDateString("es-CO");
};

const blankForm = () => ({
  email: "",
  customer_name: "",
  currency: "USD",
  note: "",
  issue_date: today(),
  send: true,
  send_email: true,
  tax_percent: "",
  items: [{ name: "", quantity: 1, unit_amount: "" }],
});

const input =
  "w-full rounded-lg bg-[var(--t-surface2)] px-3 py-2.5 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-[var(--t-accent)]";

/**
 * Sección «Mis facturas» de Mi cuenta: proxy de PayPal Invoicing.
 * Listado con chips de estado, página de pago hospedada (link/QR),
 * recordatorios, cancelación y alta de facturas (admin).
 */
export default function InvoicingPanel({ token, user, onConnect }) {
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(""); // `${id}:${accion}`
  const [urls, setUrls] = useState({}); // id → enlace de pago hospedado
  const [reminded, setReminded] = useState({});
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState(null); // {image, url}

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.invoices(token, { page_size: 20 });
      setItems(data.invoices || []);
      setOffline(false);
      setErr("");
    } catch (e) {
      if (/503|no configurado/i.test(e.message)) setOffline(true);
      else setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const run = async (key, fn) => {
    setBusy(key);
    setErr("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const payUrlOf = async (inv) => {
    const id = invId(inv);
    if (urls[id]) return urls[id];
    const d = await api.invoiceDetail(token, id);
    const url = d.pay_url || "";
    setUrls((u) => ({ ...u, [id]: url }));
    if (!url) throw new Error("PayPal no devolvió enlace de pago para esta factura.");
    return url;
  };

  const copyLink = (inv) =>
    run(`${invId(inv)}:copy`, async () => {
      const url = await payUrlOf(inv);
      await navigator.clipboard.writeText(url);
      setNotice("Enlace de pago copiado al portapapeles.");
    });

  const openLink = (inv) =>
    run(`${invId(inv)}:open`, async () => window.open(await payUrlOf(inv), "_blank"));

  const showQr = (inv) =>
    run(`${invId(inv)}:qr`, async () => {
      const d = await api.invoiceQr(token, invId(inv));
      if (!d.image) throw new Error("PayPal no generó el QR (la factura debe estar enviada).");
      setQr({ id: invId(inv), image: d.image, url: d.pay_url || "" });
    });

  const sendNow = (inv) =>
    run(`${invId(inv)}:send`, async () => {
      await api.invoiceSend(token, invId(inv), true);
      setNotice(`Factura ${invNumber(inv)} enviada al cliente.`);
      await load();
    });

  const remind = (inv) =>
    run(`${invId(inv)}:remind`, async () => {
      await api.invoiceReminder(token, invId(inv));
      setReminded((r) => ({ ...r, [invId(inv)]: true }));
      setNotice(`Recordatorio enviado para ${invNumber(inv)} (PayPal permite 2/día).`);
      await load();
    });

  const cancel = (inv) => {
    if (!window.confirm(`¿Cancelar la factura ${invNumber(inv)}? Esta acción no se puede deshacer.`)) return;
    return run(`${invId(inv)}:cancel`, async () => {
      await api.invoiceCancel(token, invId(inv));
      setNotice(`Factura ${invNumber(inv)} cancelada.`);
      await load();
    });
  };

  const setItem = (idx, patch) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  const submit = async (e) => {
    e.preventDefault();
    setFormErr("");
    setSaving(true);
    try {
      const out = await api.invoiceCreate(token, {
        email: form.email.trim(),
        customer_name: form.customer_name.trim(),
        currency: form.currency,
        note: form.note.trim(),
        issue_date: form.issue_date || today(),
        send: form.send,
        send_email: form.send_email,
        items: form.items.map((it) => ({
          name: it.name.trim(),
          quantity: Number(it.quantity) || 1,
          unit_amount: (Number(it.unit_amount) || 0).toFixed(2),
          ...(form.tax_percent ? { tax_percent: String(form.tax_percent) } : {}),
        })),
      });
      setNotice(
        `Factura ${out.invoice_id || ""} ${form.send ? "creada y enviada" : "guardada como borrador"}.`
      );
      setModal(false);
      setForm(blankForm());
      await load();
    } catch (e2) {
      setFormErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const total = form.items.reduce(
    (s, it) =>
      s + (Number(it.quantity) || 0) * (Number(it.unit_amount) || 0) *
        (1 + (Number(form.tax_percent) || 0) / 100),
    0
  );
  const valid =
    form.email.includes("@") &&
    form.items.every((it) => it.name.trim() && Number(it.unit_amount) > 0);

  const counts = items.reduce((acc, i) => {
    const s = invStatus(i);
    if (s === "draft") acc.draft += 1;
    else if (s === "sent" || s === "payment_pending") acc.sent += 1;
    else if (s === "marked_as_paid" || s === "paid") acc.paid += 1;
    else if (s === "partially_paid") acc.partial += 1;
    else if (s === "cancelled") acc.cancelled += 1;
    return acc;
  }, { draft: 0, sent: 0, paid: 0, partial: 0, cancelled: 0 });

  const chip = (label, value, tone) =>
    value > 0 && (
      <span key={label} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
        {value} {label}
      </span>
    );

  const btn =
    "grid h-7 w-7 place-items-center rounded-lg text-[var(--t-muted)] transition-colors hover:bg-[var(--t-surface2)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="rounded-xl bg-[var(--t-surface)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Mis facturas</h2>
          <p className="mt-1 text-sm text-[var(--t-muted)]">
            PayPal Invoicing · página de pago hospedada, recordatorios y estados en vivo.
          </p>
        </div>
        {isAdmin && !offline && (
          <button
            onClick={() => { setForm(blankForm()); setFormErr(""); setModal(true); }}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-4 py-2 text-sm font-semibold shadow-lg shadow-black/50 transition-all hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" /> Nueva factura
          </button>
        )}
      </div>

      {notice && <p className="mt-3 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</p>}
      {err && <p className="mt-3 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{err}</p>}

      {offline ? (
        <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-5 text-sm">
          <p className="font-semibold text-amber-300">PayPal no está configurado en el backend</p>
          <p className="mt-1 text-[var(--t-muted)]">
            Facturar necesita <code>PAYPAL_CLIENT_ID</code> y <code>PAYPAL_CLIENT_SECRET</code> (sandbox o live).
            El resto de la cuenta sigue funcionando.
          </p>
          {onConnect && (
            <button
              onClick={onConnect}
              className="mt-3 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20"
            >
              Conectar PayPal en Mis integraciones →
            </button>
          )}
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-2" aria-label="Cargando facturas">
          {[0, 1, 2].map((k) => (
            <div key={k} className="h-10 animate-pulse rounded-lg bg-[var(--t-surface2)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--t-border)] p-8 text-center">
          <Receipt className="mx-auto h-8 w-8 text-[var(--t-muted)]" />
          <p className="mt-2 text-sm font-semibold">Sin facturas todavía</p>
          <p className="mt-1 text-sm text-[var(--t-muted)]">
            {isAdmin
              ? "Crea la primera factura y comparte su enlace de pago con el cliente."
              : "Todavía no se han emitido facturas a tu cuenta."}
          </p>
          {isAdmin && (
            <button
              onClick={() => { setForm(blankForm()); setFormErr(""); setModal(true); }}
              className="mt-4 rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-5 py-2 text-sm font-semibold shadow-lg shadow-black/50 transition-all hover:scale-[1.02]"
            >
              Crear la primera factura
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {chip("enviadas", counts.sent, "bg-sky-500/15 text-sky-400")}
            {chip("pagadas", counts.paid, "bg-emerald-500/15 text-emerald-400")}
            {chip("borradores", counts.draft, "bg-slate-500/15 text-slate-300")}
            {chip("parciales", counts.partial, "bg-amber-500/15 text-amber-400")}
            {chip("canceladas", counts.cancelled, "bg-rose-500/15 text-rose-400")}
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--t-surface)] text-left text-xs uppercase tracking-wide text-[var(--t-muted)]">
                <tr>
                  <th className="py-2 pr-3">Factura</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Emitida</th>
                  <th className="py-2 pr-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => {
                  const id = invId(inv);
                  const status = invStatus(inv);
                  const [label, tone] = STATUS[status] || [status, "bg-slate-500/15 text-slate-300"];
                  const canManage = isAdmin;
                  return (
                    <tr key={id} className="border-t border-[var(--t-border)] transition-colors hover:bg-[var(--t-surface2)]/50">
                      <td className="py-2.5 pr-3 font-semibold">{invNumber(inv)}</td>
                      <td className="py-2.5 pr-3">{invRecipient(inv)}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{money(invAmount(inv), invCurrency(inv))}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-[var(--t-muted)]">{fmtDate(invDate(inv))}</td>
                      <td className="py-2.5 pr-1">
                        <div className="flex items-center justify-end gap-1">
                          <button className={btn} title="Copiar enlace de pago"
                                  disabled={busy === `${id}:copy`}
                                  onClick={() => copyLink(inv)}>
                            {busy === `${id}:copy` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                          </button>
                          <button className={btn} title="Abrir página de pago"
                                  disabled={busy === `${id}:open`}
                                  onClick={() => openLink(inv)}>
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <button className={btn} title="Ver QR de pago"
                                  disabled={busy === `${id}:qr`}
                                  onClick={() => showQr(inv)}>
                            {busy === `${id}:qr` ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                          </button>
                          {canManage && status === "draft" && (
                            <button className={btn} title="Enviar al cliente"
                                    disabled={busy === `${id}:send`}
                                    onClick={() => sendNow(inv)}>
                              {busy === `${id}:send` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </button>
                          )}
                          {canManage && !["draft", "cancelled"].includes(status) && (
                            <button className={btn} title={reminded[id] ? "Recordatorio ya enviado hoy (máx. 2/día)" : "Enviar recordatorio"}
                                    disabled={!!reminded[id] || busy === `${id}:remind`}
                                    onClick={() => remind(inv)}>
                              {busy === `${id}:remind` ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                            </button>
                          )}
                          {canManage && status === "sent" && (
                            <button className={`${btn} hover:text-rose-400`} title="Cancelar factura"
                                    disabled={busy === `${id}:cancel`}
                                    onClick={() => cancel(inv)}>
                              {busy === `${id}:cancel` ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
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
          <p className="mt-3 text-xs text-[var(--t-muted)]">
            Las facturas se sirven desde PayPal (fuente de verdad); los pagos quedan conciliados en
            <span className="font-semibold"> Mis pagos</span>.
          </p>
        </>
      )}

      {/* -------------------- modal: nueva factura -------------------- */}
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <form onSubmit={submit}
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[var(--t-surface)] p-5 ring-1 ring-[var(--t-border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Nueva factura</h3>
              <button type="button" onClick={() => setModal(false)} title="Cerrar"
                      className="grid h-8 w-8 place-items-center rounded-lg text-[var(--t-muted)] hover:bg-[var(--t-surface2)] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 text-sm">
              <label className="text-sm">Correo del cliente *
                <input type="email" required value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })}
                       placeholder="cliente@empresa.com" className={`${input} mt-1`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">Nombre (opcional)
                  <input value={form.customer_name}
                         onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                         placeholder="Ana Pérez" className={`${input} mt-1`} />
                </label>
                <label className="text-sm">Moneda
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                          className={`${input} mt-1`}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Conceptos</span>
                  <button type="button"
                          onClick={() => setForm({ ...form, items: [...form.items, { name: "", quantity: 1, unit_amount: "" }] })}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--t-accent)]">
                    <Plus className="h-3.5 w-3.5" /> Añadir
                  </button>
                </div>
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_60px_90px_28px] gap-2">
                    <input value={it.name} onChange={(e) => setItem(idx, { name: e.target.value })}
                           placeholder="Concepto" className={input} />
                    <input type="number" min="1" max="999" value={it.quantity}
                           onChange={(e) => setItem(idx, { quantity: e.target.value })}
                           title="Cantidad" className={input} />
                    <input type="number" min="0" step="0.01" value={it.unit_amount}
                           onChange={(e) => setItem(idx, { unit_amount: e.target.value })}
                           placeholder="0.00" title="Precio unitario" className={input} />
                    <button type="button" title="Quitar línea"
                            onClick={() => form.items.length > 1 &&
                              setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                            className="grid h-9 w-7 place-items-center rounded-lg text-[var(--t-muted)] hover:text-rose-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="text-sm">Impuesto %
                  <input type="number" min="0" max="100" value={form.tax_percent}
                         onChange={(e) => setForm({ ...form, tax_percent: e.target.value })}
                         placeholder="0" className={`${input} mt-1`} />
                </label>
                <label className="text-sm">Emitida
                  <input type="date" value={form.issue_date}
                         onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                         className={`${input} mt-1`} />
                </label>
                <div className="flex items-end pb-1 text-right">
                  <span className="text-xs text-[var(--t-muted)]">
                    Total<br />
                    <b className="text-sm text-white">{money(total, form.currency)}</b>
                  </span>
                </div>
              </div>

              <label className="text-sm">Nota para el cliente
                <textarea rows="2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                          placeholder="Servicios de octubre de 2026" className={`${input} mt-1 resize-none`} />
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.send}
                       onChange={(e) => setForm({ ...form, send: e.target.checked })}
                       className="h-4 w-4 accent-[var(--t-accent)]" />
                Crear y enviar (queda en estado <b>Enviada</b>)
              </label>
              <label className={`flex items-center gap-2 text-sm ${form.send ? "" : "opacity-50"}`}>
                <input type="checkbox" checked={form.send && form.send_email} disabled={!form.send}
                       onChange={(e) => setForm({ ...form, send_email: e.target.checked })}
                       className="h-4 w-4 accent-[var(--t-accent)]" />
                PayPal envía el correo al cliente (si no, solo compartes el link/QR)
              </label>
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
                {form.send ? "Crear y enviar" : "Guardar borrador"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- QR de pago -------------------- */}
      {qr && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
             onClick={() => setQr(null)} role="dialog" aria-modal="true">
          <div className="w-full max-w-xs rounded-xl bg-[var(--t-surface)] p-5 text-center ring-1 ring-[var(--t-border)]"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">QR de pago</h3>
              <button onClick={() => setQr(null)} title="Cerrar"
                      className="grid h-7 w-7 place-items-center rounded-lg text-[var(--t-muted)] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <img src={`data:image/png;base64,${qr.image}`} alt="QR de pago de la factura"
                 className="mx-auto mt-3 h-48 w-48 rounded-lg bg-white p-2" />
            <p className="mt-2 text-xs text-[var(--t-muted)]">Escanea para pagar con PayPal o tarjeta.</p>
            <div className="mt-3 flex justify-center gap-2">
              {qr.url && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(qr.url);
                      setNotice("Enlace de pago copiado al portapapeles.");
                      setQr(null);
                    } catch {
                      setErr("No se pudo copiar el enlace.");
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--t-surface2)] px-3 py-1.5 text-xs font-semibold hover:text-white"
                >
                  <Link2 className="h-3.5 w-3.5" /> Copiar enlace
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
