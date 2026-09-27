"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, ScanLine, Package, Barcode,
  History, Users, Settings, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Capacidades } from "@/lib/permisos";
import { cn } from "@/lib/utils";

/*
  SidebarRail — menú lateral de ESCRITORIO estilo HBO/Apple.

  Siempre visible como una tira angosta de solo íconos. Al acercar el mouse
  se expande suavemente y muestra los nombres. No empuja el contenido: la
  versión expandida se monta por encima. En móvil no se muestra (ahí manda
  la barra flotante de abajo, FloatingNav).
*/
type Item = { href: string; label: string; icon: LucideIcon; capacidad?: keyof Capacidades };

const GRUPOS: { titulo: string; items: Item[] }[] = [
  {
    titulo: "Operación",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/estado", label: "Estado por planta", icon: ClipboardList },
      { href: "/conteo", label: "Contar stock", icon: ScanLine, capacidad: "contar" },
      { href: "/productos", label: "Productos", icon: Package },
      { href: "/etiquetas", label: "Generar etiqueta", icon: Barcode, capacidad: "etiquetas" },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/historial", label: "Historial", icon: History, capacidad: "verHistorial" },
      { href: "/usuarios", label: "Usuarios", icon: Users, capacidad: "gestionarUsuarios" },
      { href: "/configuracion", label: "Configuración", icon: Settings, capacidad: "gestionarCatalogo" },
    ],
  },
];

const ANCHO_COLAPSADO = 68; // px — la tira de solo íconos (siempre visible)

export function SidebarRail() {
  const pathname = usePathname();
  const { capacidades } = useAuth();

  const esActivo = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const grupos = GRUPOS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.capacidad || capacidades?.[i.capacidad]) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside
      className={cn(
        "group fixed left-0 top-0 z-40 hidden h-screen flex-col overflow-hidden border-r border-border bg-card/90 py-4 backdrop-blur-xl",
        "w-[68px] transition-[width] duration-300 ease-out hover:w-64 hover:shadow-2xl md:flex"
      )}
      style={{ width: undefined }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="mb-5 flex h-10 items-center gap-2.5 px-[18px]">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">S</span>
        <span className="whitespace-nowrap font-display text-sm font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100">StockApp</span>
      </Link>

      <nav className="flex-1 space-y-1 px-3">
        {grupos.map((grupo, i) => (
          <div key={grupo.titulo} className={cn(i > 0 && "mt-4 border-t border-border pt-4")}>
            {/* Título del grupo — solo visible al expandir */}
            <p className="mb-1 h-4 overflow-hidden px-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {grupo.titulo}
            </p>
            <div className="space-y-1">
              {grupo.items.map((item) => {
                const activo = esActivo(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-current={activo ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-xl px-[14px] text-sm font-medium transition-all duration-200 ease-out",
                      // Estilo 1 — elevación: al pasar el mouse el ítem se eleva + sombra.
                      // Sombra marcada y fondo adaptativo para que el efecto se
                      // note igual en modo día (sol) que en modo noche (luna).
                      "hover:-translate-y-1 hover:shadow-[0_10px_24px_-8px_rgba(0,0,0,0.35)]",
                      activo
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                    )}
                  >
                    <Icon size={20} className="shrink-0" strokeWidth={activo ? 2.2 : 1.9} />
                    <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pista de que se expande (una flechita sutil), solo colapsado */}
      <div className="px-[26px] pt-2 text-muted-foreground/50 transition-opacity duration-200 group-hover:opacity-0">
        <div className="h-1 w-4 rounded-full bg-current" />
      </div>
    </aside>
  );
}
