"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/hooks/useSync";
import { useConfirm } from "@/hooks/useConfirm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function useToggle(clave: string, defaultValue = true) {
  const [valor, setValor] = useState(defaultValue);

  useEffect(() => {
    const guardado = localStorage.getItem(clave);
    if (guardado !== null) setValor(guardado === "true");
  }, [clave]);

  function actualizar(nuevo: boolean) {
    setValor(nuevo);
    localStorage.setItem(clave, String(nuevo));
  }

  return [valor, actualizar] as const;
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-primary" : "bg-secondary"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function ConfiguracionPage() {
  const { isAdmin } = useAuth();
  const { sincronizarAhora, sincronizando, isOnline } = useSync();
  const { confirm, ConfirmDialogElement } = useConfirm();
  const [sonidos, setSonidos] = useToggle("config_sonidos", true);
  const [vibracion, setVibracion] = useToggle("config_vibracion", true);
  const [reseteando, setReseteando] = useState(false);

  async function resetearConteos() {
    const confirmado = await confirm({
      titulo: "Reiniciar todos los conteos",
      descripcion: "Esta acción elimina TODOS los conteos registrados (no los productos). Usalo solo al arrancar un inventario nuevo desde cero.",
      textoConfirmar: "Reiniciar inventario",
      variante: "destructive",
      palabraDeSeguridad: "REINICIAR",
    });
    if (!confirmado) return;

    setReseteando(true);
    try {
      const res = await fetch("/api/conteos/reset", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success(`${json.data.eliminados} conteos eliminados. El inventario quedó en cero.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reiniciar");
    } finally {
      setReseteando(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto">
      <Card>
        <CardHeader><CardTitle>Feedback del conteo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sonidos</p>
              <p className="text-xs text-muted-foreground">Beep al leer un código y al guardar un conteo</p>
            </div>
            <Switch checked={sonidos} onChange={setSonidos} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Vibración</p>
              <p className="text-xs text-muted-foreground">Vibrar al confirmar lecturas y errores</p>
            </div>
            <Switch checked={vibracion} onChange={setVibracion} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sincronización</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Los conteos se guardan primero en este dispositivo y se sincronizan solos con Google Sheets
            apenas hay conexión. También podés forzarlo manualmente.
          </p>
          <Button variant="secondary" onClick={sincronizarAhora} disabled={sincronizando || !isOnline} className="w-full">
            {sincronizando ? <Loader2 className="animate-spin" size={15} /> : null}
            {sincronizando ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-destructive/30">
          <CardHeader><CardTitle>Zona de riesgo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 text-sm bg-destructive/10 text-destructive rounded-lg px-3 py-2.5">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              Reiniciar los conteos borra TODO el historial de conteo actual (no los productos ni el historial
              de auditoría). Usalo solo al arrancar un inventario nuevo desde cero.
            </div>
            <Button variant="destructive" onClick={resetearConteos} disabled={reseteando} className="w-full">
              {reseteando ? <Loader2 className="animate-spin" size={15} /> : null}
              Reiniciar todos los conteos
            </Button>
          </CardContent>
        </Card>
      )}

      {ConfirmDialogElement}
    </div>
  );
}
