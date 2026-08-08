import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  onClick,
  activo = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
  /** Si se pasa, la tarjeta se vuelve clickeable (ej: filtrar la tabla de abajo). */
  onClick?: () => void;
  /** Resalta la tarjeta cuando el filtro que representa está activo. */
  activo?: boolean;
}) {
  const toneClasses = {
    default: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning-foreground bg-warning/15",
    destructive: "text-destructive bg-destructive/10",
  }[tone];

  return (
    <Card
      onClick={onClick}
      className={cn(
        onClick && "cursor-pointer transition hover:border-primary/50",
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
      <CardContent className="pt-5 flex items-center justify-between">
        <div>
          <CardTitle className="mb-1.5">{label}</CardTitle>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", toneClasses)}>
          <Icon size={17} />
        </div>
      </CardContent>
    </Card>
  );
}
