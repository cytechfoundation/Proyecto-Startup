import { useState } from "react";

/** Equivalente v2 del botón "Pay with PayPal" (snippet v1 con fetch directo).
 *
 * Diferencias clave:
 * - NO llama a PayPal desde el browser ni expone ACCESS_TOKEN: crea la orden
 *   en nuestro backend (que usa Orders v2 con credenciales del servidor).
 * - En vez de alert(), muestra estado en línea y redirige a approve_url.
 *
 * Uso (admin, Orders v2):
 *   <PayWithPayPalButton label="Pagar $25 USD"
 *     onCreate={(api, token) => api.paypalCreateOrder(token, { amount: "25.00" })} />
 * Uso (donación pública, montos USD 3/5/10/25/50):
 *   <PayWithPayPalButton label="Donar $5 USD"
 *     onCreate={() => api.paypalDonateOrder({ amount_usd: 5, cause: "becas" })} />
 */
export default function PayWithPayPalButton({ label = "Pay with PayPal", onCreate }) {
  const [state, setState] = useState("idle"); // idle|busy|error
  const [detail, setDetail] = useState("");

  const createPayment = async () => {
    setState("busy");
    setDetail("");
    try {
      const data = await onCreate();
      const url = data.approve_url || data.approveUrl;
      if (!url) throw new Error("Sin URL de aprobación");
      window.location.href = url;
    } catch (e) {
      setState("error");
      setDetail(e.message || "Error al crear el pago");
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        onClick={createPayment}
        disabled={state === "busy"}
        className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
      >
        {state === "busy" ? "Creando pago…" : label}
      </button>
      {state === "error" && <span className="text-xs text-red-400">{detail}</span>}
    </span>
  );
}
