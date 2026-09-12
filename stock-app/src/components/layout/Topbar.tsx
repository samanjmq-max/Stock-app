"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, LogOut, WifiOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/hooks/useSync";
import { Button } from "@/components/ui/button";

const COLOR_OSCURO = "#100c0a";
const COLOR_CLARO = "#faf8f5";

/** Mantiene la barra de estado del teléfono del mismo color que la app. */
function sincronizarColorDeBarra(oscuro: boolean) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", oscuro ? COLOR_OSCURO : COLOR_CLARO);
}

export function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const { isOnline, pendientes, sincronizando, sincronizarAhora } = useSync();
  const [dark, setDark] = useState(true);

  /*
    El tema ya lo aplicó el script bloqueante del <head> (src/app/layout.tsx)
    antes del primer pintado. Acá solo se lee el estado resultante para que el
    ícono del botón coincida -- no se vuelve a decidir nada, si no habría dos
    fuentes de verdad y podrían discrepar.

    Por defecto es oscuro: es la identidad de StockApp, no la preferencia del
    sistema operativo. Una elección guardada a mano siempre gana.
  */
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    sincronizarColorDeBarra(next);
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 py-3.5">
      <div>
        <h1 className="font-display text-base font-semibold">{title}</h1>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {!isOnline ? (
            <>
              <WifiOff size={11} className="text-warning" />
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
            size="icon-sm"
            onClick={sincronizarAhora}
            disabled={sincronizando || !isOnline}
            aria-label="Sincronizar ahora"
          >
            <RefreshCw size={16} className={sincronizando ? "animate-spin" : ""} />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Cambiar tema">
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </Button>
        <div className="hidden sm:flex flex-col items-end mr-1">
          <span className="text-xs font-medium leading-none">{user?.nombre}</span>
          <span className="text-[11px] text-muted-foreground capitalize leading-none mt-0.5">{user?.rol}</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={logout} aria-label="Cerrar sesión">
          <LogOut size={17} />
        </Button>
      </div>
    </header>
  );
}
