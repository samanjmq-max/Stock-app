"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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

// Nav inferior interactivo: el fondo del ítem activo se desliza entre tabs
// (framer-motion layoutId, ya instalado) en vez de solo cambiar de color en seco.
// Sin gradiente saturado ni sombra dramática -- se mantiene "plano" según
// design-system/stockapp-saman/MASTER.md §11 (anti-patrón: gradientes/3D),
// el color cálido --primary ya aporta la identidad de marca.
export function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
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
              <motion.span
                layoutId="mobile-nav-active-pill"
                className="absolute inset-0 rounded-xl bg-primary/10"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
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
