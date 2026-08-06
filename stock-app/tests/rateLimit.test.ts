import { describe, it, expect, beforeEach } from "vitest";
import { estaLimitado, registrarIntentoFallido, limpiarIntentos } from "@/lib/rateLimit";

describe("rateLimit", () => {
  const clave = "test-ip:test@empresa.com";

  beforeEach(() => {
    limpiarIntentos(clave);
  });

  it("no limita antes de fallar ningún intento", () => {
    expect(estaLimitado(clave)).toBe(false);
  });

  it("no limita con menos de 5 intentos fallidos", () => {
    for (let i = 0; i < 4; i++) registrarIntentoFallido(clave);
    expect(estaLimitado(clave)).toBe(false);
  });

  it("limita a partir del 5to intento fallido", () => {
    for (let i = 0; i < 5; i++) registrarIntentoFallido(clave);
    expect(estaLimitado(clave)).toBe(true);
  });

  it("limpiarIntentos resetea el contador", () => {
    for (let i = 0; i < 5; i++) registrarIntentoFallido(clave);
    expect(estaLimitado(clave)).toBe(true);
    limpiarIntentos(clave);
    expect(estaLimitado(clave)).toBe(false);
  });
});
