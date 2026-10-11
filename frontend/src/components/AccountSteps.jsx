import { Check } from "lucide-react";
import { ACCOUNT_SECTIONS } from "./AccountSidebar.jsx";

/** Stepper superior estilo SIMO: 5 pasos con estado completado. */
export default function AccountSteps({ done, onSelect }) {
  const steps = ACCOUNT_SECTIONS.slice(1); // personal → seguridad
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--t-surface)] p-5 sm:grid-cols-3 lg:grid-cols-6">
      {steps.map(({ id, label, Icon }, i) => {
        const ok = !!done[id];
        return (
          <button key={id} onClick={() => onSelect(id)} className="group flex flex-col items-center gap-2 text-center">
            <span className={`flex h-12 w-16 items-center justify-center rounded-md transition-all group-hover:scale-105 ${ok ? "bg-emerald-500/80" : "bg-[var(--t-accent2)]"}`}>
              {ok ? <Check className="h-5 w-5 text-white" /> : <Icon className="h-5 w-5 text-white" />}
            </span>
            <span className="text-xs text-[var(--t-text2)]">
              {i + 1}. {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
