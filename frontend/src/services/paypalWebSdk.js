// PayPal Web SDK v6 con clientToken (patrón oficial):
// backend genera el token (GET /payments/client-token) o usa VITE_PAYPAL_CLIENT_TOKEN.
const ENV = import.meta.env.VITE_PAYPAL_ENV || "sandbox";
const ENV_TOKEN = import.meta.env.VITE_PAYPAL_CLIENT_TOKEN || "";
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const SRC =
  ENV === "live"
    ? "https://www.paypal.com/web-sdk/v6/core"
    : "https://www.sandbox.paypal.com/web-sdk/v6/core";

let scriptPromise = null;
let instanceCache = null; // { token, promise }

/** Inyecta el script una sola vez y resuelve cuando está listo. */
export function loadPaypalWebSdk() {
  if (window.paypal?.version) return Promise.resolve(window.paypal);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve(window.paypal);
    s.onerror = () => reject(new Error("No se pudo cargar PayPal Web SDK v6"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function fetchClientToken() {
  if (ENV_TOKEN) return ENV_TOKEN;
  const r = await fetch(`${API}/api/v1/payments/client-token`);
  if (!r.ok) throw new Error("Backend sin credenciales PayPal");
  const data = await r.json();
  if (!data.client_token) throw new Error("Sin client_token");
  return data.client_token;
}

/** Crea la instancia v6 con configuración completa (una por token). */
export function getPaypalInstance() {
  if (instanceCache) return instanceCache.promise;
  instanceCache = { promise: (async () => {
    await loadPaypalWebSdk();
    const clientToken = await fetchClientToken();
    try {
      return await window.paypal.createInstance({
        clientToken,
        components: ["paypal-payments"],
        pageType: "checkout",
        clientMetadataId: crypto.randomUUID(),
      });
    } catch (error) {
      console.error("Failed to initialize PayPal SDK:", error);
      throw error;
    }
  })() };
  return instanceCache.promise;
}

/** Callback createOrder del componente v6: retorna { orderId } (forma exigida). */
export async function createV6Order(orderPayload) {
  const response = await fetch(`${API}/paypal-api/checkout/orders/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "No se pudo crear la orden");
  return { orderId: data.id }; // <-- Required return value
} // End createOrder

export function resetPaypalInstance() {
  instanceCache = null;
}

export const paypalWebSdkEnv = ENV;
