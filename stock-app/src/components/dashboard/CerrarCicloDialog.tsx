"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Agencia } from "@/types";
import { exportarExcel, exportarPDF } from "@/lib/exportacion";
import { conteosService } from "@/services/conteos.service";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  agencia: Agencia;
  /** Filas de detalle ya armadas (mismas que el export del Dashboard). */
  filas: Record<string, unknown>[];
  /** Columnas para el PDF. */
  columnasPdf: { header: string; key: string }[];
  cantidad: number;
  importe: number;
  /** Se llama después de cerrar bien, para refrescar la pantalla. */
  onCerrado: () => void;
}

function nombreBaseArchivo(agencia: string): string {
  const fecha = new Date().toISOString().slice(0, 10); // AAAA-MM-DD
  const ag = agencia.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-").toLowerCase();
  return `cierre-conteo-${ag}-${fecha}`;
}

export function CerrarCicloDialog({ open, onClose, agencia, filas, columnasPdf, cantidad, importe, onCerrado }: Props) {
  const [conExcel, setConExcel] = useState(true);
  const [conPdf, setConPdf] = useState(true);
  const [generado, setGenerado] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [generando, setGenerando] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  // Cada vez que se abre, arranca de cero (nada de estados pegados de un cierre anterior).
  useEffect(() => {
    if (open) {
      setConExcel(true);
      setConPdf(true);
      setGenerado(false);
      setConfirmado(false);
      setNombreArchivo("");
      setGenerando(false);
      setCerrando(false);
    }
  }, [open]);

  async function generarDocumento() {
    if (!conExcel && !conPdf) {
      toast.error("Elegí al menos un formato (Excel o PDF)");
      return;
    }
    setGenerando(true);
    try {
      const base = nombreBaseArchivo(agencia);
      const titulo = `Detalle de conteo — ${agencia} — ${new Date().toLocaleDateString("es-UY")}`;
      if (conExcel) await exportarExcel(filas, "Detalle", base);
      if (conPdf) await exportarPDF(filas, columnasPdf, titulo, base);
      setNombreArchivo(base + (conExcel && conPdf ? " (.xlsx + .pdf)" : conExcel ? ".xlsx" : ".pdf"));
      setGenerado(true);
      toast.success("Documento generado — guardalo en un lugar seguro antes de cerrar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el documento");
    } finally {
      setGenerando(false);
    }
  }

  async function cerrar() {
    if (!generado || !confirmado) return;
    setCerrando(true);
    try {
      const res = await conteosService.cerrarCiclo({ agencia, archivoGenerado: nombreArchivo });
      toast.success(`Cíclico de ${agencia} cerrado: ${res.eliminados} conteos archivados y limpiados`);
      onCerrado();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cerrar el cíclico");
    } finally {
      setCerrando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !cerrando) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cerrar cíclico — {agencia}</DialogTitle>
          <DialogDescription>
            Genera el documento con el detalle del conteo, y luego archiva el resumen y limpia el detalle de esta planta. El detalle vive como documento; el sistema guarda solo un resumen liviano.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-input bg-elevated/40 px-3 py-2 text-sm">
            <span className="font-semibold">{cantidad}</span> conteos ·{" "}
            importe <span className="font-semibold tabular-nums">{importe.toLocaleString("es-UY")}</span>
          </div>

          {/* Paso 1 — formato y generación */}
          <div>
            <p className="mb-2 text-sm font-semibold">1. Elegí el formato del documento</p>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={conExcel} onChange={(e) => setConExcel(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                <FileSpreadsheet size={15} /> Excel
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={conPdf} onChange={(e) => setConPdf(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                <FileText size={15} /> PDF
              </label>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={generarDocumento} loading={generando} disabled={cerrando}>
              <Download size={15} /> Generar y descargar documento
            </Button>
          </div>

          {/* Aviso de guardado */}
          <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
            <span>Se recomienda <b>guardar este documento</b> para futuras comparaciones, en un lugar donde lo puedas encontrar. Una vez que cierres, el detalle se borra de la planilla.</span>
          </div>

          {/* Paso 2 — confirmación */}
          <div>
            <p className="mb-2 text-sm font-semibold">2. Confirmá que lo guardaste</p>
            <label className={`flex items-center gap-2 text-sm ${generado ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
              <input type="checkbox" checked={confirmado} disabled={!generado} onChange={(e) => setConfirmado(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              {generado && confirmado ? <CheckCircle2 size={15} className="text-success" /> : null}
              Confirmo que descargué y guardé el documento
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={cerrando}>Cancelar</Button>
          <Button variant="destructive-solid" onClick={cerrar} loading={cerrando} disabled={!generado || !confirmado || cerrando}>
            Cerrar y limpiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
