"use client";

import { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ConfirmOptions {
  titulo: string;
  descripcion: string;
  textoConfirmar?: string;
  variante?: "default" | "destructive";
  palabraDeSeguridad?: string;
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function handleConfirm() {
    resolverRef.current?.(true);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) resolverRef.current?.(false);
  }

  const ConfirmDialogElement = options ? (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
      titulo={options.titulo}
      descripcion={options.descripcion}
      textoConfirmar={options.textoConfirmar}
      variante={options.variante}
      palabraDeSeguridad={options.palabraDeSeguridad}
    />
  ) : null;

  return { confirm, ConfirmDialogElement };
}
