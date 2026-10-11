import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  CreditCard,
  ExternalLink,
  GraduationCap,
  Heart,
  HeartHandshake,
  Laptop,
  LineChart,
  Share2,
  Users,
  Zap,
} from "lucide-react";
import Reveal from "./Reveal.jsx";
import PaypalDonateButton, { paypalConfigured } from "./PaypalDonateButton.jsx";
import GooglePayButton from "./GooglePayButton.jsx";
import { api } from "../services/api.js";
import { loadPaypalWebSdk, getPaypalInstance, paypalWebSdkEnv } from "../services/paypalWebSdk.js";
import { FOUNDATION } from "../data/foundation.js";

const ICONS = { GraduationCap, Laptop, Users };

const fmtCOP = (n) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const fmtUSD = (n) => `$${(Number(n) || 0).toFixed(2).replace(".", ",")}`;

/**
 * Donaciones Cytech Foundation.
 * Diseño: héroe + chips de causa, conversor COP ⇄ USD, aportes rápidos,
 * panel de impacto por causa y tarjeta QR. Conserva el flujo PayPal
 * (link donativo / Web SDK v6 / registro de intención) del diseño anterior.
 */
export default function Donate() {
  const fx = FOUNDATION.fxRate;
  const [cause, setCause] = useState(FOUNDATION.causes[0].id);
  const [cop, setCop] = useState(FOUNDATION.amounts[1]); // monto en pesos (fuente de verdad)
  const [side, setSide] = useState("cop"); // qué campo está editando el usuario: cop | usd
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(null);
  const [err, setErr] = useState("");
  const [sdk, setSdk] = useState("cargando");
  const [copied, setCopied] = useState(false);
  // Cifras de impacto en vivo (clave -> {value, unit}); si el backend no responde,
  // se usan las estáticas de FOUNDATION.
  const [impacto, setImpacto] = useState({});

  useEffect(() => {
    let vivo = true;
    api
      .impactCounters()
      .then((d) => {
        if (!vivo) return;
        setImpacto(Object.fromEntries((d.counters || []).map((c) => [c.key, c])));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const usd = cop / fx;
  const active = FOUNDATION.causes.find((c) => c.id === cause) ?? FOUNDATION.causes[0];
  const url = FOUNDATION.donateUrl;
  const valido = cop >= FOUNDATION.minAmount;

  const setCopAmount = (n) => {
    setCop(Math.max(0, Math.round(Number(n) || 0)));
    setSide("cop");
  };

  const onCopInput = (raw) => setCopAmount(raw.replace(/[^0-9]/g, ""));

  const onUsdInput = (raw) => {
    const num = Number(raw.replace(/[^0-9.]/g, ""));
    setCop(Number.isFinite(num) ? num * fx : 0);
    setSide("usd");
  };

  const swap = () => {
    setCop(Math.round(usd * fx));
    setSide((s) => (s === "cop" ? "usd" : "cop"));
  };

  const share = async () => {
    const link = FOUNDATION.paypalMe;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Dona a Cytech Foundation", text: "Apoya becas, equipos y talleres", url: link });
        return;
      }
      throw new Error("sin-share");
    } catch {
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        setErr("Copia este enlace: " + link);
      }
    }
  };

  // PayPal Web SDK v6 disponible en esta página de pagos + instancia paypal-payments
  useEffect(() => {
    loadPaypalWebSdk().then(
      () => {
        setSdk("listo");
        getPaypalInstance().then(
          () => setSdk("instancia-lista"),
          () => setSdk("sin-token")
        );
      },
      () => setSdk("no-disponible")
    );
  }, []);

  const pledge = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const data = await api.donate({ name, email, amount: cop, cause });
      setSent(data);
    } catch {
      setErr("Revisa nombre, correo y monto.");
    }
  };

  const input =
    "w-full rounded-lg bg-[var(--l-surface2)] px-4 py-2.5 text-sm ring-1 ring-[var(--l-border)] focus:outline-none focus:ring-[var(--l-accent)]";
  const fieldBox = (on) =>
    `flex items-center gap-2 rounded-xl bg-[var(--l-surface2)] px-3 py-2.5 ring-1 transition-all ${
      on ? "ring-[var(--l-accent)]" : "ring-transparent"
    }`;

  return (
    <section id="donar" className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-16 md:py-20">
      {/* Líneas diagonales del diseño (decoro, sin interacción) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden md:block">
        <div className="absolute -left-28 top-16 h-64 w-64 rotate-[35deg] border-l-2 border-amber-400/25" />
        <div className="absolute -right-24 top-4 h-72 w-72 -rotate-[35deg] border-r-2 border-cyan-400/20" />
        <div className="absolute -right-10 bottom-10 h-40 w-40 -rotate-[35deg] border-r-2 border-cyan-400/15" />
      </div>

      <Reveal>
        {/* ---------------------------------------------------- héroe */}
        <header className="text-center">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[var(--l-warn)]">
            <Heart className="h-4 w-4 fill-current" /> {FOUNDATION.name}
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">
            Impulsa oportunidades con tu <span className="text-[var(--l-accent)]">donación</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[var(--l-muted)] md:text-lg">
            Tu apoyo nos permite financiar becas de estudio y formación tecnológica, abriendo puertas
            a un futuro mejor para más jóvenes.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {FOUNDATION.causes.map((c) => {
              const Icon = ICONS[c.icon] ?? HeartHandshake;
              const on = cause === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCause(c.id)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                    on
                      ? "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/25"
                      : "border border-[var(--l-border)] text-[var(--l-text2)] hover:border-[var(--l-accent)] hover:text-[var(--l-text)]"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {c.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* ---------------------------------------------------- dos columnas */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          {/* ------- monto + conversor + CTA ------- */}
          <div className="rounded-3xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6 md:p-8">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--l-accent-soft)] text-[var(--l-accent)]">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold">Monto de tu donación</h3>
                <p className="text-sm text-[var(--l-muted)]">Conviértelo de COP a USD y haz la diferencia.</p>
              </div>
            </div>

            {/* conversor COP ⇄ USD */}
            <div className="mt-5 grid items-center gap-3 rounded-2xl border border-[var(--l-border)] bg-[var(--l-bg)] p-3 sm:grid-cols-[1fr_auto_1fr]">
              <div className={fieldBox(side === "cop")}>
                <span className="text-lg font-bold text-[var(--l-muted)]">$</span>
                <input
                  value={fmtCOP(cop)}
                  onChange={(e) => onCopInput(e.target.value)}
                  inputMode="numeric"
                  aria-label="Monto en pesos colombianos"
                  className="w-full min-w-0 bg-transparent text-lg font-bold text-[var(--l-text)] outline-none"
                />
                <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--l-bg)] px-2 py-1 text-xs font-semibold text-[var(--l-text2)]">
                  🇨🇴 COP
                </span>
              </div>

              <button
                onClick={swap}
                aria-label="Invertir moneda editada (COP ⇄ USD)"
                className="mx-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--l-accent-soft)] text-[var(--l-accent)] transition-transform duration-200 hover:rotate-180"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>

              <div className={fieldBox(side === "usd")}>
                <span className="text-lg font-bold text-[var(--l-muted)]">≈</span>
                <input
                  value={fmtUSD(usd)}
                  onChange={(e) => onUsdInput(e.target.value)}
                  inputMode="decimal"
                  aria-label="Monto en dólares"
                  className="w-full min-w-0 bg-transparent text-lg font-bold text-[var(--l-text)] outline-none"
                />
                <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--l-bg)] px-2 py-1 text-xs font-semibold text-[var(--l-text2)]">
                  🇺🇸 USD
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--l-muted)]">
              Tipo de cambio referencial (1 USD = {fmtCOP(fx)} COP) · El valor final puede variar según el
              proveedor de pago.
            </p>

            {/* aportes rápidos */}
            <p className="mt-6 flex items-center gap-2 text-sm font-bold">
              <Zap className="h-4 w-4 text-[var(--l-accent)]" /> Aportes rápidos
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FOUNDATION.amounts.map((a) => {
                const on = cop === a && side === "cop";
                return (
                  <button
                    key={a}
                    onClick={() => setCopAmount(a)}
                    aria-pressed={on}
                    className={`rounded-xl px-3 py-3 text-center transition-all ${
                      on
                        ? "bg-[var(--l-accent-soft)] text-[var(--l-accent)] ring-1 ring-[var(--l-accent)]"
                        : "bg-[var(--l-surface2)] text-[var(--l-text)] ring-1 ring-[var(--l-border)] hover:ring-[var(--l-accent)]"
                    }`}
                  >
                    <span className="block text-base font-extrabold">$ {fmtCOP(a)}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wider opacity-70">
                      COP · {fmtUSD(a / fx)}
                    </span>
                  </button>
                );
              })}
            </div>
            {!valido && (
              <p className="mt-2 text-xs text-amber-400">
                El monto mínimo es {fmtCOP(FOUNDATION.minAmount)} COP (≈ {fmtUSD(FOUNDATION.minAmount / fx)}).
              </p>
            )}

            {/* CTA + compartir */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-4 font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 transition-all duration-300 hover:scale-[1.01]"
                >
                  Donar {fmtUSD(usd)} USD con PayPal <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <p className="flex-1 text-sm text-[var(--l-muted)]">
                  Configura <code>VITE_PAYPAL_DONATE_URL</code> para activar el botón de PayPal.
                </p>
              )}
              <button
                onClick={share}
                title="Compartir enlace de donación"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--l-accent)] px-5 py-4 text-sm font-semibold text-[var(--l-text)] transition-all hover:bg-[var(--l-accent-soft)]"
              >
                {copied ? <Check className="h-4 w-4 text-[var(--l-ok)]" /> : <Share2 className="h-4 w-4" />}
                {copied ? "¡Enlace copiado!" : "Compartir"}
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-[var(--l-muted)]">
              Aproximado: {fmtUSD(usd)} USD · {fmtCOP(cop)} COP · paypal.me/cytechfoundation
            </p>

            {/* pago inmediato (Web SDK v6) o registro de intención */}
            <div className="mt-6">
              {url ? (
                <GooglePayButton cause={cause} />
              ) : paypalConfigured ? (
                <div className="rounded-2xl border border-[var(--l-border)] bg-[var(--l-bg)] p-4">
                  <p className="mb-2 text-sm text-[var(--l-muted)]">Donación inmediata con PayPal:</p>
                  <PaypalDonateButton />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Billetera PayPal", "Visa", "Mastercard", "Amex", "Google Pay", "Apple Pay"].map((m) => (
                      <span key={m} className="rounded-full border border-[var(--l-border)] px-3 py-1 text-xs text-[var(--l-text2)]">
                        {m}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-[var(--l-muted)]">
                    Al pagar con tu tarjeta reconoces que tus datos serán procesados por PayPal de acuerdo
                    con su Declaración de Privacidad en PayPal.com. Web SDK v6 ({paypalWebSdkEnv}):{" "}
                    {sdk === "instancia-lista"
                      ? "instancia paypal-payments lista"
                      : sdk === "sin-token"
                        ? "falta Client ID/SECRET en el backend para el token"
                        : sdk === "listo"
                          ? "creando instancia…"
                          : sdk === "cargando"
                            ? "cargando…"
                            : "no disponible, usa el botón superior"}
                    .
                  </p>
                </div>
              ) : sent ? (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-[var(--l-ok)]">
                  ¡Gracias, {sent.name}! Registramos tu aporte de <b>{fmtCOP(sent.amount)} COP</b> para{" "}
                  <b>{active.label.toLowerCase()}</b> (ref #{sent.id}). Te escribiremos a {sent.email} para
                  coordinar el pago.
                </div>
              ) : (
                <form onSubmit={pledge} className="space-y-2 rounded-2xl border border-[var(--l-border)] bg-[var(--l-bg)] p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tu nombre"
                      className={input}
                      required
                      minLength={2}
                    />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Tu correo"
                      type="email"
                      className={input}
                      required
                    />
                  </div>
                  <button
                    disabled={!valido}
                    className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3.5 font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition-all duration-300 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirmar donación de {fmtCOP(cop)} COP (≈ {fmtUSD(usd)})
                  </button>
                  {err && <p className="text-xs text-red-400">{err}</p>}
                  <p className="text-xs text-[var(--l-muted)]">
                    O escríbenos a {FOUNDATION.contact}. El botón PayPal se activa solo al configurar{" "}
                    <code>VITE_PAYPAL_DONATE_URL</code>.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* ------- impacto + QR ------- */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--l-accent-soft)] text-[var(--l-accent)]">
                  <LineChart className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">Tu aporte transforma</h3>
                    {Object.keys(impacto).length > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--l-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--l-accent)]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" /> en vivo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--l-muted)]">
                    Con tu donación, más jóvenes pueden acceder a educación y tecnología.
                  </p>
                </div>
              </div>

              <ul className="mt-5 space-y-4">
                {FOUNDATION.causes.map((c) => {
                  const Icon = ICONS[c.icon] ?? HeartHandshake;
                  const on = cause === c.id;
                  const vivo = impacto[c.id];
                  const cifra = vivo?.value ?? c.impact.value;
                  const unidad = vivo?.unit ?? c.impact.unit;
                  const tone =
                    c.tone === "amber"
                      ? "from-amber-400 to-orange-500 text-slate-950"
                      : "from-cyan-400 to-blue-600 text-white";
                  return (
                    <li
                      key={c.id}
                      title={vivo?.updated_at ? `Actualizado ${new Date(vivo.updated_at).toLocaleString("es-CO")}` : undefined}
                      className={`flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors ${
                        on ? "bg-[var(--l-accent-soft)]" : ""
                      }`}
                    >
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br ${tone}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{c.label}</p>
                        <p className="truncate text-xs text-[var(--l-muted)]">{c.impact.note}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`text-lg font-extrabold ${
                            c.tone === "amber" ? "text-[var(--l-warn)]" : "text-[var(--l-accent)]"
                          }`}
                        >
                          +{cifra}
                        </p>
                        <p className="text-[11px] uppercase tracking-wider text-[var(--l-muted)]">{unidad}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-3xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 fill-[var(--l-warn)] text-[var(--l-warn)]" />
                <h4 className="font-bold">Escanea para donar</h4>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <p className="text-sm text-[var(--l-muted)]">También puedes donar desde tu móvil.</p>
                <ArrowUpRight className="h-6 w-6 shrink-0 rotate-90 text-[var(--l-accent)]" aria-hidden />
                <div className="relative shrink-0 rounded-xl bg-white p-2">
                  <span className="absolute -left-1 -top-1 h-3 w-3 border-l-2 border-t-2 border-[var(--l-accent)]" />
                  <span className="absolute -right-1 -top-1 h-3 w-3 border-r-2 border-t-2 border-[var(--l-accent)]" />
                  <span className="absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-[var(--l-accent)]" />
                  <span className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-[var(--l-accent)]" />
                  <img
                    src={FOUNDATION.qr}
                    alt="QR de donación Cytech Foundation"
                    className="h-24 w-24 object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- cierre */}
        <div className="mt-12 flex items-center justify-center gap-4 text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--l-muted)]">
          <span className="h-px w-10 bg-[var(--l-border)]" />
          Juntos construimos más oportunidades
          <span className="h-px w-10 bg-[var(--l-border)]" />
        </div>
      </Reveal>
    </section>
  );
}
