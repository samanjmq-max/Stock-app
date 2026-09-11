"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, ScanBarcode, Package, History, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/conteo", label: "Contar", icon: ScanBarcode },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/usuarios", label: "Perfil", icon: User },
];

// Nav inferior interactivo: el fondo del ítem activo se desliza entre tabs
// (framer-motion layoutId, ya instalado) en vez de solo cambiar de color en seco.
// Sin gradiente saturado ni sombra dramática -- se mantiene "plano" según
// design-system/stockapp-saman/MASTER.md §11 (anti-patrón: gradientes/3D),
// el color cálido --primary ya aporta la identidad de marca.
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 flex justify-around border-t border-border bg-background/95 backdrop-blur px-1 py-2"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {ITEMS.map((item) => {
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
