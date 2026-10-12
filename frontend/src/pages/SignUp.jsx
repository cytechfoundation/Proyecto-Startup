import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, FileText, GitBranch, Globe, GraduationCap, Loader2, Plug, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";

/** Beneficios del panel izquierdo (lenguaje de tiles del mockup de producto). */
const PERKS = [
  { icon: GraduationCap, tone: "bg-violet-500/15 text-violet-300", title: "Becas y convocatorias", desc: "Calendario, fechas clave y postulaciones." },
  { icon: FileText, tone: "bg-cyan-500/15 text-cyan-300", title: "Documentos al día", desc: "Facturación DIAN y PDFs en un solo lugar." },
  { icon: Plug, tone: "bg-emerald-500/15 text-emerald-300", title: "Integraciones", desc: "Conecta POS, PayPal y tus sistemas." },
  { icon: ShieldCheck, tone: "bg-amber-500/15 text-amber-300", title: "Seguridad por roles", desc: "Permisos granulares y auditoría." },
];

/** Fortaleza de la contraseña: 0–4 segmentos (misma política que el backend). */
function strengthScore(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (/[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (pw.length >= 12 || /[^\w\s]/.test(pw)) s += 1;
  return s;
}

const STRENGTH = [
  { label: "", bar: "bg-slate-600" },
  { label: "Débil", bar: "bg-red-500" },
  { label: "Aceptable", bar: "bg-amber-500" },
  { label: "Buena", bar: "bg-cyan-500" },
  { label: "Excelente", bar: "bg-emerald-500" },
];

/** Alta de cuenta (/cuenta-nueva): federado + email/password + bienvenida. */
export default function SignUp() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const score = strengthScore(form.password);
  const valid = form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && score >= 3 && terms;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!valid) {
      setErr("Revisa los campos: contraseña (8+ con mayúscula y dígito) y acepta los términos.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.register({ ...form, name: form.name.trim(), terms: true });
      login(data.access_token);
      navigate("/dashboard");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  };

  const field =
    "w-full rounded-lg border border-[var(--l-border)] bg-[var(--l-surface2)] px-3.5 py-3 text-sm text-[var(--l-text)] placeholder:text-[var(--l-muted)] outline-none transition-all focus:border-[var(--l-accent)] focus:ring-2 focus:ring-cyan-500/20";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--l-bg)] px-4 py-10 text-[var(--l-text)] antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1E293B,transparent_60%)]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--l-border)] bg-[var(--l-bg)] shadow-2xl shadow-cyan-500/10 lg:grid-cols-[1.05fr_1fr]">
        {/* Panel de marca (solo ≥lg) */}
        <aside className="hidden flex-col justify-between bg-gradient-to-br from-[#0a1230] via-[#0e1b3f] to-[#123254] p-10 lg:flex">
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-white">
              CYTECH<span className="text-cyan-400">.</span>
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" /> Cuenta gratuita · Sin tarjeta
            </span>
            <h2 className="mt-5 text-3xl font-bold leading-tight text-white">
              Tu futuro académico <span className="text-cyan-400">comienza aquí</span>
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Becas · Formación · Tecnología. Gestiona documentos, calendario e integraciones desde un solo lugar.
            </p>

            <ul className="mt-7 space-y-3">
              {PERKS.map(({ icon: Icon, tone, title, desc }) => (
                <li key={title} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.04] p-3.5">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{title}</span>
                    <span className="block text-xs text-slate-400">{desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-500">
            Rol automático por dominio: <b className="text-slate-300">@cytech.com → Administrador</b>, resto → Cliente.
          </p>
        </aside>

        {/* Formulario */}
        <div className="p-8 sm:p-10">
          <p className="text-xl font-extrabold tracking-tight">
            CYTECH<span className="text-[var(--l-accent)]">.</span>
          </p>
          <h1 className="mt-4 text-2xl font-bold">Crear tu cuenta</h1>
          <p className="mt-1 text-sm text-[var(--l-muted)]">Únete en menos de un minuto.</p>

          <div className="mt-5 space-y-2.5">
            <a
              href={api.loginUrls.google}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-all duration-300 hover:scale-[1.01] hover:bg-slate-100"
            >
              <Globe className="h-4 w-4" /> Continuar con Google
            </a>
            <a
              href={api.loginUrls.github}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--l-border)] bg-[var(--l-surface2)] px-4 py-3 text-sm font-semibold text-[var(--l-text)] transition-all duration-300 hover:scale-[1.01] hover:border-[var(--l-accent)]"
            >
              <GitBranch className="h-4 w-4" /> Continuar con GitHub
            </a>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-[var(--l-muted)]">
            <span className="h-px flex-1 bg-[var(--l-surface2)]" />
            o con tu email
            <span className="h-px flex-1 bg-[var(--l-surface2)]" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
            <div>
              <label htmlFor="su-name" className="mb-1.5 block text-xs font-semibold text-[var(--l-muted)]">Nombre completo</label>
              <input id="su-name" autoComplete="name" value={form.name} onChange={set("name")} placeholder="Ana Pérez" className={field} />
            </div>
            <div>
              <label htmlFor="su-email" className="mb-1.5 block text-xs font-semibold text-[var(--l-muted)]">Correo electrónico</label>
              <input id="su-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="tu@correo.com" className={field} />
            </div>
            <div>
              <label htmlFor="su-pw" className="mb-1.5 block text-xs font-semibold text-[var(--l-muted)]">Contraseña</label>
              <div className="relative">
                <input
                  id="su-pw"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Mín. 8, una mayúscula y un dígito"
                  className={`${field} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--l-muted)] transition-colors hover:text-[var(--l-text)]"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex h-1.5 flex-1 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={`h-full flex-1 rounded-full transition-colors ${i <= score ? STRENGTH[score].bar : "bg-[var(--l-surface2)]"}`} />
                    ))}
                  </div>
                  <span className="w-20 text-right text-[11px] text-[var(--l-muted)]">{STRENGTH[score].label}</span>
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[var(--l-muted)]">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-500" />
              <span>
                Acepto los <b className="text-[var(--l-text)]">términos del servicio</b> y la{" "}
                <b className="text-[var(--l-text)]">política de privacidad</b> de Cytech.
              </span>
            </label>

            {err && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--l-accent)] to-[var(--l-accent2)] px-4 py-3 text-sm font-bold text-white transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Creando tu cuenta…" : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[var(--l-muted)]">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-semibold text-[var(--l-accent)] hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
