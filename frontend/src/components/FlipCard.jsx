import { useState } from "react";
import { RotateCw, Cpu } from "lucide-react";

/** Tarjeta con giro 3D al clic: frente = feature, reverso = qué hace el Middleware/APIs. */
export default function FlipCard({ Icon, title, text, back }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="[perspective:1000px]">
      <button
        onClick={() => setFlipped((f) => !f)}
        title="Toca para girar"
        className="relative block h-72 w-full text-left transition-all duration-300 hover:-translate-y-1 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
      >
        {/* Frente */}
        <div className="absolute inset-0 rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6 backdrop-blur-sm [backface-visibility:hidden]">
          <div className="bg-[var(--l-accent-soft)] p-2.5 rounded-lg text-[var(--l-accent)] w-fit">
            <Icon className="h-6 w-6" />
          </div>
          <h3 className="mb-2 mt-5 text-lg font-semibold text-[var(--l-text)]">{title}</h3>
          <p className="leading-relaxed text-[var(--l-muted)]">{text}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--l-muted)]">
            <RotateCw className="h-3.5 w-3.5" /> Toca para girar
          </span>
        </div>

        {/* Reverso */}
        <div
          className="absolute inset-0 rounded-xl border border-[var(--l-accent)] bg-gradient-to-br from-[var(--l-accent-soft)] via-[var(--l-surface)] to-[var(--l-surface)] p-6 [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          <p className="text-sm font-semibold text-[var(--l-text)]">{title}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--l-accent)]">
            <Cpu className="h-3.5 w-3.5" /> Lo que hace el Middleware / APIs
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--l-text)]">{back}</p>
        </div>
      </button>
    </div>
  );
}
