import { AuthProvider } from "@/contexts/AuthContext";

/**
 * Todos los providers globales de la app se componen acá. Hoy solo hay
 * autenticación; en Etapa 3 se suma acá el provider de notificaciones
 * (toasts) para confirmaciones visuales, sin tocar layout.tsx.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
