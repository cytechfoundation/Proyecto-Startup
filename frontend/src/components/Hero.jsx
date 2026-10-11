import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";

const keyword =
  "text-transparent bg-clip-text bg-gradient-to-r from-[var(--l-k1)] to-[var(--l-k2)]";

export default function Hero() {
  return (
    <section className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-[var(--l-accent)] bg-[var(--l-accent-soft)] px-4 py-1.5 text-xs font-medium text-[var(--l-accent)]"
        >
          <Zap className="h-3.5 w-3.5" />
          Middleware · Cloud · Facturación DIAN
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl"
        >
          Software <span className={keyword}>SaaS</span> a la medida,{" "}
          <span className={keyword}>cloud</span> e{" "}
          <span className={keyword}>integraciones</span> que facturan
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--l-muted)]"
        >
          Consultora técnica especializada en middleware, pasarelas de pago, POS y
          DIAN. Arquitectura Backend-First, robusta y modular.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-[1.02] hover:from-cyan-400 hover:to-blue-500"
          >
            Ingresar a Demo Controlada
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <a
            href="#servicios"
            className="rounded-lg border border-[var(--l-border)] px-8 py-3.5 font-semibold text-[var(--l-text)] transition-all duration-300 hover:border-[var(--l-accent)] hover:text-[var(--l-text)]"
          >
            Ver servicios
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-8 flex items-center justify-center gap-2 text-sm text-[var(--l-muted)]"
        >
          <ShieldCheck className="h-4 w-4 text-[var(--l-accent)]" />
          Acceso federado · Sin contraseñas · Roles por dominio corporativo
        </motion.div>
      </div>
    </section>
  );
}
