import { describe, it, expect } from "vitest";
import { loginSchema, productoSchema, conteoSchema, usuarioSchema } from "@/lib/validations";

describe("loginSchema", () => {
  it("acepta un email y contraseña válidos", () => {
    const res = loginSchema.safeParse({ email: "admin@empresa.com", password: "123456" });
    expect(res.success).toBe(true);
  });

  it("rechaza un email inválido", () => {
    const res = loginSchema.safeParse({ email: "no-es-un-email", password: "123456" });
    expect(res.success).toBe(false);
  });

  it("rechaza una contraseña muy corta", () => {
    const res = loginSchema.safeParse({ email: "admin@empresa.com", password: "123" });
    expect(res.success).toBe(false);
  });
});

describe("productoSchema", () => {
  it("acepta un producto válido con todos los campos", () => {
    const res = productoSchema.safeParse({
      codigo: "7791234567890",
      descripcion: "Aceite de girasol 900ml",
      ubicacion: "Depósito A",
      familia: "Almacén",
      proveedor: "Proveedor SA",
      stockSap: 48,
    });
    expect(res.success).toBe(true);
  });

  it("rechaza un producto sin código", () => {
    const res = productoSchema.safeParse({ codigo: "", descripcion: "Algo", stockSap: 1 });
    expect(res.success).toBe(false);
  });

  it("rechaza stock negativo", () => {
    const res = productoSchema.safeParse({ codigo: "123", descripcion: "Algo", stockSap: -5 });
    expect(res.success).toBe(false);
  });

  it("convierte un stockSap en string numérico a número", () => {
    const res = productoSchema.safeParse({ codigo: "123", descripcion: "Algo", stockSap: "48" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.stockSap).toBe(48);
  });
});

describe("conteoSchema", () => {
  it("acepta un conteo válido", () => {
    const res = conteoSchema.safeParse({ codigo: "123", stockContado: 10, observaciones: "" });
    expect(res.success).toBe(true);
  });

  it("rechaza cantidad contada negativa", () => {
    const res = conteoSchema.safeParse({ codigo: "123", stockContado: -1 });
    expect(res.success).toBe(false);
  });
});

describe("usuarioSchema", () => {
  it("acepta un usuario nuevo con contraseña", () => {
    const res = usuarioSchema.safeParse({
      nombre: "Ana Gómez", email: "ana@empresa.com", password: "123456", rol: "operador", activo: true,
    });
    expect(res.success).toBe(true);
  });

  it("acepta contraseña vacía (edición sin cambiar clave)", () => {
    const res = usuarioSchema.safeParse({
      nombre: "Ana Gómez", email: "ana@empresa.com", password: "", rol: "operador", activo: true,
    });
    expect(res.success).toBe(true);
  });

  it("rechaza un rol que no sea administrador u operador", () => {
    const res = usuarioSchema.safeParse({
      nombre: "Ana Gómez", email: "ana@empresa.com", rol: "superadmin", activo: true,
    });
    expect(res.success).toBe(false);
  });
});
