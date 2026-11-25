// Donaciones Cytech Foundation vía PayPal.
// Configura en frontend/.env:
//   VITE_PAYPAL_DONATE_URL=https://www.paypal.com/donate?hosted_button_id=XXXX
//   VITE_FX_RATE=4000   (pesos colombianos por 1 USD, tipo de cambio referencial)
const DONATE_URL = import.meta.env.VITE_PAYPAL_DONATE_URL || "";
const FX_RATE = Number(import.meta.env.VITE_FX_RATE) || 4000;

export const FOUNDATION = {
  name: "Cytech Foundation",
  contact: "cytechfoundation@gmail.com",
  donateUrl: DONATE_URL,
  paypalMe: "https://www.paypal.com/paypalme/cytechfoundation",
  qr: "/dona-qr.png",
  /** COP por 1 USD: el conversor de la página usa este tipo de cambio referencial. */
  fxRate: FX_RATE,
  causes: [
    {
      id: "becas",
      label: "Becas de estudio",
      desc: "Formación en software para jóvenes.",
      icon: "GraduationCap",
      tone: "cyan",
      impact: { value: 100, unit: "becas", note: "Formación para un futuro mejor" },
    },
    {
      id: "equipos",
      label: "Equipamiento tecnológico",
      desc: "Computadores para aulas comunitarias.",
      icon: "Laptop",
      tone: "cyan",
      impact: { value: 250, unit: "equipos", note: "Herramientas para aprender" },
    },
    {
      id: "talleres",
      label: "Talleres gratuitos",
      desc: "Cloud, APIs y facturación electrónica.",
      icon: "Users",
      tone: "amber",
      impact: { value: 500, unit: "talleres", note: "Conocimiento para todos" },
    },
  ],
  /**
   * Cursos preparados cuyas cifras muestra la sección Donar ("Tu aporte transforma").
   * `id` es la clave del contador de impacto (`curso_*`) que el panel admin de
   * /cuenta actualiza; el valor en vivo lo pide la página al backend.
   */
  courses: [
    {
      id: "curso_ruta_frontend",
      label: "Ruta Frontend desde Cero",
      desc: "60 h · 4 módulos · autoguiada.",
      icon: "BookOpen",
      tone: "cyan",
      impact: { value: 0, unit: "cursos", note: "Formación que abre puertas en tecnología" },
    },
  ],
  /** Aportes rápidos en COP (el equivalente USD se calcula con fxRate). */
  amounts: [10000, 25000, 50000, 100000],
  minAmount: 1000,
  impact: [
    { value: "+100", label: "becas otorgadas" },
    { value: "+250", label: "equipos entregados" },
    { value: "+500", label: "talleres dictados" },
  ],
};
