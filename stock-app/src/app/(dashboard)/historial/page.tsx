"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { historialService } from "@/services/historial.service";
import type { HistorialEntry } from "@/types";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ETIQUETAS_ACCION: Record<string, string> = {
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
  crear_producto: "Producto creado",
  editar_producto: "Producto editado",
  eliminar_producto: "Producto eliminado",
  crear_usuario: "Usuario creado",
  editar_usuario: "Usuario editado",
  eliminar_usuario: "Usuario eliminado",
  guardar_conteo: "Conteo guardado",
  resetear_conteos: "Conteos reiniciados",
  importar_productos: "Importación de productos",
  exportar_datos: "Exportación de datos",
};

export default function HistorialPage() {
  const [entradas, setEntradas] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    historialService
      .listar()
      .then(setEntradas)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return entradas;
    return entradas.filter((h) =>
      [h.usuarioEmail, h.accion, h.entidad, h.observacion].join(" ").toLowerCase().includes(q)
    );
  }, [entradas, busqueda]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-muted-foreground" size={22} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-3 max-w-3xl mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
        <Input
          placeholder="Buscar por usuario, acción, producto..."
          className="pl-9"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {filtradas.length} evento{filtradas.length !== 1 ? "s" : ""} de auditoría
      </p>

      <div className="space-y-2">
        {filtradas.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">Todavía no hay eventos registrados.</p>
        )}
        {filtradas.map((h) => (
          <Card key={h.id}>
            <CardContent className="pt-4 pb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{ETIQUETAS_ACCION[h.accion] || h.accion}</Badge>
                  {h.entidad && <span className="text-xs text-muted-foreground truncate">{h.entidad}</span>}
                </div>
                <p className="text-sm mt-1.5">
                  <span className="font-medium">{h.usuarioEmail}</span>{" "}
                  <span className="text-muted-foreground capitalize">({h.rol})</span>
                </p>
                {h.valorNuevo && <p className="text-xs text-muted-foreground mt-1 break-words">{h.valorNuevo}</p>}
                {h.observacion && <p className="text-xs text-muted-foreground mt-0.5 italic">"{h.observacion}"</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{h.fecha}</p>
                <p className="text-xs text-muted-foreground">{h.hora}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
