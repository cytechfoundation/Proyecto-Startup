export const CAL2026 = [
  {
    grupo: "Renta",
    etiqueta: "Grandes contribuyentes",
    color: "#0a2342",
    accent: "#00b4e6",
    filas: [
      { mes: "Febrero", tramite: "Pago 1a. cuota", dias: ["10","11","12","13","16","17","18","19","20","23"] },
      { mes: "Abril", tramite: "Declaración y pago 2a. cuota", dias: ["13","14","15","16","20","21","22","23","24","27"] },
      { mes: "Junio", tramite: "Pago 3a. cuota", dias: ["10","11","12","16","17","18","19","22","23","24"] },
    ],
  },
  {
    grupo: "Renta",
    etiqueta: "Personas jurídicas",
    color: "#4a9e2b",
    accent: "#ffffff",
    filas: [
      { mes: "Mayo", tramite: "Declaración y pago 1a. cuota", dias: ["12","13","14","15","19","20","21","22","25","26"] },
      { mes: "Julio", tramite: "Pago 2a. cuota", dias: ["9","10","14","15","16","17","21","22","23","24"] },
    ],
  },
  {
    grupo: "Renta",
    etiqueta: "Personas naturales",
    color: "#0a2342",
    accent: "#00b4e6",
    filas: [
      { mes: "Agosto", tramite: "Declaración y pago · dígitos 01 al 26", dias: ["12","13","14","18","19","20","21","24","25","26"] },
      { mes: "Septiembre", tramite: "Declaración y pago · dígitos 27 al 66", dias: ["1","2","3","4","7","8","9","10","11","14"] },
      { mes: "Octubre", tramite: "Declaración y pago · dígitos 67 al 00", dias: ["1","2","5","6","7","8","9","13","14","15"] },
    ],
  },
  {
    grupo: "IVA",
    etiqueta: "Bimestral",
    color: "#0a7aa8",
    accent: "#ffffff",
    filas: [
      { mes: "Mayo", tramite: "Enero - febrero", dias: ["12","13","14","15","19","20","21","22","25","26"] },
      { mes: "Julio", tramite: "Marzo - abril", dias: ["9","10","14","15","16","17","21","22","23","24"] },
      { mes: "Septiembre", tramite: "Mayo - junio", dias: ["9","10","11","14","15","16","17","18","21","22"] },
      { mes: "Noviembre", tramite: "Julio - agosto", dias: ["11","12","13","17","18","19","20","23","24","25"] },
    ],
  },
  {
    grupo: "Retención",
    etiqueta: "En la fuente · mensual",
    color: "#333333",
    accent: "#ffd400",
    filas: [
      { mes: "Febrero", tramite: "Periodo enero", dias: ["10","11","12","13","16","17","18","19","20","23"] },
      { mes: "Marzo", tramite: "Periodo febrero", dias: ["10","11","12","13","16","17","18","19","20","24"] },
      { mes: "Abril", tramite: "Periodo marzo", dias: ["13","14","15","16","20","21","22","23","24","27"] },
    ],
  },
  {
    grupo: "Presencia Económica Significativa",
    etiqueta: "PES",
    color: "#0a8a8a",
    accent: "#ffffff",
    filas: [
      { kind: "periodos", mes: "Pagos anticipados bimestrales", tramite: "Periodo", periodos: [
        { p: "ene - feb", m: "mar", d: "13" }, { p: "mar - abr", m: "may", d: "15" },
        { p: "may - jun", m: "jul", d: "15" }, { p: "jul - ago", m: "sep", d: "14" },
        { p: "sep - oct", m: "nov", d: "17" }, { p: "nov - dic", m: "ene 2027", d: "18" },
      ]},
      { kind: "unico", mes: "Abril", tramite: "Declaración anual", dia: "23", nota: "Independientemente del Número de Identificación Tributaria -NIT" },
    ],
  },
  {
    grupo: "Activos en el",
    etiqueta: "exterior",
    color: "#0a5a8a",
    accent: "#ffffff",
    filas: [
      { kind: "nota", mes: "Declaración anual", tramite: "Declaración anual", texto: "Las fechas para la presentación de esta declaración son las mismas de renta grandes contribuyentes, personas jurídicas, personas naturales y los acogidos al Régimen Simple de Tributación (RST)." },
    ],
  },
  {
    grupo: "",
    etiqueta: "Consumo",
    color: "#7ac143",
    accent: "#0a2342",
    filas: [
      { kind: "nota", mes: "Declaración y pago bimestral", tramite: "Declaración y pago bimestral", texto: "En las mismas fechas que el impuesto sobre las ventas bimestral (incluyendo bolsas plásticas y cannabis)." },
    ],
  },
  {
    grupo: "Gasolina y",
    etiqueta: "ACPM",
    color: "#b9d4e8",
    accent: "#0a2342",
    filas: [
      { kind: "periodos", mes: "Declaración mensual y pago", tramite: "Periodo", periodos: [
        { p: "enero", m: "feb", d: "13" }, { p: "febrero", m: "mar", d: "13" },
        { p: "marzo", m: "abr", d: "16" }, { p: "abril", m: "may", d: "15" },
        { p: "mayo", m: "jun", d: "16" }, { p: "junio", m: "jul", d: "15" },
        { p: "julio", m: "ago", d: "18" }, { p: "agosto", m: "sep", d: "14" },
        { p: "septiembre", m: "oct", d: "15" }, { p: "octubre", m: "nov", d: "17" },
        { p: "noviembre", m: "dic", d: "15" }, { p: "diciembre", m: "ene 2027", d: "18" },
      ]},
    ],
  },
  {
    grupo: "",
    etiqueta: "Carbono",
    color: "#0a8a8a",
    accent: "#ffffff",
    filas: [
      { kind: "periodos", mes: "Declaración y pago", tramite: "Periodo", periodos: [
        { p: "ene - feb", m: "mar", d: "13" }, { p: "mar - abr", m: "may", d: "15" },
        { p: "may - jun", m: "jul", d: "15" }, { p: "jul - ago", m: "sep", d: "14" },
        { p: "sep - oct", m: "nov", d: "17" }, { p: "nov - dic", m: "ene 2027", d: "18" },
      ]},
    ],
  },
  {
    grupo: "",
    etiqueta: "RST",
    color: "#c98a12",
    accent: "#ffffff",
    filas: [
      { kind: "grupos", mes: "Abril", tramite: "Declaración anual y pago · Consolidada", grupos: ["1-2","3-4","5-6","7-8","9-0"], dias: ["20","21","22","23","24"] },
      { kind: "grupos", mes: "Febrero", tramite: "Consolidada de IVA", grupos: ["1-2","3-4","5-6","7-8","9-0"], dias: ["16","17","18","19","20"] },
    ],
  },
  {
    grupo: "RST - Anticipo",
    etiqueta: "bimestral",
    color: "#c98a12",
    accent: "#ffffff",
    filas: [
      { mes: "Mayo", tramite: "Enero - febrero", dias: ["12","13","14","15","19","20","21","22","25","26"] },
      { mes: "Junio", tramite: "Marzo - abril", dias: ["10","11","12","16","17","18","19","22","23","24"] },
      { mes: "Julio", tramite: "Mayo - junio", dias: ["9","10","14","15","16","17","21","22","23","24"] },
      { mes: "Septiembre", tramite: "Julio - agosto", dias: ["9","10","11","14","15","16","17","18","21","22"] },
      { mes: "Noviembre", tramite: "Septiembre - octubre", dias: ["11","12","13","17","18","19","20","23","24","25"] },
      { mes: "Enero 2027", tramite: "Noviembre - diciembre", dias: ["13","14","15","18","19","20","21","22","25","26"] },
    ],
  },
  {
    grupo: "Precios de",
    etiqueta: "transferencia",
    color: "#2a9fd8",
    accent: "#ffffff",
    filas: [
      { mes: "Septiembre", tramite: "Presentar · Declaración informativa", dias: ["9","10","11","14","15","16","17","18","21","22"] },
      { mes: "Septiembre", tramite: "Presentar · Documentación comprobatoria local y maestro", dias: ["9","10","11","14","15","16","17","18","21","22"] },
      { kind: "unico", mes: "Diciembre", tramite: "Informe país por país", dia: "15", nota: "Independientemente del Número de Identificación Tributaria -NIT" },
    ],
  },
  {
    grupo: "IVA prestadores de",
    etiqueta: "servicios desde el exterior",
    color: "#2a9e5a",
    accent: "#ffffff",
    filas: [
      { kind: "periodos", mes: "Declaración y pago bimestral", tramite: "Periodo", periodos: [
        { p: "ene - feb", m: "mar", d: "13" }, { p: "mar - abr", m: "may", d: "15" },
        { p: "may - jun", m: "jul", d: "15" }, { p: "jul - ago", m: "sep", d: "14" },
        { p: "sep - oct", m: "nov", d: "17" }, { p: "nov - dic", m: "ene 2027", d: "18" },
      ]},
    ],
  },
  {
    grupo: "",
    etiqueta: "Patrimonio",
    color: "#0a5aaa",
    accent: "#ffffff",
    filas: [
      { mes: "Mayo", tramite: "Declaración y pago 1a. cuota", dias: ["12","13","14","15","19","20","21","22","25","26"] },
      { kind: "unico", mes: "Septiembre", tramite: "Pago 2a. cuota", dia: "14", nota: "Independientemente del Número de Identificación Tributaria -NIT" },
    ],
  },
  {
    grupo: "Productos plásticos de un solo uso",
    etiqueta: "envasar / empacar",
    color: "#3aa33a",
    accent: "#ffffff",
    filas: [
      { kind: "unico", mes: "Febrero", tramite: "Presentación y pago", dia: "13", nota: "Independientemente del Número de Identificación Tributaria -NIT" },
    ],
  },
  {
    grupo: "Bebidas ultraprocesadas y comestibles",
    etiqueta: "azúcares / sodio / grasas",
    color: "#0a8a8a",
    accent: "#ffffff",
    filas: [
      { kind: "periodos", mes: "Presentación y pago", tramite: "Periodo", periodos: [
        { p: "ene - feb", m: "mar", d: "13" }, { p: "mar - abr", m: "may", d: "15" },
        { p: "may - jun", m: "jul", d: "15" }, { p: "jul - ago", m: "sep", d: "14" },
        { p: "sep - oct", m: "nov", d: "17" }, { p: "nov - dic", m: "ene 2027", d: "18" },
      ]},
    ],
  },
  {
    grupo: "Registro Único de Beneficiarios Finales",
    etiqueta: "RUB",
    color: "#2a9fd8",
    accent: "#ffffff",
    filas: [
      { kind: "periodos", mes: "Actualización · Independiente NIT", tramite: "Actualización", periodos: [
        { p: "", m: "feb", d: "2" }, { p: "", m: "may", d: "4" },
        { p: "", m: "ago", d: "3" }, { p: "", m: "nov", d: "3" },
      ]},
    ],
  },
];

export const DIGITOS = ["1","2","3","4","5","6","7","8","9","0"];
