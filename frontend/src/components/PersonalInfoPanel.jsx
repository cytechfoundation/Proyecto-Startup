import { useEffect, useState } from "react";
import { Save, Search, Building2, Loader2, History, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";

const input =
  "w-full rounded-lg bg-[var(--t-surface2)] px-3 py-2.5 text-sm ring-1 ring-[var(--t-border)] focus:outline-none focus:ring-[var(--t-accent)]";

/** Registros por página del historial RUES (la paginación es en el servidor). */
const PAGE_SIZE = 10;

const EMPTY = {
  name: "",
  company: "",
  phone: "",
  nit: "",
  person_type: "",
};

/**
 * Sección "Información personal" de /cuenta.
 *
 * Consulta el NIT en el RUES (datos abiertos). El registro oficial se guarda
 * en la tabla propia `rues_records` (clave = NIT), por lo que aquí se muestra
 * solo como lectura y nunca se copia a la cuenta: la cuenta solo conserva su
 * propio NIT, empresa y tipo de persona. Compuesto en tres bloques:
 * Consultor RUES · Datos del registro (solo lectura) · Información personal.
 */
export default function PersonalInfoPanel() {
  const { token, user, refresh } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState("");
  const [nitLoading, setNitLoading] = useState(false);
  const [nitInfo, setNitInfo] = useState(null); // registro RUES persistido (solo lectura)
  const [records, setRecords] = useState([]); // items de la página actual
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 }); // paginación
  const [page, setPage] = useState(1); // página visible
  const [q, setQ] = useState(""); // buscador del historial (se manda al servidor)
  const [histLoading, setHistLoading] = useState(false);

  // Trae una página del historial (el filtrado por `q` ocurre en el servidor).
  const loadRecords = async (p = 1, term = "") => {
    setHistLoading(true);
    try {
      const data = await api.nitRecords(token, { page: p, pageSize: PAGE_SIZE, q: term });
      setRecords(data.items);
      setMeta({ total: data.total, page: data.page, pages: data.pages });
      setPage(data.page); // sincroniza con el recorte que hace el servidor
    } catch {
      setRecords([]);
      setMeta({ total: 0, page: 1, pages: 1 });
      setPage(1);
    } finally {
      setHistLoading(false);
    }
  };

  /** Elimina un NIT del cache RUES y refresca la página actual. */
  const deleteRecord = async (nit) => {
    try {
      await api.nitDeleteRecord(token, nit);
      setMsg(`Registro del NIT ${nit} eliminado del cache RUES.`);
      if (nitInfo?.nit === nit) setNitInfo(null);
      loadRecords(page, q); // el backend recorta la página si quedó vacía
    } catch (e) {
      setMsg(e.message);
    }
  };

  /** Cambia de página. */
  const gotoPage = (p) => {
    loadRecords(p, q);
  };

  // Carga inicial + recarga con debounce cuando cambia el texto del buscador
  // (siempre vuelve a la página 1 para no perderse entre resultados).
  useEffect(() => {
    if (!token) return undefined;
    const t = setTimeout(() => {
      setPage(1);
      loadRecords(1, q);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, q]);

  useEffect(() => {
    if (user)
      setForm({
        name: user.name || "",
        company: user.company || "",
        phone: user.phone || "",
        nit: user.nit || "",
        person_type: user.person_type || "",
      });
  }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /** Consulta el NIT en el RUES. El registro queda persistido en `rues_records`. */
  const lookupNit = async () => {
    const nitDigits = (form.nit || "").replace(/\D/g, "");
    if (nitDigits.length < 6) {
      setMsg("Escribe un NIT válido (mínimo 6 dígitos) antes de consultar.");
      return;
    }
    setNitLoading(true);
    setMsg("");
    setNitInfo(null);
    try {
      const data = await api.nitLookup(token, nitDigits);
      setNitInfo(data);
      // Solo se autocompletan campos propios de la cuenta (vacíos); los datos
      // del registro RUES NO se copian aquí: viven en su tabla, por NIT.
      setForm((f) => ({
        ...f,
        company: f.company || data.razon_social || "",
        person_type:
          f.person_type ||
          (/SOCIEDAD|ANONIMA|SAS|LIMITADA|EMPRESA/i.test(data.organizacion_juridica || "")
            ? "juridica"
            : /PERSONA NATURAL/i.test(data.organizacion_juridica || "")
              ? "natural"
              : ""),
      }));
      setMsg(`Registro consultado y guardado en RUES: ${data.razon_social} · ${data.estado_matricula}.`);
      // Al consultar se limpia el buscador: el registro nuevo debe verse siempre.
      if (q.trim()) {
        setQ(""); // el efecto de búsqueda recarga la página 1 sin filtro
      } else {
        loadRecords(1, ""); // ya estaba limpio: solo refresca por el registro nuevo
      }
    } catch (e) {
      setMsg(e.message);
    } finally {
      setNitLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.updateProfile(token, { ...form, person_type: form.person_type || null });
      await refresh();
      setMsg("Perfil actualizado.");
    } catch (err) {
      setMsg(err.message);
    }
  };

  /** Recarga un NIT del historial sin volver a consultar la fuente externa. */
  const pickRecord = (r) => {
    setForm((f) => ({ ...f, nit: r.nit || "" }));
    setNitInfo(r);
    setMsg(`Registro cargado desde el historial: ${r.razon_social || r.nit}.`);
  };

  return (
    <form onSubmit={save} className="rounded-xl bg-[var(--t-surface)] p-5">
      <h2 className="text-xl font-bold">Consultor RUES e información personal</h2>
      <p className="mt-1 text-sm text-[var(--t-muted)]">
        Escribe el NIT y consulúltalo en el registro oficial (RUES) para autocompletar los datos de tu empresa.
      </p>

      {msg && (
        <p className="mt-3 rounded-lg bg-[var(--t-accent-soft)] p-3 text-sm text-[var(--t-accent)]">{msg}</p>
      )}

      {/* Bloque 1 · Consultor RUES */}
      <div className="mt-4 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface2)] p-4">
        <label className="text-sm font-semibold">
          NIT (empresa o persona)
          <div className="mt-1 flex gap-2">
            <input
              value={form.nit}
              onChange={set("nit")}
              placeholder="900123456-7"
              className={`${input} flex-1`}
            />
            <button
              type="button"
              onClick={lookupNit}
              disabled={nitLoading}
              title="Consultar el NIT en los datos abiertos del RUES (Confecámaras)"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--t-accent)] bg-[var(--t-accent-soft)] px-3 text-xs font-semibold text-[var(--t-accent)] transition hover:bg-[var(--t-accent)]/20 disabled:opacity-50"
            >
              {nitLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {nitLoading ? "Consultando…" : "Consultar RUES"}
            </button>
          </div>
        </label>
        {nitInfo && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--t-muted)]">
            <Building2 className="h-3.5 w-3.5 text-[var(--t-accent)]" />
            <span className="font-semibold text-[var(--t-text2)]">{nitInfo.razon_social}</span> · Fuente: {nitInfo.fuente}
          </p>
        )}
      </div>

      {/* Bloque 2 · Datos del registro (RUES) */}
      <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-[var(--t-muted)]">
        Datos del registro (RUES)
      </h3>
      {nitInfo ? (
        <div className="mt-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface2)] p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-[var(--t-text2)]">{nitInfo.razon_social || "—"}</p>
            {nitInfo.estado_matricula && (
              <span className="rounded-full bg-[var(--t-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--t-accent)]">
                {nitInfo.estado_matricula}
              </span>
            )}
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs md:grid-cols-2">
            <div className="flex justify-between gap-2"><dt className="text-[var(--t-muted)]">Cámara de comercio</dt><dd className="text-right text-[var(--t-text2)]">{nitInfo.camara_comercio || "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--t-muted)]">Matrícula</dt><dd className="text-right text-[var(--t-text2)]">{nitInfo.matricula || "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--t-muted)]">Representante legal</dt><dd className="text-right text-[var(--t-text2)]">{nitInfo.representante_legal || "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--t-muted)]">Organización jurídica</dt><dd className="text-right text-[var(--t-text2)]">{nitInfo.organizacion_juridica || "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--t-muted)]">NIT</dt><dd className="text-right text-[var(--t-text2)]">{nitInfo.nit}{nitInfo.digito_verificacion ? `-${nitInfo.digito_verificacion}` : ""}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--t-muted)]">Fecha de matrícula</dt><dd className="text-right text-[var(--t-text2)]">{nitInfo.fecha_matricula || "—"}</dd></div>
          </dl>
          <p className="mt-3 text-[10px] text-[var(--t-muted)]">
            Fuente: {nitInfo.fuente || "datos.gov.co · RUES (Confecámaras)"} · guardado en RUES
          </p>
        </div>
      ) : (
        <p className="mt-2 rounded-lg border border-dashed border-[var(--t-border)] bg-[var(--t-surface2)] p-4 text-sm text-[var(--t-muted)]">
          Consulta un NIT para ver aquí su registro oficial. Estos datos se guardan en la base RUES (una fila por NIT) y no forman parte de tu cuenta.
        </p>
      )}

      {/* Bloque 3 · Historial de NITs consultados (paginado y buscado en el servidor) */}
      <h3 className="mt-5 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--t-muted)]">
        <History className="h-3.5 w-3.5" /> NITs consultados
        {meta.total > 0 && (
          <span className="rounded-full bg-[var(--t-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--t-accent)]">
            {meta.total}
          </span>
        )}
      </h3>
      {meta.total === 0 && !q.trim() ? (
        <p className="mt-2 rounded-lg border border-dashed border-[var(--t-border)] bg-[var(--t-surface2)] p-4 text-sm text-[var(--t-muted)]">
          Aún no has consultado NITs. Los registros que consultes quedarán guardados aquí para volver a usarlos.
        </p>
      ) : (
        <>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--t-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por NIT, razón social, cámara o matrícula…"
              className={`${input} pl-8`}
            />
          </div>
          {histLoading ? (
            <p className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface2)] p-4 text-sm text-[var(--t-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando registros…
            </p>
          ) : records.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-[var(--t-border)] bg-[var(--t-surface2)] p-4 text-sm text-[var(--t-muted)]">
              Ningún registro coincide con “{q}”.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--t-border)] overflow-hidden rounded-lg border border-[var(--t-border)]">
              {records.map((r) => (
                <li key={r.nit} className="flex items-stretch bg-[var(--t-surface2)]">
                  <button
                    type="button"
                    onClick={() => pickRecord(r)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--t-accent-soft)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[var(--t-text2)]">{r.razon_social || "—"}</span>
                      <span className="block text-xs text-[var(--t-muted)]">NIT {r.nit}{r.digito_verificacion ? `-${r.digito_verificacion}` : ""}{r.camara_comercio ? ` · ${r.camara_comercio}` : ""}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.estado_matricula && (
                        <span className="rounded-full bg-[var(--t-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--t-accent)]">{r.estado_matricula}</span>
                      )}
                      <span className="text-xs text-[var(--t-muted)]">Ver →</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRecord(r.nit)}
                    title={`Eliminar NIT ${r.nit} del cache RUES`}
                    aria-label={`Eliminar NIT ${r.nit} del cache RUES`}
                    className="shrink-0 border-l border-[var(--t-border)] px-3 text-[var(--t-muted)] transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* Paginación (solo si hay más de una página) */}
          {meta.total > PAGE_SIZE && (
            <nav className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[var(--t-muted)]">
                {meta.total} registro{meta.total === 1 ? "" : "s"} en total
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => gotoPage(page - 1)}
                  disabled={page <= 1 || histLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface2)] px-2.5 py-1.5 font-medium text-[var(--t-text2)] transition hover:bg-[var(--t-accent-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </button>
                <span className="px-2 text-[var(--t-muted)]">
                  {page} / {meta.pages}
                </span>
                <button
                  type="button"
                  onClick={() => gotoPage(page + 1)}
                  disabled={page >= meta.pages || histLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface2)] px-2.5 py-1.5 font-medium text-[var(--t-text2)] transition hover:bg-[var(--t-accent-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      {/* Bloque 4 · Información personal */}
      <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-[var(--t-muted)]">Información personal</h3>
      <div className="mt-2 grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          Nombre
          <input value={form.name} onChange={set("name")} className={`${input} mt-1`} />
        </label>
        <label className="text-sm">
          Empresa
          <input value={form.company} onChange={set("company")} placeholder="Mi empresa S.A.S." className={`${input} mt-1`} />
        </label>
        <label className="text-sm">
          Teléfono
          <input value={form.phone} onChange={set("phone")} placeholder="+57 300 000 0000" className={`${input} mt-1`} />
        </label>
        <label className="text-sm">
          Tipo de persona
          <select value={form.person_type} onChange={set("person_type")} className={`${input} mt-1`}>
            <option value="">Seleccionar…</option>
            <option value="natural">Persona natural</option>
            <option value="juridica">Persona jurídica</option>
          </select>
        </label>
        <div className="text-sm md:col-span-2">
          Correo (verificado por {user?.provider})
          <p className="mt-1 rounded-lg bg-[var(--t-surface2)] px-3 py-2.5 text-[var(--t-muted)]">{user?.email}</p>
        </div>
      </div>

      <button className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--t-accent)] to-[var(--t-accent2)] px-6 py-2.5 text-sm font-semibold shadow-lg shadow-black/50 transition-all hover:scale-[1.02]">
        <Save className="h-4 w-4" /> Guardar cambios
      </button>
    </form>
  );
}
