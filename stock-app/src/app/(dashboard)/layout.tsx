"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AuthGate } from "@/components/layout/AuthGate";

const TITULOS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/conteo": "Contar stock",
  "/productos": "Productos",
  "/historial": "Historial",
  "/usuarios": "Usuarios",
  "/configuracion": "Configuración",
};

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const titulo = TITULOS[pathname] || "StockApp";

  return (
    <AuthGate>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0 pb-16 md:pb-0">
          <Topbar title={titulo} />
          {children}
        </div>
        <MobileNav />
      </div>
    </AuthGate>
  );
}
