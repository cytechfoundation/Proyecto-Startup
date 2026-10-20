import { Link } from "react-router-dom";
import Reveal from "./Reveal.jsx";
import { SOLUTIONS } from "../data/solutions.js";

const card =
  "block h-full bg-[var(--l-surface)] border border-[var(--l-border)] rounded-xl p-6 elev-1 transition-all duration-300 hover:border-[var(--l-accent)] hover:bg-[var(--l-surface2)] hover:elev-2 hover:-translate-y-1";
const icon = "text-[var(--l-accent)] bg-[var(--l-accent-soft)] p-2.5 rounded-lg w-fit";

const services = SOLUTIONS.filter((s) => s.kind === "servicio");

export default function Services() {
  return (
    <section id="servicios" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--l-accent)]">
          Portafolio
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          Servicios
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-[var(--l-muted)]">
          Capacidades técnicas que sostienen la demo que verás al ingresar:
          volumen transaccional, facturas y webhooks en vivo. Toca una tarjeta
          para ver el detalle.
        </p>
      </Reveal>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {services.map((s, i) => (
          <Reveal key={s.slug} delay={i * 0.1}>
            <Link to={`/soluciones/${s.slug}`} className={card}>
              <div className={icon}>
                <s.Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 mt-5 text-lg font-semibold text-[var(--l-text)]">{s.title}</h3>
              <p className="leading-relaxed text-[var(--l-muted)]">{s.short}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-[var(--l-accent)]">
                Ver detalle →
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
