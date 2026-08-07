import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const usuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre es muy corto"),
  email: z.string().email("Email inválido"),
  password: z.union([z.literal(""), z.string().min(6, "Mínimo 6 caracteres")]).optional(),
  rol: z.enum(["administrador", "operador"]),
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
});
export type ProductoInput = z.infer<typeof productoSchema>;

export const conteoSchema = z.object({
  codigo: z.string().min(1),
  stockContado: z.coerce.number().min(0, "No puede ser negativo"),
  observaciones: z.string().optional().default(""),
  ubicacionNueva: z.string().optional().default(""),
});
export type ConteoInput = z.infer<typeof conteoSchema>;
