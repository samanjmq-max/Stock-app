"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload, AlertTriangle, CheckCircle2, Download, FileWarning } from "lucide-react";
import {
  leerArchivoProductos,
  descargarPlantillaProductos,
  esErrorDeColumnas,
  COLUMNAS_REQUERIDAS,
  COLUMNA_PRECIO,
  COLUMNA_UNIDAD,
  type ResultadoLectura,
  type ErrorDeColumnas,
} from "@/lib/importacion";
import { productosService } from "@/services/productos.service";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import type { Agencia } from "@/types";

/**
 * Cuántos productos se mandan por viaje al backend.
 *
 * Mandar el catálogo entero de una (10.000+ productos) no funciona: Apps
 * Script tiene que leer toda la hoja para saber cuáles ya existen y después
 * escribir miles de filas, y eso no entra en el tiempo que una función de
 * Vercel puede estar esperando. Cortado en lotes, cada viaje es corto y
 * previsible, se puede mostrar avance real, y si algo falla se sabe dónde.
 *
 * Si alguna vez vuelve a dar timeout, bajar este número (por ejemplo a 500)
 * es el primer ajuste a probar.
 */
const TAMANO_LOTE = 1000;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportado: (cantidad: number) => void;
}

export function ImportarProductosDialog({ open, onOpenChange, onImportado }: Props) {
  /*
    El desplegable ofrece SOLO las plantas que esta persona tiene a cargo,
    no las nueve.

    Antes listaba `AGENCIAS` entero para cualquiera. El servidor igual
    rechazaba las ajenas, así que no era un agujero -- era peor de usar: un
    encargado de Lascano veía ocho opciones que terminaban en un 403 después
    de haber elegido el archivo y esperado la lectura. Ofrecer algo que se
    va a rechazar es una promesa que la pantalla no puede cumplir.

    `alcance` viene resuelto del servidor (son las nueve para el gerente y
    el super admin), así que acá no se reimplementa ninguna regla.
  */
  const { alcance, agencia: agenciaPropia } = useAuth();
  const plantasDisponibles: Agencia[] = alcance.length > 0 ? alcance : agenciaPropia ? [agenciaPropia] : [];

  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState<Agencia | "">("");

  /*
    Con una sola planta a cargo no hay nada que elegir: se preselecciona al
    abrir. Es el caso del encargado de almacén, que es justamente quien más
    veces por mes va a pasar por acá.
  */
  useEffect(() => {
    if (!open) return;
    if (plantasDisponibles.length === 1) setAgenciaSeleccionada(plantasDisponibles[0]!);
    // `plantasDisponibles` se arma en cada render; listarlo acá reabriría
    // el efecto en cada pasada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plantasDisponibles.length]);
  const [resultado, setResultado] = useState<ResultadoLectura | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /*
    El archivo mal armado tiene su propio estado, separado de `error`.

    Un error suelto en una línea de texto roja es lo que se le muestra a
    alguien cuando algo salió mal y no hay nada que hacer. Acá sí hay algo
    que hacer -- arreglar el archivo -- así que la pantalla tiene que decir
    exactamente qué columna falta, con qué nombre se puede escribir, y dar
    la planilla modelo ahí mismo.
  */
  const [errorColumnas, setErrorColumnas] = useState<ErrorDeColumnas | null>(null);
  const [bajandoPlantilla, setBajandoPlantilla] = useState(false);

  async function bajarPlantilla() {
    setBajandoPlantilla(true);
    try {
      await descargarPlantillaProductos();
    } catch {
      setError("No se pudo generar la plantilla");
    } finally {
      setBajandoPlantilla(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!agenciaSeleccionada) {
      setError("Seleccioná una agencia antes de elegir el archivo.");
      return;
    }
    setError(null);
    setErrorColumnas(null);
    setLeyendo(true);
    setNombreArchivo(file.name);
    try {
      const res = await leerArchivoProductos(file);
      setResultado(res);
    } catch (err) {
      if (esErrorDeColumnas(err)) setErrorColumnas(err);
      else setError(err instanceof Error ? err.message : "No se pudo leer el archivo");
    } finally {
      setLeyendo(false);
      // Se limpia el input para que elegir OTRA VEZ el mismo archivo, después
      // de corregirlo en Excel, vuelva a disparar la lectura. Sin esto el
      // navegador ve el mismo valor y no emite el evento.
      e.target.value = "";
    }
  }

  async function confirmarImportacion() {
    if (!resultado || resultado.filasValidas.length === 0 || !agenciaSeleccionada) return;

    const filas = resultado.filasValidas;
    setImportando(true);
    setError(null);
    setProgreso({ hechos: 0, total: filas.length });

    let importados = 0;
    let actualizados = 0;
    let procesados = 0;

    try {
      for (let desde = 0; desde < filas.length; desde += TAMANO_LOTE) {
        const lote = filas.slice(desde, desde + TAMANO_LOTE);
        const res = await productosService.importar(lote, agenciaSeleccionada);
        importados += res.importados ?? 0;
        actualizados += res.actualizados ?? 0;
        procesados += lote.length;
        setProgreso({ hechos: procesados, total: filas.length });
      }
      onImportado(importados + actualizados);
      cerrar();
    } catch (err) {
      const motivo = err instanceof Error ? err.message : "No se pudo importar";
      // Se avisa cuántos alcanzaron a entrar: sin esto, ante un corte a mitad
      // de camino no hay forma de saber si conviene reintentar o si se van a
      // duplicar los productos. Reintentar es seguro — los códigos que ya
      // están se actualizan, no se duplican.
      setError(
        procesados > 0
          ? `Se importaron ${procesados} de ${filas.length} productos y ahí se cortó. ${motivo} — Podés volver a intentar con el mismo archivo: los que ya entraron se actualizan, no se duplican.`
          : motivo
      );
    } finally {
      setImportando(false);
      setProgreso(null);
    }
  }

  function cerrar() {
    setResultado(null);
    setNombreArchivo("");
    setError(null);
    setErrorColumnas(null);
    setProgreso(null);
    setAgenciaSeleccionada("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar productos</DialogTitle>
          <DialogDescription>
            Archivo .xlsx, .xls o .csv con las columnas del formato estándar. Los códigos que ya existen en esa
            agencia se actualizan; los nuevos se agregan. Nunca toca productos de otras agencias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Agencia destino</Label>
            <Select
              value={agenciaSeleccionada}
              disabled={importando}
              onValueChange={(v) => {
                setAgenciaSeleccionada(v as Agencia);
                setResultado(null);
                setError(null);
                setErrorColumnas(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná la agencia..." />
              </SelectTrigger>
              <SelectContent>
                {plantasDisponibles.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/*
            Archivo rechazado por formato. Es un bloqueo, no una advertencia:
            si le falta una columna, importarlo le borra ese dato a todos los
            artículos de la planta. Y es la única forma de que las nueve
            plantas manden la misma planilla en vez de nueve variantes.
          */}
          {errorColumnas && (
            <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3.5">
              <div className="flex items-start gap-2">
                <FileWarning size={17} className="mt-px shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-destructive">
                    Este archivo no tiene el formato que necesita la app
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{nombreArchivo}</p>
                </div>
              </div>

              <div>
                <p className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {errorColumnas.columnasFaltantes.length === 1 ? "Falta esta columna" : "Faltan estas columnas"}
                </p>
                <ul className="space-y-1">
                  {errorColumnas.columnasFaltantes.map((c) => (
                    <li key={c.campo} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                      <span className="font-medium text-foreground">{c.etiqueta}</span>
                      <span className="text-muted-foreground">
                        — encabezado: {c.acepta.map((a) => `"${a}"`).join(" o ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {errorColumnas.columnasEncontradas.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">El archivo trae:</span>{" "}
                  {errorColumnas.columnasEncontradas.join(" · ")}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-destructive/20 pt-3">
                <Button variant="outline" size="sm" onClick={bajarPlantilla} disabled={bajandoPlantilla}>
                  {bajandoPlantilla ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                  Descargar plantilla
                </Button>
                <span className="text-xs text-muted-foreground">
                  Corregí el archivo y volvé a elegirlo.
                </span>
              </div>
            </div>
          )}

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

          {/* El formato, a la vista ANTES de elegir el archivo. Enterarse de
              que falta una columna recién después de buscar el archivo en el
              disco es enterarse tarde. */}
          {!resultado && !errorColumnas && (
            <div className="space-y-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Columnas obligatorias
              </p>
              <p className="text-xs text-muted-foreground">
                {COLUMNAS_REQUERIDAS.map((c) => c.etiqueta).join(" · ")}
                <span className="opacity-70">
                  {" "}· {COLUMNA_UNIDAD.etiqueta} y {COLUMNA_PRECIO.etiqueta} (opcionales)
                </span>
              </p>
              <button
                type="button"
                onClick={bajarPlantilla}
                disabled={bajandoPlantilla}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline decoration-dotted underline-offset-2 hover:no-underline disabled:opacity-60"
              >
                {bajandoPlantilla ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />}
                Descargar plantilla
              </button>
            </div>
          )}

          {resultado && (
            <div className="space-y-3">
              <p className="text-sm font-medium truncate">{nombreArchivo}</p>
              <p className="text-xs text-muted-foreground">Agencia destino: <span className="font-medium text-foreground">{agenciaSeleccionada}</span></p>
              {!resultado.traeUnidad && (
                /* Misma lógica que el precio: no se pierde nada, pero si
                   alguien sube el archivo para cargar las unidades de los
                   líquidos y no cambia nada, el silencio parece una falla. */
                <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  <AlertTriangle size={14} className="mt-px shrink-0" />
                  <span>
                    El archivo no trae columna de unidad de medida ({COLUMNA_UNIDAD.acepta.map((a) => `"${a}"`).join(" o ")}).
                    Las que ya están cargadas se mantienen. Bajá la plantilla si querés sumarla —
                    para los líquidos es la diferencia entre contar bidones y contar litros.
                  </span>
                </div>
              )}
              {!resultado.traePrecio && (
                /* No es un error: el script no pisa el precio si la fila no
                   lo trae, así que lo ya cargado queda intacto. Se avisa
                   igual porque subir el archivo esperando actualizar precios
                   y que no cambie nada se parece demasiado a una falla. */
                <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  <AlertTriangle size={14} className="mt-px shrink-0" />
                  <span>
                    El archivo no trae columna de precio ({COLUMNA_PRECIO.acepta.map((a) => `"${a}"`).join(" o ")}).
                    Se importa igual y los precios que ya están cargados se mantienen, pero no se actualiza ninguno.
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm bg-success/10 text-success rounded-lg px-3 py-2">
                <CheckCircle2 size={16} />
                {resultado.filasValidas.length} de {resultado.totalFilas} filas listas para importar
              </div>
              {resultado.filasInvalidas.length > 0 && (
                <div className="text-sm bg-warning/15 text-warning rounded-lg px-3 py-2">
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

              {progreso && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Importando en lotes de {TAMANO_LOTE}...</span>
                    <span className="tabular-nums font-medium text-foreground">
                      {progreso.hechos} / {progreso.total}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.round((progreso.hechos / progreso.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No cierres esta ventana hasta que termine.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-3">{error}</p>}

        <DialogFooter>
          <Button variant="secondary" onClick={cerrar} disabled={importando}>Cancelar</Button>
          {resultado && (
            <Button onClick={confirmarImportacion} disabled={importando || resultado.filasValidas.length === 0 || !agenciaSeleccionada}>
              {importando && <Loader2 className="animate-spin" size={15} />}
              {importando
                ? `Importando ${progreso?.hechos ?? 0} de ${progreso?.total ?? resultado.filasValidas.length}...`
                : `Importar ${resultado.filasValidas.length} productos → ${agenciaSeleccionada}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
