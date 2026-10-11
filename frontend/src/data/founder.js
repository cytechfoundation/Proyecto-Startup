import { CodeXml, GitBranch, PenTool, Mail, Contact } from "lucide-react";

// TODO: reemplaza con los datos reales del fundador
export const FOUNDER = {
  name: "Fernando Saldaña",
  role: "Fundador · Desarrollador de Software & Arquitecto Cloud",
  // Foto del fundador servida desde frontend/public
  photo: "/founder.png",
  // Perfil público de insignias y certificaciones
  credly: "https://www.credly.com/users/fernando-saldana.160b77cb",
  bio: [
    "Desarrollador de software especializado en plataformas SaaS, arquitectura en la nube e integraciones críticas (POS, pasarelas de pago y facturación electrónica DIAN).",
    "Acompaño a startups y negocios en todo el ciclo: del MVP a la operación en producción, con consultorías técnicas que priorizan impacto, costo y velocidad.",
  ],
  consulting: [
    { title: "Consultoría Cloud", text: "Auditoría, diseño y optimización de infraestructura con IaC." },
    { title: "SaaS a la medida", text: "MVPs multitenant y APIs Backend-First listas para escalar." },
    { title: "Integraciones", text: "Middleware POS, pagos y DIAN con observabilidad total." },
  ],
  stack: ["Python", "FastAPI", "React", "PostgreSQL", "Docker", "AWS", "Google Cloud", "Oracle", "Tailwind CSS"],
  credentials: [
    {
      title: "Certificación Oracle",
      detail: "Insignia verificable · Oracle University",
      href: "https://catalog-education.oracle.com/pls/certview/sharebadge?id=0EBA9F3E3DD3BDC62CFD7F5851993C491B6311AB0AEDEC7F2F9E47C90308ED7B",
    },
    { title: "Arquitectura Cloud", detail: "Diseño y operación de sistemas productivos" },
    { title: "SaaS & APIs", detail: "Multitenant, auth federada y RBAC" },
    { title: "Integraciones críticas", detail: "Pagos, POS y facturación DIAN" },
  ],
  metrics: [
    { value: "+15", label: "proyectos entregados" },
    { value: "99.9%", label: "uptime objetivo" },
    { value: "3", label: "verticales activas" },
  ],
};

// TODO: redes personales del fundador (proyectos y código)
export const FOUNDER_SOCIAL = [
  { Icon: GitBranch, label: "GitHub personal", desc: "Código y proyectos", href: "https://github.com/fercho22savi" },
  { Icon: PenTool, label: "CodePen", desc: "Experimentos frontend", href: "https://codepen.io/fercho22savi" },
  { Icon: Contact, label: "LinkedIn", desc: "Perfil profesional", href: "https://www.linkedin.com/in/fernando-salda%C3%B1a" },
  { Icon: CodeXml, label: "Blog técnico", desc: "Notas de ingeniería", href: "https://tu-blog.dev" },
  { Icon: Mail, label: "Contacto directo", desc: "cytechfoundation@gmail.com", href: "mailto:cytechfoundation@gmail.com?subject=Contacto%20desde%20Cytech%20Web", action: "contact" },
];
