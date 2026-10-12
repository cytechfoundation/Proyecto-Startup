import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Circle, Rocket, X } from "lucide-react";
import { STEPS, dismissOnboarding, loadOnboarding } from "../services/onboarding.js";

/** Panel de bienvenida para cuentas nuevas: checklist de 3 pasos + progreso.

Solo se muestra hasta que el usuario lo completa o lo oculta con la ×.
*/
export default function OnboardingChecklist({ userName }) {
  const [state, setState] = useState(loadOnboarding);
  if (state.dismissed) return null;

  const doneCount = STEPS.filter((s) => state.done[s.id]).length;
  const allDone = doneCount === STEPS.length;

  return (
    <section className="rounded-xl bg-[var(--t-surface)] p-5" aria-label="Bienvenida">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)]">
            <Rocket className="h-5 w-5 text-white" />
          </span>
          <div>
            <h2 className="font-bold">👋 Bienvenido{userName ? `, ${userName}` : ""}</h2>
            <p className="text-xs text-[var(--t-muted)]">Completa estos pasos para sacarle el máximo a tu cuenta.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--t-surface2)] px-3 py-1 text-xs font-semibold ring-1 ring-[var(--t-border)]">
            {doneCount}/{STEPS.length} completados
          </span>
          <button
            onClick={() => setState(dismissOnboarding())}
            aria-label="Ocultar bienvenida"
            className="rounded-lg p-1.5 text-[var(--t-muted)] transition-colors hover:bg-[var(--t-surface2)] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--t-surface2)]" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={STEPS.length}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] transition-all duration-500"
          style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
        />
      </div>

      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {STEPS.map((step) => {
          const done = !!state.done[step.id];
          return (
            <li key={step.id}>
              <Link
                to={step.to}
                className={`group flex h-full items-start gap-3 rounded-lg border p-3.5 transition-all ${
                  done
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-[var(--t-border)] bg-[var(--t-surface2)] hover:border-[var(--t-accent)] hover:bg-white/[0.03]"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--t-muted)]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${done ? "text-emerald-300" : "text-white"}`}>{step.title}</span>
                  <span className="mt-0.5 block text-xs text-[var(--t-muted)]">{step.desc}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--t-muted)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ol>

      {allDone && (
        <p className="mt-3 text-xs font-semibold text-emerald-400">
          ✅ ¡Todo listo! Puedes ocultar este panel con la × de arriba.
        </p>
      )}
    </section>
  );
}
