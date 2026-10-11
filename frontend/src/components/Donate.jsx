import { useEffect, useState } from "react";
import { HeartHandshake, ExternalLink, Share2, Check } from "lucide-react";
import Reveal from "./Reveal.jsx";
import PaypalDonateButton, { paypalConfigured } from "./PaypalDonateButton.jsx";
import GooglePayButton from "./GooglePayButton.jsx";
import { api } from "../services/api.js";
import { loadPaypalWebSdk, getPaypalInstance, paypalWebSdkEnv } from "../services/paypalWebSdk.js";
import { FOUNDATION } from "../data/foundation.js";

const fmt = (n) => `$ ${n.toLocaleString("es-CO")}`;

/** Donaciones Cytech Foundation: causa + monto + registro del aporte. */
export default function Donate() {
  const [cause, setCause] = useState(FOUNDATION.causes[0].id);
  const [amount, setAmount] = useState(FOUNDATION.amounts[1]);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(null);
  const [err, setErr] = useState("");
  const [sdk, setSdk] = useState("cargando");
  const [copied, setCopied] = useState(false);

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

  const value = Number(custom) > 0 ? Number(custom) : amount;
  const active = FOUNDATION.causes.find((c) => c.id === cause);
  const url = FOUNDATION.donateUrl;

  const pledge = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const data = await api.donate({ name, email, amount: value, cause });
      setSent(data);
    } catch (e2) {
      setErr("Revisa nombre, correo y monto.");
    }
  };

  const input = "w-full rounded-lg bg-[var(--l-surface2)] px-4 py-2.5 text-sm ring-1 ring-[var(--l-border)] focus:outline-none focus:ring-amber-400";

  return (
    <section id="donar" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/10 via-transparent to-cyan-500/10 p-10 text-center md:p-14">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[var(--l-warn)]">
            <HeartHandshake className="h-4 w-4" /> {FOUNDATION.name}
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            Donación para {active.label.toLowerCase()}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-[var(--l-muted)]">
            Tu apoyo nos permite seguir impulsando iniciativas tecnológicas y educativas en
            nuestra comunidad. Con tu contribución, {FOUNDATION.name} puede financiar{" "}
            {active.desc.charAt(0).toLowerCase() + active.desc.slice(1)} ¡Muchas gracias por
            tu generosidad!
          </p>

          <div className="mx-auto mt-8 max-w-xl">
            <div className="flex flex-wrap justify-center gap-2">
              {FOUNDATION.causes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCause(c.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    cause === c.id
                      ? "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950"
                      : "border border-[var(--l-border)] text-[var(--l-text2)] hover:border-amber-400/50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FOUNDATION.amounts.map((a) => (
                <button
                  key={a}
                  onClick={() => { setAmount(a); setCustom(""); }}
                  className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-all ${
                    value === a && !custom
                      ? "bg-[var(--l-accent-soft)] text-[var(--l-accent)] ring-1 ring-[var(--l-accent)]"
                      : "bg-[var(--l-surface)] text-[var(--l-text)] ring-1 ring-[var(--l-border)] hover:ring-[var(--l-accent)]/50"
                  }`}
                >
                  {fmt(a)}
                </button>
              ))}
            </div>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Otro monto (COP)"
              inputMode="numeric"
              className="mt-2 w-full rounded-lg bg-[var(--l-surface2)] px-4 py-2.5 text-center text-sm ring-1 ring-[var(--l-border)] focus:outline-none focus:ring-amber-400"
            />

            {url ? (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3.5 font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition-all duration-300 hover:scale-[1.02]"
                  >
                    Donar {fmt(value)} con PayPal <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={share}
                    title="Compartir enlace de donación"
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-5 py-3.5 text-sm font-semibold text-[var(--l-warn)] transition-all hover:scale-[1.02] hover:bg-amber-400/20"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    {copied ? "¡Enlace copiado!" : "Compartir"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--l-muted)]">paypal.me/cytechfoundation</p>
                <GooglePayButton cause={cause} />
                <div className="mx-auto mt-5 w-48 rounded-2xl border border-[var(--l-border)] bg-white p-3">
                  <p className="mb-2 text-center text-xs font-bold text-slate-900">o escanea para donar</p>
                  <img src={FOUNDATION.qr} alt="QR de donación Cytech Foundation" className="mx-auto w-full" />
                </div>
              </div>
            ) : paypalConfigured ? (
              <div className="mx-auto mt-6 max-w-md">
                <p className="mb-2 text-sm text-[var(--l-muted)]">Donación inmediata con PayPal:</p>
                <PaypalDonateButton />
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {["Billetera PayPal", "Visa", "Mastercard", "Amex", "Google Pay", "Apple Pay"].map((m) => (
                    <span key={m} className="rounded-full border border-[var(--l-border)] px-3 py-1 text-xs text-[var(--l-text2)]">{m}</span>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-[var(--l-muted)]">
                  Al pagar con tu tarjeta reconoces que tus datos serán procesados por PayPal de
                  acuerdo con su Declaración de Privacidad en PayPal.com. Web SDK v6 ({paypalWebSdkEnv}):{" "}
                  {sdk === "instancia-lista"
                    ? "instancia paypal-payments lista"
                    : sdk === "sin-token"
                      ? "falta Client ID/SECRET en el backend para el token"
                      : sdk === "listo"
                        ? "creando instancia…"
                        : sdk === "cargando" ? "cargando…" : "no disponible, usa el botón superior"}.
                </p>
              </div>
            ) : sent ? (
              <div className="mx-auto mt-6 max-w-md rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-[var(--l-ok)]">
                ¡Gracias, {sent.name}! Registramos tu aporte de <b>{fmt(sent.amount)}</b> para{" "}
                <b>{active.label.toLowerCase()}</b> (ref #{sent.id}). Te escribiremos a {sent.email}{" "}
                para coordinar el pago.
              </div>
            ) : (
              <form onSubmit={pledge} className="mx-auto mt-6 max-w-md space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre"
                         className={input} required minLength={2} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Tu correo"
                         type="email" className={input} required />
                </div>
                <button className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3.5 font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition-all duration-300 hover:scale-[1.02]">
                  Confirmar donación de {fmt(value)}
                </button>
                {err && <p className="text-xs text-red-400">{err}</p>}
                <p className="text-xs text-[var(--l-muted)]">
                  O escríbenos a {FOUNDATION.contact}. El botón PayPal se activa solo al configurar{" "}
                  <code>VITE_PAYPAL_DONATE_URL</code>.
                </p>
              </form>
            )}
          </div>

          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-2 border-t border-[var(--l-border)] pt-6 text-center">
            {FOUNDATION.impact.map((m) => (
              <div key={m.label}>
                <p className="text-2xl font-extrabold text-[var(--l-warn)]">{m.value}</p>
                <p className="mt-0.5 text-xs text-[var(--l-muted)]">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
