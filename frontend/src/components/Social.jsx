import { WhatsappIcon, DiscordIcon, GithubIcon } from "./BrandIcons.jsx";
import Reveal from "./Reveal.jsx";

// TODO: reemplaza con los enlaces reales de Cytech
const WHATSAPP_URL = "https://wa.me/573144609907?text=Hola%20Cytech%2C%20quiero%20una%20demo";
const DISCORD_URL = "https://discord.gg/tu-servidor";
const GITHUB_URL = "https://github.com/tu-organizacion";

const card =
  "bg-[var(--l-surface)] backdrop-blur-sm border border-[var(--l-border)] rounded-xl p-6 transition-all duration-300 hover:border-[var(--l-accent)] hover:bg-[var(--l-surface2)] hover:-translate-y-1";
const icon = "text-[var(--l-accent)] bg-[var(--l-accent-soft)] p-2.5 rounded-lg w-fit";

const channels = [
  {
    Icon: WhatsappIcon,
    t: "WhatsApp",
    d: "Respuesta directa para cotizaciones y soporte de la demo.",
    cta: "Chatear",
    href: WHATSAPP_URL,
  },
  {
    Icon: DiscordIcon,
    t: "Discord",
    d: "Únete a la comunidad: dudas técnicas, roadmap y anuncios.",
    cta: "Unirse",
    href: DISCORD_URL,
  },
  {
    Icon: GithubIcon,
    t: "GitHub",
    d: "Explora integraciones, ejemplos y el código de nuestras demos.",
    cta: "Seguir",
    href: GITHUB_URL,
  },
];

export default function Social() {
  return (
    <section id="redes" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--l-accent)]">
          Comunidad
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          Conecta con nosotros
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-[var(--l-muted)]">
          Elige tu canal: hablamos de integraciones, demos y soporte por donde
          prefieras.
        </p>
      </Reveal>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {channels.map(({ Icon, t, d, cta, href }, i) => (
          <Reveal key={t} delay={i * 0.1}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={`${card} block h-full`}
            >
              <div className={icon}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 mt-5 text-lg font-semibold text-[var(--l-text)]">{t}</h3>
              <p className="leading-relaxed text-[var(--l-muted)]">{d}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-[var(--l-accent)]">
                {cta} →
              </span>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
