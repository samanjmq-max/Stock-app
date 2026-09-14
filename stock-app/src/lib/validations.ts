import { z } from "zod";
import { AGENCIAS } from "@/types";
export const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
export type LoginInput = z.infer<typeof loginSchema>;
/*
  El formulario manda `perfil`, no `rol`. El rol se deriva del perfil en el
  servidor y en Apps Script -- si el cliente pudiera mandarlo, alcanzaría con
  una llamada a mano para quedar con perfil de operario y rol de
  administrador. Por eso no está en el esquema: lo que no se acepta no se
  puede falsificar.
*/
export const usuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre es muy corto"),
  email: z.string().email("Email inválido"),
  password: z.union([z.literal(""), z.string().min(6, "Mínimo 6 caracteres")]).optional(),
  perfil: z.enum(["operario", "encargado", "jefe", "gerente"]),
  /** Planta principal: la que se usa por defecto al contar. */
  agencia: z.union([z.literal(""), z.enum(AGENCIAS)]).optional().default(""),
  /**
   * Todas las plantas a cargo. Solo tiene sentido para un jefe de planta
   * -- a veces la misma persona está a cargo de dos o tres depósitos. Para
   * los demás perfiles queda en una sola, la misma que `agencia`.
   */
  agencias: z.array(z.enum(AGENCIAS)).optional().default([]),
  activo: z.boolean().default(true),
});
export type UsuarioInput = z.infer<typeof usuarioSchema>;
export const productoSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio"),
  descripcion: z.string().min(1, "La descripción es obligatoria"),
  ubicacion: z.string().optional().default(""),
  familia: z.string().optional().default(""),
  proveedor: z.string().optional().default(""),
  stockSap: z.coerce.number().min(0, "No puede ser negativo"),
  precioUnitario: z.coerce.number().min(0, "No puede ser negativo").optional().default(0),
  agencia: z.enum(AGENCIAS),
});
export type ProductoInput = z.infer<typeof productoSchema>;
export const conteoSchema = z.object({
  codigo: z.string().min(1),
  stockContado: z.coerce.number().min(0, "No puede ser negativo"),
  observaciones: z.string().optional().default(""),
  ubicacionNueva: z.string().optional().default(""),
});
export type ConteoInput = z.infer<typeof conteoSchema>;
