"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={22} />
      </div>
    );
  }

  // El middleware ya redirige a /login si no hay sesión; esto es una
  // segunda barrera para el primer render en el cliente.
  if (!user) return null;

  return <>{children}</>;
}
