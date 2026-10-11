import { useEffect, useRef, useState } from "react";

const SDK_URL = import.meta.env.VITE_PAYPAL_SDK_URL || "";
const BUTTON_ID = import.meta.env.VITE_PAYPAL_HOSTED_BUTTON_ID || "";

export const paypalConfigured = Boolean(SDK_URL && BUTTON_ID);

/** Botón de donación hospedado de PayPal (SDK + hostedButtonId). */
export default function PaypalDonateButton() {
  const ref = useRef(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!paypalConfigured || !ref.current) return;
    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      try {
        window.paypal.HostedButtons({ hostedButtonId: BUTTON_ID }).render(ref.current);
      } catch {
        if (!cancelled) setErr("No se pudo cargar el botón de PayPal.");
      }
    };

    if (window.paypal?.HostedButtons) {
      render();
      return () => { cancelled = true; };
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.onload = render;
    s.onerror = () => !cancelled && setErr("No se pudo cargar el SDK de PayPal.");
    document.body.appendChild(s);
    return () => { cancelled = true; };
  }, []);

  if (!paypalConfigured) return null;
  if (err) return <p className="text-xs text-red-400">{err}</p>;
  return <div ref={ref} className="mx-auto mt-2 min-h-[3rem] max-w-md" />;
}
