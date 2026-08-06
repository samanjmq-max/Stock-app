"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, ShieldCheck, ShieldOff } from "lucide-react";
import { usuariosService } from "@/services/usuarios.service";
import type { UsuarioInput } from "@/lib/validations";
import type { Usuario } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/hooks/useConfirm";
import { UsuarioFormDialog } from "@/features/usuarios/components/UsuarioFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function UsuariosPage() {
  const { user } = useAuth();
  const { confirm, ConfirmDialogElement } = useConfirm();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      setUsuarios(await usuariosService.listar());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardarUsuario(input: UsuarioInput) {
    try {
      if (usuarioEditando) {
        await usuariosService.actualizar(usuarioEditando.id, input);
        toast.success("Usuario actualizado");
      } else {
        await usuariosService.crear(input);
        toast.success("Usuario creado");
      }
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function toggleActivo(u: Usuario) {
    try {
      await usuariosService.actualizar(u.id, { activo: !u.activo });
      toast.success(u.activo ? "Usuario desactivado" : "Usuario activado");
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    }
  }

  async function eliminarUsuario(u: Usuario) {
    const confirmado = await confirm({
      titulo: "Eliminar usuario",
      descripcion: `¿Eliminar a ${u.email}? Esta acción no se puede deshacer.`,
      textoConfirmar: "Eliminar",
      variante: "destructive",
    });
    if (!confirmado) return;

    try {
      await usuariosService.eliminar(u.id);
      toast.success("Usuario eliminado");
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-muted-foreground" size={22} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex justify-end">
        <Button onClick={() => { setUsuarioEditando(null); setDialogOpen(true); }}>
          <Plus size={15} />
          Nuevo usuario
        </Button>
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

      <div className="space-y-2">
        {usuarios.map((u) => (
          <Card key={u.id}>
            <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{u.nombre}</p>
                  <Badge variant={u.rol === "administrador" ? "default" : "secondary"}>{u.rol}</Badge>
                  {!u.activo && <Badge variant="destructive">Inactivo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => toggleActivo(u)} title={u.activo ? "Desactivar" : "Activar"}>
                  {u.activo ? <ShieldCheck size={15} className="text-success" /> : <ShieldOff size={15} className="text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setUsuarioEditando(u); setDialogOpen(true); }}>
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => eliminarUsuario(u)}
                  disabled={u.id === user?.id}
                  title={u.id === user?.id ? "No podés eliminar tu propio usuario" : "Eliminar"}
                >
                  <Trash2 size={15} className="text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <UsuarioFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        usuarioEditando={usuarioEditando}
        onGuardar={guardarUsuario}
      />
      {ConfirmDialogElement}
    </div>
  );
}
