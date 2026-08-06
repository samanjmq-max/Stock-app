"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, LogOut, WifiOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/hooks/useSync";
import { Button } from "@/components/ui/button";

export function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const { isOnline, pendientes, sincronizando, sincronizarAhora } = useSync();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 py-3.5">
      <div>
        <h1 className="text-base font-semibold">{title}</h1>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {!isOnline ? (
            <>
              <WifiOff size={11} className="text-warning-foreground" />
              Sin conexión
            </>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              En línea
            </span>
          )}
          {pendientes > 0 && <span>· {pendientes} por sincronizar</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {pendientes > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={sincronizarAhora}
            disabled={sincronizando || !isOnline}
            aria-label="Sincronizar ahora"
          >
            <RefreshCw size={16} className={sincronizando ? "animate-spin" : ""} />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </Button>
        <div className="hidden sm:flex flex-col items-end mr-1">
          <span className="text-xs font-medium leading-none">{user?.nombre}</span>
          <span className="text-[11px] text-muted-foreground capitalize leading-none mt-0.5">{user?.rol}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión">
          <LogOut size={17} />
        </Button>
      </div>
    </header>
  );
}
