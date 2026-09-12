import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Sistema de botones — cuatro niveles de peso visual.

  La regla que gobierna todo: UNA sola acción primaria por pantalla. Antes,
  en Productos convivían Excel, CSV, PDF, Importar y Nuevo, cuatro de ellos
  con el mismo variant "secondary" -- exportar a CSV pesaba visualmente lo
  mismo que dar de alta un producto.

    Nivel 1  default, success      Acción primaria. Con glow. Una por pantalla
    Nivel 2  outline, destructive  Acción secundaria y peligrosa
    Nivel 3  secondary, ghost      Acciones de fila, de barra, cancelar
    Nivel 4  link                  Navegación dentro de un texto

  El glow (ver .btn-glow en globals.css) va SOLO en el nivel 1 y en la
  destructiva: la luz es información, y si todo brilla no brilla nada.

  La destructiva arranca como contorno y se rellena al hover -- un botón rojo
  sólido permanente en pantalla enseña a ignorar el rojo, que es justo el
  color que necesitamos que nadie ignore.

  Alturas: 44px por defecto (objetivo táctil mínimo), 48px en "lg" para el
  flujo de Conteo, donde se opera con guantes.
*/
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors duration-quick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 btn-glow",
        success: "bg-success text-success-foreground hover:bg-success/90 btn-glow btn-glow-success",
        destructive:
          "border border-destructive/40 text-destructive bg-transparent hover:bg-destructive/10 btn-glow btn-glow-destructive",
        // Rojo sólido. Reservado a la confirmación final dentro de un diálogo,
        // donde ya no compite con nada y el usuario decidió avanzar.
        "destructive-solid": "bg-destructive text-destructive-foreground hover:bg-destructive/90 btn-glow btn-glow-destructive",
        outline: "border border-input bg-transparent hover:bg-elevated hover:border-muted-foreground/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-elevated",
        ghost: "text-muted-foreground hover:bg-elevated hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-[18px] py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-6 text-base",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9 rounded-md",
        // Acción flotante del tab bar. El ícono va más grande porque es el
        // único control de la barra que no lleva etiqueta adentro.
        fab: "h-14 w-14 rounded-[18px] [&_svg]:size-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Muestra una rueda y deshabilita el botón. El texto se mantiene, así que
   * el botón no cambia de ancho ni se queda mudo mientras trabaja -- que es
   * exactamente lo que pasaba antes, cuando cada pantalla improvisaba su
   * propio <Loader2> reemplazando el contenido.
   */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    // Con asChild el componente no puede inyectar nada: Slot exige un único
    // hijo y clonarlo rompería el elemento que se le pasó. En ese caso el
    // estado de carga queda a cargo de quien lo use.
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
