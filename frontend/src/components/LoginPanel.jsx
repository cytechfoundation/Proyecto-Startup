import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Globe, GitBranch, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";

const DEMO_USERS = [
  { email: "admin@cytech.com", label: "Admin", desc: "Acceso total" },
  { email: "operador@gmail.com", label: "Editor", desc: "Opera contenidos" },
  { email: "demo.retail@gmail.com", label: "Cliente", desc: "Solo lectura" },
];

/** Panel de acceso corporativo: federado + contraseña + demo. Reusado en modal y página /login. */
export default function LoginPanel({ onSuccess }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState("");
  const [pw, setPw] = useState({ email: "", password: "" });

  const go = (t) => {
    login(t);
    if (onSuccess) onSuccess();
    navigate("/dashboard");
  };

  const demo = async (email) => {
    setErr("");
    setLoading(email);
    try {
      const data = await api.demoLogin(email);
      go(data.access_token);
    } catch {
      setErr("Demo no disponible: ejecuta `python seed_demo.py` en el backend.");
    } finally {
      setLoading("");
    }
  };

  const passwordLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading("pw");
    try {
      const data = await api.passwordLogin(pw.email, pw.password);
      go(data.access_token);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading("");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[var(--l-accent)]" />
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--l-muted)]">
          Acceso corporativo · Identidad federada
        </p>
      </div>

      <div className="mt-4 space-y-3">
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

      <form onSubmit={passwordLogin} className="space-y-2.5">
        <input
          type="email"
          autoComplete="email"
          required
          value={pw.email}
          onChange={(e) => setPw((f) => ({ ...f, email: e.target.value }))}
          placeholder="Correo electrónico"
          aria-label="Correo electrónico"
          className="w-full rounded-lg border border-[var(--l-border)] bg-[var(--l-surface2)] px-3.5 py-2.5 text-sm text-[var(--l-text)] placeholder:text-[var(--l-muted)] outline-none transition-all focus:border-[var(--l-accent)]"
        />
        <input
          type="password"
          autoComplete="current-password"
          required
          value={pw.password}
          onChange={(e) => setPw((f) => ({ ...f, password: e.target.value }))}
          placeholder="Contraseña"
          aria-label="Contraseña"
          className="w-full rounded-lg border border-[var(--l-border)] bg-[var(--l-surface2)] px-3.5 py-2.5 text-sm text-[var(--l-text)] placeholder:text-[var(--l-muted)] outline-none transition-all focus:border-[var(--l-accent)]"
        />
        <button
          type="submit"
          disabled={loading === "pw"}
          className="w-full rounded-lg bg-gradient-to-r from-[var(--l-accent)] to-[var(--l-accent2)] px-4 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === "pw" ? "Entrando…" : "Entrar con contraseña"}
        </button>
        <p className="pt-1 text-center text-xs text-[var(--l-muted)]">
          ¿No tienes cuenta?{" "}
          <Link to="/cuenta-nueva" className="font-semibold text-[var(--l-accent)] hover:underline">
            Crear cuenta
          </Link>
        </p>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-[var(--l-muted)]">
        <span className="h-px flex-1 bg-[var(--l-surface2)]" />
        entorno de demostración
        <span className="h-px flex-1 bg-[var(--l-surface2)]" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {DEMO_USERS.map((u) => (
          <button
            key={u.email}
            onClick={() => demo(u.email)}
            disabled={!!loading}
            title={`${u.email} — ${u.desc}`}
            className="rounded-lg border border-[var(--l-border)] bg-[var(--l-surface)] px-2 py-2.5 text-center transition-all hover:border-[var(--l-accent)] hover:bg-[var(--l-surface2)] disabled:opacity-50"
          >
            <span className="block text-sm font-semibold text-[var(--l-text)]">
              {loading === u.email ? "…" : u.label}
            </span>
            <span className="mt-0.5 block text-[11px] text-[var(--l-muted)]">{u.desc}</span>
          </button>
        ))}
      </div>
      {err && <p className="mt-3 text-xs text-red-400">{err}</p>}

      <p className="mt-5 rounded-lg border border-[var(--l-border)] bg-[var(--l-surface)] p-3 text-xs leading-relaxed text-[var(--l-muted)]">
        ¿Nuevo aquí? Crea tu cuenta con email y contraseña. En la vía federada la cuenta se crea sola:{" "}
        <b className="text-[var(--l-text)]">@cytech.com → Administrador</b>, otro dominio → Cliente.
      </p>
    </div>
  );
}
