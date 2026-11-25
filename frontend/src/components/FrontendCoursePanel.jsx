/**
 * Ruta Autoguiada: Desarrollo Frontend Desde Cero.
 *
 * Plan de formación de 60 horas (4 módulos con práctica guiada por módulo).
 * En `/cuenta` se monta DENTRO de un `Collapsible` y solo cuando
 * `user.role === "admin"`: el resto de roles nunca lo renderiza.
 * Todo el contenido vive en `RUTA` como datos, no como JSX, para que las
 * etiquetas HTML del temario (`<header>`, `<!DOCTYPE html>`) se muestren
 * como texto.
 */

const RUTA = {
  titulo: "Ruta Autoguiada: Desarrollo Frontend Desde Cero",
  duracion: "60 Horas",
  metodologia: "Autoguiado (Explicación conceptual + Práctica guiada + Proyecto por módulo)",
  modulos: [
    {
      n: 1,
      ruta: "HTML5 & CSS3",
      titulo: "La Estructura y el Estilo Web (HTML5 y CSS3)",
      duracion: "15 Horas",
      objetivo:
        "Crear páginas web estáticas, bien estructuradas, visualmente atractivas y adaptables a celulares.",
      bloques: [
        {
          horas: "Hora 1 - 3",
          titulo: "Fundamentos de HTML5",
          temas: [
            "Estructura básica de un documento web (<!DOCTYPE html>, <html>, <head>, <body>).",
            "Etiquetas semánticas esenciales (<header>, <nav>, <main>, <section>, <article>, <footer>).",
            "Manejo de textos, enlaces, listas e imágenes.",
          ],
        },
        {
          horas: "Hora 4 - 6",
          titulo: "Introducción a CSS3",
          temas: [
            "Cómo enlazar estilos (Selectores de etiquetas, clases e IDs).",
            "El Modelo de Caja (Box Model): margin, border, padding, width y height.",
            "Colores, tipografías y propiedades de texto básicas.",
          ],
        },
        {
          horas: "Hora 7 - 10",
          titulo: "Maquetación Moderna con Flexbox",
          temas: [
            "Ejes de alineación (flex-direction, justify-content, align-items).",
            "Distribución y crecimiento de contenedores (flex-grow, gap).",
            "Creación de barras de navegación y grillas básicas.",
          ],
        },
        {
          horas: "Hora 11 - 13",
          titulo: "Diseño Responsivo (Responsive Design)",
          temas: [
            "Uso de Media Queries (@media).",
            "Concepto de Mobile First (diseñar primero para pantallas móviles).",
            "Unidades relativas (em, rem, %, vw, vh).",
          ],
        },
        {
          horas: "Hora 14 - 15",
          titulo: "Práctica Guiada (Proyecto 1)",
          proyecto: true,
          temas: [
            "Reto: Crear una página de aterrizaje (Landing Page) para un producto o portafolio personal que sea 100% responsiva usando HTML semántico y Flexbox.",
          ],
        },
      ],
    },
    {
      n: 2,
      ruta: "Git & CSS Avanzado",
      titulo: "Control de Versiones y Diseño Avanzado",
      duracion: "12 Horas",
      objetivo: "Aprender a guardar el historial de tu código y dominar layouts web complejos.",
      bloques: [
        {
          horas: "Hora 16 - 18",
          titulo: "Git y GitHub para Desarrolladores",
          temas: [
            "Instalación y comandos esenciales de Git (git init, add, commit, status).",
            "Creación de repositorios en GitHub y cómo subir tu código (git push).",
          ],
        },
        {
          horas: "Hora 19 - 22",
          titulo: "CSS Grid Layout",
          temas: [
            "Diferencias clave entre Flexbox (una dimensión) y Grid (dos dimensiones).",
            "Definición de filas y columnas (grid-template-columns, repeat(), fr).",
            "Áreas de la cuadrícula (grid-template-areas).",
          ],
        },
        {
          horas: "Hora 23 - 25",
          titulo: "Animaciones y Transiciones",
          temas: [
            "Efectos visuales al pasar el mouse (:hover, transition).",
            "Creación de animaciones personalizadas con @keyframes.",
          ],
        },
        {
          horas: "Hora 26 - 27",
          titulo: "Práctica Guiada (Proyecto 2)",
          proyecto: true,
          temas: [
            "Reto: Subir el proyecto del Módulo 1 a GitHub y agregarle una sección de galería de imágenes compleja utilizando CSS Grid, incluyendo animaciones suaves de entrada.",
          ],
        },
      ],
    },
    {
      n: 3,
      ruta: "JavaScript Esencial",
      titulo: "Lógica y Dinamismo con JavaScript",
      duracion: "20 Horas",
      objetivo:
        "Darle vida a tus páginas web controlando eventos, validando datos e interactuando con el usuario.",
      bloques: [
        {
          horas: "Hora 28 - 31",
          titulo: "Fundamentos de Programación en JS",
          temas: [
            "Variables (let, const) y tipos de datos (Strings, Numbers, Booleans).",
            "Operadores lógicos y matemáticos.",
            "Estructuras condicionales (if, else, switch).",
          ],
        },
        {
          horas: "Hora 32 - 35",
          titulo: "Estructuras de Datos y Bucles",
          temas: [
            "Listas (Arrays) y Objetos literales.",
            "Ciclos iterativos (for, while) y métodos modernos de arreglos (.forEach(), .map()).",
          ],
        },
        {
          horas: "Hora 36 - 39",
          titulo: "Funciones y Modularidad",
          temas: [
            "Declaración de funciones clásicas y funciones flecha (() => {}).",
            "Paso de parámetros y retorno de valores.",
          ],
        },
        {
          horas: "Hora 40 - 44",
          titulo: "Manipulación del DOM (Document Object Model)",
          temas: [
            "Cómo seleccionar elementos HTML desde JavaScript (querySelector).",
            "Escuchar clics y teclazos (addEventListener).",
            "Modificar texto, clases de CSS y crear nuevos elementos en pantalla en tiempo real.",
          ],
        },
        {
          horas: "Hora 45 - 47",
          titulo: "Práctica Guiada (Proyecto 3)",
          proyecto: true,
          temas: [
            'Reto: Construir una aplicación de "Lista de Tareas" (To-Do List) donde el usuario pueda agregar, tachar y eliminar tareas de manera dinámica sin recargar la página.',
          ],
        },
      ],
    },
    {
      n: 4,
      ruta: "Proyecto Final & Despliegue",
      titulo: "Integración, API y Publicación Web",
      duracion: "13 Horas",
      objetivo:
        "Conectar tu interfaz web con información externa de internet y publicar tu trabajo gratis.",
      bloques: [
        {
          horas: "Hora 48 - 51",
          titulo: "Consumo de APIs con Fetch",
          temas: [
            "Concepto de solicitudes HTTP y formatos de datos (JSON).",
            "Uso de fetch() y promesas en JavaScript para traer datos externos (por ejemplo, el clima o productos de una tienda).",
          ],
        },
        {
          horas: "Hora 52 - 55",
          titulo: "Almacenamiento Local (LocalStorage)",
          temas: [
            "Cómo guardar datos en el navegador del usuario para que no se borren al refrescar la página (localStorage.setItem / getItem).",
          ],
        },
        {
          horas: "Hora 56 - 57",
          titulo: "Despliegue en Producción (Hosting)",
          temas: [
            "Cómo subir tu proyecto final a internet de forma gratuita usando plataformas como Vercel, Netlify o GitHub Pages.",
          ],
        },
      ],
    },
  ],
};

const chip = "rounded-full bg-[var(--t-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--t-accent)]";
const chipHours = "rounded-md bg-black/30 px-2 py-0.5 font-mono text-xs text-[var(--t-text2)] ring-1 ring-[var(--t-border)]";

export default function FrontendCoursePanel() {
  return (
    <div className="space-y-5">
      {/* ---------------- cabecera de la ruta ---------------- */}
      <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface2)]/60 p-4">
        <h3 className="font-bold text-[var(--t-text2)]">{RUTA.titulo}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-2.5 py-1 text-xs font-bold text-white">
            {RUTA.duracion}
          </span>
          <span className={chip}>{RUTA.modulos.length} módulos</span>
          <span className="text-xs text-[var(--t-muted)]">{RUTA.metodologia}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {RUTA.modulos.map((m, i) => (
            <span key={m.n} className="flex items-center gap-2">
              <span className="rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-2.5 py-1">
                <span className="font-semibold text-[var(--t-text2)]">Módulo {m.n}:</span>{" "}
                <span className="text-[var(--t-muted)]">{m.ruta}</span>
              </span>
              {i < RUTA.modulos.length - 1 && (
                <span aria-hidden className="text-[var(--t-muted)]">
                  ──▶
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- módulos ---------------- */}
      {RUTA.modulos.map((m) => (
        <section key={m.n} className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface2)]/40 p-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-bold text-[var(--t-text2)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--t-accent)] to-[var(--t-accent2)] text-sm font-extrabold text-white">
                {m.n}
              </span>
              {m.titulo}
            </h3>
            <span className="rounded-md bg-black/30 px-2.5 py-1 text-xs font-semibold text-[var(--t-text2)]">
              {m.duracion}
            </span>
          </header>

          <p className="mt-2 text-sm text-[var(--t-muted)]">
            <span className="font-semibold text-[var(--t-accent)]">Objetivo:</span> {m.objetivo}
          </p>

          <div className="mt-3 space-y-2.5">
            {m.bloques.map((b) => (
              <div
                key={b.horas}
                className={`rounded-lg border p-3 ${
                  b.proyecto
                    ? "border-emerald-500/35 bg-emerald-500/10"
                    : "border-[var(--t-border)] bg-[var(--t-surface)]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={chipHours}>{b.horas}</span>
                  <span className="text-sm font-semibold text-[var(--t-text2)]">{b.titulo}</span>
                  {b.proyecto && (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                      Proyecto
                    </span>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-sm text-[var(--t-muted)]">
                  {b.temas.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span aria-hidden className="text-[var(--t-accent)]">
                        •
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
