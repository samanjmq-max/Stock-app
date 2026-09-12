"use client";

import { useState } from "react";
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
 * Diálogo de confirmación genérico. Se usa vía el hook useConfirm()
 * (src/hooks/useConfirm.ts), que evita tener que manejar el estado
 * open/close a mano en cada pantalla que necesita confirmar una acción.
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {/*
            Acá sí va el rojo sólido, no el contorno del variant "destructive":
            este es el último paso, el usuario ya decidió avanzar y el botón no
            compite con nada más en pantalla. El contorno se reserva para los
            botones destructivos que conviven con otras acciones en una lista.
          */}
          <Button
            variant={variante === "destructive" ? "destructive-solid" : "default"}
            onClick={confirmar}
            loading={cargando}
            disabled={bloqueado}
          >
            {textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
