import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import UserDirectory from "../components/UserDirectory.jsx";
import RbacMatrix from "../components/RbacMatrix.jsx";
import DonationList from "../components/DonationList.jsx";
import KnowledgePanel from "../components/KnowledgePanel.jsx";
import PermissionTester from "../components/PermissionTester.jsx";
import OnboardingChecklist from "../components/OnboardingChecklist.jsx";
import ThemeSwitcher from "../components/ThemeSwitcher.jsx";

/** Cambia de rol al instante con las cuentas demo (solo desarrollo). */
const ROLE_DEMO = [
  { role: "admin", label: "Admin", email: "admin@cytech.com" },
  { role: "editor", label: "Editor", email: "operador@gmail.com" },
  { role: "client", label: "Cliente", email: "demo.retail@gmail.com" },
];

/** Dashboard post-login: analíticas + directorio + matriz RBAC + motor de contenidos. */
export default function Dashboard() {
  const { token, user, login, logout } = useAuth();
  const [stats, setStats] = useState({ tps: 0, invoices: 0, webhooksOk: 100 });
  const [err, setErr] = useState("");
  const onError = useCallback((m) => setErr(m), []);

  useEffect(() => {
    const id = setInterval(() => {
      setStats((s) => ({
        tps: 80 + Math.round(Math.random() * 120),
        invoices: s.invoices + Math.round(Math.random() * 8),
        webhooksOk: 97 + Math.round(Math.random() * 3),
      }));
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const isAdmin = user?.role === "admin";

  const switchRole = async (email) => {
    setErr("");
    try {
      const data = await api.demoLogin(email);
      login(data.access_token);
    } catch {
      setErr("Cambio de rol no disponible: ejecuta `python seed_demo.py` en backend.");
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-[var(--t-bg)] p-8 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard — {user?.email} ({user?.role})</h1>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="flex items-center gap-1 rounded-lg bg-[var(--t-surface2)] p-1 ring-1 ring-[var(--t-border)]" title="Vista como (solo desarrollo)">
              <span className="px-2 text-xs text-[var(--t-muted)]">Vista:</span>
              {ROLE_DEMO.map(({ role, label, email }) => (
                <button
                  key={role}
                  onClick={() => switchRole(email)}
                  disabled={user?.role === role && user?.email === email}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    user?.role === role
                      ? "bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] text-white"
                      : "text-[var(--t-text2)] hover:bg-[var(--t-surface2)] hover:text-white"
                  } disabled:cursor-default`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <Link to="/cuenta" className="rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-4 py-2 text-sm font-semibold">Mi cuenta</Link>
          <ThemeSwitcher />
          <button onClick={logout} className="rounded-lg bg-[var(--t-surface2)] px-4 py-2 ring-1 ring-[var(--t-border)]">Salir</button>
        </div>
      </header>

      {err && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{err}</p>}

      <OnboardingChecklist userName={user?.name || user?.email?.split("@")[0]} />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-[var(--t-surface)] p-5"><p className="text-[var(--t-muted)]">Transacciones / min</p><p className="text-3xl font-extrabold text-[var(--t-accent)]">{stats.tps}</p></div>
        <div className="rounded-xl bg-[var(--t-surface)] p-5"><p className="text-[var(--t-muted)]">Facturas procesadas</p><p className="text-3xl font-extrabold">{stats.invoices}</p></div>
        <div className="rounded-xl bg-[var(--t-surface)] p-5"><p className="text-[var(--t-muted)]">Webhooks OK %</p><p className="text-3xl font-extrabold text-emerald-400">{stats.webhooksOk}%</p></div>
      </section>

      {isAdmin
        ? <UserDirectory token={token} isAdmin onError={onError} />
        : <p className="rounded-xl bg-[var(--t-surface)] p-5 text-sm text-[var(--t-muted)]">El Directorio de Usuarios requiere rol Administrador.</p>}

      <RbacMatrix token={token} isAdmin={isAdmin} myRole={user?.role} onError={onError} />
      {isAdmin && <DonationList token={token} onError={onError} />}
      {isAdmin && <KnowledgePanel token={token} onError={onError} />}
      <PermissionTester token={token} role={user?.role} />
    </div>
  );
}
