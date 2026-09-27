"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, ScanLine, Package, Barcode,
  History, Users, Settings, MoreHorizontal, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Capacidades } from "@/lib/permisos";
import { cn } from "@/lib/utils";

/*
  FloatingNav — barra flotante estilo "Apple dock" (Estilo 1: elevación).

  Reemplaza al Sidebar de escritorio y al MobileNav. Vive fija abajo y al
  centro, SIEMPRE VISIBLE (tanto en celular como en computadora). Cada ícono
  se eleva al hacer hover y muestra su nombre.

  Los ítems de operación van en la pastilla; los de administración (menos
  frecuentes) viven detrás del botón "Más". Todo se filtra por capacidad:
  cada perfil ve solo lo que puede usar, igual que el menú anterior.
*/
type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  capacidad?: keyof Capacidades;
  accion?: boolean; // botón de acción (Contar) — resaltado en terracota
};

const OPERACION: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/estado", label: "Estado por planta", icon: ClipboardList },
  { href: "/conteo", label: "Contar stock", icon: ScanLine, capacidad: "contar", accion: true },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/etiquetas", label: "Generar etiqueta", icon: Barcode, capacidad: "etiquetas" },
];

const ADMINISTRACION: Item[] = [
  { href: "/historial", label: "Historial", icon: History, capacidad: "verHistorial" },
  { href: "/usuarios", label: "Usuarios", icon: Users, capacidad: "gestionarUsuarios" },
  { href: "/configuracion", label: "Configuración", icon: Settings, capacidad: "gestionarCatalogo" },
];

export function FloatingNav() {
  const pathname = usePathname();
  const { capacidades } = useAuth();
  const [masAbierto, setMasAbierto] = useState(false);

  const puede = (i: Item) => !i.capacidad || capacidades?.[i.capacidad];
  const operacion = OPERACION.filter(puede);
  const administracion = ADMINISTRACION.filter(puede);

  const esActivo = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // Escritorio: aparece cuando el mouse se acerca al borde inferior.
  // (En móvil no corre este efecto de forma útil, pero no molesta: la barra
  //  igual se muestra siempre por CSS por debajo de `md`.)
  // Cerrar el popover "Más" al cambiar de ruta.
  useEffect(() => { setMasAbierto(false); }, [pathname]);

  function Boton({ item }: { item: Item }) {
    const activo = esActivo(item.href);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        aria-label={item.label}
        aria-current={activo ? "page" : undefined}
        className={cn(
          "group relative grid h-11 w-11 place-items-center rounded-[15px] transition-all duration-200 ease-out",
          "hover:-translate-y-2 hover:shadow-lg",
          item.accion
            ? "bg-primary text-primary-foreground hover:shadow-xl"
            : activo
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-elevated hover:text-foreground"
        )}
      >
        {/* Tooltip (se ve al hacer hover en escritorio) */}
        <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 scale-90 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100">
          {item.label}
        </span>
        <Icon size={21} strokeWidth={activo || item.accion ? 2.2 : 1.9} />
        {/* Puntito del activo (no en el botón de acción) */}
        {activo && !item.accion && (
          <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
        )}
      </Link>
    );
  }

  return (
    <div
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      className="fixed left-1/2 z-40 -translate-x-1/2 md:hidden"
    >
      {/* Popover "Más" — ítems de administración */}
      {masAbierto && administracion.length > 0 && (
        <>
          <div className="fixed inset-0 z-0" onClick={() => setMasAbierto(false)} />
          <div className="absolute bottom-full left-1/2 z-10 mb-3 w-52 -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur-xl">
            <p className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
              Administración
            </p>
            {administracion.map((item) => {
              const activo = esActivo(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    activo ? "bg-primary/15 text-primary" : "text-foreground hover:bg-elevated"
                  )}
                >
                  <Icon size={18} /> {item.label}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* La pastilla */}
      <nav className="flex items-center gap-1.5 rounded-[22px] border border-border bg-card/85 p-2 shadow-2xl backdrop-blur-xl">
        {operacion.map((item) => <Boton key={item.href} item={item} />)}

        {administracion.length > 0 && (
          <>
            <span className="mx-1 h-8 w-px bg-border" />
            <button
              type="button"
              aria-label="Más"
              onClick={() => setMasAbierto((v) => !v)}
              className={cn(
                "group relative grid h-11 w-11 place-items-center rounded-[15px] transition-all duration-200 ease-out hover:-translate-y-2 hover:bg-elevated hover:text-foreground hover:shadow-lg",
                masAbierto ? "bg-elevated text-foreground" : "text-muted-foreground"
              )}
            >
              <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 scale-90 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100">
                Más
              </span>
              <MoreHorizontal size={21} />
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
