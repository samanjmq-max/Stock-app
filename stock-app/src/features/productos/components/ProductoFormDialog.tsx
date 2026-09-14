"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { productoSchema, type ProductoInput } from "@/lib/validations";
import type { Agencia, Producto } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productoEditando: Producto | null;
  onGuardar: (input: ProductoInput) => Promise<void>;
  /**
   * Agencia a asignar cuando se crea un producto NUEVO (para editar, se
   * mantiene la del producto existente). `productoSchema.agencia` es
   * obligatorio y sin default -- sin esto, el submit queda bloqueado en
   * silencio por Zod porque el form nunca junta un valor válido.
   */
  agenciaPorDefecto: Agencia;
}

export function ProductoFormDialog({ open, onOpenChange, productoEditando, onGuardar, agenciaPorDefecto }: Props) {
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
              unidadMedida: productoEditando.unidadMedida ?? "",
              agencia: productoEditando.agencia,
            }
          : { codigo: "", descripcion: "", ubicacion: "", familia: "", proveedor: "", stockSap: 0, unidadMedida: "", agencia: agenciaPorDefecto }
      );
    }
  }, [open, productoEditando, agenciaPorDefecto, reset]);

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
            {/* Stock y unidad comparten celda: son el mismo dato partido en
                dos. "450" no significa nada hasta saber si son litros o
                bidones, así que se cargan juntos y no en extremos opuestos
                del formulario. */}
            <div className="space-y-1.5">
              <Label>Stock SAP</Label>
              <div className="grid grid-cols-[1fr_76px] gap-2">
                <Input type="number" step="any" {...register("stockSap")} />
                <Input
                  {...register("unidadMedida")}
                  placeholder="UN"
                  maxLength={8}
                  aria-label="Unidad de medida"
                  className="text-center uppercase"
                />
              </div>
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
