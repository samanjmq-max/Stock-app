"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Capacidades } from "@/lib/permisos";
import type { Perfil, Rol, Agencia } from "@/types";
interface SessionUser {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  perfil: Perfil;
  agencia: Agencia;
  /** Todas las plantas que puede ver, ya resueltas por el servidor. */
  alcance: Agencia[];
  capacidades: Capacidades;
  esSuperAdmin: boolean;
}
interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  isAdmin: boolean;
  esSuperAdmin: boolean;
  agencia: Agencia | null;
  perfil: Perfil | null;
  /*
    Las capacidades vienen resueltas del servidor y NO se recalculan acá.
    Si el frontend reimplementara la tabla de permisos, tarde o temprano
    quedaría desalineada con el servidor y la interfaz mostraría botones que
    la API rechaza. Esto es solo para dibujar: quien decide sigue siendo
    cada ruta de API.
  */
  capacidades: Capacidades | null;
  alcance: Agencia[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        setUser(json.data);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  async function login(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo iniciar sesión");
    await refresh();
    router.push("/dashboard");
    router.refresh();
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }
  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAdmin: user?.rol === "administrador",
      esSuperAdmin: user?.esSuperAdmin ?? false,
      agencia: user?.agencia ?? null,
      perfil: user?.perfil ?? null,
      capacidades: user?.capacidades ?? null,
      alcance: user?.alcance ?? [],
      login,
      logout,
      refresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
