"use client";

import { useState } from "react";
import { Loader2, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { leerArchivoProductos, type ResultadoLectura } from "@/lib/importacion";
import { productosService } from "@/services/productos.service";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AGENCIAS } from "@/types";
import type { Agencia } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportado: (cantidad: number) => void;
}

export function ImportarProductosDialog({ open, onOpenChange, onImportado }: Props) {
  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState<Agencia | "">("");
  const [resultado, setResultado] = useState<ResultadoLectura | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!agenciaSeleccionada) {
      setError("Seleccioná una agencia antes de elegir el archivo.");
      return;
    }
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
    if (!resultado || resultado.filasValidas.length === 0 || !agenciaSeleccionada) return;
    setImportando(true);
    setError(null);
    try {
      const res = await productosService.importar(resultado.filasValidas, agenciaSeleccionada);
      onImportado(res.importados + res.actualizados);
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
    setAgenciaSeleccionada("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar productos</DialogTitle>
          <DialogDescription>
            Archivo .xlsx, .xls o .csv con columnas: código, descripción, ubicación, familia, proveedor, stockSap.
            Los códigos que ya existen en esa agencia se actualizan; los nuevos se agregan. Nunca toca productos de otras agencias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Agencia destino</Label>
            <Select
              value={agenciaSeleccionada}
              onValueChange={(v) => {
                setAgenciaSeleccionada(v as Agencia);
                setResultado(null);
                setError(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná la agencia..." />
              </SelectTrigger>
              <SelectContent>
                {AGENCIAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!resultado && (
            <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-10 transition-colors ${agenciaSeleccionada ? "cursor-pointer hover:bg-secondary/50" : "opacity-50 cursor-not-allowed"}`}>
              <Upload size={22} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {leyendo ? "Leyendo archivo..." : agenciaSeleccionada ? "Hacé clic para elegir un archivo" : "Primero seleccioná una agencia"}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFile}
                disabled={leyendo || !agenciaSeleccionada}
              />
            </label>
          )}

          {resultado && (
            <div className="space-y-3">
              <p className="text-sm font-medium truncate">{nombreArchivo}</p>
              <p className="text-xs text-muted-foreground">Agencia destino: <span className="font-medium text-foreground">{agenciaSeleccionada}</span></p>
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
                      <li key={i}>Fila {f.fila}: {f.motivo}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-3">{error}</p>}

        <DialogFooter>
          <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
          {resultado && (
            <Button onClick={confirmarImportacion} disabled={importando || resultado.filasValidas.length === 0 || !agenciaSeleccionada}>
              {importando && <Loader2 className="animate-spin" size={15} />}
              Importar {resultado.filasValidas.length} productos → {agenciaSeleccionada}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
