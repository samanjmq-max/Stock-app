import { Card, CardContent, CardLabel } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

function formatearImporte(valor: number): string {
  return `$ ${valor.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}

/*
  Tarjeta de KPI.

  Jerarquía interna, de más a menos peso: la cifra (Archivo, grande, tabular),
  la etiqueta (mono, mayúsculas, chica) y el importe (metadato, al pie). Antes
  la etiqueta usaba CardTitle -- que ahora es un título de card de verdad -- y
  el importe competía con el número en un chip con fondo propio.

  El estado se marca con una franja vertical de color en el borde izquierdo,
  no tiñendo la tarjeta entera: mantiene la calidez neutra del fondo y deja
  que el color siga significando una sola cosa.
*/
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  onClick,
  activo = false,
  importe,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
  /** Si se pasa, la tarjeta se vuelve clickeable (ej: filtrar la tabla de abajo). */
  onClick?: () => void;
  /** Resalta la tarjeta cuando el filtro que representa está activo. */
  activo?: boolean;
  /** Importe en pesos a mostrar al pie — se omite si no se pasa. */
  importe?: number;
}) {
  const iconClasses = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];

  // OJO: `text-warning` (el color saturado), NO `text-warning-foreground`
  // -- ese token es el texto que va ENCIMA de un fondo --warning, pensado
  // para contrastar con esa superficie. Usarlo acá lo hacía invisible en
  // modo oscuro: texto casi negro sobre card casi negra.
  const valorClasses = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];

  const franjaClasses = {
    default: "",
    success: "border-l-2 border-l-success",
    warning: "border-l-2 border-l-warning",
    destructive: "border-l-2 border-l-destructive",
  }[tone];

  return (
    <Card
      onClick={onClick}
      className={cn(
        "transition-shadow duration-quick",
        franjaClasses,
        onClick && "cursor-pointer hover:shadow-elev-1 hover:border-primary/40",
        activo && "border-primary ring-1 ring-primary"
      )}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <CardLabel>{label}</CardLabel>
          <p className={cn("font-display text-[26px] font-semibold leading-none tracking-tight tabular-nums mt-2", valorClasses)}>
            {value}
          </p>
          {importe !== undefined && (
            <p className="font-mono text-[11px] text-muted-foreground mt-2 tabular-nums">
              {formatearImporte(importe)}
            </p>
          )}
        </div>
        <Icon size={16} className={cn("shrink-0 mt-0.5", iconClasses)} />
      </CardContent>
    </Card>
  );
}
