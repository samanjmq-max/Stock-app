"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard, ScanLine, Package, History, Users, Settings, Barcode,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/*
  Sidebar de escritorio.

  Dos cambios respecto de la versión anterior:

  1. LOS SIETE ÍTEMS SE AGRUPAN. Antes eran una lista plana donde "Contar
     stock" y "Configuración" pesaban lo mismo. Ahora hay dos bloques
     separados por un filete: lo que se usa todos los días (operación) y lo
     que se toca de vez en cuando (administración).

  2. SE PUEDE COLAPSAR a solo íconos, y la preferencia se recuerda. En una
     pantalla de 1280px, 240px de sidebar permanente es mucho para una app
     cuyo contenido principal son tablas anchas.

  El indicador del ítem activo es el mismo lenguaje de luz que el tab bar de
  móvil, pero como resaltado de fila completa en vez de barra corta: el
  contenedor acá es una fila con ícono y texto, no un ícono suelto. Mismo
  significado, forma distinta según el contenedor.
*/
const GRUPOS = [
  {
    titulo: "Operación",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, soloAdmin: false },
      { href: "/conteo", label: "Contar stock", icon: ScanLine, soloAdmin: false },
      { href: "/productos", label: "Productos", icon: Package, soloAdmin: false },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/etiquetas", label: "Generar etiqueta", icon: Barcode, soloAdmin: true },
      { href: "/historial", label: "Historial", icon: History, soloAdmin: true },
      { href: "/usuarios", label: "Usuarios", icon: Users, soloAdmin: true },
      { href: "/configuracion", label: "Configuración", icon: Settings, soloAdmin: true },
    ],
  },
];

const CLAVE_COLAPSADO = "sidebar-colapsado";

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [colapsado, setColapsado] = useState(false);

  // Se lee después del montaje, no en el estado inicial: leer localStorage
  // durante el render haría que el servidor y el cliente dibujen anchos
  // distintos y React marque un error de hidratación.
  useEffect(() => {
    setColapsado(localStorage.getItem(CLAVE_COLAPSADO) === "1");
  }, []);

  function alternar() {
    setColapsado((previo) => {
      const siguiente = !previo;
      localStorage.setItem(CLAVE_COLAPSADO, siguiente ? "1" : "0");
      return siguiente;
    });
  }

  const glowTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 32 };

  const gruposVisibles = GRUPOS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.soloAdmin || isAdmin) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card/50 py-5 transition-[width] duration-base ease-out-soft md:flex",
        colapsado ? "w-[68px]" : "w-60"
      )}
    >
      <div className={cn("mb-6 flex items-center gap-2", colapsado ? "justify-center px-2" : "px-5")}>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
          S
        </div>
        {!colapsado && <span className="font-display text-sm font-semibold">StockApp</span>}
      </div>

      <nav className={cn("flex-1 space-y-1", colapsado ? "px-2" : "px-3")}>
        {gruposVisibles.map((grupo, indice) => (
          <div key={grupo.titulo} className={cn(indice > 0 && "mt-5 border-t border-border pt-5")}>
            {!colapsado && (
              <p className="mb-1.5 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                {grupo.titulo}
              </p>
            )}
            <div className="space-y-0.5">
              {grupo.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={colapsado ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors duration-quick",
                      colapsado ? "justify-center px-0 h-10" : "px-3",
                      active ? "text-primary" : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-glow"
                        transition={glowTransition}
                        aria-hidden="true"
                        className="absolute inset-0 rounded-lg bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_0_16px_-4px_hsl(var(--primary)/0.45)]"
                      />
                    )}
                    <Icon size={17} className="relative shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    {!colapsado && <span className="relative truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={alternar}
        aria-label={colapsado ? "Expandir menú" : "Colapsar menú"}
        className={cn(
          "mt-4 flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors duration-quick hover:bg-elevated hover:text-foreground",
          colapsado ? "mx-2 justify-center" : "mx-3 px-3"
        )}
      >
        {colapsado ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        {!colapsado && <span>Colapsar</span>}
      </button>
    </aside>
  );
}
