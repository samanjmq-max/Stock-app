"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import type { Conteo } from "@/types";
import { calcularDiferencia, estadoDesdeDiferencia } from "@/lib/utils";
import { conteosService } from "@/services/conteos.service";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  conteo: Conteo | null;
  onClose: () => void;
  /** Se llama después de guardar bien, para que la pantalla que lo abrió refresque los datos. */
  onGuardado: () => void;
}

export function EditarConteoDialog({ conteo, onClose, onGuardado }: Props) {
  const [stockContado, setStockContado] = useState("");
  const [ubicacionNueva, setUbicacionNueva] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

  if (!conteo) return null;

  const stockActual = stockContado === "" ? conteo.stockContado : Number(stockContado);
  const diferenciaPreview = calcularDiferencia(conteo.stockSap, stockActual);

  async function guardar() {
    if (!conteo) return;
    setGuardando(true);
    try {
      const contado = stockContado === "" ? conteo.stockContado : Number(stockContado);
      const diferencia = calcularDiferencia(conteo.stockSap, contado);
      const estado = estadoDesdeDiferencia(diferencia);

      await conteosService.editar(conteo.id, {
        stockContado: contado,
        diferencia,
        estado,
        observaciones: observaciones || conteo.observaciones || "",
        ubicacionNueva: ubicacionNueva || conteo.ubicacionNueva || "",
      });

      toast.success("Conteo corregido");
      onGuardado();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la corrección");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={Boolean(conteo)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corregir conteo</DialogTitle>
          <DialogDescription>
            {conteo.codigo} — {conteo.descripcion}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-y-1.5 text-xs border-b border-border pb-3">
            <span className="text-muted-foreground">Ubicación SAP</span>
            <span className="text-right">{conteo.ubicacion || "—"}</span>
            <span className="text-muted-foreground">Stock SAP</span>
            <span className="text-right">{conteo.stockSap}</span>
            <span className="text-muted-foreground">Contado originalmente</span>
            <span className="text-right">{conteo.stockContado}</span>
            <span className="text-muted-foreground">Usuario que contó</span>
            <span className="text-right">{conteo.usuarioEmail}</span>
            <span className="text-muted-foreground">Fecha del conteo</span>
            <span className="text-right">{conteo.fecha}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-stock">Cantidad correcta</Label>
            <Input
              id="edit-stock"
              type="number"
              inputMode="decimal"
              placeholder={String(conteo.stockContado)}
              value={stockContado}
              onChange={(e) => setStockContado(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Nueva diferencia: {diferenciaPreview > 0 ? "+" : ""}
              {diferenciaPreview} ({estadoDesdeDiferencia(diferenciaPreview)})
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-ubicacion">Ubicación corregida (opcional)</Label>
            <Input
              id="edit-ubicacion"
              placeholder={conteo.ubicacionNueva || "Sin corrección de ubicación"}
              value={ubicacionNueva}
              onChange={(e) => setUbicacionNueva(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-obs">Observaciones</Label>
            <Textarea
              id="edit-obs"
              rows={2}
              placeholder={conteo.observaciones || "Sin observaciones"}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar corrección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
