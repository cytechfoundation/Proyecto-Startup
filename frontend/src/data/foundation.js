// Donaciones Cytech Foundation vía PayPal.
// Configura tu enlace (botón de donación o paypal.me) en frontend/.env:
// VITE_PAYPAL_DONATE_URL=https://www.paypal.com/donate?hosted_button_id=XXXX
const DONATE_URL = import.meta.env.VITE_PAYPAL_DONATE_URL || "";

export const FOUNDATION = {
  name: "Cytech Foundation",
  contact: "cytechfoundation@gmail.com",
  donateUrl: DONATE_URL,
  paypalMe: "https://www.paypal.com/paypalme/cytechfoundation",
  qr: "/dona-qr.png",
  causes: [
    { id: "becas", label: "Becas de estudio", desc: "Formación en software para jóvenes." },
    { id: "equipos", label: "Equipamiento tecnológico", desc: "Computadores para aulas comunitarias." },
    { id: "talleres", label: "Talleres gratuitos", desc: "Cloud, APIs y facturación electrónica." },
  ],
  amounts: [10000, 25000, 50000, 100000],
  impact: [
    { value: "+120", label: "becas otorgadas" },
    { value: "+30", label: "equipos entregados" },
    { value: "+45", label: "talleres dictados" },
  ],
};
