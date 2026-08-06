"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { usuarioSchema, type UsuarioInput } from "@/lib/validations";
import type { Usuario } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuarioEditando: Usuario | null;
  onGuardar: (input: UsuarioInput) => Promise<void>;
}

export function UsuarioFormDialog({ open, onOpenChange, usuarioEditando, onGuardar }: Props) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioInput>({ resolver: zodResolver(usuarioSchema) });

  useEffect(() => {
    if (open) {
      reset(
        usuarioEditando
          ? { nombre: usuarioEditando.nombre, email: usuarioEditando.email, rol: usuarioEditando.rol, activo: usuarioEditando.activo, password: "" }
          : { nombre: "", email: "", rol: "operador", activo: true, password: "" }
      );
    }
  }, [open, usuarioEditando, reset]);

  async function onSubmit(data: UsuarioInput) {
    await onGuardar(data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{usuarioEditando ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          {usuarioEditando && <DialogDescription>Dejá la contraseña vacía si no querés cambiarla.</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input {...register("nombre")} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...register("email")} disabled={!!usuarioEditando} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{usuarioEditando ? "Nueva contraseña (opcional)" : "Contraseña"}</Label>
            <Input type="password" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Controller
              control={control}
              name="rol"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="administrador">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
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
