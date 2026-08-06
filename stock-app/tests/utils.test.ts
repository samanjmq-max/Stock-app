import { describe, it, expect } from "vitest";
import { calcularDiferencia, estadoDesdeDiferencia, formatFecha, formatHora } from "@/lib/utils";

describe("calcularDiferencia", () => {
  it("devuelve 0 cuando el stock contado coincide con el SAP", () => {
    expect(calcularDiferencia(48, 48)).toBe(0);
  });

  it("devuelve un número positivo cuando sobra stock", () => {
    expect(calcularDiferencia(48, 55)).toBe(7);
  });

  it("devuelve un número negativo cuando falta stock", () => {
    expect(calcularDiferencia(48, 40)).toBe(-8);
  });

  it("funciona con stock SAP en cero (producto nuevo)", () => {
    expect(calcularDiferencia(0, 10)).toBe(10);
  });
});

describe("estadoDesdeDiferencia", () => {
  it("clasifica 0 como 'coincide'", () => {
    expect(estadoDesdeDiferencia(0)).toBe("coincide");
  });

  it("clasifica un número positivo como 'sobra'", () => {
    expect(estadoDesdeDiferencia(5)).toBe("sobra");
  });

  it("clasifica un número negativo como 'falta'", () => {
    expect(estadoDesdeDiferencia(-3)).toBe("falta");
  });
});

describe("formatFecha / formatHora", () => {
  it("formatea la fecha en formato dd/mm/aaaa", () => {
    const fecha = new Date(2026, 6, 31); // 31 de julio de 2026
    expect(formatFecha(fecha)).toBe("31/07/2026");
  });

  it("formatHora devuelve un string con separadores de hora", () => {
    const fecha = new Date(2026, 6, 31, 14, 32, 10);
    expect(formatHora(fecha)).toMatch(/14:32:10/);
  });
});
