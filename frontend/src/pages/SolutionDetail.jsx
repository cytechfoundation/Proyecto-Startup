import { Link, Navigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Reveal from "../components/Reveal.jsx";
import FlipCard from "../components/FlipCard.jsx";
import { findSolution, middlewareBack } from "../data/solutions.js";

/** Detalle de solución: /soluciones/:slug (hero, features, integraciones, KPIs, pasos, CTA). */
export default function SolutionDetail() {
  const { slug } = useParams();
  const s = findSolution(slug);
  if (!s) return <Navigate to="/" replace />;
  const { Icon } = s;

  return (
    <div className="relative min-h-screen bg-[var(--l-bg)] text-[var(--l-text)] antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1E293B,transparent_60%)]" />
      <div className="relative">
        <Navbar />
        <main className="mx-auto max-w-6xl px-6">
          <Link to="/" className="mt-8 inline-flex items-center gap-2 text-sm text-[var(--l-muted)] transition-colors hover:text-[var(--l-text)]">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="py-12 md:py-16">
            <div className="flex items-center gap-4">
              <div className="bg-[var(--l-accent-soft)] p-3 rounded-xl text-[var(--l-accent)] w-fit">
                <Icon className="h-8 w-8" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[var(--l-accent)]">{s.kind}</p>
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">{s.title}</h1>
            <p className="mt-4 max-w-2xl text-xl leading-relaxed text-[var(--l-text2)]">{s.tagline}</p>
            {s.description.map((p, i) => (
              <p key={i} className="mt-4 max-w-3xl leading-relaxed text-[var(--l-muted)]">{p}</p>
            ))}
          </motion.div>

          <div className="grid gap-4 py-6 md:grid-cols-3">
            {s.kpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-[var(--l-accent)] bg-[var(--l-accent-soft)] p-6 text-center">
                <p className="text-3xl font-extrabold text-[var(--l-accent)]">{k.value}</p>
                <p className="mt-1 text-sm text-[var(--l-muted)]">{k.label}</p>
              </div>
            ))}
          </div>

          <Reveal>
            <h2 className="mt-10 text-2xl font-bold tracking-tight md:text-3xl">Qué incluye</h2>
            <p className="mt-2 text-sm text-[var(--l-muted)]">Toca una tarjeta para girarla y ver qué hace el Middleware / APIs.</p>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {s.features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.07}>
                <FlipCard
                  Icon={f.Icon}
                  title={f.title}
                  text={f.text}
                  back={middlewareBack(s.slug, f.title)}
                />
              </Reveal>
            ))}
          </div>

          <Reveal>
            <h2 className="mt-14 text-2xl font-bold tracking-tight md:text-3xl">Integraciones</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {s.integrations.map((name) => (
                <span key={name} className="inline-flex items-center gap-2 rounded-full border border-[var(--l-border)] bg-[var(--l-surface)] px-4 py-2 text-sm text-[var(--l-text)]">
                  <CheckCircle2 className="h-4 w-4 text-[var(--l-accent)]" /> {name}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal>
            <h2 className="mt-14 text-2xl font-bold tracking-tight md:text-3xl">Cómo empezamos</h2>
            <ol className="mt-6 grid gap-4 md:grid-cols-3">
              {s.steps.map((st, i) => (
                <li key={st.title} className="rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6">
                  <p className="text-3xl font-extrabold text-cyan-500/60">0{i + 1}</p>
                  <h3 className="mt-3 font-semibold text-[var(--l-text)]">{st.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--l-muted)]">{st.text}</p>
                </li>
              ))}
            </ol>
          </Reveal>

          {s.infra && (
            <Reveal>
              <div className="my-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-8 md:p-10">
                <p className="text-sm font-semibold uppercase tracking-widest text-[var(--l-ok)]">
                  Arquitectura · Soberanía de datos
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{s.infra.title}</h2>
                <p className="mt-3 max-w-3xl leading-relaxed text-[var(--l-text2)]">{s.infra.text}</p>
                <ul className="mt-4 space-y-2">
                  {s.infra.options.map((o) => (
                    <li key={o} className="flex gap-2.5 text-sm text-[var(--l-text2)]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--l-ok)]" /> {o}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm font-semibold text-[var(--l-ok)]">{s.infra.foot}</p>
              </div>
            </Reveal>
          )}

          <Reveal>
            <div className="my-16 rounded-2xl border border-[var(--l-accent)] bg-gradient-to-r from-cyan-500/10 via-blue-600/10 to-transparent p-10 text-center">
              <h2 className="text-2xl font-bold md:text-3xl">¿Hablamos de tu caso?</h2>
              <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[var(--l-muted)]">
                Agenda una demo y mira {s.title} funcionando con tus propios datos.
              </p>
              <Link
                to="/login"
                className="group mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-[1.02] hover:from-cyan-400 hover:to-blue-500"
              >
                Ingresar a Demo Controlada
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>
        </main>
        <Footer />
      </div>
    </div>
  );
}
