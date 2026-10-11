import { useState } from "react";
import { Award, Briefcase, GraduationCap } from "lucide-react";
import Reveal from "./Reveal.jsx";
import ContactModal from "./ContactModal.jsx";
import { FOUNDER, FOUNDER_SOCIAL } from "../data/founder.js";

const card =
  "bg-[var(--l-surface)] backdrop-blur-sm border border-[var(--l-border)] rounded-xl p-6 transition-all duration-300 hover:border-[var(--l-accent)] hover:bg-[var(--l-surface2)] hover:-translate-y-1";

/** Portafolio del fundador: perfil, consultorías, stack, credenciales y redes personales. */
export default function Founder() {
  const initials = FOUNDER.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const [photoOk, setPhotoOk] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <section id="fundador" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--l-accent)]">
          Fundador
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          Quién construye Cytech
        </h2>
      </Reveal>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Perfil */}
        <Reveal className="lg:col-span-1">
          <div className={`${card} text-center`}>
            {FOUNDER.photo && photoOk ? (
              <img
                src={FOUNDER.photo}
                alt={FOUNDER.name}
                onError={() => setPhotoOk(false)}
                className="mx-auto h-28 w-28 rounded-full border-2 border-[var(--l-accent)] object-cover object-top shadow-lg shadow-cyan-500/20"
              />
            ) : (
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-3xl font-extrabold text-white">
                {initials}
              </div>
            )}
            <h3 className="mt-4 text-xl font-bold">{FOUNDER.name}</h3>
            <p className="mt-1 text-sm text-[var(--l-accent)]">{FOUNDER.role}</p>
            {FOUNDER.bio.map((p, i) => (
              <p key={i} className="mt-3 text-left text-sm leading-relaxed text-[var(--l-muted)]">{p}</p>
            ))}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {FOUNDER_SOCIAL.map(({ Icon, label, desc, href, action }) =>
                action === "contact" ? (
                  <button
                    key={label}
                    onClick={() => setContactOpen(true)}
                    className="flex items-center gap-2 rounded-lg border border-[var(--l-border)] bg-[var(--l-surface)] px-3 py-2.5 text-left transition-all hover:border-[var(--l-accent)]"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[var(--l-accent)]" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-[var(--l-text)]">{label}</span>
                      <span className="block break-all text-[11px] leading-tight text-[var(--l-muted)]">{desc}</span>
                    </span>
                  </button>
                ) : (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    title={desc}
                    className="flex items-center gap-2 rounded-lg border border-[var(--l-border)] bg-[var(--l-surface)] px-3 py-2.5 text-left transition-all hover:border-[var(--l-accent)]"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[var(--l-accent)]" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-[var(--l-text)]">{label}</span>
                      <span className="block break-all text-[11px] leading-tight text-[var(--l-muted)]">{desc}</span>
                    </span>
                  </a>
                )
              )}
            </div>
            <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
          </div>
        </Reveal>

        {/* Consultorías + stack */}
        <Reveal delay={0.1} className="lg:col-span-1">
          <div className={card}>
            <p className="flex items-center gap-2 font-semibold text-[var(--l-text)]">
              <Briefcase className="h-4 w-4 text-[var(--l-accent)]" /> Consultorías & SaaS
            </p>
            <ul className="mt-4 space-y-4">
              {FOUNDER.consulting.map((c) => (
                <li key={c.title}>
                  <p className="text-sm font-semibold text-[var(--l-text)]">{c.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-[var(--l-muted)]">{c.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-[var(--l-muted)]">Stack</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FOUNDER.stack.map((t) => (
                <span key={t} className="rounded-full bg-[var(--l-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--l-accent)]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Credenciales + métricas */}
        <Reveal delay={0.2} className="lg:col-span-1">
          <div className={card}>
            <p className="flex items-center gap-2 font-semibold text-[var(--l-text)]">
              <GraduationCap className="h-4 w-4 text-[var(--l-accent)]" /> Credenciales
            </p>
            <ul className="mt-4 space-y-3">
              {FOUNDER.credentials.map((c) => (
                <li key={c.title} className="flex gap-2.5">
                  <Award className="mt-0.5 h-4 w-4 shrink-0 text-[var(--l-accent)]" />
                  <span>
                    {c.href ? (
                      <a href={c.href} target="_blank" rel="noreferrer"
                         className="block text-sm font-semibold text-[var(--l-accent)] hover:text-[var(--l-accent)] hover:underline">
                        {c.title} ↗
                      </a>
                    ) : (
                      <span className="block text-sm font-semibold text-[var(--l-text)]">{c.title}</span>
                    )}
                    <span className="block text-xs text-[var(--l-muted)]">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <a
              href={FOUNDER.credly}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[var(--l-accent)] bg-[var(--l-accent-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--l-accent)] transition-all hover:scale-[1.01] hover:bg-[var(--l-accent-soft)]"
            >
              <Award className="h-4 w-4" /> Verificar insignias en Credly
            </a>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[var(--l-border)] pt-4 text-center">
              {FOUNDER.metrics.map((m) => (
                <div key={m.label}>
                  <p className="text-xl font-extrabold text-[var(--l-accent)]">{m.value}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-[var(--l-muted)]">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
