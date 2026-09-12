"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { LayoutDashboard, ScanLine, Package, History, Users, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/*
  Tab bar con acción central.

  Dos decisiones de fondo:

  1. CONTAR SALE DE LA FILA DE TABS. La app existe para contar y esa acción
     pesaba exactamente lo mismo que "Productos". Ahora es un botón central,
     el único punto de la barra que no es navegación sino acción, y cae
     naturalmente bajo el pulgar.

  2. EL ACTIVO SE MARCA CON UNA BARRA DE LUZ sobre el borde superior de la
     barra, no con la gota líquida anterior. La gota (filtro SVG tipo
     metaball) se montaba encima de la etiqueta y tapaba el texto del tab --
     "Cont" quedaba oculto detrás del óvalo, algo que ya se había tenido que
     parchear moviendo el ancla. En una app que se usa con guantes y a media
     luz, leer el nombre del tab gana sobre el efecto.

  Los tabs se reparten a los lados del botón central: la mitad a la izquierda
  y la mitad a la derecha. Así la barra queda equilibrada tanto para un
  administrador (que ve cuatro) como para un operario (que ve dos), sin el
  hueco que dejaban antes los ítems solo-admin.

  Historial y Usuarios siguen siendo solo-admin porque el middleware los
  restringe de verdad (RUTAS_SOLO_ADMIN): mostrárselos a un operario le
  daría un link que lo rebota. Unificar sesión, agencia, tema y usuarios en
  una pantalla "Cuenta" es el paso siguiente, pero implica una ruta nueva y
  queda fuera de este pase visual.
*/
const ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, soloAdmin: false },
  { href: "/productos", label: "Productos", icon: Package, soloAdmin: false },
  { href: "/historial", label: "Historial", icon: History, soloAdmin: true },
  { href: "/usuarios", label: "Usuarios", icon: Users, soloAdmin: true },
];

/*
  Tab va a nivel de módulo, NO adentro de MobileNav.

  Si se define dentro del componente padre, se crea una función nueva en cada
  render: para React es un tipo de componente distinto, así que desmonta el
  árbol viejo y monta uno nuevo en lugar de actualizarlo. Eso rompe justo la
  animación de la barra de luz, porque layoutId necesita que el elemento
  sobreviva entre renders para poder interpolar su posición.
*/
function Tab({
  href,
  label,
  icon: Icon,
  active,
  transition,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  transition: { duration: number } | { type: "spring"; stiffness: number; damping: number };
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-[48px] min-w-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors duration-quick",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-light"
          transition={transition}
          aria-hidden="true"
          className="nav-light absolute -top-[9px] h-[2.5px] w-7 rounded-b-full bg-primary"
        />
      )}
      <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
      <span>{label}</span>
    </Link>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const visibles = ITEMS.filter((item) => !item.soloAdmin || isAdmin);
  const corte = Math.ceil(visibles.length / 2);
  const izquierda = visibles.slice(0, corte);
  const derecha = visibles.slice(corte);

  const contandoActivo = pathname === "/conteo" || pathname.startsWith("/conteo/");

  const lightTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 32 };

  const esActivo = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around border-t border-border bg-card/95 px-2 pt-2 backdrop-blur md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {izquierda.map((item) => (
        <Tab key={item.href} href={item.href} label={item.label} icon={item.icon}
          active={esActivo(item.href)} transition={lightTransition} />
      ))}

      {/* Acción central. El anillo del mismo color que la barra recorta el
          botón contra ella, para que se lea como una pieza montada sobre la
          barra y no como un círculo flotando por encima, desconectado. */}
      <div className="flex min-w-[68px] flex-col items-center">
        <Link
          href="/conteo"
          aria-label="Contar stock"
          aria-current={contandoActivo ? "page" : undefined}
          className={cn(
            "-mt-6 grid h-14 w-14 place-items-center rounded-[18px] text-primary-foreground transition-transform duration-quick ease-spring active:scale-95",
            "shadow-[0_0_0_5px_hsl(var(--card)),0_10px_24px_-8px_hsl(var(--primary)/0.8)]",
            contandoActivo ? "bg-primary" : "bg-primary/90"
          )}
        >
          <ScanLine size={25} strokeWidth={2.2} />
        </Link>
        <span className={cn("mt-1 text-[11px] font-semibold", contandoActivo ? "text-primary" : "text-muted-foreground")}>
          Contar
        </span>
      </div>

      {derecha.map((item) => (
        <Tab key={item.href} href={item.href} label={item.label} icon={item.icon}
          active={esActivo(item.href)} transition={lightTransition} />
      ))}
    </nav>
  );
}
