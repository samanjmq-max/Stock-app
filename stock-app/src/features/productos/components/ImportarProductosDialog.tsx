"use client";

import { useState } from "react";
import { Loader2, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { leerArchivoProductos, type ResultadoLectura } from "@/lib/importacion";
import { productosService } from "@/services/productos.service";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportado: (cantidad: number) => void;
}

export function ImportarProductosDialog({ open, onOpenChange, onImportado }: Props) {
  const [resultado, setResultado] = useState<ResultadoLectura | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLeyendo(true);
    setNombreArchivo(file.name);
    try {
      const res = await leerArchivoProductos(file);
      setResultado(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo");
    } finally {
      setLeyendo(false);
    }
  }

  async function confirmarImportacion() {
    if (!resultado || resultado.filasValidas.length === 0) return;
    setImportando(true);
    setError(null);
    try {
      const { importados } = await productosService.importar(resultado.filasValidas);
      onImportado(importados);
      cerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar");
    } finally {
      setImportando(false);
    }
  }

  function cerrar() {
    setResultado(null);
    setNombreArchivo("");
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar productos</DialogTitle>
          <DialogDescription>
            Archivo .xlsx, .xls o .csv con columnas: código, descripción, ubicación, familia, proveedor, stockSap.
            Solo se agregan productos nuevos (los códigos ya existentes se ignoran).
          </DialogDescription>
        </DialogHeader>

        {!resultado && (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-10 cursor-pointer hover:bg-secondary/50 transition-colors">
            <Upload size={22} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {leyendo ? "Leyendo archivo..." : "Hacé clic para elegir un archivo"}
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} disabled={leyendo} />
          </label>
        )}

        {resultado && (
          <div className="space-y-3">
            <p className="text-sm font-medium truncate">{nombreArchivo}</p>
            <div className="flex items-center gap-2 text-sm bg-success/10 text-success rounded-lg px-3 py-2">
              <CheckCircle2 size={16} />
              {resultado.filasValidas.length} de {resultado.totalFilas} filas listas para importar
            </div>
            {resultado.filasInvalidas.length > 0 && (
              <div className="text-sm bg-warning/15 text-warning-foreground rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <AlertTriangle size={16} />
                  {resultado.filasInvalidas.length} filas con errores (se omiten)
                </div>
                <ul className="text-xs space-y-0.5 max-h-24 overflow-y-auto">
                  {resultado.filasInvalidas.slice(0, 10).map((f, i) => (
                    <li key={i}>
                      Fila {f.fila}: {f.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-3">{error}</p>}

        <DialogFooter>
          <Button variant="secondary" onClick={cerrar}>
            Cancelar
          </Button>
          {resultado && (
            <Button onClick={confirmarImportacion} disabled={importando || resultado.filasValidas.length === 0}>
              {importando && <Loader2 className="animate-spin" size={15} />}
              Importar {resultado.filasValidas.length} productos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
