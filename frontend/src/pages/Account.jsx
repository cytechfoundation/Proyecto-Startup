import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BellRing, Plug, Activity, Save, FileText } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import AccountSidebar from "../components/AccountSidebar.jsx";
import AccountSteps from "../components/AccountSteps.jsx";
import Collapsible from "../components/Collapsible.jsx";
import ThemeSwitcher from "../components/ThemeSwitcher.jsx";
import CalendarImporter from "../components/CalendarImporter.jsx";

const INTEGRATIONS = [
  { id: "pos", name: "POS / Punto de venta", desc: "Sincroniza tickets, caja e inventario." },
  { id: "dian", name: "Facturación DIAN", desc: "Emisión y validación de documentos." },
  { id: "paypal", name: "PayPal · Pasarela de pagos", desc: "Vincula tu cuenta PayPal para cobrar.", needsAccount: true },
];

const DEMO_INVOICES = [
  { id: "FV-1042", date: "2026-10-01", total: "$ 1.250.000", state: "Aceptada DIAN" },
  { id: "FV-1041", date: "2026-09-28", total: "$ 860.000", state: "Aceptada DIAN" },
  { id: "FV-1040", date: "2026-09-21", total: "$ 430.000", state: "En contingencia" },
];

const DEMO_PAYMENTS = [
  { id: "PAY-881", date: "2026-10-02", method: "Tarjeta ···· 4521", total: "$ 1.250.000", state: "Conciliado" },
  { id: "PAY-880", date: "2026-09-28", method: "PSE", total: "$ 860.000", state: "Conciliado" },
];

const loadJSON = (k, fb) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fb;
  } catch {
    return fb;
  }
};

/** Mi cuenta: administración del cliente/usuario (panel, perfil, integraciones, facturas, pagos, seguridad). */
export default function Account() {
  const { token, user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("panel");
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState({ name: "", company: "", phone: "", nit: "", person_type: "" });
  const [msg, setMsg] = useState("");
  const [linked, setLinked] = useState({}); // provider -> {connected, account}
  const [allLinked, setAllLinked] = useState([]); // auditoría admin
  const [visited, setVisited] = useState(() => loadJSON("cytech_visited", {}));
  const [prefs, setPrefs] = useState(() => loadJSON("cytech_privacy", { product: true, analytics: false }));
  const [ppEmail, setPpEmail] = useState("");
  const [ppForm, setPpForm] = useState(false);

  useEffect(() => {
    if (token) api.summary(token).then(setSummary).catch(() => {});
  }, [token, user]);

  const loadLinked = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.integrations(token);
      setLinked(Object.fromEntries(list.map((i) => [i.provider, i])));
      if (user?.role === "admin") {
        setAllLinked(await api.integrationsAll(token));
      }
    } catch (e) {
      setMsg(e.message);
    }
  }, [token, user?.role]);

  useEffect(() => { loadLinked(); }, [loadLinked]);

  useEffect(() => {
    if (user) setForm({ name: user.name || "", company: user.company || "", phone: user.phone || "", nit: user.nit || "", person_type: user.person_type || "" });
  }, [user]);

  const select = useCallback((id) => {
    setSection(id);
    setVisited((v) => {
      const next = { ...v, [id]: true };
      localStorage.setItem("cytech_visited", JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("cytech_privacy", JSON.stringify(prefs));
  }, [prefs]);

  const isOn = (id) => !!linked[id]?.connected;

  const toggleProvider = async (id) => {
    setMsg("");
    try {
      if (isOn(id)) {
        await api.disconnect(token, id);
      } else {
        await api.connect(token, id, linked[id]?.account || null);
      }
      await loadLinked();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const connectPaypal = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.connect(token, "paypal", ppEmail);
      setPpEmail("");
      setPpForm(false);
      await loadLinked();
      setMsg("Cuenta PayPal vinculada.");
    } catch (err) {
      setMsg(err.message);
    }
  };

  const [docTab, setDocTab] = useState("privacidad");
  const [checked, setChecked] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delEmail, setDelEmail] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (!token) return;
    api.transactions(token, { kind: "invoice", page_size: 20 }).then((d) => setInvoices(d.items || [])).catch(() => {});
    api.transactions(token, { kind: "payment", page_size: 20 }).then((d) => setPayments(d.items || [])).catch(() => {});
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  const done = {
    personal: !!(form.name && form.company && form.phone && form.nit),
    integraciones: Object.values(linked).some((i) => i.connected),
    facturas: !!visited.facturas,
    pagos: !!visited.pagos,
    seguridad: !!visited.seguridad,
    privacidad: !!user?.terms_accepted_at,
  };

  const accept = async () => {
    setMsg("");
    try {
      await api.acceptTerms(token, true);
      await refresh();
      setChecked(false);
      setMsg("Constancia registrada: aceptaste la Política y los Términos (v1.0-oct2026).");
    } catch (e) {
      setMsg(e.message);
    }
  };

  const revoke = async () => {
    setMsg("");
    try {
      await api.acceptTerms(token, false);
      await refresh();
      setMsg("Aceptación revocada. Vuelve a aceptar para completar este paso.");
    } catch (e) {
      setMsg(e.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.updateProfile(token, { ...form, person_type: form.person_type || null });
      await refresh();
      setMsg("Perfil actualizado.");
      select("personal");
    } catch (err) {
      setMsg(err.message);
    }
  };

  const downloadData = async () => {
    try {
      const data = await api.summary(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mis-datos-cytech.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const doDelete = async () => {
    setMsg("");
    try {
      await api.deleteMe(token, delEmail);
      logout();
      navigate("/");
    } catch (e) {
      setMsg(e.message);
    }
  };

  const input = "w-full rounded-lg bg-[var(--t-surface2)] px-3 py-2.5 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-[var(--t-accent)]";

  return (
    <div className="min-h-screen bg-[var(--t-bg)] p-4 text-white md:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row">
        <AccountSidebar user={user} section={section} onSelect={select} onLogout={logout} />

        <main className="min-w-0 flex-1 space-y-4">
          <AccountSteps done={done} onSelect={select} />
          {msg && <p className="rounded-lg bg-[var(--t-accent-soft)] p-3 text-sm text-[var(--t-accent)]">{msg}</p>}

          {section === "panel" && (
            <div className="space-y-4">
              {user?.role === "admin" && (
                <Collapsible title="Importar Calendario DIAN (admin)" icon={FileText} tone="blue" defaultOpen badge="PDF 2026">
                  <CalendarImporter bare />
                </Collapsible>
              )}
              <Collapsible title="Alertas" icon={BellRing} tone="blue" defaultOpen badge="0 mensajes sin leer">
                <p className="text-sm text-[var(--t-muted)]">Sin alertas pendientes. Aquí verás avisos de facturación, pagos y actividad de tu cuenta.</p>
              </Collapsible>
              <Collapsible title="Mis integraciones" icon={Plug} tone="red" defaultOpen
                           badge={`${Object.values(linked).filter((i) => i.connected).length}/${INTEGRATIONS.length} activas`}>
                <ul className="space-y-2 text-sm">
                  {INTEGRATIONS.map((i) => (
                    <li key={i.id} className="flex items-center justify-between rounded-lg bg-[var(--t-surface2)] px-3 py-2">
                      <span>{i.name}{linked[i.id]?.account ? ` · ${linked[i.id].account}` : ""}</span>
                      <span className={isOn(i.id) ? "text-emerald-400" : "text-[var(--t-muted)]"}>
                        {isOn(i.id) ? "Conectada" : "Desconectada"}
                      </span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => select("integraciones")} className="mt-3 text-sm font-semibold text-[var(--t-accent)] hover:text-[var(--t-accent)]">
                  Administrar →
                </button>
              </Collapsible>
              <Collapsible title="Actividad de mi cuenta" icon={Activity} tone="green">
                <dl className="grid gap-2 text-sm md:grid-cols-2">
                  <div className="rounded-lg bg-[var(--t-surface2)] p-3"><dt className="text-[var(--t-muted)]">Miembro desde</dt><dd>{user?.created_at ? new Date(user.created_at).toLocaleString() : "—"}</dd></div>
                  <div className="rounded-lg bg-[var(--t-surface2)] p-3"><dt className="text-[var(--t-muted)]">Último ingreso</dt><dd>{summary?.last_login ? new Date(summary.last_login).toLocaleString() : "—"}</dd></div>
                  <div className="rounded-lg bg-[var(--t-surface2)] p-3"><dt className="text-[var(--t-muted)]">Proveedor de identidad</dt><dd className="capitalize">{user?.provider}</dd></div>
                  <div className="rounded-lg bg-[var(--t-surface2)] p-3"><dt className="text-[var(--t-muted)]">Permisos activos</dt><dd>{summary?.permissions.length ?? "—"}</dd></div>
                </dl>
              </Collapsible>
            </div>
          )}

          {section === "personal" && (
            <form onSubmit={save} className="rounded-xl bg-[var(--t-surface)] p-5">
              <h2 className="text-xl font-bold">Información personal</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm">Nombre
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${input} mt-1`} />
                </label>
                <label className="text-sm">Empresa
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Mi empresa S.A.S." className={`${input} mt-1`} />
                </label>
                <label className="text-sm">Teléfono
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+57 300 000 0000" className={`${input} mt-1`} />
                </label>
                <label className="text-sm">NIT (empresa o persona)
                  <input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} placeholder="900123456-7" className={`${input} mt-1`} />
                </label>
                <label className="text-sm">Tipo de persona
                  <select value={form.person_type} onChange={(e) => setForm({ ...form, person_type: e.target.value })} className={`${input} mt-1`}>
                    <option value="">Seleccionar…</option>
                    <option value="natural">Persona natural</option>
                    <option value="juridica">Persona jurídica</option>
                  </select>
                </label>
                <div className="text-sm">Correo (verificado por {user?.provider})
                  <p className="mt-1 rounded-lg bg-[var(--t-surface2)] px-3 py-2.5 text-[var(--t-muted)]">{user?.email}</p>
                </div>
              </div>
              <button className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-6 py-2.5 text-sm font-semibold shadow-lg shadow-black/50 transition-all hover:scale-[1.02]">
                <Save className="h-4 w-4" /> Guardar cambios
              </button>
            </form>
          )}

          {section === "integraciones" && (
            <div className="rounded-xl bg-[var(--t-surface)] p-5">
              <h2 className="text-xl font-bold">Mis integraciones</h2>
              <p className="mt-1 text-sm text-[var(--t-muted)]">Vinculación real guardada en tu cuenta.</p>
              <div className="mt-4 space-y-3">
                {INTEGRATIONS.map((i) => (
                  <div key={i.id} className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface2)]/60 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{i.name}</p>
                        <p className="text-sm text-[var(--t-muted)]">{i.desc}</p>
                        {linked[i.id]?.account && (
                          <p className="mt-1 font-mono text-xs text-[var(--t-accent)]">{linked[i.id].account}</p>
                        )}
                      </div>
                      <button
                        onClick={() => (i.needsAccount && !isOn(i.id) ? setPpForm(true) : toggleProvider(i.id))}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isOn(i.id) ? "bg-[var(--t-accent)]" : "bg-slate-600"}`}
                        title={isOn(i.id) ? "Desconectar" : "Conectar"}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${isOn(i.id) ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    {i.needsAccount && isOn(i.id) && (
                      <div className="mt-2">
                        {linked[i.id]?.verified ? (
                          <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                            ✓ Verificada con PayPal
                          </span>
                        ) : (
                          <button
                            onClick={async () => {
                              setMsg("");
                              try {
                                const { authorize_url } = await api.paypalAuthorize(token);
                                window.open(authorize_url, "_blank");
                                setMsg("Inicia sesión en PayPal en la pestaña abierta para verificar tu cuenta.");
                              } catch (e) {
                                setMsg("Verificación PayPal no disponible: falta PAYPAL_CLIENT_ID en el backend.");
                              }
                            }}
                            className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20"
                          >
                            Verificar con PayPal
                          </button>
                        )}
                      </div>
                    )}
                    {i.needsAccount && (ppForm || !isOn(i.id)) && (
                      <form onSubmit={connectPaypal} className="mt-3 flex flex-wrap gap-2">
                        <input
                          value={ppEmail}
                          onChange={(e) => setPpEmail(e.target.value)}
                          placeholder="tu-correo@paypal.com"
                          type="email"
                          required
                          className="min-w-0 flex-1 rounded-lg bg-[var(--t-surface2)] px-3 py-2 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-[var(--t-accent)]"
                        />
                        <button className="rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-4 py-2 text-sm font-semibold">
                          Vincular PayPal
                        </button>
                        {ppForm && (
                          <button type="button" onClick={() => setPpForm(false)} className="rounded-lg px-3 py-2 text-sm text-[var(--t-muted)] hover:text-white">
                            Cancelar
                          </button>
                        )}
                      </form>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-[var(--t-muted)]">
                Para cobrar con PayPal en producción configura tus credenciales sandbox/live en el backend (PAYPAL_CLIENT_ID).
              </p>
              {user?.role === "admin" && (
                <div className="mt-6 border-t border-[var(--t-border)] pt-4">
                  <h3 className="font-bold">Todas las integraciones (admin)</h3>
                  {allLinked.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--t-muted)]">Ningún usuario ha vinculado integraciones.</p>
                  ) : (
                    <table className="mt-3 w-full text-sm">
                      <thead className="text-left text-[var(--t-muted)]">
                        <tr><th>Usuario</th><th>Proveedor</th><th>Cuenta</th><th>Verificada</th></tr>
                      </thead>
                      <tbody>
                        {allLinked.map((r, i) => (
                          <tr key={i} className="border-t border-[var(--t-border)]">
                            <td className="py-2 pr-3">{r.user_name}<br /><span className="text-xs text-[var(--t-muted)]">{r.user_email}</span></td>
                            <td className="pr-3 uppercase">{r.provider}</td>
                            <td className="pr-3 font-mono text-xs">{r.account || "—"}</td>
                            <td>{r.verified ? <span className="text-emerald-400">✓</span> : <span className="text-[var(--t-muted)]">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {section === "facturas" && (
            <div className="rounded-xl bg-[var(--t-surface)] p-5">
              <h2 className="text-xl font-bold">Mis facturas</h2>
              <p className="mt-1 text-sm text-[var(--t-muted)]">Documentos DIAN reales de tu cuenta (vía middleware).</p>
              {invoices.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--t-muted)]">Sin facturas registradas.</p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <thead className="text-left text-[var(--t-muted)]"><tr><th>Documento</th><th>Proveedor</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
                  <tbody>
                    {invoices.map((f) => (
                      <tr key={f.id} className="border-t border-[var(--t-border)]">
                        <td className="py-2 font-semibold">{f.external_id || f.id.slice(0, 8)}</td>
                        <td className="uppercase">{f.provider}</td>
                        <td>$ {(f.amount / 100).toLocaleString("es-CO")}</td>
                        <td><span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs capitalize text-emerald-400">{f.state || f.status}</span></td>
                        <td className="text-[var(--t-muted)]">{new Date(f.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {section === "pagos" && (
            <div className="rounded-xl bg-[var(--t-surface)] p-5">
              <h2 className="text-xl font-bold">Mis pagos</h2>
              <p className="mt-1 text-sm text-[var(--t-muted)]">Transacciones conciliadas de tu cuenta.</p>
              {payments.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--t-muted)]">Sin pagos registrados.</p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <thead className="text-left text-[var(--t-muted)]"><tr><th>Ref</th><th>Proveedor</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t border-[var(--t-border)]">
                        <td className="py-2 font-semibold">{p.external_id || p.id.slice(0, 8)}</td>
                        <td className="uppercase">{p.provider}</td>
                        <td>$ {(p.amount / 100).toLocaleString("es-CO")}</td>
                        <td><span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs capitalize text-emerald-400">{p.state || p.status}</span></td>
                        <td className="text-[var(--t-muted)]">{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {section === "seguridad" && (
            <div className="rounded-xl bg-[var(--t-surface)] p-5">
              <h2 className="text-xl font-bold">Seguridad</h2>
              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg bg-[var(--t-surface2)] p-3"><dt className="text-[var(--t-muted)]">Inicio de sesión</dt><dd>Solo federado ({user?.provider}) — sin contraseñas que robar.</dd></div>
                <div className="rounded-lg bg-[var(--t-surface2)] p-3"><dt className="text-[var(--t-muted)]">Rol actual</dt><dd className="capitalize">{user?.role}</dd></div>
              </dl>
              <h3 className="mt-5 font-semibold">Mis permisos ({summary?.permissions.length ?? 0})</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {(summary?.permissions || []).map((p) => (
                  <span key={p} className="rounded-full bg-[var(--t-accent-soft)] px-3 py-1 font-mono text-xs text-[var(--t-accent)]">{p}</span>
                ))}
              </div>
              <p className="mt-5 text-xs text-[var(--t-muted)]">Para desactivar tu cuenta contacta a un administrador (@cytech.com).</p>
            </div>
          )}

          {section === "privacidad" && (
            <div className="rounded-xl bg-[var(--t-surface)] p-5">
              <h2 className="text-xl font-bold">Política de Privacidad y Términos</h2>
              <p className="mt-1 text-sm text-[var(--t-muted)]">Documento v1.0-oct2026 · Cytech</p>

              <div className="mt-4 flex gap-2">
                {[
                  { id: "privacidad", label: "Política de Privacidad" },
                  { id: "terminos", label: "Términos y Condiciones" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDocTab(t.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                      docTab === t.id ? "bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] text-white" : "bg-[var(--t-surface2)] text-[var(--t-text2)] hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {docTab === "privacidad" ? (
                <div className="mt-4 max-h-64 space-y-4 overflow-y-auto rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] p-4 text-sm leading-relaxed text-[var(--t-text2)]">
                  <div>
                    <h3 className="font-semibold text-white">1. Datos que recogemos</h3>
                    <p className="mt-1 text-[var(--t-muted)]">Nombre, correo verificado, empresa, teléfono e historial de ingresos. Solo lo necesario para operar tu cuenta, facturar ante la DIAN y conciliar pagos.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">2. Autenticación federada: no guardamos contraseñas</h3>
                    <p className="mt-1 text-[var(--t-muted)]">El acceso es exclusivo con Google o GitHub (OAuth2/OIDC). Cytech nunca ve ni almacena tu contraseña: solo recibe de tu proveedor el correo verificado y tu nombre.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">3. Uso de tus datos</h3>
                    <p className="mt-1 text-[var(--t-muted)]">Operar integraciones POS, emitir reportes DIAN y mostrar analíticas. No vendemos ni compartimos tus datos con terceros con fines publicitarios.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">4. Tus derechos (Ley 1581 de 2012)</h3>
                    <p className="mt-1 text-[var(--t-muted)]">Acceso, actualización, rectificación y eliminación de tus datos. Ejerce estos botones o escribe a cytechfoundation@gmail.com.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 max-h-64 space-y-4 overflow-y-auto rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] p-4 text-sm leading-relaxed text-[var(--t-text2)]">
                  <div>
                    <h3 className="font-semibold text-white">1. Objeto del servicio</h3>
                    <p className="mt-1 text-[var(--t-muted)]">Cytech ofrece una demo controlada de middleware SaaS: analíticas transaccionales, reportes DIAN y gestión de usuarios con control de roles.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">2. Cuentas y roles</h3>
                    <p className="mt-1 text-[var(--t-muted)]">El registro es automático vía identidad federada (@cytech.com → Administrador, otro dominio → Cliente). El rol Editor lo asigna un Administrador. No existe registro manual.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">3. Uso aceptable</h3>
                    <p className="mt-1 text-[var(--t-muted)]">Prohibido el uso fraudulento, la suplantación de identidad y cualquier intento de vulnerar los controles de rol. El incumplimiento permite suspender la cuenta.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">4. Datos de demostración</h3>
                    <p className="mt-1 text-[var(--t-muted)]">Facturas, pagos y métricas visibles son datos simulados sin valor tributario ni comercial.</p>
                  </div>
                </div>
              )}

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] p-4">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--t-accent)]"
                />
                <span className="text-sm text-[var(--t-text2)]">
                  <b className="text-white">He leído y acepto la Política de Privacidad y los Términos y Condiciones</b>
                  {" "}(v1.0-oct2026).
                </span>
              </label>

              {user?.terms_accepted_at ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
                  <span>Aceptado el {new Date(user.terms_accepted_at).toLocaleString()}.</span>
                  <button onClick={revoke} className="font-semibold underline hover:text-emerald-200">Revocar</button>
                </div>
              ) : (
                <button
                  onClick={accept}
                  disabled={!checked}
                  className="mt-3 rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-6 py-2.5 text-sm font-semibold shadow-lg shadow-black/50 transition-all hover:scale-[1.02] disabled:opacity-40"
                >
                  Aceptar documentos
                </button>
              )}

              <h3 className="mt-6 font-semibold text-white">Preferencias</h3>
              <div className="mt-2 space-y-2">
                {[
                  { id: "product", label: "Correos de producto y novedades" },
                  { id: "analytics", label: "Analítica de uso anonimizada" },
                ].map((p) => (
                  <button key={p.id} onClick={() => setPrefs((v) => ({ ...v, [p.id]: !v[p.id] }))}
                          className="flex w-full items-center justify-between rounded-lg bg-[var(--t-surface2)] px-4 py-3 text-sm">
                    <span>{p.label}</span>
                    <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${prefs[p.id] ? "bg-[var(--t-accent)]" : "bg-slate-600"}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${prefs[p.id] ? "left-[22px]" : "left-0.5"}`} />
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={downloadData}
                        className="rounded-lg border border-[var(--t-accent)] bg-[var(--t-accent-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--t-accent)] hover:bg-[var(--t-accent)]/20">
                  Descargar mis datos (JSON)
                </button>
                {!confirmDel ? (
                  <button onClick={() => { setConfirmDel(true); setDelEmail(""); }}
                          className="rounded-lg border border-[var(--t-border)] px-4 py-2.5 text-sm font-semibold text-[var(--t-text2)] hover:border-red-500/50 hover:text-red-300">
                    Solicitar eliminación
                  </button>
                ) : (
                  <div className="w-full rounded-lg border border-red-500/40 bg-red-500/5 p-4">
                    <p className="text-sm text-red-200">
                      <b>Acción irreversible.</b> Escribe tu correo (<b>{user?.email}</b>) para eliminar tu cuenta definitivamente:
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        value={delEmail}
                        onChange={(e) => setDelEmail(e.target.value)}
                        placeholder={user?.email}
                        className="min-w-0 flex-1 rounded-lg bg-[var(--t-surface2)] px-3 py-2.5 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-red-500"
                      />
                      <button
                        onClick={doDelete}
                        disabled={delEmail.toLowerCase().trim() !== (user?.email || "").toLowerCase() || !delEmail}
                        className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
                      >
                        Eliminar mi cuenta
                      </button>
                      <button onClick={() => setConfirmDel(false)}
                              className="rounded-lg border border-[var(--t-border)] px-4 py-2.5 text-sm text-[var(--t-text2)] hover:text-white">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
