"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { LayoutDashboard, ScanBarcode, Package, History, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, soloAdmin: false },
  { href: "/conteo", label: "Contar", icon: ScanBarcode, soloAdmin: false },
  { href: "/productos", label: "Productos", icon: Package, soloAdmin: false },
  // Historial es el log de auditoría de toda la empresa (ver middleware.ts,
  // RUTAS_SOLO_ADMIN) -- si un operador lo ve acá, el link lo rebota.
  { href: "/historial", label: "Historial", icon: History, soloAdmin: true },
  // Iba etiquetado "Perfil" pero apunta a /usuarios, que también es
  // admin-only -- un operador lo veía y el link lo rebotaba. No hay página
  // de Perfil (se decidió no construirla por ahora); esto queda como el
  // acceso a gestión de usuarios que realmente es, mismo criterio que ya
  // usa el Sidebar de escritorio.
  { href: "/usuarios", label: "Usuarios", icon: Users, soloAdmin: true },
];

// Tab bar con "gota líquida": el ícono activo se levanta sobre un bulto de
// --primary que sube desde el propio borde superior de la barra (efecto
// metaball vía filtro SVG), elegido por el usuario sobre el anillo de luz y
// la burbuja flotante (ver mockup "Tres Barras", 2026-09-12) -- con la
// condición explícita de no inventar un color nuevo: el bulto usa el mismo
// --primary que ya usan el botón .btn-glow y el Sidebar, y la barra en sí
// (fondo, blur, borde) queda exactamente como está hoy, no se convierte en
// una píldora nueva.
//
// Dos piezas con layoutId (anchor pegado al borde de la barra + blob flotando
// arriba) que un filtro SVG funde en una sola forma continua -- sin esto se
// verían como dos círculos separados en vez de una gota. Los íconos van en
// una capa aparte, sin el filtro, para que no salgan borrosos: el filtro solo
// difumina las dos formas de fondo, nunca el trazo del ícono.
export function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const anchorTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 22 };
  const blobTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 200, damping: 20 };
  const iconTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 20 };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 flex justify-around border-t border-border bg-background/95 backdrop-blur px-1 py-2"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="mobile-nav-gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
        </filter>
      </svg>

      {ITEMS.filter((item) => !item.soloAdmin || isAdmin).map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] font-medium min-w-[52px] min-h-[44px] justify-center"
          >
            {active && (
              <span className="absolute inset-0 pointer-events-none" style={{ filter: "url(#mobile-nav-gooey)" }} aria-hidden="true">
                <motion.span
                  layoutId="mobile-nav-goo-anchor"
                  transition={anchorTransition}
                  className="absolute left-1/2 -translate-x-1/2 bottom-1 h-3 w-8 rounded-full bg-primary"
                />
                <motion.span
                  layoutId="mobile-nav-goo-blob"
                  transition={blobTransition}
                  className="absolute left-1/2 -translate-x-1/2 -top-3.5 h-8 w-8 rounded-full bg-primary"
                />
              </span>
            )}
            <span className="relative z-10 flex flex-col items-center gap-0.5">
              <motion.span
                animate={{ y: active ? -13 : 0 }}
                transition={iconTransition}
                className={cn(
                  "flex items-center justify-center transition-colors duration-200",
                  active ? "text-primary-foreground" : "text-muted-foreground"
                )}
              >
                <Icon size={19} strokeWidth={active ? 2.25 : 1.75} />
              </motion.span>
              <span className={cn("transition-colors duration-200", active ? "text-primary" : "text-muted-foreground")}>
                {item.label}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
