import * as React from "react";
import { cn } from "@/lib/utils";

/*
  La card en reposo NO lleva sombra: en modo oscuro la propia superficie
  (--card, un escalón por encima de --background) ya la separa del fondo, y
  estampar la misma sombra en todos los bloques aplana la jerarquía en vez de
  construirla. La sombra aparece solo cuando la card es interactiva y está en
  hover -- ahí sí comunica algo: "esto se puede tocar".
*/
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-xl border border-border bg-card text-card-foreground", className)} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-col gap-1 p-5", className)} {...props} />
);
CardHeader.displayName = "CardHeader";

/*
  Antes era `text-sm text-muted-foreground`: el título de una tarjeta quedaba
  más chico y más apagado que su propio contenido, que es exactamente al revés
  de lo que tiene que pasar. Ahora es un título de verdad -- 16px, semibold,
  color de texto pleno.

  Para la etiqueta chica en mayúsculas que va ARRIBA de una cifra (el rol que
  antes se resolvía mal usando CardTitle) está CardLabel, acá abajo.
*/
const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-display text-base font-semibold leading-tight tracking-tight text-foreground", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

/** Etiqueta de dato: mono, mayúsculas, chica. Va arriba de una cifra o de un valor. */
const CardLabel = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-muted-foreground", className)} {...props} />
  )
);
CardLabel.displayName = "CardLabel";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardLabel, CardDescription, CardContent, CardFooter };
