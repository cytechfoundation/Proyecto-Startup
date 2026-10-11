import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal.jsx";

export default function CtaBand() {
  return (
    <section id="contacto" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-[var(--l-accent)] bg-gradient-to-r from-cyan-500/10 via-blue-600/10 to-transparent p-10 text-center md:p-14">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--l-accent-soft)] blur-3xl" />
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Mira la plataforma en acción
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[var(--l-muted)]">
            Ingresa con tu cuenta federada y explora analíticas en tiempo real,
            gestión de usuarios y control de roles.
          </p>
          <Link
            to="/login"
            className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-[1.02] hover:from-cyan-400 hover:to-blue-500"
          >
            Ingresar a Demo Controlada
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
