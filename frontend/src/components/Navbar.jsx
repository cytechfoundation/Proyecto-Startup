import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Sun, Moon, ChevronDown, Menu, X, ReceiptText, CalendarDays, FileCheck2, CreditCard, HandCoins } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { getMode, applyMode } from "../theme.js";
import LoginModal from "./LoginModal.jsx";

export function ModeToggle() {
  const [mode, setMode] = useState(getMode());
  useEffect(() => { applyMode(mode); }, [mode]);
  const light = mode === "light";
  return (
    <button
      onClick={() => setMode(light ? "dark" : "light")}
      title={light ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      aria-label={light ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      className="rounded-lg border border-[var(--l-border)] bg-[var(--l-surface)] p-2 text-[var(--l-muted)] transition-all hover:scale-105 hover:text-[var(--l-accent)]"
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}

const FACT_ITEMS = [
  { to: "/facturacion-electronica", label: "Facturación electrónica", desc: "Emite sin fricción", Icon: FileCheck2 },
  { to: "/soluciones/facturacion-dian", label: "Solución Facturación DIAN", desc: "Emisión validada y contingencia", Icon: ReceiptText },
  { to: "/calendario-facturacion", label: "Calendario de Facturación", desc: "Vencimientos y pagos", Icon: CalendarDays },
  { to: "/calendario-tributario", label: "Calendario tributario DIAN", desc: "Diseño oficial 2026", Icon: ReceiptText },
  { to: "/soluciones/middleware-apis", label: "Órdenes y cobros", desc: "Cómo orquestamos pagos", Icon: HandCoins },
  { to: "/#donar", label: "Donaciones", desc: "Aportes públicos", Icon: CreditCard },
];

function FactDropdown({ mobile = false, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className={mobile ? "w-full" : "relative"} onMouseEnter={() => !mobile && setOpen(true)} onMouseLeave={() => !mobile && setOpen(false)}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-1.5 transition-all duration-200 hover:text-[var(--l-text)] ${mobile ? "py-2 text-base text-[var(--l-text)]" : "text-sm text-[var(--l-muted)]"}`}
      >
        Facturación
        <ChevronDown className={`h-4 w-4 transition-all duration-200 ease-in-out ${open ? "rotate-180" : "rotate-0"}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? "max-h-[480px] opacity-100" : "max-h-0 opacity-0"} ${mobile ? "" : "absolute left-0 top-full z-50 w-72 pt-2"}`}>
        <div className={`${mobile ? "border-l-2 border-[var(--l-accent)] pl-4" : "rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-2 shadow-xl"} space-y-1`}>
          {FACT_ITEMS.map(({ to, label, desc, Icon }) => (
            <Link
              key={label}
              to={to}
              onClick={() => { setOpen(false); onNavigate?.(); }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 pl-4 transition-all duration-200 hover:bg-[var(--l-surface2)]"
            >
              <Icon className="h-4 w-4 shrink-0 text-[var(--l-accent)]" />
              <span>
                <span className="block text-sm font-semibold text-[var(--l-text)]">{label}</span>
                <span className="block text-xs text-[var(--l-muted)]">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Navbar() {
  const { token, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [burger, setBurger] = useState(false);
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--l-border)] bg-[var(--l-bg)] backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-extrabold tracking-tight text-[var(--l-text)]">
            CYTECH<span className="text-[var(--l-accent)]">.</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-[var(--l-muted)] md:flex">
            <a href="/#clientes" className="transition-colors hover:text-[var(--l-text)]">Clientes</a>
            <a href="/#servicios" className="transition-colors hover:text-[var(--l-text)]">Servicios</a>
            <FactDropdown />
            <a href="/#fundador" className="transition-colors hover:text-[var(--l-text)]">Fundador</a>
            <a href="/#donar" className="transition-colors hover:text-[var(--l-text)]">Donar</a>
            <a href="/#redes" className="transition-colors hover:text-[var(--l-text)]">Redes</a>
          </div>
          <div className="flex items-center gap-2">
            {token ? (
              <div className="flex items-center gap-3">
                <ModeToggle />
                <Link to="/dashboard" className="hidden text-sm text-[var(--l-text2)] transition-colors hover:text-[var(--l-text)] sm:block">Dashboard</Link>
                <Link to="/cuenta" title={user?.email} className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-extrabold text-white">{initial}</Link>
                <button onClick={logout} title="Cerrar sesión" className="rounded-lg p-2 text-[var(--l-muted)] transition-colors hover:bg-[var(--l-surface2)] hover:text-[var(--l-text)]"><LogOut className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <ModeToggle />
                <Link to="/cuenta-nueva" className="hidden rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition-colors hover:border-cyan-400 sm:block">Crear cuenta</Link>
                <button onClick={() => setOpen(true)} className="hidden rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg sm:block">Ingresar a Demo</button>
              </div>
            )}
            <button onClick={() => setBurger((b) => !b)} aria-label="Menú" className="rounded-lg p-2 text-[var(--l-muted)] hover:bg-[var(--l-surface2)] md:hidden">
              {burger ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
        <div className={`overflow-hidden transition-all duration-200 ease-in-out md:hidden ${burger ? "max-h-[560px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="space-y-2 border-t border-[var(--l-border)] px-6 py-4">
            <a href="/#clientes" onClick={() => setBurger(false)} className="block py-1 text-[var(--l-text)]">Clientes</a>
            <a href="/#servicios" onClick={() => setBurger(false)} className="block py-1 text-[var(--l-text)]">Servicios</a>
            <FactDropdown mobile onNavigate={() => setBurger(false)} />
            <a href="/#fundador" onClick={() => setBurger(false)} className="block py-1 text-[var(--l-text)]">Fundador</a>
            <a href="/#donar" onClick={() => setBurger(false)} className="block py-1 text-[var(--l-text)]">Donar</a>
            <a href="/#redes" onClick={() => setBurger(false)} className="block py-1 text-[var(--l-text)]">Redes</a>
            {!token && <button onClick={() => { setOpen(true); setBurger(false); }} className="mt-2 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Ingresar a Demo</button>}
            {!token && <Link to="/cuenta-nueva" onClick={() => setBurger(false)} className="mt-2 block w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 text-center text-sm font-semibold text-cyan-300">Crear cuenta</Link>}
          </div>
        </div>
      </header>
      <LoginModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
