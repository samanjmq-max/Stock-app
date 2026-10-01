"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/*
  ============================================================================
  Tablero ABC
  ============================================================================

  Reemplaza al Top 20 más costosos. No es un gráfico más: es el que contesta
  "¿qué hay que contar seguido y qué puede esperar al cierre del año?".

  Tres decisiones que conviene no deshacer sin pensarlas:

  1. LAS TRES COLUMNAS VAN ENCENDIDAS. Una versión anterior bajaba el brillo
     de A a C para que la clase más pesada fuese la más luminosa. Se veía
     bien y dejaba a B y C medio muertas -- y son justo las que se miran
     cuando hay que decidir qué NO contar. El peso lo cargan las barras (ver
     abajo), no la opacidad.

  2. CADA COLUMNA LLEVA DOS BARRAS: la plata sobre el total y los artículos
     sobre el total. Los dos rieles miden SIEMPRE el total completo, así que
     se comparan entre columnas sin hacer cuentas -- y sobre todo se comparan
     entre sí dentro de la misma columna. Ahí está todo el ABC en una imagen:
     en A la barra de plata está casi llena y la de artículos es una raya; en
     C es exactamente al revés.

  3. UN COLOR DISTINTO POR CLASE, no tres pasos del mismo dorado.

     La primera versión usaba oro en tres intensidades, con el argumento de
     que ABC es una escala y no tres categorías. En la pantalla no funcionó:
     con las tres columnas encendidas por igual, tres tonos del mismo dorado
     se veían casi idénticos y había que leer la letra para saber en cuál
     estabas parado. Un argumento correcto que la pantalla desmintió.

     Los tres que quedaron evitan a propósito el verde, el azul y el rojo de
     los estados de conteo (coincide, diferencias +, diferencias −): un
     tablero verde se leería como "está todo bien" cuando habla de plata.

       A  oro      -- es el color del valor en toda la app, y A es la plata
       B  cian     -- frío y claramente separado del oro
       C  violeta  -- el más lejano de los tres, y un tono que no significa
                      nada más en esta app

     El violeta también es el que más contrasta con el fondo cálido del
     tablero, que es lo que hace que la columna más larga -- la de los miles
     de artículos baratos -- se despegue de un vistazo.

  Los colores van por `style` y no por clases de Tailwind a propósito: son
  tres tonos que se derivan entre sí (relleno, borde, halo) y Tailwind no
  puede generar clases que no aparezcan literales en el código fuente.

  ---------------------------------------------------------------------------
  ESTE TABLERO ES SIEMPRE OSCURO, TAMBIÉN EN MODO DÍA
  ---------------------------------------------------------------------------

  Y por eso NO usa los tokens de tema (`text-foreground`,
  `text-muted-foreground`, `border-border`): todos los colores de texto están
  escritos literales.

  El bug que esto arregla: el fondo estaba fijo en oscuro pero las letras
  usaban los tokens, que en modo día se dan vuelta a tinta oscura. Resultado:
  texto casi negro sobre fondo casi negro, y el título, el total y los
  rótulos de las barras desaparecían. Las cifras de colores se seguían viendo
  porque esas sí tenían color propio, lo que hacía el problema más raro
  todavía de mirar.

  Se podría haber arreglado al revés -- que el tablero se aclare en modo día --
  pero este diseño no sobrevive a un fondo claro: el resplandor de las
  columnas, la rejilla y los tonos neón necesitan oscuridad para existir. Es
  un instrumento embutido en la página, como la pantalla de un tablero de
  control, y se comporta igual con la luz prendida o apagada.
*/

export type CriterioABC = "montos" | "acumulado";

export interface ArticuloValor {
  codigo: string;
  descripcion: string;
  unidadMedida?: string;
  familia?: string;
  stockSap: number;
  valor: number;
}

interface Props {
  /** Artículos con valor > 0, de la agencia y los filtros que estén activos. */
  articulos: ArticuloValor[];
  tituloAgencia: string;
}

type Clave = "a" | "b" | "c";

/** Cortes en pesos, tal como los definió Maximiliano. */
const CORTE_A = 150000;
const CORTE_B = 70000;

/** Reparto clásico por valor acumulado: 80 % / 15 % / 5 %. */
const ACUM_A = 0.8;
const ACUM_B = 0.95;

/*
  Colores ejecutivos, elegidos por Maximiliano: A rojo, B amarillo, C azul.
  Planos (sin resplandor / neón). El rojo queda en la clase A porque es la que
  concentra el valor -- es la que más hay que mirar.
*/
const TONOS: Record<Clave, string> = {
  a: "#d1493f", // rojo
  b: "#d99a2b", // amarillo
  c: "#3f7fd4", // azul
};

/*
  El total del catálogo va en color de TEXTO, no en oro.

  Estaba del mismo dorado que la clase A y se confundían: son los dos números
  grandes de la cabecera, uno al lado del otro, y el ojo los emparejaba como
  si fueran lo mismo. No lo son -- el total es el denominador contra el que
  se miden las tres clases, no una cuarta categoría.

  Con el total en crema, todo lo que está coloreado en esta pantalla es una
  clase y nada más. Es la regla que hace que el color signifique algo.
*/

const LETRA: Record<Clave, string> = { a: "A", b: "B", c: "C" };

function pesos(v: number): string {
  return `$ ${Math.round(v).toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}
function miles(v: number): string {
  return v.toLocaleString("es-UY");
}
/**
 * Porcentaje con la precisión justa: 47 de 12.416 da 0,38 %, y redondeado a
 * un decimal se vuelve "0,4 %" -- que en esta pantalla es justamente el
 * número que hace el punto.
 */
function porcentaje(parte: number, total: number): string {
  if (!total) return "0";
  const p = (parte / total) * 100;
  const d = p >= 1 ? 1 : 2;
  return p.toLocaleString("es-UY", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * Clasifica por monto fijo. Es el criterio que se explica en una frase y
 * cualquiera verifica con una calculadora -- pero se corre solo si suben los
 * precios, y con un catálogo grande casi todo cae en C.
 */
function clasificarPorMontos(articulos: ArticuloValor[]): Record<Clave, ArticuloValor[]> {
  const out: Record<Clave, ArticuloValor[]> = { a: [], b: [], c: [] };
  for (const art of articulos) {
    if (art.valor >= CORTE_A) out.a.push(art);
    else if (art.valor >= CORTE_B) out.b.push(art);
    else out.c.push(art);
  }
  return out;
}

/**
 * ABC clásico: se ordena de mayor a menor y se corta donde el valor ACUMULADO
 * llega al 80 % y al 95 %. Los cortes se recalculan solos, así que las clases
 * nunca se desbalancean -- el precio es que el límite entre A y B deja de ser
 * un número redondo.
 */
function clasificarPorAcumulado(articulos: ArticuloValor[]): Record<Clave, ArticuloValor[]> {
  const out: Record<Clave, ArticuloValor[]> = { a: [], b: [], c: [] };
  const total = articulos.reduce((s, a) => s + a.valor, 0);
  if (total <= 0) return out;

  let acumulado = 0;
  for (const art of articulos) {
    // El artículo se clasifica por dónde ARRANCA su tramo, no por dónde
    // termina: si no, el que cruza el 80 % caería en B aunque casi todo él
    // esté dentro del 80 %.
    const fraccion = acumulado / total;
    acumulado += art.valor;
    if (fraccion < ACUM_A) out.a.push(art);
    else if (fraccion < ACUM_B) out.b.push(art);
    else out.c.push(art);
  }
  return out;
}

function rangoTexto(clave: Clave, criterio: CriterioABC, grupos: Record<Clave, ArticuloValor[]>): string {
  if (criterio === "montos") {
    if (clave === "a") return `${pesos(CORTE_A)} o más`;
    if (clave === "b") return `${pesos(CORTE_B)} – ${pesos(CORTE_A - 1)}`;
    return `menos de ${pesos(CORTE_B)}`;
  }
  // En acumulado el rango no es un número fijo: se informa dónde quedó el
  // corte de verdad, que es el dato que la gente va a querer verificar.
  const lista = grupos[clave];
  if (lista.length === 0) return clave === "a" ? "primer 80 % del valor" : clave === "b" ? "siguiente 15 %" : "último 5 %";
  const menor = lista[lista.length - 1]!.valor;
  if (clave === "a") return `80 % del valor · desde ${pesos(menor)}`;
  if (clave === "b") return `15 % siguiente · desde ${pesos(menor)}`;
  return `último 5 % · desde ${pesos(menor)}`;
}

function Columna({
  clave,
  articulos,
  totalValor,
  totalItems,
  rango,
}: {
  clave: Clave;
  articulos: ArticuloValor[];
  totalValor: number;
  totalItems: number;
  rango: string;
}) {
  const h = TONOS[clave];
  // Con la clase C a escala de miles de artículos, este reduce corre en cada
  // tecla del buscador; memoizado para que tipear no recalcule toda la suma.
  const valor = useMemo(() => articulos.reduce((s, a) => s + a.valor, 0), [articulos]);
  const pctValor = totalValor > 0 ? (valor / totalValor) * 100 : 0;
  const pctItems = totalItems > 0 ? (articulos.length / totalItems) * 100 : 0;

  // Buscador + filtro por familia, DENTRO de cada cuadro.
  const [busqueda, setBusqueda] = useState("");
  const [familiaSel, setFamiliaSel] = useState("");
  const familias = useMemo(
    () => Array.from(new Set(articulos.map((a) => (a.familia || "").trim()).filter(Boolean))).sort(),
    [articulos]
  );
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return articulos.filter((a) => {
      if (familiaSel && (a.familia || "").trim() !== familiaSel) return false;
      if (!q) return true;
      return String(a.codigo).toLowerCase().includes(q) || String(a.descripcion).toLowerCase().includes(q);
    });
  }, [articulos, busqueda, familiaSel]);
  const hayFiltro = busqueda.trim() !== "" || familiaSel !== "";

  function limpiarFiltro() {
    setBusqueda("");
    setFamiliaSel("");
  }

  // Selección de artículos: tildar filas para ver cuánta plata representan
  // (ej. dentro de A, marcar urea + fertilizantes y ver el total).
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  function toggle(codigo: string) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(codigo)) s.delete(codigo);
      else s.add(codigo);
      return s;
    });
  }
  const valorSeleccion = useMemo(
    () => (seleccion.size === 0 ? 0 : articulos.reduce((s, a) => (seleccion.has(a.codigo) ? s + a.valor : s), 0)),
    [articulos, seleccion]
  );

  // Solo se dibujan las primeras filas: la clase C puede tener miles de
  // artículos y montar miles de <tr> congelaría el dashboard en un celular.
  const VISIBLES = 40;
  const visibles = filtrados.slice(0, VISIBLES);
  const restantes = filtrados.length - visibles.length;

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-xl border bg-muted/50"
      style={{ borderColor: `${h}55` }}
    >
      {/* Filete superior: el gesto que convierte la tarjeta en instrumento. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${h}, transparent)` }}
      />

      <div className="relative overflow-hidden p-[13px]">
        <div className="relative flex items-center gap-2.5">
          <span
            className="grid h-7 w-7 place-items-center rounded-[8px] font-hud text-[15px] font-bold leading-none"
            style={{ color: h, background: `${h}22`, border: `1px solid ${h}66` }}
          >
            {LETRA[clave]}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">{rango}</span>
        </div>

        <p
          className="relative mt-2.5 font-hud text-[30px] font-bold leading-none tabular-nums"
          style={{ color: h }}
        >
          {porcentaje(valor, totalValor)}
          <span className="ml-0.5 text-[15px] font-semibold opacity-70">%</span>
        </p>
        <p className="relative mt-px text-[10.5px] text-muted-foreground">del valor total en stock</p>

        {/*
          Las dos barras. El riel entero es SIEMPRE el total -- los dos
          rieles de las tres columnas miden lo mismo -- así que el relleno
          se compara sin hacer cuentas.
        */}
        <div className="relative mt-3.5 flex flex-col gap-[11px]">
          <div>
            <div className="mb-[5px] flex items-baseline justify-between gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">Plata</span>
              <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                <b className="font-semibold" style={{ color: h }}>{pesos(valor)}</b> de {pesos(totalValor)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-[4px] bg-foreground/[0.08]">
              <div
                className="relative h-full min-w-[3px] rounded-[4px]"
                style={{ width: `${pctValor.toFixed(2)}%`, background: h }}
              />
            </div>
          </div>

          <div>
            <div className="mb-[5px] flex items-baseline justify-between gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">Artículos</span>
              <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                <b className="font-semibold text-foreground">{miles(articulos.length)}</b> de {miles(totalItems)}
              </span>
            </div>
            {/* Gris y no dorada: es el contrapeso, no el protagonista. */}
            <div className="h-1.5 overflow-hidden rounded-[4px] bg-foreground/[0.08]">
              <div
                className="h-full min-w-[3px] rounded-[4px] bg-foreground/30"
                style={{ width: `${pctItems.toFixed(2)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Buscador + filtro por familia, dentro del cuadro */}
      <div className="flex gap-1.5 px-[13px] pb-2.5 pt-2.5" style={{ borderTop: `1px solid ${h}2e` }}>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5">
          <Search size={12} className="shrink-0 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar en ${LETRA[clave]}…`}
            className="w-full min-w-0 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        {familias.length > 0 && (
          <select
            value={familiaSel}
            onChange={(e) => setFamiliaSel(e.target.value)}
            aria-label="Filtrar por familia"
            className="max-w-[104px] shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-foreground focus:outline-none"
          >
            <option value="">Familia</option>
            {familias.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        {hayFiltro && (
          <button
            type="button"
            onClick={limpiarFiltro}
            title="Borrar filtro"
            aria-label="Borrar filtro"
            className="grid shrink-0 place-items-center rounded-lg border border-border bg-background px-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="flex-1" style={{ borderTop: `1px solid ${h}2e` }}>
        <div className="max-h-[250px] overflow-y-auto">
          {filtrados.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              {hayFiltro ? "Ningún artículo coincide con la búsqueda." : "Ningún artículo cae en esta clase."}
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th
                    className="sticky top-0 z-[2] w-6 px-2 py-2"
                    style={{ background: "hsl(var(--muted))", borderBottom: `1px solid ${h}2e` }}
                    aria-label="Seleccionar"
                  />
                  <th
                    className="sticky top-0 z-[2] px-3 py-2 text-left font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    style={{ background: "hsl(var(--muted))", borderBottom: `1px solid ${h}2e` }}
                  >
                    Artículo
                  </th>
                  <th
                    className="sticky top-0 z-[2] px-3 py-2 text-right font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    style={{ background: "hsl(var(--muted))", borderBottom: `1px solid ${h}2e` }}
                  >
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((art) => {
                  const marcado = seleccion.has(art.codigo);
                  return (
                  <tr
                    key={art.codigo}
                    onClick={() => toggle(art.codigo)}
                    className="cursor-pointer border-b border-border/60 last:border-0 transition-colors hover:bg-foreground/[0.04]"
                    style={marcado ? { background: `${h}1f` } : undefined}
                  >
                    <td className="px-2 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => toggle(art.codigo)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Seleccionar ${art.codigo}`}
                        className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-current"
                        style={{ accentColor: h }}
                      />
                    </td>
                    <td className="max-w-px px-3 py-2 align-top">
                      <span className="block font-mono text-[11px] text-muted-foreground">{art.codigo}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground" title={art.descripcion}>
                        {art.descripcion}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top">
                      <span className="font-mono text-[11.5px] font-semibold" style={{ color: h }}>
                        {pesos(art.valor)}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                        {miles(art.stockSap)}
                        {art.unidadMedida ? ` ${art.unidadMedida}` : ""}
                      </span>
                    </td>
                  </tr>
                  );
                })}
                {restantes > 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-center text-[11.5px] text-muted-foreground">
                      y {miles(restantes)} artículo{restantes === 1 ? "" : "s"} más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Total de lo seleccionado: cuánta plata representan las filas tildadas. */}
        {seleccion.size > 0 && (
          <div
            className="flex items-center justify-between gap-2 px-3 py-2.5"
            style={{ borderTop: `1px solid ${h}2e`, background: `${h}14` }}
          >
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
              {seleccion.size} seleccionado{seleccion.size === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[13px] font-bold tabular-nums" style={{ color: h }}>
                {pesos(valorSeleccion)}
              </span>
              <button
                type="button"
                onClick={() => setSeleccion(new Set())}
                title="Limpiar selección"
                aria-label="Limpiar selección"
                className="grid place-items-center rounded-md border border-border px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TableroABC({ articulos, tituloAgencia }: Props) {
  const [criterio, setCriterio] = useState<CriterioABC>("montos");

  // Ordenado de mayor a menor una sola vez: lo necesitan los dos criterios
  // (el acumulado por definición, y el de montos para que cada columna
  // muestre primero lo más caro).
  const ordenados = useMemo(
    () => [...articulos].sort((x, y) => y.valor - x.valor),
    [articulos]
  );

  const grupos = useMemo(
    () => (criterio === "montos" ? clasificarPorMontos(ordenados) : clasificarPorAcumulado(ordenados)),
    [ordenados, criterio]
  );

  const totalValor = useMemo(() => ordenados.reduce((s, a) => s + a.valor, 0), [ordenados]);
  const totalItems = ordenados.length;

  return (
    <Card className="overflow-hidden border-[1.5px] border-border bg-card text-card-foreground">
      <CardContent className="relative p-5">
        <div className="relative mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-hud text-[17px] font-semibold tracking-[0.02em]">
              Clasificación ABC — {tituloAgencia}
            </p>
            <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
              por valor en stock · precio unitario × stock SAP
            </p>
          </div>

          <div className="flex items-end gap-5">
            {/*
              El criterio se elige acá y no se fija en el código: los montos
              se explican en una frase pero se corren solos si suben los
              precios; el acumulado nunca se desbalancea pero los cortes
              dejan de ser números redondos. Cuál sirve depende de para qué
              se esté mirando, así que se puede cambiar y comparar.
            */}
            <div className="flex rounded-lg border border-border p-0.5">
              {([
                ["montos", "Montos fijos"],
                ["acumulado", "80/15/5"],
              ] as [CriterioABC, string][]).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setCriterio(valor)}
                  aria-pressed={criterio === valor}
                  className={cn(
                    "rounded-[6px] px-2.5 py-1 font-mono text-[10.5px] transition-colors duration-quick",
                    criterio === valor ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <div className="text-right">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                Valor total del catálogo
              </p>
              <p className="font-hud text-[26px] font-bold leading-none tabular-nums text-foreground">
                {pesos(totalValor)}
              </p>
            </div>
          </div>
        </div>

        {totalValor === 0 ? (
          <p className="relative py-10 text-center text-sm text-muted-foreground">
            Sin importes para clasificar — cargá precios unitarios en el catálogo.
          </p>
        ) : (
          <div className="relative grid gap-3.5 md:grid-cols-3">
            {(["a", "b", "c"] as Clave[]).map((clave) => (
              <Columna
                key={clave}
                clave={clave}
                articulos={grupos[clave]}
                totalValor={totalValor}
                totalItems={totalItems}
                rango={rangoTexto(clave, criterio, grupos)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
