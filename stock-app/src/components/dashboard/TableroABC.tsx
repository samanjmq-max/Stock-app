"use client";

import { useMemo, useState } from "react";
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

  Y por eso NO usa los tokens de tema (`text-[#f2f4f7]`,
  `text-[#9aa3b2]`, `border-[#32302c]`): todos los colores de texto están
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

const TONOS: Record<Clave, string> = {
  a: "#ffc93c", // oro
  b: "#2fd0e8", // cian
  c: "#a78bfa", // violeta
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
  const valor = articulos.reduce((s, a) => s + a.valor, 0);
  const pctValor = totalValor > 0 ? (valor / totalValor) * 100 : 0;
  const pctItems = totalItems > 0 ? (articulos.length / totalItems) * 100 : 0;

  // Solo se dibujan las primeras filas: la clase C puede tener doce mil
  // artículos y montar doce mil <tr> congelaría el dashboard en un celular
  // de depósito. El resto se resume en el pie.
  const VISIBLES = 40;
  const visibles = articulos.slice(0, VISIBLES);
  const restantes = articulos.length - visibles.length;

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-xl"
      /* Fondo casi neutro y no marrón: era cálido de cuando las tres columnas
         eran doradas, y contra el cian y el violeta ensuciaba el tono. El
         color de cada columna lo pone el resplandor de abajo, no la base. */
      style={{ background: "#100f11", border: `1px solid ${h}3d` }}
    >
      {/* Filete superior: el gesto que convierte la tarjeta en instrumento. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${h}, transparent)` }}
      />

      <div className="relative overflow-hidden p-[15px] pb-[15px]">
        {/* Resplandor: sube desde la esquina, difuminado, sin bordes. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-[60px] -top-[100px] h-[200px] w-[200px] rounded-full opacity-30 blur-[46px]"
          style={{ background: h }}
        />

        <div className="relative flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-[9px] font-hud text-[17px] font-bold leading-none"
            style={{
              color: h,
              background: `${h}29`,
              border: `1px solid ${h}85`,
              boxShadow: `0 0 15px -2px ${h}99, inset 0 0 10px -4px ${h}bf`,
            }}
          >
            {LETRA[clave]}
          </span>
          <span className="font-mono text-[10.5px] text-[#9aa3b2]">{rango}</span>
        </div>

        <p
          className="relative mt-3 font-hud text-[44px] font-bold leading-none tabular-nums"
          style={{ color: h, textShadow: `0 0 28px ${h}7a` }}
        >
          {porcentaje(valor, totalValor)}
          <span className="ml-0.5 text-[19px] font-semibold opacity-70">%</span>
        </p>
        <p className="relative mt-px text-[11.5px] text-[#9aa3b2]">del valor total en stock</p>

        {/*
          Las dos barras. El riel entero es SIEMPRE el total -- los dos
          rieles de las tres columnas miden lo mismo -- así que el relleno
          se compara sin hacer cuentas.
        */}
        <div className="relative mt-3.5 flex flex-col gap-[11px]">
          <div>
            <div className="mb-[5px] flex items-baseline justify-between gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#9aa3b2]">Plata</span>
              <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-[#9aa3b2]">
                <b className="font-semibold" style={{ color: h }}>{pesos(valor)}</b> de {pesos(totalValor)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-[4px] bg-white/[0.06]">
              <div
                className="relative h-full min-w-[3px] rounded-[4px]"
                style={{
                  width: `${pctValor.toFixed(2)}%`,
                  background: `linear-gradient(90deg, ${h}57, ${h})`,
                  boxShadow: `0 0 13px -1px ${h}c7`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="mb-[5px] flex items-baseline justify-between gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#9aa3b2]">Artículos</span>
              <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-[#9aa3b2]">
                <b className="font-semibold text-[#f2f4f7]">{miles(articulos.length)}</b> de {miles(totalItems)}
              </span>
            </div>
            {/* Gris y no dorada: es el contrapeso, no el protagonista. */}
            <div className="h-1.5 overflow-hidden rounded-[4px] bg-white/[0.06]">
              <div
                className="h-full min-w-[3px] rounded-[4px] bg-white/25"
                style={{ width: `${pctItems.toFixed(2)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1" style={{ borderTop: `1px solid ${h}2e` }}>
        <div className="max-h-[230px] overflow-y-auto">
          {articulos.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-[#9aa3b2]">
              Ningún artículo cae en esta clase.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th
                    className="sticky top-0 z-[2] px-3 py-2 text-left font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-[#9aa3b2]"
                    style={{ background: "#100f11", borderBottom: `1px solid ${h}2e` }}
                  >
                    Artículo
                  </th>
                  <th
                    className="sticky top-0 z-[2] px-3 py-2 text-right font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-[#9aa3b2]"
                    style={{ background: "#100f11", borderBottom: `1px solid ${h}2e` }}
                  >
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((art) => (
                  <tr key={art.codigo} className="border-b border-white/[0.04] last:border-0">
                    <td className="max-w-px px-3 py-2 align-top">
                      <span className="block font-mono text-[11px] text-[#9aa3b2]">{art.codigo}</span>
                      <span className="block truncate text-[11.5px] text-[#9aa3b2]" title={art.descripcion}>
                        {art.descripcion}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top">
                      <span className="font-mono text-[11.5px] font-semibold" style={{ color: h }}>
                        {pesos(art.valor)}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] text-[#9aa3b2]">
                        {miles(art.stockSap)}
                        {art.unidadMedida ? ` ${art.unidadMedida}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
                {restantes > 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-2.5 text-center text-[11.5px] text-[#9aa3b2]">
                      y {miles(restantes)} artículo{restantes === 1 ? "" : "s"} más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
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
    <Card
      className="overflow-hidden border-[1.5px]"
      /* `color` explícito: la Card de shadcn trae `text-card-foreground`, que
         en modo día es tinta oscura. Sin esto, todo lo que no declara su
         propio color -- el título, por ejemplo -- se pierde contra el fondo. */
      style={{ background: "#0d0a05", borderColor: "#2b2110", color: "#f2f4f7" }}
    >
      <CardContent className="relative p-5">
        {/* Rejilla tenue: profundidad sin competir con nada. Se desvanece
            hacia abajo para no ensuciar las tarjetas. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(#ffd24a0d 1px, transparent 1px), linear-gradient(90deg, #ffd24a0d 1px, transparent 1px)",
            backgroundSize: "46px 46px",
            maskImage: "radial-gradient(130% 95% at 50% 0%, #000 0%, transparent 74%)",
            WebkitMaskImage: "radial-gradient(130% 95% at 50% 0%, #000 0%, transparent 74%)",
          }}
        />

        <div className="relative mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-hud text-[17px] font-semibold tracking-[0.02em]">
              Clasificación ABC — {tituloAgencia}
            </p>
            <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#9aa3b2]">
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
            <div className="flex rounded-lg border border-[#32302c] p-0.5">
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
                    criterio === valor ? "bg-white/10 text-[#f2f4f7]" : "text-[#9aa3b2] hover:text-[#f2f4f7]"
                  )}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <div className="text-right">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#9aa3b2]">
                Valor total del catálogo
              </p>
              <p className="font-hud text-[26px] font-bold leading-none tabular-nums text-[#f2f4f7]">
                {pesos(totalValor)}
              </p>
            </div>
          </div>
        </div>

        {totalValor === 0 ? (
          <p className="relative py-10 text-center text-sm text-[#9aa3b2]">
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
