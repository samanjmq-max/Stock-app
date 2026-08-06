import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFecha(date: Date = new Date()): string {
  return date.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatHora(date: Date = new Date()): string {
  return date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function calcularDiferencia(stockSap: number, stockContado: number) {
  return stockContado - stockSap;
}

export function estadoDesdeDiferencia(diferencia: number): "coincide" | "sobra" | "falta" {
  if (diferencia === 0) return "coincide";
  return diferencia > 0 ? "sobra" : "falta";
}
