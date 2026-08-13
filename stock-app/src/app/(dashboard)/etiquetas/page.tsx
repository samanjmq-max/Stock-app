"use client";

import { useState } from "react";
import { Plus, Trash2, Download, Barcode as BarcodeIcon } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { descargarEtiquetas, type DatosEtiqueta } from "@/lib/etiquetas";

export default function EtiquetasPage() {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [lista, setLista] = useState<DatosEtiqueta[]>([]);
  const [generando, setGenerando] = useState(false);

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
    // La ubicación se mantiene cargada: es común agregar varios artículos seguidos de la misma zona.
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
      console.error(err);
      toast.error("No se pudo generar el PDF");
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
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el PDF");
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
          Para artículos que todavía no tenés en el catálogo, o para reimprimir uno puntual.
          Genera el mismo formato de etiqueta (10×5 cm) que las del catálogo completo.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Datos del artículo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Código</Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: 50232" />
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

      {lista.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">
              Por generar <span className="text-muted-foreground font-normal">({lista.length})</span>
            </CardTitle>
            <Button size="sm" onClick={generarPdf} disabled={generando}>
              <Download size={15} /> Generar PDF ({lista.length})
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
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
