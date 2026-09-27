"use client";

import { usePathname } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { FloatingNav } from "@/components/layout/FloatingNav";
import { AuthGate } from "@/components/layout/AuthGate";

const TITULOS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/estado": "Estado por planta",
  "/conteo": "Contar stock",
  "/productos": "Productos",
  "/etiquetas": "Generar etiqueta",
  "/historial": "Historial",
  "/usuarios": "Usuarios",
  "/configuracion": "Configuración",
};

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const titulo = TITULOS[pathname] || "StockApp";

  return (
    <AuthGate>
      <div className="min-h-screen">
        {/* Escritorio: menú lateral que se expande al pasar el mouse. */}
        <SidebarRail />
        {/* El contenido deja lugar a la izquierda para la tira de íconos (68px)
            en escritorio; la versión expandida se monta por encima, no empuja. */}
        <div className="md:pl-[68px]">
          <Topbar title={titulo} />
          <div className="mx-auto max-w-[1400px] pb-28 md:pb-10">{children}</div>
        </div>
        {/* Celular: barra flotante abajo (FloatingNav se oculta solo en md+). */}
        <FloatingNav />
      </div>
    </AuthGate>
  );
}
