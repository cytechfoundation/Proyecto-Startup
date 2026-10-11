// Carga Google Pay JS + PayPal JS SDK (componente googlepay) para checkout web.
// Requiere VITE_PAYPAL_CLIENT_ID (REST) y Google Pay habilitado en el dashboard PayPal.
const CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";
const PP_SDK = (id) =>
  `https://www.paypal.com/sdk/js?client-id=${id}&currency=USD&components=googlepay`;
const G_SDK = "https://pay.google.com/gp/p/js/pay.js";

let promise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

/** Carga ambos SDKs una sola vez. Falla si no hay Client ID. */
export function loadGooglePaySdks() {
  if (!CLIENT_ID) return Promise.reject(new Error("Falta VITE_PAYPAL_CLIENT_ID"));
  if (promise) return promise;
  promise = Promise.all([loadScript(PP_SDK(CLIENT_ID)), loadScript(G_SDK)]);
  return promise;
}

export const googlePayConfigured = Boolean(CLIENT_ID);
