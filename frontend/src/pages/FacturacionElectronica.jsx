import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileCheck2, Zap, ShieldCheck, Send } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Reveal from "../components/Reveal.jsx";
import { api } from "../services/api.js";

const VOLUMEN = ["Menos de 100 docs/mes", "100 – 1.000 docs/mes", "1.000 – 10.000 docs/mes", "Más de 10.000 docs/mes"];

const perks = [
  { Icon: Zap, t: "Emisión en segundos", d: "Del POS al documento validado sin fricción." },
  { Icon: FileCheck2, t: "100% DIAN", d: "Validación, CUFE y contingencia automática." },
  { Icon: ShieldCheck, t: "Sin mensualidad por volumen", d: "Opción autohospedada con soberanía total." },
];

const fresh = () => ({ a: 1 + Math.floor(Math.random() * 9), b: 1 + Math.floor(Math.random() * 9) });

/** Página de Facturación Electrónica: hero + formulario corporativo de contacto. */
export default function FacturacionElectronica() {
  const [form, setForm] = useState({
    nombre: "", apellidos: "", empresa: "", nit: "", cargo: "",
    email: "", telefono: "", ciudad: "", opcion: VOLUMEN[1], answer: "",
  });
  const [cap, setCap] = useState(fresh);
  const [auth, setAuth] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const input = "w-full rounded-lg bg-[var(--l-surface2)] px-4 py-3 text-sm text-[var(--l-text)] ring-1 ring-[var(--l-border)] focus:outline-none focus:ring-[var(--l-accent)]";
  const label = "text-sm font-medium text-[var(--l-text2)]";

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!auth) {
      setErr("Debes autorizar el tratamiento de datos.");
      return;
    }
    try {
      const data = await api.lead({ ...form, captcha: { a: cap.a, b: cap.b, answer: Number(form.answer) } });
      setSent(data);
    } catch {
      setErr("Revisa los campos e intenta de nuevo (¿captcha?).");
      setCap(fresh());
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--l-bg)] text-[var(--l-text)] antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1E293B,transparent_60%)]" />
      <div className="relative">
        <Navbar />
        <main className="mx-auto max-w-4xl px-6">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="py-14 text-center md:py-20">
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Emite sin fricción tu{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--l-k1)] to-[var(--l-k2)]">
                Factura Electrónica
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[var(--l-muted)]">
              Te contactamos en menos de 24 horas con una propuesta a tu medida: nube o autohospedada.
            </p>
          </motion.div>

          <div className="grid gap-4 pb-10 md:grid-cols-3">
            {perks.map(({ Icon, t, d }, i) => (
              <Reveal key={t} delay={i * 0.08}>
                <div className="h-full rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-5">
                  <div className="w-fit rounded-lg bg-[var(--l-accent-soft)] p-2.5 text-[var(--l-accent)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1 mt-3 font-semibold">{t}</h3>
                  <p className="text-sm leading-relaxed text-[var(--l-muted)]">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="mb-16 rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6 shadow-xl md:p-10">
              {sent ? (
                <div className="py-8 text-center">
                  <p className="text-2xl font-bold">¡Gracias, {sent.nombre}!</p>
                  <p className="mx-auto mt-3 max-w-md text-[var(--l-muted)]">
                    Recibimos tus datos de <b>{sent.empresa}</b> (NIT {sent.nit}). Te contactaremos
                    en <b>{sent.email}</b> en menos de 24 horas. Ref #{sent.id.slice(0, 8)}.
                  </p>
                  <Link to="/" className="mt-6 inline-block text-sm font-semibold text-[var(--l-accent)] hover:underline">
                    ← Volver al inicio
                  </Link>
                </div>
              ) : (
                <form onSubmit={submit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className={label}>Nombre*<input value={form.nombre} onChange={set("nombre")} required className={`${input} mt-1`} /></label>
                    <label className={label}>Apellidos*<input value={form.apellidos} onChange={set("apellidos")} required className={`${input} mt-1`} /></label>
                    <label className={label}>Empresa*<input value={form.empresa} onChange={set("empresa")} required className={`${input} mt-1`} /></label>
                    <label className={label}>NIT*<input value={form.nit} onChange={set("nit")} required placeholder="900123456-7" className={`${input} mt-1`} /></label>
                    <label className={label}>Cargo*<input value={form.cargo} onChange={set("cargo")} required className={`${input} mt-1`} /></label>
                    <label className={label}>Email corporativo*<input value={form.email} onChange={set("email")} required type="email" className={`${input} mt-1`} /></label>
                    <label className={label}>Teléfono Celular*<input value={form.telefono} onChange={set("telefono")} required className={`${input} mt-1`} /></label>
                    <label className={label}>Ciudad*<input value={form.ciudad} onChange={set("ciudad")} required className={`${input} mt-1`} /></label>
                    <label className={label}>Volumen mensual*
                      <select value={form.opcion} onChange={set("opcion")} className={`${input} mt-1`}>
                        {VOLUMEN.map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </label>
                    <label className={label}>¿Cuánto es {cap.a} + {cap.b}?*
                      <input value={form.answer} onChange={set("answer")} required inputMode="numeric" className={`${input} mt-1`} />
                    </label>
                  </div>
                  <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-[var(--l-text2)]">
                    <input type="checkbox" checked={auth} onChange={(e) => setAuth(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--l-accent)]" />
                    <span>
                      <b>Autorización Tratamiento de datos.</b> Autorizo a Cytech el tratamiento de
                      mis datos personales según la Política de Privacidad y los Términos publicados
                      en esta web.
                    </span>
                  </label>
                  {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
                  <div className="mt-6 text-center">
                    <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-12 py-3.5 font-bold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-[1.03]">
                      <Send className="h-4 w-4" /> Contáctame
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Reveal>
        </main>
        <Footer />
      </div>
    </div>
  );
}
