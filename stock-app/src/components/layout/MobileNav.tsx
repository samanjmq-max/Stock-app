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

// Nav inferior interactivo: un anillo de luz viaja detrás del ícono activo
// (glass + glow, evolución futurista confirmada 2026-09-12 sobre la misma
// paleta cálida -- ver mockup "Glass & Glow") en vez de deslizar un fondo
// sólido. Dos capas con layoutId: una "cola" difuminada más grande que viaja
// con un resorte más lento (queda un paso atrás, efecto cometa) y el anillo
// nítido encima con un resorte más rápido. Sigue siendo bajo-movimiento en
// el sentido que importa: solo se anima al cambiar de tab, nunca en loop.
export function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const tailTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 140, damping: 20 };
  const ringTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 24 };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 flex justify-around border-t border-border bg-background/95 backdrop-blur px-1 py-2"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
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
              <>
                <motion.span
                  layoutId="mobile-nav-glow-tail"
                  transition={tailTransition}
                  className="absolute left-1/2 top-0.5 -translate-x-1/2 h-9 w-9 rounded-full bg-primary/25 blur-md"
                  aria-hidden="true"
                />
                <motion.span
                  layoutId="mobile-nav-glow-ring"
                  transition={ringTransition}
                  className="absolute left-1/2 top-0.5 -translate-x-1/2 h-9 w-9 rounded-full ring-2 ring-primary/70 shadow-[0_0_14px_2px_hsl(var(--primary)/0.5)]"
                  aria-hidden="true"
                />
              </>
            )}
            <span
              className={cn(
                "relative flex flex-col items-center gap-0.5 transition-colors duration-200",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon size={19} strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
