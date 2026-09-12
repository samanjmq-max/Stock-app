"use client";

import { useState } from "react";
import { SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

/*
  Filtros en celular: un solo control "madre".

  El problema que resuelve: en pantalla angosta los tres filtros (agencia,
  ubicación, familia) más sus etiquetas ocupaban cuatro renglones antes de
  cualquier dato. Había que hacer scroll para llegar al conteo y, al hacerlo,
  todo eso quedaba tapado por el encabezado fijo -- y con ello se perdía la
  posibilidad de volver a cambiar de agencia sin subir de nuevo.

  Cómo funciona ahora:

  - PLEGADO es una sola fila que dice QUÉ está filtrado ("Lascano · 2
    ubicaciones"), no un botón mudo que dice "Filtros". Se ve el estado sin
    tener que abrir nada.
  - DESPLEGADO muestra los tres selectores, cada uno a lo ancho completo --
    antes eran anchos fijos de 176px que truncaban los nombres a
    "Todas las ubicaci...".
  - Siempre se puede volver a cambiar cualquiera de los tres, incluida la
    agencia. Para un super administrador eso no es opcional: tiene que poder
    saltar entre todas las plantas.

  En escritorio este componente no se dibuja: ahí los filtros van en línea,
  que es lo que ya funcionaba bien.
*/

export interface OpcionAgencia {
  valor: string;
  etiqueta: string;
}

interface Props {
  /** Solo se muestra si el usuario puede elegir agencia (admin / super admin). */
  agencia?: {
    valor: string;
    opciones: OpcionAgencia[];
    onChange: (valor: string) => void;
    /** Valor que representa "sin filtrar por agencia" — no cuenta como filtro activo. */
    valorNeutro: string;
  };
  ubicacion: string[];
  opcionesUbicacion: string[];
  onUbicacion: (valores: string[]) => void;
  familia: string[];
  opcionesFamilia: string[];
  onFamilia: (valores: string[]) => void;
  onLimpiar: () => void;
}

export function FiltrosMoviles({
  agencia,
  ubicacion,
  opcionesUbicacion,
  onUbicacion,
  familia,
  opcionesFamilia,
  onFamilia,
  onLimpiar,
}: Props) {
  const [abierto, setAbierto] = useState(false);

  const agenciaActiva = agencia && agencia.valor !== agencia.valorNeutro;
  const etiquetaAgencia = agencia?.opciones.find((o) => o.valor === agencia.valor)?.etiqueta;
  const cantidadActivos = (agenciaActiva ? 1 : 0) + (ubicacion.length > 0 ? 1 : 0) + (familia.length > 0 ? 1 : 0);

  // Resumen de lo filtrado. Se omite lo que está en "todas" para que la fila
  // no se llene de texto que no aporta.
  const partes: string[] = [];
  if (agenciaActiva && etiquetaAgencia) partes.push(etiquetaAgencia);
  if (ubicacion.length === 1 && ubicacion[0]) partes.push(ubicacion[0]);
  else if (ubicacion.length > 1) partes.push(`${ubicacion.length} ubicaciones`);
  if (familia.length === 1 && familia[0]) partes.push(familia[0]);
  else if (familia.length > 1) partes.push(`${familia.length} familias`);
  const resumen = partes.length > 0 ? partes.join(" · ") : "Sin filtros";

  return (
    <div className="md:hidden">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className={cn(
            "flex min-h-[44px] flex-1 items-center gap-2 rounded-lg border px-3 text-left transition-colors duration-quick",
            cantidadActivos > 0
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-card text-muted-foreground"
          )}
        >
          <SlidersHorizontal size={15} className={cn("shrink-0", cantidadActivos > 0 && "text-primary")} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{resumen}</span>
          {cantidadActivos > 0 && (
            <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold tabular-nums text-primary-foreground">
              {cantidadActivos}
            </span>
          )}
          <ChevronDown
            size={16}
            className={cn("shrink-0 transition-transform duration-quick", abierto && "rotate-180")}
          />
        </button>

        {cantidadActivos > 0 && !abierto && (
          <Button variant="ghost" size="sm" onClick={onLimpiar}>
            Limpiar
          </Button>
        )}
      </div>

      {abierto && (
        <div className="mt-2 space-y-2.5 rounded-lg border border-border bg-card p-3 animate-slide-up">
          {agencia && (
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Agencia</p>
              <Select value={agencia.valor} onValueChange={agencia.onChange}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agencia.opciones.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Ubicación</p>
            <SearchableSelect
              value={ubicacion}
              onValueChange={onUbicacion}
              options={opcionesUbicacion}
              allLabel="Todas las ubicaciones"
              placeholder="Buscar ubicación..."
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Familia</p>
            <SearchableSelect
              value={familia}
              onValueChange={onFamilia}
              options={opcionesFamilia}
              allLabel="Todas las familias"
              placeholder="Buscar familia..."
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onLimpiar} disabled={cantidadActivos === 0}>
              Limpiar todo
            </Button>
            <Button size="sm" onClick={() => setAbierto(false)}>
              <Check size={14} />
              Listo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
