import { useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
import { loadGooglePaySdks, googlePayConfigured } from "../services/googlePaySdk.js";

const AMOUNTS_USD = [3, 5, 10, 25, 50];
const baseRequest = { apiVersion: 2, apiVersionMinor: 0 };

/** Checkout Google Pay web (PayPal): botón → payment sheet → orden → captura. */
export default function GooglePayButton({ cause }) {
  const container = useRef(null);
  const [amount, setAmount] = useState(5);
  const [state, setState] = useState("cargando"); // cargando|listo|pagando|ok|error|nodisponible
  const [detail, setDetail] = useState("");

  useEffect(() => {
    if (!googlePayConfigured) {
      setState("nodisponible");
      return;
    }
    let cancelled = false;

    const getClient = () =>
      new window.google.payments.api.PaymentsClient({ environment: "TEST", paymentDataCallbacks: { onPaymentAuthorized } });

    async function onPaymentAuthorized(paymentData) {
      try {
        const { id } = await api.paypalDonateOrder({ amount_usd: amount, cause });
        const confirm = await window.paypal.Googlepay().confirmOrder({
          orderId: id,
          paymentMethodData: paymentData.paymentMethodData,
        });
        if (confirm.status === "PAYER_ACTION_REQUIRED") {
          await window.paypal.Googlepay().initiatePayerAction({ orderId: id });
        }
        const cap = await api.paypalDonateCapture(id);
        const ok = JSON.stringify(cap).includes("COMPLETED");
        if (!cancelled) {
          setState(ok ? "ok" : "error");
          setDetail(ok ? `Donación de $${amount} USD confirmada. ¡Gracias!` : "El pago no se completó.");
        }
        return { transactionState: ok ? "SUCCESS" : "ERROR" };
      } catch (e) {
        if (!cancelled) {
          setState("error");
          setDetail("Falló el pago. Intenta de nuevo.");
        }
        return { transactionState: "ERROR" };
      }
    }

    (async () => {
      try {
        await loadGooglePaySdks();
        if (cancelled) return;
        const cfg = await window.paypal.Googlepay().config();
        const client = getClient();
        const resp = await client.isReadyToPay({ ...baseRequest, allowedPaymentMethods: cfg.allowedPaymentMethods });
        if (cancelled) return;
        if (!resp.result) {
          setState("nodisponible");
          return;
        }
        container.current.innerHTML = "";
        const btn = client.createButton({
          onClick: async () => {
            const req = {
              ...baseRequest,
              allowedPaymentMethods: cfg.allowedPaymentMethods,
              merchantInfo: cfg.merchantInfo,
              transactionInfo: { countryCode: "US", currencyCode: "USD", totalPriceStatus: "FINAL", totalPrice: String(amount) },
              callbackIntents: ["PAYMENT_AUTHORIZATION"],
            };
            getClient().loadPaymentData(req);
          },
        });
        if (!cancelled) container.current.appendChild(btn);
        setState("listo");
      } catch {
        if (!cancelled) setState("nodisponible");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, cause]);

  if (!googlePayConfigured) return null;

  return (
    <div className="mx-auto mt-4 max-w-md rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-4">
      <p className="text-sm font-semibold text-[var(--l-text)]">Donar con Google Pay (USD)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {AMOUNTS_USD.map((a) => (
          <button
            key={a}
            onClick={() => setAmount(a)}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${amount === a ? "bg-[var(--l-accent-soft)] text-[var(--l-accent)] ring-1 ring-[var(--l-accent)]" : "bg-[var(--l-surface2)] text-[var(--l-text)] ring-1 ring-[var(--l-border)]"}`}
          >
            ${a}
          </button>
        ))}
      </div>
      <div ref={container} className="mt-3 min-h-[2.5rem]" />
      {state === "ok" && <p className="mt-2 text-sm text-[var(--l-ok)]">{detail}</p>}
      {state === "error" && <p className="mt-2 text-sm text-red-400">{detail}</p>}
      {state === "nodisponible" && <p className="mt-2 text-xs text-[var(--l-muted)]">Google Pay no disponible en este navegador/dispositivo.</p>}
    </div>
  );
}
