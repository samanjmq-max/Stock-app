"use client";

import { useState } from "react";
import { Plus, Trash2, Download, Barcode as BarcodeIcon, Search, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { descargarEtiquetas, type DatosEtiqueta } from "@/lib/etiquetas";

type EstadoBusqueda = "idle" | "buscando" | "encontrado" | "no-encontrado";

export default function EtiquetasPage() {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [estadoBusqueda, setEstadoBusqueda] = useState<EstadoBusqueda>("idle");
  const [lista, setLista] = useState<DatosEtiqueta[]>([]);
  const [generando, setGenerando] = useState(false);
  const [cargandoExcel, setCargandoExcel] = useState(false);

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

  function agregar() {
    if (!validar()) return;
    setLista((prev) => [
      ...prev,
      { codigo: codigo.trim(), descripcion: descripcion.trim(), ubicacion: ubicacion.trim() || undefined },
    ]);
    setCodigo("");
    setDescripcion("");
    setEstadoBusqueda("idle");
  }

  function quitar(index: number) {
    setLista((prev) => prev.filter((_, i) => i !== index));
  }

  function generarPdf() {
    if (lista.length === 0) return;
    setGenerando(true);
    try {
      descargarEtiquetas(lista, "etiquetas-nuevas");
      toast.success(`${lista.length} etiqueta${lista.length === 1 ? "" : "s"} generada${lista.length === 1 ? "" : "s"}`);
      setLista([]);
    } catch (err) {
      console.error("Error al generar el PDF:", err);
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF");
    } finally {
      setGenerando(false);
    }
  }

  function generarSoloEsta() {
    if (!validar()) return;
    const item: DatosEtiqueta = {
      codigo: codigo.trim(),
      descripcion: descripcion.trim(),
      ubicacion: ubicacion.trim() || undefined,
    };
    try {
      descargarEtiquetas([item], `etiqueta-${item.codigo}`);
      setCodigo("");
      setDescripcion("");
      setEstadoBusqueda("idle");
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
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const filas: Record<string, unknown>[] = XLSX.utils.sheet_to_json(hoja, { defval: "" });

      const nuevos: DatosEtiqueta[] = [];
      let omitidas = 0;
      for (const fila of filas) {
        const obtener = (nombres: string[]) => {
          for (const n of nombres) {
            const clave = Object.keys(fila).find((k) => k.trim().toLowerCase() === n);
            if (clave && String(fila[clave]).trim()) return String(fila[clave]).trim();
          }
          return "";
        };
        const codigoFila = obtener(["codigo", "código"]);
        const descripcionFila = obtener(["descripcion", "descripción"]);
        const ubicacionFila = obtener(["ubicacion", "ubicación"]);

        if (!codigoFila || !descripcionFila) {
          omitidas++;
          continue;
        }
        nuevos.push({ codigo: codigoFila, descripcion: descripcionFila, ubicacion: ubicacionFila || undefined });
      }

      setLista((prev) => [...prev, ...nuevos]);
      toast.success(
        `${nuevos.length} filas agregadas${omitidas > 0 ? ` (${omitidas} omitidas por falta de código o descripción)` : ""}`
      );
    } catch (err) {
      console.error("Error al leer el Excel:", err);
      toast.error("No se pudo leer el archivo. Verificá que tenga columnas codigo y descripcion.");
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
          <div className="space-y-1.5">
            <Label>Ubicación (opcional)</Label>
            <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Ej: CL-A-A-001" />
          </div>

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
                : "Archivo .xlsx con columnas codigo, descripcion y ubicacion (opcional)"}
            </span>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleArchivoExcel} disabled={cargandoExcel} />
          </label>
        </CardContent>
      </Card>

      {lista.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">
              Por generar <span className="text-muted-foreground font-normal">({lista.length})</span>
            </CardTitle>
            <Button size="sm" onClick={generarPdf} disabled={generando}>
              {generando ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
              Generar PDF ({lista.length})
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border max-h-[400px] overflow-auto">
              {lista.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {item.codigo} — {item.descripcion}
                    </p>
                    {item.ubicacion && <p className="text-xs text-muted-foreground">Ubic.: {item.ubicacion}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => quitar(i)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
