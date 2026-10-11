import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, User, Plug, ReceiptText, CreditCard, ShieldCheck, FileText, LogOut, ChevronDown, CalendarDays,
} from "lucide-react";
import ThemeSwitcher from "./ThemeSwitcher.jsx";

export const ACCOUNT_SECTIONS = [
  { id: "panel", label: "Panel de control", Icon: LayoutDashboard },
  { id: "personal", label: "Información personal", Icon: User },
  { id: "integraciones", label: "Mis integraciones", Icon: Plug },
  { id: "seguridad", label: "Seguridad", Icon: ShieldCheck },
  { id: "privacidad", label: "Privacidad", Icon: FileText },
];

const FACT_CHILDREN = [
  { id: "facturas", label: "Mis facturas", Icon: ReceiptText },
  { id: "pagos", label: "Mis pagos", Icon: CreditCard },
];

export default function AccountSidebar({ user, section, onSelect, onLogout }) {
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  const factActive = ["facturas", "pagos"].includes(section);
  const [factOpen, setFactOpen] = useState(factActive);

  return (
    <aside className="w-full shrink-0 rounded-xl bg-[var(--t-surface)] p-5 md:w-64">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--t-accent)] to-[var(--t-accent2)] text-3xl font-extrabold">
          {initial}
        </div>
        <p className="mt-3 font-bold uppercase tracking-wide">{user?.name}</p>
        <p className="mt-1 break-all text-xs text-[var(--t-muted)]">{user?.email}</p>
        <span className="mt-2 rounded-full bg-[var(--t-accent-soft)] px-3 py-0.5 text-xs font-semibold capitalize text-[var(--t-accent)]">
          {user?.role}
        </span>
      </div>

      <nav className="mt-6 space-y-1">
        {ACCOUNT_SECTIONS.slice(0, 3).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
              section === id ? "bg-[var(--t-accent-soft)] font-semibold text-[var(--t-accent)]" : "text-[var(--t-text2)] hover:bg-[var(--t-surface2)] hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}

        <div className="rounded-lg">
          <button
            onClick={() => setFactOpen((o) => !o)}
            aria-expanded={factOpen}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
              factActive ? "bg-[var(--t-accent-soft)] font-semibold text-[var(--t-accent)]" : "text-[var(--t-text2)] hover:bg-[var(--t-surface2)] hover:text-white"
            }`}
          >
            <ReceiptText className="h-4 w-4" /> Facturación
            <ChevronDown className={`ml-auto h-4 w-4 transition-all duration-200 ease-in-out ${factOpen ? "rotate-180" : "rotate-0"}`} />
          </button>
          <div className={`overflow-hidden transition-all duration-200 ease-in-out ${factOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="space-y-1 py-1 pl-6">
              {FACT_CHILDREN.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                    section === id ? "bg-[var(--t-accent-soft)] font-semibold text-[var(--t-accent)]" : "text-[var(--t-text2)] hover:bg-[var(--t-surface2)] hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
              <Link
                to="/calendario-facturacion"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--t-text2)] transition-all duration-200 hover:bg-[var(--t-surface2)] hover:text-white"
              >
                <CalendarDays className="h-4 w-4" /> Calendario
              </Link>
            </div>
          </div>
        </div>

        {ACCOUNT_SECTIONS.slice(3).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
              section === id ? "bg-[var(--t-accent-soft)] font-semibold text-[var(--t-accent)]" : "text-[var(--t-text2)] hover:bg-[var(--t-surface2)] hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      <div className="mt-6 space-y-2 border-t border-[var(--t-border)] pt-4">
        <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--t-text2)]">
          <span>Tema del panel</span>
          <ThemeSwitcher />
        </div>
        <Link to="/dashboard" className="block rounded-lg px-3 py-2 text-sm text-[var(--t-muted)] hover:text-white">
          ← Volver al Dashboard
        </Link>
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-500/10">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
