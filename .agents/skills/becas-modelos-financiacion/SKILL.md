---
name: becas-modelos-financiacion
description: >-
  Modelos de financiación del programa de becas de Cytech Foundation: Compra con
  Propósito (% de ventas), Consultoría + Semillero de Talento (patrocinio
  corporativo) y Fondos Complementarios vía registro BIC. Úsala al redactar
  contratos, cláusulas, textos de donación, contenido de landing o features de
  becas, o cuando hay que explicar a un cliente cómo financia la fundación las
  matrículas sin salir del modelo comercial de la empresa.
---

# Modelos de financiación de becas

Contexto de negocio para el programa de becas de Cytech Foundation. Aplica esta
skill cuando el trabajo involucre **dinero de becas, contratos con clientes,
donaciones, RSE o el sello BIC**. Estos tres modelos conviven: se pueden ofrecer
al mismo cliente según su caso.

## 1. Modelo de "Compra con Propósito" (porcentaje de ventas)

La forma más sencilla de integrarlo al portafolio actual de software y
consultoría.

- **Cómo funciona:** la empresa vende licencias de software, desarrollos a la
  medida o consultorías bajo tarifas de mercado. En el contrato de venta se
  estipula explícitamente que un porcentaje fijo de la compra (ej. 5% o 10%)
  destina directamente al fondo de becas de la empresa.
- **Manejo contable:** el cliente paga una factura comercial normal por los
  servicios tecnológicos. La empresa registra el ingreso total, deduce sus
  costos y el porcentaje prometido se transfiere internamente a una **cuenta
  restringida** exclusiva para el pago de matrículas.
- **Beneficio para el cliente:** deduce el **100% del valor de la factura** como
  gasto operativo de su negocio (servicios de software/consultoría) y, al mismo
  tiempo, cumple con sus metas de responsabilidad social.

## 2. Modelo de "Consultoría + Semillero de Talento" (patrocinio corporativo)

Resuelve una de las mayores necesidades de las grandes empresas: conseguir
talento técnico calificado.

- **Cómo funciona:** se vende un paquete de consultoría tecnológica a un cliente
  corporativo. Como parte del entregable, la empresa selecciona, capacita y
  beca a estudiantes en áreas tecnológicas clave (programación, nube,
  ciberseguridad) bajo los requerimientos específicos de ese cliente.
- **Manejo contable:** el cliente contrata bajo un objeto contractual como
  *"Consultoría especializada y desarrollo de capacidades tecnológicas"*.
- **Beneficio mutuo:**
  - **Cliente:** gasto de operación deducible de impuestos.
  - **Empresa:** ingreso comercial.
  - **Estudiante:** recibe la beca y, al graduarse, tiene la oportunidad de
    realizar prácticas o ser contratado directamente por el cliente que
    financió su proceso.

## 3. Modelo de "Fondos Complementarios" mediante el registro BIC

Si se quiere un estatus superior que valide el programa de becas ante el
mercado, adoptar la condición de **Empresa BIC (Beneficio e Interés Colectivo)**
al constituir o actualizar la S.A.S.

- **Ventaja competitiva:** al ser una S.A.S. BIC la empresa adquiere una
  reputación oficial que le permite competir con mayor fuerza en licitaciones
  públicas y privadas de software, ya que el Estado y las grandes corporaciones
  priorizan a proveedores con sello social.
- **Financiamiento alternativo:** las empresas BIC pueden acceder a líneas de
  crédito preferenciales (tasas de interés más bajas) en bancos locales y a
  fondos de inversión internacionales de impacto para apalancar sus programas
  sociales.

## Resumen del flujo financiero y legal

```
[ Cliente de Software/Consultoría ]
               │
               ▼  (Paga Factura Comercial 100% Deducible como Gasto)
     [ Tu Empresa S.A.S. ]
               │
               ▼  (Porcentaje de Utilidad o Rubro de Co-formación)
   [ Pago Directo a la Universidad/Becario ]
```

## Reglamento de las becas

Como fundador y consultor se tiene la libertad de diseñar el **reglamento de
las becas** (promedio requerido, áreas de estudio, etc.) en los términos y
condiciones de la propia empresa, **sin depender de la aprobación de un tercero**.

## Dónde se relaciona en el repo

- Causa `becas` (violeta): `frontend/src/data/foundation.js` y el chip en
  `frontend/src/components/DonationList.jsx`.
- Sección de donación y contador público: `frontend/src/components/Donate.jsx`
  y `frontend/src/components/ScholarshipCounter.jsx` (panel `/cuenta`).
- Texto que ya comunica el propósito: *"Tu apoyo nos permite financiar becas de
  estudio y formación tecnológica…"* en `Donate.jsx`.
- Base de conocimiento del asistente (`seed_knowledge.py`): si el chatbot debe
  explicar estos modelos a un cliente, hay que indexarlos en `knowledge_docs`
  (mismo patrón que `seed_tax_calendar_knowledge.py`).
- Al redactar contratos/cláusulas o contenido de landing, mantén la separación
  contable: factura comercial normal al cliente → porcentaje o rubro a la cuenta
  restringida/fondo de becas.
