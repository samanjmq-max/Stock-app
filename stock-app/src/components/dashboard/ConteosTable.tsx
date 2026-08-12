"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, X, Loader2, Search } from "lucide-react";
import type { Conteo, EstadoConteo } from "@/types";
import { conteosService } from "@/services/conteos.service";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BADGE_POR_ESTADO: Record<EstadoConteo, "success" | "destructive" | "default"> = {
  coincide: "success",
  falta: "destructive",
  sobra: "default",
  no_existe: "destructive",
};

const LABEL_FILTRO: Record<string, string> = {
  coincide: "Coincidencias",
  sobra: "Diferencias +",
  falta: "Diferencias −",
};

// La columna "fecha" a veces llega como fecha simple y a veces como ISO
// completo (con hora incluida) — esto la muestra siempre prolija, en
// formato dd/mm/aaaa, sin importar cuál de los dos formatos llegó.
function formatearFecha(valor: string): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (isNaN(fecha.getTime())) return valor; // si no es una fecha válida, se muestra tal cual
  return fecha.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Props {
  conteos: Conteo[];
  filtro: EstadoConteo | null;
  onQuitarFiltro: () => void;
  onEditar: (conteo: Conteo) => void;
  onEliminado: () => void;
}

export function ConteosTable({ conteos, filtro, onQuitarFiltro, onEditar, onEliminado }: Props) {
  const { isAdmin } = useAuth();
  const [busqueda, setBusqueda] = useState("");
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [eliminandoLote, setEliminandoLote] = useState(false);

  // Buscador por código — filtra en vivo sobre lo que ya está cargado,
  // así encontrar un código puntual entre cientos de conteos es inmediato.
  const conteosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return conteos;
    return conteos.filter(
      (c) => c.codigo.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q)
    );
  }, [conteos, busqueda]);

  const todosSeleccionados = conteosFiltrados.length > 0 && seleccionados.size === conteosFiltrados.length;
  const algunoSeleccionado = seleccionados.size > 0;

  function toggleUno(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSeleccionados(todosSeleccionados ? new Set() : new Set(conteosFiltrados.map((c) => c.id)));
  }

  async function eliminar(conteo: Conteo) {
    const confirmado = window.confirm(
      `¿Eliminar el conteo de "${conteo.codigo} — ${conteo.descripcion}"?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setEliminandoId(conteo.id);
    try {
      await conteosService.eliminar(conteo.id);
      toast.success("Conteo eliminado");
      onEliminado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el conteo");
    } finally {
      setEliminandoId(null);
    }
  }

  async function eliminarSeleccionados() {
    const cantidad = seleccionados.size;
    const confirmado = window.confirm(
      `¿Eliminar ${cantidad} conteo${cantidad === 1 ? "" : "s"} seleccionado${cantidad === 1 ? "" : "s"}?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setEliminandoLote(true);
    try {
      const res = await conteosService.eliminarVarios(Array.from(seleccionados));
      toast.success(`${res.eliminados} conteos eliminados`);
      setSeleccionados(new Set());
      onEliminado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron eliminar los conteos");
    } finally {
      setEliminandoLote(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 flex-wrap gap-2">
        <CardTitle className="text-sm">
          {filtro ? `Conteos — ${LABEL_FILTRO[filtro] || filtro}` : "Todos los conteos"}
          <span className="ml-2 text-muted-foreground font-normal">
            ({conteosFiltrados.length}
            {busqueda ? ` de ${conteos.length}` : ""})
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {isAdmin && algunoSeleccionado && (
            <Button
              variant="destructive"
              size="sm"
              onClick={eliminarSeleccionados}
              disabled={eliminandoLote}
              className="h-7 text-xs"
            >
              {eliminandoLote ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
              Eliminar seleccionados ({seleccionados.size})
            </Button>
          )}
          {filtro && (
            <Button
              variant="outline"
              size="sm"
              onClick={onQuitarFiltro}
              className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/5"
            >
              <X size={13} />
              Ver todos los conteos
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {conteosFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {conteos.length === 0
              ? "No hay conteos para mostrar."
              : "Ningún conteo coincide con la búsqueda."}
          </p>
        ) : (
          <div className="-mx-5">
            {/* Recuadro de alto fijo: las filas scrollean adentro, el resto de la pantalla queda quieto. */}
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
                    {isAdmin && (
                      <th className="px-5 py-2 font-medium w-8">
                        <input
                          type="checkbox"
                          checked={todosSeleccionados}
                          onChange={toggleTodos}
                          aria-label="Seleccionar todos"
                          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                        />
                      </th>
                    )}
                    <th className={`py-2 font-medium ${isAdmin ? "px-2" : "px-5"}`}>Código</th>
                    <th className="px-2 py-2 font-medium">Descripción</th>
                    <th className="px-2 py-2 font-medium">Ubicación</th>
                    <th className="px-2 py-2 font-medium">Ubic. nueva</th>
                    <th className="px-2 py-2 font-medium text-right">SAP</th>
                    <th className="px-2 py-2 font-medium text-right">Contado</th>
                    <th className="px-2 py-2 font-medium text-right">Dif.</th>
                    <th className="px-2 py-2 font-medium">Estado</th>
                    <th className="px-2 py-2 font-medium">Usuario</th>
                    <th className="px-2 py-2 font-medium">Fecha y hora</th>
                    <th className="px-5 py-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {conteosFiltrados.map((c) => (
                    <tr
                      key={c.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 ${
                        seleccionados.has(c.id) ? "bg-primary/5" : ""
                      }`}
                    >
                      {isAdmin && (
                        <td className="px-5 py-2">
                          <input
                            type="checkbox"
                            checked={seleccionados.has(c.id)}
                            onChange={() => toggleUno(c.id)}
                            aria-label={`Seleccionar ${c.codigo}`}
                            className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                          />
                        </td>
                      )}
                      <td className={`py-2 font-medium whitespace-nowrap ${isAdmin ? "px-2" : "px-5"}`}>{c.codigo}</td>
                      <td className="px-2 py-2 max-w-[180px] truncate" title={c.descripcion}>
                        {c.descripcion}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{c.ubicacion || "—"}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {c.ubicacionNueva ? (
                          <span className="text-warning-foreground font-medium">{c.ubicacionNueva}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">{c.stockSap}</td>
                      <td className="px-2 py-2 text-right">{c.stockContado}</td>
                      <td className="px-2 py-2 text-right">
                        {c.diferencia > 0 ? "+" : ""}
                        {c.diferencia}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant={BADGE_POR_ESTADO[c.estado]}>{c.estado}</Badge>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap max-w-[140px] truncate" title={c.usuarioEmail}>
                        {c.usuarioEmail}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatearFecha(c.fecha)}
                        {c.hora ? <span className="text-muted-foreground"> · {c.hora}</span> : ""}
                      </td>
                      <td className="px-5 py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditar(c)}>
                          <Pencil size={13} />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => eliminar(c)}
                            disabled={eliminandoId === c.id}
                          >
                            {eliminandoId === c.id ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
