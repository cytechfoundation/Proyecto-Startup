import { useEffect, useState } from "react";
import { Palette, Check } from "lucide-react";
import { PALETTES, getThemeId, applyTheme } from "../theme.js";

/** Icono conmutador de paleta del panel (Dashboard + Mi cuenta). */
export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(getThemeId());

  useEffect(() => {
    applyTheme(current);
  }, [current]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Cambiar paleta del panel"
        aria-label="Cambiar paleta del panel"
        className="rounded-lg bg-[var(--t-surface2)] p-2 text-[var(--t-muted)] ring-1 ring-[var(--t-border)] transition-colors hover:text-white"
      >
        <Palette className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] shadow-xl">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-widest text-[var(--t-muted)]">
            Paleta
          </p>
          {Object.entries(PALETTES).map(([id, p]) => (
            <button
              key={id}
              onClick={() => {
                setCurrent(id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--t-surface2)]"
            >
              <span className="flex -space-x-1">
                <span className="h-4 w-4 rounded-full ring-2 ring-[var(--t-surface)]" style={{ background: p.accent }} />
                <span className="h-4 w-4 rounded-full ring-2 ring-[var(--t-surface)]" style={{ background: p.surface2 }} />
              </span>
              <span className="text-white">{p.name}</span>
              {current === id && <Check className="ml-auto h-4 w-4 text-[var(--t-accent)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
