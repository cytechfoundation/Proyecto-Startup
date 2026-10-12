/** Estado del checklist de bienvenida (localStorage, por navegador).

- `done`: marcas de paso (se completan al visitar su destino).
- `dismissed`: el usuario ocultó el panel con la × (no vuelve a aparecer).
*/
const KEY = "cytech_onboarding_v1";

export const STEPS = [
  { id: "perfil", title: "Completa tu perfil", desc: "Nombre, empresa y datos de facturación.", to: "/cuenta" },
  { id: "calendario", title: "Revisa el calendario", desc: "Obligaciones y vencimientos del mes.", to: "/calendario-facturacion" },
  { id: "integraciones", title: "Explora tus integraciones", desc: "Conecta POS, DIAN o PayPal desde Mi cuenta.", to: "/cuenta" },
];

const EMPTY = { done: {}, dismissed: false };

export function loadOnboarding() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    return { done: parsed.done || {}, dismissed: !!parsed.dismissed };
  } catch {
    return { ...EMPTY };
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* modo privado: la sesión pierde la memoria, no rompe */
  }
}

/** Marca un paso como completado (idempotente). */
export function markStep(id) {
  const state = loadOnboarding();
  if (state.done[id]) return;
  save({ ...state, done: { ...state.done, [id]: Date.now() } });
}

/** Oculta el panel de bienvenida de forma permanente. */
export function dismissOnboarding() {
  const next = { ...loadOnboarding(), dismissed: true };
  save(next);
  return next;
}
