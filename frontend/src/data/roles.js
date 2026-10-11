import { PencilLine, ShieldCheck, UserRound } from "lucide-react";

/**
 * Identidad visual por rol, compartida por la Matriz RBAC del dashboard y el
 * Directorio de Usuarios: mismo color e icono en cabeceras, chips, avatares y
 * toggles para que toda la ruta tenga un acabado uniforme.
 *
 * Los valores son clases literales (nunca se concatenan dinámicamente) para
 * que Tailwind las incluya en el build.
 */
export const ROLE_META = {
  admin: {
    icon: ShieldCheck,
    on: "bg-violet-500",
    ring: "hover:ring-2 hover:ring-violet-400/60",
    chip: "text-violet-300 bg-violet-500/15 ring-1 ring-violet-400/30",
    avatar: "bg-violet-500/20 text-violet-300",
  },
  editor: {
    icon: PencilLine,
    on: "bg-sky-500",
    ring: "hover:ring-2 hover:ring-sky-400/60",
    chip: "text-sky-300 bg-sky-500/15 ring-1 ring-sky-400/30",
    avatar: "bg-sky-500/20 text-sky-300",
  },
  client: {
    icon: UserRound,
    on: "bg-emerald-500",
    ring: "hover:ring-2 hover:ring-emerald-400/60",
    chip: "text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-400/30",
    avatar: "bg-emerald-500/20 text-emerald-300",
  },
};

/** Metadatos de un rol (con fallback a client para valores inesperados). */
export const roleMeta = (r) => ROLE_META[r] || ROLE_META.client;
