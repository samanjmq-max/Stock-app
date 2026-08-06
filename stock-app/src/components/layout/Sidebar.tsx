"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ScanBarcode, Package, History, Users, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, soloAdmin: false },
  { href: "/conteo", label: "Contar stock", icon: ScanBarcode, soloAdmin: false },
  { href: "/productos", label: "Productos", icon: Package, soloAdmin: false },
  { href: "/historial", label: "Historial", icon: History, soloAdmin: false },
  { href: "/usuarios", label: "Usuarios", icon: Users, soloAdmin: true },
  { href: "/configuracion", label: "Configuración", icon: Settings, soloAdmin: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

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
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
