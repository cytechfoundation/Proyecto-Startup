import { useEffect } from "react";
import { X } from "lucide-react";
import LoginPanel from "./LoginPanel.jsx";

/** Modal corporativo de acceso, anclado al botón "Ingresar a Demo". */
export default function LoginModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-8 elev-2"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top,var(--l-glow-top),transparent_65%)]" />
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--l-muted)] transition-colors hover:bg-[var(--l-surface2)] hover:text-[var(--l-text)]"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="relative">
          <p className="text-2xl font-extrabold tracking-tight">
            CYTECH<span className="text-[var(--l-accent)]">.</span>
          </p>
          <p className="mt-1 text-sm text-[var(--l-muted)]">Demo controlada · Acceso seguro</p>
          <div className="mt-6">
            <LoginPanel onSuccess={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}
