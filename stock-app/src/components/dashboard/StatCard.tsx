import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardLabel } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

function formatearImporte(valor: number): string {
  return `$ ${valor.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}

type Tono = "default" | "success" | "warning" | "destructive" | "info" | "avance";

/*
  Tarjeta de KPI — "panel nocturno, contorno completo".

  La superficie sigue siendo oscura y el color entra por tres lados: el marco
  entero, un resplandor que sube desde abajo, y la cifra.

  Ese resplandor interno no es decoración. Un contorno de color liso y nada
  más es exactamente el recurso que usa cualquier formulario para marcar un
  campo mal completado; con las cuatro tarjetas encendidas a la vez, la fila
  se leería como cuatro alertas en vez de cuatro cifras. La luz de adentro es
  lo que la convierte en un panel encendido. De paso queda una perilla: si
  algún día hay que hacer que la tarjeta de faltantes llame más la atención
  cuando crece, se sube esa opacidad y nada más.

  Jerarquía interna, de más a menos peso: la cifra (Archivo, 40px, tabular),
  el título (mono, mayúsculas, 12px, con su ícono en un chip del color), el
  importe al pie y, cuando corresponde, el aviso.
*/

/** Colores por tono. Un solo lugar donde vive el mapeo tono -> token. */
const TONOS: Record<Tono, { texto: string; borde: string; anillo: string; halo: string; chip: string; pastilla: string }> = {
  default: {
    texto: "text-foreground",
    borde: "border-border",
    anillo: "ring-border",
    halo: "",
    chip: "bg-muted text-muted-foreground",
    pastilla: "bg-muted text-muted-foreground",
  },
  success: {
    texto: "text-success",
    borde: "border-success",
    anillo: "ring-success",
    halo: "bg-success",
    chip: "bg-success/15 text-success",
    pastilla: "bg-success/15 text-success",
  },
  info: {
    texto: "text-info",
    borde: "border-info",
    anillo: "ring-info",
    halo: "bg-info",
    chip: "bg-info/15 text-info",
    pastilla: "bg-info/15 text-info",
  },
  destructive: {
    texto: "text-destructive",
    borde: "border-destructive",
    anillo: "ring-destructive",
    halo: "bg-destructive",
    chip: "bg-destructive/15 text-destructive",
    pastilla: "bg-destructive/15 text-destructive",
  },
  warning: {
    // OJO: `text-warning` (el color saturado), NO `text-warning-foreground`
    // -- ese token es el texto que va ENCIMA de un fondo --warning. Usarlo
    // acá lo hacía invisible en oscuro: casi negro sobre casi negro.
    texto: "text-warning",
    borde: "border-warning",
    anillo: "ring-warning",
    halo: "bg-warning",
    chip: "bg-warning/15 text-warning",
    pastilla: "bg-warning/15 text-warning",
  },
  avance: {
    texto: "text-avance",
    borde: "border-avance",
    anillo: "ring-avance",
    halo: "bg-avance",
    chip: "bg-avance/15 text-avance",
    pastilla: "bg-avance/15 text-avance",
  },
};

/**
 * Curva del turno. Cada serie se normaliza contra su propio mínimo y máximo:
 * si no, la de "Por contar" (miles) aplastaría a la de "Diferencias +"
 * (decenas) hasta volverla una línea recta.
 *
 * Devuelve la línea y el área cerrada, en el sistema de coordenadas del
 * viewBox (260 × 46), que se estira a lo ancho con preserveAspectRatio="none".
 */
function trazarCurva(serie: number[], ancho: number, alto: number) {
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const rango = max - min || 1;
  const margen = 5;

  const puntos = serie.map((v, i) => {
    const x = (i / (serie.length - 1 || 1)) * ancho;
    const y = alto - margen - ((v - min) / rango) * (alto - margen * 2);
    return [x, y] as const;
  });

  let d = `M${puntos[0]![0].toFixed(1)} ${puntos[0]![1].toFixed(1)}`;
  for (let i = 1; i < puntos.length; i++) {
    const [x0, y0] = puntos[i - 1]!;
    const [x1, y1] = puntos[i]!;
    const cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(1)} ${y0.toFixed(1)} ${cx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }

  return {
    linea: d,
    area: `${d} L${ancho} ${alto} L0 ${alto} Z`,
    fin: puntos[puntos.length - 1]!,
  };
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  onClick,
  activo = false,
  importe,
  aviso,
  serie,
  delta,
  id,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tono;
  /** Si se pasa, la tarjeta se vuelve clickeable (ej: filtrar la tabla de abajo). */
  onClick?: () => void;
  /** Resalta la tarjeta cuando el filtro que representa está activo. */
  activo?: boolean;
  /** Importe en pesos a mostrar al pie — se omite si no se pasa. */
  importe?: number;
  /**
   * Aviso corto al pie de la tarjeta (ej. "Sin revisar"). Reemplaza a la
   * franja de alerta que antes vivía suelta arriba del Dashboard y ocupaba
   * casi una pantalla de alto en celular para decir lo mismo que ya dice
   * esta cifra.
   */
  aviso?: string;
  /**
   * Evolución de esta cifra a lo largo del conteo. Se dibuja a sangre en el
   * borde de abajo. Con menos de dos puntos no se dibuja nada -- una curva de
   * un solo dato es una línea recta que no dice nada.
   */
  serie?: number[];
  /** Cuánto se movió la cifra hoy. Se muestra como pastilla con flecha. */
  delta?: number;
  /** Necesario para que el degradado del SVG no choque entre tarjetas. */
  id: string;
}) {
  const t = TONOS[tone];
  const ANCHO = 260;
  const ALTO = 46;
  const curva = serie && serie.length > 1 ? trazarCurva(serie, ANCHO, ALTO) : null;
  const gradId = `curva-${id}`;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative flex min-h-[176px] flex-col overflow-hidden border-[1.5px] p-0 transition-shadow duration-quick",
        t.borde,
        onClick && "cursor-pointer hover:shadow-elev-2",
        // Filtro activo: un anillo del mismo color por fuera del contorno.
        // No se puede armar la clase con .replace() -- Tailwind escanea el
        // código fuente y nunca generaría `ring-success` si no aparece literal.
        activo && cn("ring-2 ring-offset-2 ring-offset-background", t.anillo)
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
      {/* El resplandor. Sube desde abajo a la izquierda, difuminado, sin bordes. */}
      {t.halo && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -bottom-[70%] -left-[30%] h-[150%] w-[150%] rounded-full opacity-[0.17] blur-2xl",
            t.halo
          )}
        />
      )}

      <CardContent className="relative flex flex-1 flex-col p-[17px] pb-3">
        <CardLabel className="mb-3 flex items-center gap-2.5 text-[12px] tracking-[0.1em]">
          <span className={cn("grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg", t.chip)}>
            <Icon size={14} />
          </span>
          <span className="truncate">{label}</span>
        </CardLabel>

        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("font-display text-[40px] font-bold leading-none tracking-tight tabular-nums", t.texto)}>
              {value}
            </p>
            {importe !== undefined && (
              <p className="mt-2.5 font-mono text-[12.5px] tabular-nums text-muted-foreground">
                {formatearImporte(importe)}
              </p>
            )}
            {aviso && (
              <p className={cn("mt-1.5 flex items-center gap-1 text-[12px] font-medium", t.texto)}>
                <AlertTriangle size={12} className="shrink-0" />
                {aviso}
              </p>
            )}
          </div>

          {delta !== undefined && delta !== 0 && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full py-[3px] pl-1.5 pr-2 font-mono text-[11.5px] font-medium tabular-nums",
                t.pastilla
              )}
              title="Movimiento de hoy"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {delta > 0 ? <path d="M12 19V5m-7 7 7-7 7 7" /> : <path d="M12 5v14m7-7-7 7-7-7" />}
              </svg>
              {delta > 0 ? "+" : "−"}
              {Math.abs(delta).toLocaleString("es-UY")}
            </span>
          )}
        </div>
      </CardContent>

      {curva && (
        /*
          La clase de color va en el <svg>, NO en un <g> de adentro. Los stops
          del degradado viven en <defs>, que hereda del <svg>: si el color
          estuviera en un <g> hermano, `currentColor` en el degradado se
          resolvería contra el color de la Card (crema) y el área saldría del
          color equivocado. Con el color acá, el degradado, la línea y el punto
          final toman los tres el mismo token que la cifra.
        */
        <svg
          className={cn("relative block h-[46px] w-full", t.texto)}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.34} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={curva.area} fill={`url(#${gradId})`} />
          <path d={curva.linea} fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx={curva.fin[0].toFixed(1)} cy={curva.fin[1].toFixed(1)} r="2.4" fill="currentColor" />
        </svg>
      )}
    </Card>
  );
}
