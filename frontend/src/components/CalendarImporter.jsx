import { useCallback, useEffect, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, CalendarRange, CopyCheck, CalendarDays, Download, Trash2 } from "lucide-react";
import { api } from "../services/api.js";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";

const ANIOS = [2025, 2026, 2027, 2028];

const kb = (bytes) => `${(Number(bytes || 0) / 1024).toFixed(1)} KB`;
const fecha = (iso) => {
  try {
    return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
};

export default function CalendarImporter({ bare = false, onImported }) {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [year, setYear] = useState(2026);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type, msg, detail? }
  // Archivos PDF guardados en el backend, ordenados del más reciente al más antiguo.
  const [uploads, setUploads] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [listError, setListError] = useState("");

  const loadUploads = useCallback(async () => {
    if (!token) return;
    try {
      const d = await api.taxUploads(token);
      setUploads(d.uploads || []);
      setListError("");
    } catch (e) {
      // Sin permisos admin u otro fallo: la lista simplemente no se muestra.
      setListError(e.message || String(e));
    }
  }, [token]);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(
        `${api.base}/api/v1/tax-calendar/import?year=${year}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`
          },
        }
      );

      const d = res.data || {};
      setStatus({
        type: "success",
        msg: d.message || "Importación exitosa.",
        detail: d.total_parsed
          ? { created: d.created, duplicates: d.duplicates, first: d.first_date, last: d.last_date, years: d.years }
          : null,
      });
      setFile(null);
      loadUploads(); // el PDF importado aparece arriba en la lista de archivos
      onImported?.(d);
    } catch (err) {
      setStatus({ type: "error", msg: err.response?.data?.detail || "Error al importar el calendario" });
    } finally {
      setLoading(false);
    }
  };

  /** Descarga el PDF original guardado (el endpoint exige el token admin). */
  const handleDownload = async (u) => {
    setBusyId(u.id);
    try {
      const res = await axios.get(`${api.base}/api/v1/tax-calendar/uploads/${u.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = u.filename || "calendario.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setStatus({ type: "error", msg: e.response?.data?.detail || "No se pudo descargar el archivo" });
    } finally {
      setBusyId("");
    }
  };

  /** Borra el PDF del almacén (los eventos importados permanecen en la BD). */
  const handleDelete = async (u) => {
    if (!window.confirm(`¿Eliminar "${u.filename}" del almacén? Los eventos importados permanecen.`)) return;
    setBusyId(u.id);
    try {
      await api.taxDeleteUpload(token, u.id);
      setUploads((xs) => xs.filter((x) => x.id !== u.id));
      setStatus({ type: "success", msg: `Archivo "${u.filename}" eliminado.` });
    } catch (e) {
      setStatus({ type: "error", msg: e.response?.data?.detail || e.message || "No se pudo eliminar" });
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className={bare ? "" : "rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-6 shadow-sm"}>
      {!bare && (
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-[var(--t-text)]">Importador de Calendario Tributario</h3>
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div
          className={`relative group cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200
            ${file ? "border-green-500 bg-green-500/5" : "border-[var(--t-border)] hover:border-blue-500 bg-[var(--t-surface2)]"}`}
        >
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setFile(e.target.files[0] || null)}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          />
          <div className="flex flex-col items-center justify-center py-10 text-center">
            {file ? (
              <>
                <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
                <p className="text-sm font-medium text-[var(--t-text)]">{file.name}</p>
                <p className="text-xs text-[var(--t-muted)]">{(file.size / 1024).toFixed(1)} KB · listo para importar</p>
              </>
            ) : (
              <>
                <Upload className="mb-3 h-10 w-10 text-[var(--t-muted)] group-hover:text-blue-500 transition-colors" />
                <p className="text-sm font-medium text-[var(--t-text)]">Sube el PDF del Calendario Tributario</p>
                <p className="text-xs text-[var(--t-muted)]">Extraemos el texto real del PDF · máx. 12 MB</p>
              </>
            )}
          </div>
        </div>

        {/* Año del calendario: cada evento se guarda etiquetado con su año. */}
        <label className="flex items-center gap-3 rounded-xl bg-[var(--t-surface2)] px-4 py-3">
          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--t-muted)]" />
          <span className="text-sm font-medium text-[var(--t-text)]">Año del calendario</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="ml-auto rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--t-text)] outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            {ANIOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        {status && (
          <div className={`rounded-lg p-3 text-sm ${status.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            <div className="flex items-start gap-3">
              {status.type === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <p>{status.msg}</p>
            </div>
            {status.detail && (
              <div className="mt-2 flex flex-wrap gap-3 pl-7 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 font-semibold">
                  <CopyCheck className="h-3 w-3" /> {status.detail.created} nuevos
                </span>
                {status.detail.duplicates > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--t-surface2)] px-2.5 py-1">
                    {status.detail.duplicates} duplicados omitidos
                  </span>
                )}
                {status.detail.first && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--t-surface2)] px-2.5 py-1">
                    <CalendarRange className="h-3 w-3" /> {status.detail.first} → {status.detail.last}
                  </span>
                )}
                {status.detail.years && Object.keys(status.detail.years).length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--t-surface2)] px-2.5 py-1">
                    Guardado por año:{" "}
                    {Object.entries(status.detail.years).map(([a, n]) => `${a} (${n})`).join(", ")}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <button
          disabled={!file || loading}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Extrayendo y analizando PDF..." : "Importar Datos"}
        </button>
      </form>

      {/* ---------------- archivos PDF guardados, ordenados por subida ---------------- */}
      {token && !listError && (
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <h4 className="text-sm font-bold text-[var(--t-text)]">Archivos subidos</h4>
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-bold text-blue-500">
              {uploads.length}
            </span>
            <span className="text-xs text-[var(--t-muted)]">· más reciente primero</span>
          </div>

          {uploads.length === 0 ? (
            <p className="rounded-xl bg-[var(--t-surface2)] px-4 py-3 text-sm text-[var(--t-muted)]">
              Aún no hay PDFs guardados. El archivo que importes quedará aquí con su nombre.
            </p>
          ) : (
            <ul className="space-y-2">
              {uploads.map((u, i) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-xl bg-[var(--t-surface2)] px-3 py-2.5 ring-1 ring-[var(--t-border)]"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-500/15 text-[11px] font-bold text-blue-500">
                    {i + 1}
                  </span>
                  <FileText className="h-4 w-4 shrink-0 text-[var(--t-muted)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--t-text)]" title={u.filename}>
                      {u.filename}
                    </p>
                    <p className="truncate text-xs text-[var(--t-muted)]">
                      {kb(u.size)} · año {u.year} · {u.events_created} eventos nuevos
                      {u.events_duplicated > 0 && ` · ${u.events_duplicated} duplicados`} · {fecha(u.uploaded_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownload(u)}
                    disabled={busyId === u.id}
                    title="Descargar PDF"
                    className="rounded-lg p-2 text-[var(--t-muted)] transition-colors hover:bg-blue-500/10 hover:text-blue-500 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={busyId === u.id}
                    title="Eliminar archivo"
                    className="rounded-lg p-2 text-[var(--t-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
