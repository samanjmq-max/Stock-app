"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { productoSchema, type ProductoInput } from "@/lib/validations";
import type { Producto } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productoEditando: Producto | null;
  onGuardar: (input: ProductoInput) => Promise<void>;
}

export function ProductoFormDialog({ open, onOpenChange, productoEditando, onGuardar }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductoInput>({ resolver: zodResolver(productoSchema) });

  useEffect(() => {
    if (open) {
      reset(
        productoEditando
          ? {
              codigo: productoEditando.codigo,
              descripcion: productoEditando.descripcion,
              ubicacion: productoEditando.ubicacion,
              familia: productoEditando.familia,
              proveedor: productoEditando.proveedor,
              stockSap: productoEditando.stockSap,
            }
          : { codigo: "", descripcion: "", ubicacion: "", familia: "", proveedor: "", stockSap: 0 }
      );
    }
  }, [open, productoEditando, reset]);

  async function onSubmit(data: ProductoInput) {
    await onGuardar(data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{productoEditando ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Código</Label>
            <Input {...register("codigo")} disabled={!!productoEditando} />
            {errors.codigo && <p className="text-xs text-destructive">{errors.codigo.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input {...register("descripcion")} />
            {errors.descripcion && <p className="text-xs text-destructive">{errors.descripcion.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ubicación</Label>
              <Input {...register("ubicacion")} />
            </div>
            <div className="space-y-1.5">
              <Label>Stock SAP</Label>
              <Input type="number" step="any" {...register("stockSap")} />
              {errors.stockSap && <p className="text-xs text-destructive">{errors.stockSap.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Familia</Label>
              <Input {...register("familia")} />
            </div>
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Input {...register("proveedor")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" size={15} />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
