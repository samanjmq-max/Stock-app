"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { usuarioSchema, type UsuarioInput } from "@/lib/validations";
import type { Perfil, Usuario } from "@/types";
import { AGENCIAS } from "@/types";
import { PERFILES, ESCALA_PERFILES, perfilDe, perfilesQuePuedeCrear, parsearAgencias } from "@/lib/permisos";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
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
  const { esSuperAdmin, agencia: agenciaPropia, alcance, user } = useAuth();

  // Solo se oculta el campo cuando el super administrador edita SU PROPIA
  // cuenta — el resto de los usuarios siempre necesita una planta asignada.
  const esPropiaCuentaDeSuperAdmin = esSuperAdmin && usuarioEditando?.email === user?.email;

  /*
    Qué perfiles puede otorgar quien está usando el formulario. Un jefe de
    planta ve solo Operario y Encargado: si pudiera crear otro jefe, le
    alcanzaría con crearse un usuario nuevo para darse a sí mismo las nueve
    plantas. El servidor vuelve a verificarlo -- esto es para no ofrecer algo
    que después va a ser rechazado.

    El caso del super admin se resuelve con el dato que ya trajo el servidor
    (`esSuperAdmin` del contexto) y NO llamando a la función: adentro,
    `esSuperAdmin()` compara contra SUPER_ADMIN_EMAIL, que es una variable
    de entorno del servidor y en el navegador vale undefined. Sin esto, el
    propio Maximiliano no vería la opción "Gerente" en su propio formulario.
  */
  const perfilesDisponibles = esSuperAdmin
    ? ESCALA_PERFILES
    : perfilesQuePuedeCrear({ perfil: user?.perfil, rol: user?.rol, email: user?.email });

  /*
    Qué plantas puede asignar. El super admin y el gerente, las nueve; un
    jefe, solo las que él ya tiene. Así no puede mandar gente a un depósito
    que no maneja.
  */
  const plantasDisponibles = esSuperAdmin ? [...AGENCIAS] : alcance.length > 0 ? alcance : agenciaPropia ? [agenciaPropia] : [];

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioInput>({ resolver: zodResolver(usuarioSchema) });

  const perfilElegido = watch("perfil");
  // Solo el jefe de planta tiene sentido con varias: es el único caso real
  // (el mismo jefe a cargo de Tres Gomensoro y Salto). El gerente ve todo
  // por definición y no necesita lista.
  const admiteVariasPlantas = perfilElegido === "jefe";

  useEffect(() => {
    if (!open) return;

    if (usuarioEditando) {
      const perfil = perfilDe(usuarioEditando);
      reset({
        nombre: usuarioEditando.nombre,
        email: usuarioEditando.email,
        perfil,
        agencia: usuarioEditando.agencia,
        agencias: parsearAgencias(usuarioEditando.agencias, usuarioEditando.agencia),
        activo: usuarioEditando.activo,
        password: "",
      });
      return;
    }

    const porDefecto = (esSuperAdmin ? "Centro Logístico" : agenciaPropia ?? "Centro Logístico") as (typeof AGENCIAS)[number];
    reset({
      nombre: "",
      email: "",
      perfil: perfilesDisponibles[0] ?? "operario",
      agencia: porDefecto,
      agencias: [porDefecto],
      activo: true,
      password: "",
    });
    // `perfilesDisponibles` se arma en cada render; listarlo acá volvería a
    // resetear el formulario mientras se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, usuarioEditando, reset, esSuperAdmin, agenciaPropia]);

  async function onSubmit(data: UsuarioInput) {
    /*
      La lista de plantas se normaliza antes de mandarla, para que lo que se
      guarda no dependa de por dónde pasó la persona en el formulario:

      - El super admin editándose a sí mismo no pertenece a ninguna planta.
      - Un perfil que no admite varias queda con una sola, la principal:
        si alguien elige jefe, tilda tres plantas y después vuelve a
        operario, no puede quedar un operario con tres depósitos.
      - La planta principal siempre está dentro de la lista.
    */
    if (esPropiaCuentaDeSuperAdmin) {
      await onGuardar({ ...data, agencia: "", agencias: [] });
      onOpenChange(false);
      return;
    }

    const principal = (data.agencia || plantasDisponibles[0] || "Centro Logístico") as (typeof AGENCIAS)[number];
    const lista =
      data.perfil === "jefe"
        ? Array.from(new Set([principal, ...(data.agencias ?? [])]))
        : [principal];

    await onGuardar({ ...data, agencia: principal, agencias: lista });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
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

          {/* --- Perfil --- */}
          <div className="space-y-1.5">
            <Label>Perfil</Label>
            <Controller
              control={control}
              name="perfil"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Elegí el perfil..." /></SelectTrigger>
                  <SelectContent>
                    {perfilesDisponibles.map((p) => (
                      <SelectItem key={p} value={p}>{PERFILES[p].etiqueta}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {/* La descripción del perfil elegido, para no tener que
                acordarse de memoria qué puede hacer cada uno. */}
            {perfilElegido && PERFILES[perfilElegido as Perfil] && (
              <p className="text-xs text-muted-foreground">{PERFILES[perfilElegido as Perfil].descripcion}</p>
            )}
            {errors.perfil && <p className="text-xs text-destructive">{errors.perfil.message}</p>}
          </div>

          {/* --- Plantas --- */}
          {esPropiaCuentaDeSuperAdmin ? (
            <div className="space-y-1.5">
              <Label>Plantas</Label>
              <Input value="Todas (super administrador)" disabled />
              <p className="text-xs text-muted-foreground">
                Como super administrador no pertenecés a una sola planta — las administrás todas.
              </p>
            </div>
          ) : perfilElegido === "gerente" ? (
            <div className="space-y-1.5">
              <Label>Plantas</Label>
              <Input value="Todas las plantas" disabled />
              <p className="text-xs text-muted-foreground">
                El gerente ve las nueve plantas por definición: no hace falta asignárselas.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{admiteVariasPlantas ? "Planta principal" : "Planta"}</Label>
              <Controller
                control={control}
                name="agencia"
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={field.onChange} disabled={plantasDisponibles.length === 1}>
                    <SelectTrigger><SelectValue placeholder="Seleccioná la planta..." /></SelectTrigger>
                    <SelectContent>
                      {plantasDisponibles.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.agencia && <p className="text-xs text-destructive">{errors.agencia.message}</p>}

              {admiteVariasPlantas && (
                <div className="pt-2">
                  <Label className="text-xs">Otras plantas a cargo</Label>
                  {/*
                    Casillas y no un desplegable múltiple: acá lo que importa
                    es ver de un golpe TODAS las plantas que quedan
                    asignadas, no elegir una. Un jefe a cargo de tres
                    depósitos tiene que poder verificarlo sin abrir nada.
                  */}
                  <Controller
                    control={control}
                    name="agencias"
                    render={({ field }) => {
                      const elegidas = field.value ?? [];
                      return (
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                          {plantasDisponibles.map((a) => {
                            const principal = watch("agencia") === a;
                            const marcada = principal || elegidas.includes(a);
                            return (
                              <button
                                key={a}
                                type="button"
                                disabled={principal}
                                onClick={() =>
                                  field.onChange(
                                    elegidas.includes(a) ? elegidas.filter((x) => x !== a) : [...elegidas, a]
                                  )
                                }
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors duration-quick",
                                  marcada ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
                                  principal && "cursor-default opacity-70"
                                )}
                              >
                                <span
                                  className={cn(
                                    "grid h-4 w-4 shrink-0 place-items-center rounded border",
                                    marcada ? "border-primary bg-primary text-primary-foreground" : "border-border"
                                  )}
                                >
                                  {marcada && <Check size={11} strokeWidth={3} />}
                                </span>
                                <span className="truncate">{a}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    }}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    La planta principal queda siempre marcada. Sumá las otras si esta persona está a cargo de más de un depósito.
                  </p>
                </div>
              )}

              {!admiteVariasPlantas && (
                <p className="text-xs text-muted-foreground">
                  Solo va a ver y contar los productos de esta planta.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
