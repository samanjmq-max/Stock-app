"use client";

import { useState } from "react";
import { Plus, Trash2, Download, Barcode as BarcodeIcon, Search, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { descargarEtiquetas, contarEtiquetas, type DatosEtiqueta } from "@/lib/etiquetas";
import { campoDe } from "@/lib/importacion";

type EstadoBusqueda = "idle" | "buscando" | "encontrado" | "no-encontrado";

/*
  Tope de copias por artículo. El mismo que aplica el servidor -- acá está
  para avisar en el momento, allá para que el tope exista aunque la
  petición no venga de esta pantalla.
*/
const MAX_COPIAS = 100;

/**
 * Cuántas copias pidió la persona.
 *
 * REGLA: vacío es 1, no es un error. El pedido fue explícito -- "si no le
 * pongo ningún número en cantidad de copias, que entienda que es una sola
 * por defecto, que no me tranque por no poner una cantidad". Así que este
 * campo nunca valida ni bloquea: interpreta.
 */
function leerCopias(texto: string): number {
  const n = Math.floor(Number(String(texto).trim()));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_COPIAS);
}

/*
  Un renglón de la lista guarda el texto CRUDO de copias, no el número ya
  interpretado.

  Si guardara el número, borrar el dígito de un "5" para escribir "12"
  dejaría el campo vacío por un instante, leerCopias() lo convertiría en 1
  al toque, y el "2" siguiente se escribiría al lado del 1 que apareció
  solo: uno quiere 12 y le queda 12 de casualidad, o 120, o cualquier cosa.
  Guardando el texto, el campo se comporta como un campo de texto mientras
  se escribe y el número se interpreta recién cuando hace falta.

  El `id` estable es lo que permite borrar un renglón del medio sin que los
  demás se re-numeren y React recicle el input equivocado.
*/
interface Renglon {
  id: string;
  codigo: string;
  descripcion: string;
  ubicacion?: string;
  copiasTexto: string;
}

let proximoId = 0;
function nuevoId(): string {
  proximoId += 1;
  return `etq-${proximoId}`;
}

export default function EtiquetasPage() {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [copias, setCopias] = useState("");
  const [estadoBusqueda, setEstadoBusqueda] = useState<EstadoBusqueda>("idle");
  const [lista, setLista] = useState<Renglon[]>([]);
  const [generando, setGenerando] = useState(false);
  const [cargandoExcel, setCargandoExcel] = useState(false);

  // Lo que se le manda al servidor, ya con las copias interpretadas.
  const paraGenerar: DatosEtiqueta[] = lista.map((r) => ({
    codigo: r.codigo,
    descripcion: r.descripcion,
    ubicacion: r.ubicacion,
    copias: leerCopias(r.copiasTexto),
  }));

  // Renglones de la lista vs. etiquetas que va a tener el PDF: con copias
  // dejan de ser el mismo número, y el botón tiene que decir el segundo.
  const totalEtiquetas = contarEtiquetas(paraGenerar);

  async function buscarEnCatalogo(codigoBuscado: string) {
    const limpio = codigoBuscado.trim();
    if (!limpio) return;
    setEstadoBusqueda("buscando");
    try {
      const res = await fetch(`/api/productos?codigo=${encodeURIComponent(limpio)}`);
      const json = await res.json();
      if (res.ok && json.ok && json.data) {
        setDescripcion(json.data.descripcion || "");
        setUbicacion(json.data.ubicacion || "");
        setEstadoBusqueda("encontrado");
      } else {
        setEstadoBusqueda("no-encontrado");
      }
    } catch {
      setEstadoBusqueda("no-encontrado");
    }
  }

  function validar(): boolean {
    if (!codigo.trim() || !descripcion.trim()) {
      toast.error("Código y descripción son obligatorios");
      return false;
    }
    return true;
  }

  function limpiarFormulario() {
    setCodigo("");
    setDescripcion("");
    setCopias("");
    setEstadoBusqueda("idle");
  }

  function agregar() {
    if (!validar()) return;
    setLista((prev) => [
      ...prev,
      {
        id: nuevoId(),
        codigo: codigo.trim(),
        descripcion: descripcion.trim(),
        ubicacion: ubicacion.trim() || undefined,
        copiasTexto: String(leerCopias(copias)),
      },
    ]);
    limpiarFormulario();
  }

  function quitar(id: string) {
    setLista((prev) => prev.filter((r) => r.id !== id));
  }

  /** Corregir las copias de un renglón ya cargado, sin borrarlo y volver a agregarlo. */
  function cambiarCopias(id: string, texto: string) {
    setLista((prev) => prev.map((r) => (r.id === id ? { ...r, copiasTexto: texto } : r)));
  }

  /** Al salir del campo se normaliza: lo que quedó vacío o inválido pasa a ser 1. */
  function normalizarCopiasDe(id: string) {
    setLista((prev) => prev.map((r) => (r.id === id ? { ...r, copiasTexto: String(leerCopias(r.copiasTexto)) } : r)));
  }

  async function generarPdf() {
    if (paraGenerar.length === 0) return;
    setGenerando(true);
    try {
      await descargarEtiquetas(paraGenerar, "etiquetas-nuevas");
      toast.success(`${totalEtiquetas} etiqueta${totalEtiquetas === 1 ? "" : "s"} generada${totalEtiquetas === 1 ? "" : "s"}`);
      setLista([]);
    } catch (err) {
      console.error("Error al generar el PDF:", err);
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF");
    } finally {
      setGenerando(false);
    }
  }

  async function generarSoloEsta() {
    if (!validar()) return;
    const item: DatosEtiqueta = {
      codigo: codigo.trim(),
      descripcion: descripcion.trim(),
      ubicacion: ubicacion.trim() || undefined,
      copias: leerCopias(copias),
    };
    try {
      await descargarEtiquetas([item], `etiqueta-${item.codigo}`);
      limpiarFormulario();
    } catch (err) {
      console.error("Error al generar el PDF:", err);
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF");
    }
  }

  async function handleArchivoExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargandoExcel(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const nombreHoja = wb.SheetNames[0];
      if (!nombreHoja) {
        toast.error("El archivo no tiene ninguna hoja");
        return;
      }
      const hoja = wb.Sheets[nombreHoja]!;
      const filas: Record<string, unknown>[] = XLSX.utils.sheet_to_json(hoja, { defval: "" });

      const nuevos: Renglon[] = [];
      let omitidas = 0;
      for (const fila of filas) {
        /*
          Se traducen los encabezados del archivo al vocabulario de la app
          con el MISMO diccionario que usa la importación de stock
          (`campoDe`). Así esta pantalla acepta tanto la planilla
          simplificada ("codigo", "descripcion") como el export crudo del
          SAP ("Material", "Texto breve de material", "Ubicación") sin que
          nadie tenga que renombrar columnas a mano.
        */
        const campos: Record<string, string> = {};
        for (const [clave, valor] of Object.entries(fila)) {
          const campo = campoDe(clave);
          if (!campo) continue;
          const texto = String(valor ?? "").trim();
          if (texto && !campos[campo]) campos[campo] = texto;
        }

        // Las copias son propias de esta pantalla: no existen en la
        // importación de stock, así que se buscan aparte por nombre.
        // Misma regla que el formulario: columna ausente o vacía = 1 copia.
        const copiasFila = (() => {
          for (const n of ["copias", "cantidad", "unidades"]) {
            const clave = Object.keys(fila).find((k) => k.trim().toLowerCase() === n);
            if (clave && String(fila[clave]).trim()) return String(fila[clave]).trim();
          }
          return "";
        })();

        const codigoFila = campos.codigo ?? "";
        const descripcionFila = campos.descripcion ?? "";
        const ubicacionFila = campos.ubicacion ?? "";

        if (!codigoFila || !descripcionFila) {
          omitidas++;
          continue;
        }
        nuevos.push({
          id: nuevoId(),
          codigo: codigoFila,
          descripcion: descripcionFila,
          ubicacion: ubicacionFila || undefined,
          copiasTexto: String(leerCopias(copiasFila)),
        });
      }

      setLista((prev) => [...prev, ...nuevos]);
      toast.success(
        `${nuevos.length} filas agregadas${omitidas > 0 ? ` (${omitidas} omitidas por falta de código o descripción)` : ""}`
      );
    } catch (err) {
      console.error("Error al leer el Excel:", err);
      toast.error(
        "No se pudo leer el archivo. Tiene que tener una columna de código y una de descripción (sirven tanto codigo/descripcion como Material/Texto breve de material del SAP)."
      );
    } finally {
      setCargandoExcel(false);
      e.target.value = "";
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <BarcodeIcon size={20} />
          Generar etiqueta
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escribí un código: si ya existe en el catálogo, la descripción y ubicación se completan solas.
          Si no existe, cargalas a mano. También podés subir un Excel con varios artículos de una vez.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Datos del artículo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Código</Label>
            <div className="flex gap-2">
              <Input
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value);
                  setEstadoBusqueda("idle");
                }}
                onBlur={() => buscarEnCatalogo(codigo)}
                placeholder="Ej: 50232"
              />
              <Button type="button" variant="secondary" onClick={() => buscarEnCatalogo(codigo)} disabled={!codigo.trim()}>
                {estadoBusqueda === "buscando" ? <Loader2 className="animate-spin" size={15} /> : <Search size={15} />}
              </Button>
            </div>
            {estadoBusqueda === "encontrado" && (
              <p className="text-xs text-success flex items-center gap-1">
                <CheckCircle2 size={12} /> Encontrado en el catálogo — datos completados solos
              </p>
            )}
            {estadoBusqueda === "no-encontrado" && (
              <p className="text-xs text-muted-foreground">No está en el catálogo todavía — cargá los datos a mano</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: ALMENDRA PEL. TOST. Y SAL. L.A. 100 G"
            />
          </div>

          {/*
            Ubicación y copias comparten renglón. Copias va acá, pegado al
            artículo y no al lado del botón "Agregar": es un dato de ESTA
            etiqueta, igual que la ubicación -- si estuviera junto al botón
            parecería una opción de la lista entera.
          */}
          <div className="grid grid-cols-[1fr_92px] gap-2">
            <div className="space-y-1.5">
              <Label>Ubicación (opcional)</Label>
              <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Ej: CL-A-A-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Copias</Label>
              <Input
                type="number"
                min={1}
                max={MAX_COPIAS}
                inputMode="numeric"
                value={copias}
                onChange={(e) => setCopias(e.target.value)}
                onKeyDown={(e) => {
                  // Enter agrega: es el último campo del formulario y es lo
                  // que uno espera después de tipear un número corto.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregar();
                  }
                }}
                placeholder="1"
                className="text-center tabular-nums"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Dejalo vacío y sale una sola etiqueta. Poné 5 y salen las 5 iguales, sin cargar el artículo cinco veces
            (máximo {MAX_COPIAS} por artículo).
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={agregar}>
              <Plus size={15} /> Agregar a la lista
            </Button>
            <Button type="button" variant="outline" onClick={generarSoloEsta}>
              <Download size={15} /> Generar solo esta
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Subir varios desde Excel</CardTitle></CardHeader>
        <CardContent>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 cursor-pointer hover:bg-secondary/50 transition-colors">
            <Upload size={20} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground text-center px-4">
              {cargandoExcel
                ? "Leyendo archivo..."
                : "Archivo .xlsx con columnas codigo, descripcion, ubicacion y copias (las dos últimas opcionales)"}
            </span>
            {!cargandoExcel && (
              <span className="text-xs text-muted-foreground text-center px-4">
                También sirve el archivo tal cual sale del SAP (Material, Texto breve de material, Ubicación).
              </span>
            )}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleArchivoExcel} disabled={cargandoExcel} />
          </label>
        </CardContent>
      </Card>

      {lista.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">
              Por generar{" "}
              <span className="text-muted-foreground font-normal">
                ({lista.length} {lista.length === 1 ? "artículo" : "artículos"}
                {totalEtiquetas !== lista.length ? ` · ${totalEtiquetas} etiquetas` : ""})
              </span>
            </CardTitle>
            <Button size="sm" onClick={generarPdf} disabled={generando}>
              {generando ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
              Generar PDF ({totalEtiquetas})
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border max-h-[400px] overflow-auto">
              {lista.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {item.codigo} — {item.descripcion}
                    </p>
                    {item.ubicacion && <p className="text-xs text-muted-foreground">Ubic.: {item.ubicacion}</p>}
                  </div>
                  {/*
                    Las copias se corrigen acá mismo. Darse cuenta de que
                    eran 10 y no 5 después de agregar el renglón no debería
                    obligar a borrarlo y cargar el artículo de nuevo.
                  */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="font-mono text-[11px] text-muted-foreground">×</span>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_COPIAS}
                      inputMode="numeric"
                      value={item.copiasTexto}
                      onChange={(e) => cambiarCopias(item.id, e.target.value)}
                      onBlur={() => normalizarCopiasDe(item.id)}
                      aria-label={`Copias de ${item.codigo}`}
                      className="h-7 w-14 px-1.5 text-center text-xs tabular-nums"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => quitar(item.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
