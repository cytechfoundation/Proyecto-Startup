import { useState } from "react";
import { ChevronDown } from "lucide-react";

/** Panel colapsable estilo SIMO: cabecera de color + contenido plegable. */
export default function Collapsible({ title, icon: Icon, tone = "blue", defaultOpen = false, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  const tones = {
    blue: "bg-blue-500/80",
    red: "bg-red-500/80",
    green: "bg-emerald-600/80",
    slate: "bg-slate-700/80",
  };
  return (
    <div className="overflow-hidden rounded-lg shadow-lg">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-center gap-2 px-4 py-3 font-semibold text-white ${tones[tone]}`}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {title}
        {badge && <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs">{badge}</span>}
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="bg-[var(--t-surface)] p-5">{children}</div>}
    </div>
  );
}
