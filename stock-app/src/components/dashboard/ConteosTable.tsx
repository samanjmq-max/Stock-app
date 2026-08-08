"use client";

import { Pencil, X } from "lucide-react";
import type { Conteo, EstadoConteo } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

interface Props {
  conteos: Conteo[];
  filtro: EstadoConteo | null;
  onQuitarFiltro: () => void;
  onEditar: (conteo: Conteo) => void;
}

export function ConteosTable({ conteos, filtro, onQuitarFiltro, onEditar }: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">
          {filtro ? `Conteos — ${LABEL_FILTRO[filtro] || filtro}` : "Todos los conteos"}
          <span className="ml-2 text-muted-foreground font-normal">({conteos.length})</span>
        </CardTitle>
        {filtro && (
          <Button variant="ghost" size="sm" onClick={onQuitarFiltro} className="h-7 text-xs">
            <X size={13} />
            Quitar filtro
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {conteos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No hay conteos para mostrar.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="px-5 py-2 font-medium">Código</th>
                  <th className="px-2 py-2 font-medium">Descripción</th>
                  <th className="px-2 py-2 font-medium">Ubicación</th>
                  <th className="px-2 py-2 font-medium">Ubic. nueva</th>
                  <th className="px-2 py-2 font-medium text-right">SAP</th>
                  <th className="px-2 py-2 font-medium text-right">Contado</th>
                  <th className="px-2 py-2 font-medium text-right">Dif.</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Usuario</th>
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-5 py-2 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {conteos.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-2 font-medium whitespace-nowrap">{c.codigo}</td>
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
                    <td className="px-2 py-2 whitespace-nowrap">{c.fecha}</td>
                    <td className="px-5 py-2 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditar(c)}>
                        <Pencil size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
