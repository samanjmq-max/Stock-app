"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Square, CheckSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Multi-select con buscador para listas largas (ej. ubicaciones/familias de
 * un catálogo con miles de productos) -- el <Select> nativo de Radix no
 * deja escribir para filtrar ni elegir más de una opción a la vez, y para
 * conteo cíclico tiene sentido acotar a varias zonas juntas (ej. "A
 * DEVOLVER" + "ARMARIO"). Hecho a mano en vez de sumar `cmdk` +
 * `@radix-ui/react-popover` como dependencias nuevas (mismo criterio que el
 * resto de `components/ui/`: primitives livianos, sin librerías de más).
 *
 * `value` vacío ([]) significa "sin filtro / todas" -- no hace falta un
 * sentinel string como en el <Select> nativo.
 */
interface SearchableSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: string[];
  allLabel: string;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  allLabel,
  placeholder = "Buscar...",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Deja pintar el panel antes de enfocar, si no el foco no agarra.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(v: string) {
    onValueChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  function limpiar() {
    onValueChange([]);
    setOpen(false);
  }

  const etiquetaTrigger =
    value.length === 0 ? allLabel : value.length === 1 ? value[0] : `${value.length} seleccionadas`;

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        <span className={cn("truncate text-left", value.length === 0 && "text-muted-foreground")}>
          {etiquetaTrigger}
        </span>
        <ChevronDown size={15} className="shrink-0 text-muted-foreground ml-2" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[240px] rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <div className="relative border-b border-border">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                const primera = filtradas[0];
                if (e.key === "Enter" && primera) toggle(primera);
              }}
              placeholder={placeholder}
              className="w-full h-10 pl-9 pr-8 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Borrar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              role="option"
              aria-selected={value.length === 0}
              onClick={limpiar}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-secondary cursor-pointer border-b border-border/60 mb-0.5"
            >
              <X size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">{allLabel} (limpiar selección)</span>
            </button>

            {filtradas.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados para "{query}"</p>
            ) : (
              filtradas.map((o) => {
                const marcado = value.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    role="option"
                    aria-selected={marcado}
                    onClick={() => toggle(o)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-secondary cursor-pointer"
                  >
                    {marcado ? (
                      <CheckSquare size={15} className="text-primary shrink-0" />
                    ) : (
                      <Square size={15} className="text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{o}</span>
                  </button>
                );
              })
            )}
          </div>

          {value.length > 0 && (
            <div className="border-t border-border p-1.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-md bg-primary text-primary-foreground text-xs font-medium py-1.5 hover:bg-primary/90 cursor-pointer"
              >
                Listo ({value.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
