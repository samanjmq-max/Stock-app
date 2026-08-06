"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConfirmOptions {
  titulo: string;
  descripcion: string;
  textoConfirmar?: string;
  variante?: "default" | "destructive";
  /** Si se define, el usuario debe escribir exactamente este texto para poder confirmar (para acciones irreversibles). */
  palabraDeSeguridad?: string;
}

interface Props extends ConfirmOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
}

/**
 * Diálogo de confirmación genérico. Se usa vía el hook useConfirm() de más
 * abajo, que evita tener que manejar el estado open/close a mano en cada
 * pantalla que necesita confirmar una acción (eliminar, reiniciar, etc.).
 */
export function ConfirmDialog({ open, onOpenChange, titulo, descripcion, textoConfirmar = "Confirmar", variante = "default", palabraDeSeguridad, onConfirm }: Props) {
  const [escrito, setEscrito] = useState("");
  const [cargando, setCargando] = useState(false);

  const bloqueado = !!palabraDeSeguridad && escrito !== palabraDeSeguridad;

  async function confirmar() {
    setCargando(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setCargando(false);
      setEscrito("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setEscrito(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        {palabraDeSeguridad && (
          <Input
            className="mt-1"
            placeholder={`Escribí "${palabraDeSeguridad}" para confirmar`}
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
          />
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant={variante === "destructive" ? "destructive" : "default"} onClick={confirmar} disabled={cargando || bloqueado}>
            {cargando && <Loader2 className="animate-spin" size={15} />}
            {textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
