import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LoginPanel from "../components/LoginPanel.jsx";

/** Página de acceso (diseño corporativo unificado con el modal del Navbar). */
export default function Login() {
  const { token } = useAuth();
  if (token) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--l-bg)] px-4 text-[var(--l-text)] antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1E293B,transparent_60%)]" />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--l-border)] bg-[var(--l-bg)] p-8 shadow-2xl shadow-cyan-500/10">
        <p className="text-2xl font-extrabold tracking-tight">
          CYTECH<span className="text-[var(--l-accent)]">.</span>
        </p>
        <p className="mt-1 text-sm text-[var(--l-muted)]">Demo controlada · Acceso seguro</p>
        <div className="mt-6">
          <LoginPanel />
        </div>
      </div>
    </div>
  );
}
