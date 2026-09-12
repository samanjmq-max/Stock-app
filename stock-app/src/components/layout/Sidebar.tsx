"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { LayoutDashboard, ScanBarcode, Package, History, Users, Settings, Barcode } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, soloAdmin: false },
  { href: "/conteo", label: "Contar stock", icon: ScanBarcode, soloAdmin: false },
  { href: "/productos", label: "Productos", icon: Package, soloAdmin: false },
  { href: "/etiquetas", label: "Generar etiqueta", icon: Barcode, soloAdmin: true },
  { href: "/historial", label: "Historial", icon: History, soloAdmin: true },
  { href: "/usuarios", label: "Usuarios", icon: Users, soloAdmin: true },
  { href: "/configuracion", label: "Configuración", icon: Settings, soloAdmin: true },
];

// Contraparte de escritorio del glow del MobileNav (ver components/layout/
// MobileNav.tsx) -- antes el ítem activo solo cambiaba de color en seco, sin
// ninguna animación, por eso el pase de "glow futurista" no se notaba nada
// en la compu aunque sí en el celular. Acá el glow es un resaltado de fondo
// completo (no un anillo puntual como en el tab bar) porque el ítem es una
// fila con ícono + texto, no solo un ícono -- mismo lenguaje visual, forma
// distinta según el contenedor.
export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const glowTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 32 };

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/50 h-screen sticky top-0 py-5">
      <div className="px-5 mb-6 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
          S
        </div>
        <span className="font-semibold text-sm">StockApp</span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.filter((item) => !item.soloAdmin || isAdmin).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-glow"
                  transition={glowTransition}
                  className="absolute inset-0 rounded-lg bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_0_16px_-4px_hsl(var(--primary)/0.45)]"
                  aria-hidden="true"
                />
              )}
              <Icon size={17} className="relative" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
