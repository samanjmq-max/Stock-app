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
          {/* Centra y limita a 1400px en desktop -- sin esto el contenido se
              estira sin límite en monitores grandes. Se usa max-w directo
              (no la clase `container`) para no sumarle su padding propio al
              p-4/md:p-6 que cada página ya trae, que aflojaría la densidad
              alta que pide Dashboard. Conteo mantiene su propio max-w-xl
              más angosto adentro, sin cambios visuales para esa página. */}
          <div className="max-w-[1400px] mx-auto">{children}</div>
        </div>
        <MobileNav />
      </div>
    </AuthGate>
  );
}
