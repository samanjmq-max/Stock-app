# Design System Master — StockApp (SAMAN)

> **LÓGICA:** al construir una pantalla específica, mirar primero
> `design-system/stockapp-saman/pages/[pantalla].md`. Si ese archivo existe,
> sus reglas **sobreescriben** este documento. Si no, seguir lo de acá.

---

**Producto:** StockApp SAMAN — PWA de conteo de inventario para logística arrocera (Uruguay)
**Dirección:** "Turno noche en el depósito"
**Versión:** 3 — 12 de septiembre de 2026
**Reemplaza a:** "Depósito v2" (10 set 2026)

---

## 0. Por qué se reescribió este documento

La versión anterior dejó de describir el producto. Prohibía explícitamente
gradientes, sombras marcadas y glassmorphism, y fijaba el dial de motion en
3/10 — mientras el código ya tenía glow en botones, un filtro SVG tipo
metaball en el tab bar, y un login con video, vidrio esmerilado y tilt 3D.

Un documento de diseño que contradice al producto es peor que no tener
documento: cada sesión de implementación decide por su cuenta a cuál de los
dos hacerle caso. Esta versión describe lo que la app es y hacia dónde va.

**Lo que se conserva de la versión anterior**, porque estaba bien y sigue
estándolo: la arquitectura de tokens HSL estilo shadcn (mismos nombres de
variable), el `--radius` de 0.75rem, `darkMode` por clase, `lucide-react`
como única familia de íconos, Inter como cara de interfaz, y —sobre todo— el
principio de que en un conteo físico **el color ES la información**.

---

## 1. La idea

StockApp no es "una app de logística". Es **la cabina desde la que se maneja
el movimiento del arroz**: un tablero oscuro donde los números brillan porque
son la única fuente de luz.

El campo y el grano no entran como decoración —ni espigas ni fotos de
arrozales en cada pantalla— sino como **temperatura**: todos los neutros
tiran a tierra (matices 18–32°), nunca a azul. Es lo que separa esta app de
cualquier plantilla de SaaS, y se sostiene sin que haga falta un solo
elemento ilustrativo.

### Tres reglas que gobiernan todo

1. **La luz es información.** En un tablero oscuro, lo que brilla es lo que
   importa. El glow se reserva para la acción primaria de cada pantalla y
   para el estado que requiere atención. Si todo brilla, no brilla nada.

2. **El color sigue siendo el dato.** El semáforo coincide / sobra / falta no
   se suaviza, no se pastelea y no se cambia por tonos de moda. Un operario
   con guantes y media luz tiene que distinguirlos de un vistazo. Siempre
   acompañado de ícono y texto, nunca solo color.

3. **Una cara para hablar, otra para contar.** Los números —stock,
   diferencias, importes, códigos— llevan ancho fijo y nunca bailan al
   actualizarse.

### Modo oscuro como identidad

El oscuro deja de ser un modo alternativo y pasa a ser el diseño principal.
El claro sigue existiendo, bien resuelto, para quien trabaja en oficina con
ventanal — pero es la traducción, no el original.

---

## 2. Color

Formato HSL en triples `H S% L%`, listo para `:root` / `.dark` en
`globals.css`. Los cinco colores de estado comparten matiz entre los dos
modos; cambian luminosidad y saturación.

### 2.1 Superficies — tres capas reales

La capa que faltaba en la versión anterior, donde el oscuro era una inversión
mecánica del claro. Sin capas no hay profundidad posible.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--background` | `38 30% 97%` | `20 25% 5%` | Suelo de la app |
| `--card` | `0 0% 100%` | `18 18% 8%` | Tarjetas, barras, paneles |
| `--elevated` | `0 0% 100%` | `20 22% 11%` | Modales, dropdowns, hover de fila |
| `--popover` | `0 0% 100%` | `20 22% 11%` | Popovers y menús |
| `--secondary` | `38 22% 93%` | `20 22% 11%` | Superficies y botones secundarios |
| `--muted` | `38 20% 94%` | `20 20% 13%` | Fondos discretos, filas alternadas |
| `--border` | `34 22% 88%` | `22 24% 15%` | Bordes y separadores |
| `--input` | `34 22% 85%` | `22 24% 18%` | Borde de campos |

### 2.2 Texto

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--foreground` | `20 25% 12%` | `32 46% 93%` | Cifras y títulos. Blanco cálido, nunca puro |
| `--muted-foreground` | `30 14% 42%` | `29 18% 60%` | Descripciones, etiquetas, metadatos |

### 2.3 Marca y estado

| Token | Claro | Oscuro | Significado |
|---|---|---|---|
| `--primary` | `21 72% 36%` | `21 71% 57%` | Terracota. Marca, acción primaria, ítem activo |
| `--success` | `112 45% 30%` | `112 34% 55%` | Grano. Coincide, avance |
| `--warning` | `40 85% 42%` | `40 78% 61%` | Dorado. Sobra, alertas |
| `--destructive` | `4 70% 47%` | `4 72% 59%` | Falta, destructivo, error |
| `--info` | `208 45% 42%` | `208 43% 60%` | Señal. Sincronización, info neutra |
| `--accent` | `112 40% 94%` | `112 25% 14%` | Chips y tabs activos, tinte verde |
| `--ring` | `= primary` | `= primary` | Foco de teclado |

En oscuro los colores van más claros y **menos saturados**: sobre fondo
oscuro un color saturado vibra y cansa la vista en una jornada larga.

`--info` es el único color frío del sistema, y por eso mismo se lee como
"del sistema" y no como estado del conteo.

**Contraste marca vs. error:** `--primary` (21°) y `--destructive` (4°) están
a 17° de matiz. Para que un botón primario nunca se lea como peligro, el
primario es más oscuro y menos saturado en claro, y las acciones destructivas
llevan **siempre** ícono más verbo explícito.

### 2.4 Semáforo del conteo — patrón de dominio

| Estado | Token | Ícono | Texto obligatorio |
|---|---|---|---|
| Coincide | `--success` | `CheckCircle2` | "Coincide" |
| Sobra | `--warning` | `ArrowUpCircle` | "Sobra (+N)" |
| Falta | `--destructive` | `ArrowDownCircle` | "Falta (−N)" |
| Pendiente de sync | `--info` | `RefreshCw` girando | "Pendiente de sincronizar" |

---

## 3. Tipografía

Tres roles, tres caras. Se cargan por `next/font` en `src/app/layout.tsx`, o
sea que se sirven desde el propio dominio — importa para una PWA que tiene
que arrancar con señal mala.

| Rol | Cara | Variable | Dónde |
|---|---|---|---|
| Display | **Archivo** 500/600/700 | `--font-display` | Títulos de pantalla y de card, cifras grandes de KPI |
| Interfaz | **Inter** | `--font-sans` | Cuerpo, formularios, botones, tablas, navegación |
| Datos | **JetBrains Mono** | `--font-mono` | Códigos SKU, ubicaciones, timestamps, etiquetas overline |

Archivo es una grotesca industrial, emparentada con la cartelería de
depósito: es lo que le da carácter propio a la app. Inter se queda donde es
imbatible, que es la interfaz.

### Escala

| Token | Tamaño | Peso | Uso |
|---|---|---|---|
| display-xl | 38–56px | 700 | Cifra protagonista del Dashboard |
| display | 28–34px | 600 | Título de pantalla |
| kpi | 26px | 600 | Cifra de tarjeta de KPI |
| heading | 16–20px | 600 | Título de sección o de card |
| body | 15px | 400 | Cuerpo general |
| body-input | 16px | 400 | Campos de formulario. **Nunca menos**: evita el zoom de iOS |
| label | 13px | 500 | Etiquetas de campo |
| caption | 11.5px | 500 | Metadatos y ayudas |
| overline | 10.5px | 500 | Mono, mayúsculas, tracking .13em |

Nada de tamaños sueltos fuera de esta escala. Si hace falta uno nuevo, se
agrega acá primero.

**Cifras tabulares siempre** en columnas numéricas, KPI y tablas: una tabla
que salta de ancho cada vez que sincroniza se lee mal y se ve barata. La
regla ya está global en `globals.css` para `.font-mono` y `[data-numeric]`.

---

## 4. Espacio y forma

| Grupo | Valores | Criterio |
|---|---|---|
| Espaciado | 4 · 8 · 12 · 16 · 24 · 32 · 48 | Escala fija, nada fuera de la lista |
| Radio | 6 / 10 / 14 / 20 / 9999 | Chip · input y botón · card · modal y FAB · píldora |
| Íconos | 16 · 20 · 24 | Inline · estándar · acción primaria y FAB |

### Elevación

Cuatro niveles, no uno estampado en todo.

| Nivel | Valor | Uso |
|---|---|---|
| 0 | Sin sombra, solo borde | Card en reposo. La superficie ya la separa del fondo |
| `--elev-1` | `0 2px 8px hsl(0 0% 0% / .4)` | Card interactiva en hover |
| `--elev-2` | `0 12px 28px hsl(0 0% 0% / .55)` | Dropdown, popover |
| `--elev-3` | `0 24px 60px hsl(0 0% 0% / .7)` | Modal, sheet |

(Valores del modo oscuro; en claro son más suaves y cálidos.)

**Glow:** `0 0 0 1px primary/.35, 0 10px 26px -12px primary/.85`. Solo en la
acción primaria, la destructiva y el foco. Nunca como animación ambiente.

---

## 5. Motion

Una sola tabla para toda la app. Antes cada animación elegía su propia
duración entre Framer Motion, keyframes CSS y `tailwindcss-animate`.

| Token | Duración | Curva | Para |
|---|---|---|---|
| instant | 100ms | ease-out | Color de hover, foco |
| quick | 160ms | ease-out | Presión de botón, chips, tooltips |
| base | 240ms | `cubic-bezier(.2,.8,.2,1)` | Cards, acordeones, cambio de tab |
| enter | 280ms | `cubic-bezier(.34,1.4,.64,1)` | Modales, sheets, escáner a producto |
| exit | 180ms | ease-in | Todo lo que se va. Siempre más rápido que al entrar |
| count | 600ms | ease-out | Números que suben al cargar el Dashboard |

Disponibles como `duration-quick`, `ease-out-soft`, `ease-spring` en Tailwind,
y como `--dur-*` / `--ease-*` en CSS.

### Reglas

- **Un elemento animado por vista.** Nada de animar la lista entera al cargar.
- **Motion con propósito:** orientar, confirmar, anticipar, mostrar estado o
  progreso. Nunca decorativo.
- **Sin loops ambiente**, con una sola excepción: el login (`wheat-sway`,
  `btn-shiny`), que es la única pantalla sin una tarea en curso que
  interrumpir.
- **`prefers-reduced-motion` siempre.** La regla global de `globals.css` ya
  neutraliza duraciones; los componentes con Framer Motion usan además
  `useReducedMotion()`.

---

## 6. Botones

Cuatro niveles de peso. La regla: **una sola acción primaria por pantalla**.

| Nivel | Variants | Tratamiento |
|---|---|---|
| 1 | `default`, `success` | Fondo sólido, glow. Una por pantalla |
| 2 | `outline`, `destructive` | Contorno. Destructiva se rellena al hover |
| 3 | `secondary`, `ghost` | Sin borde. Acciones de fila y de barra |
| 4 | `link` | Navegación dentro de un texto |

`destructive-solid` existe aparte, y se usa **solo** en la confirmación final
dentro de un diálogo: ahí ya no compite con nada y el usuario decidió
avanzar. Un botón rojo sólido permanente en pantalla enseña a ignorar el
rojo, que es justo el color que no queremos que nadie ignore.

### Tamaños

| Size | Altura | Uso |
|---|---|---|
| `sm` | 36px | Acciones de barra y de fila |
| `default` | 44px | Estándar. Objetivo táctil mínimo |
| `lg` | 48px | Flujo de Conteo, donde se opera con guantes |
| `icon` | 44×44 | Botón de solo ícono |
| `icon-sm` | 36×36 | Ícono en fila de tabla |
| `fab` | 56×56 | Acción central del tab bar |

### Estado de carga

Usar la prop `loading` del `Button`, no un `<Loader2>` improvisado en cada
pantalla. El botón **mantiene su texto y su ancho** mientras trabaja, y
cuando hay progreso real lo dice ("Importando 3.000 de 10.826"). Reemplazar
el texto por una ruedita muda es lo que dejó la app aparentemente colgada
durante la importación de Lascano.

### Accesibilidad

Objetivo táctil mínimo 44px (48px en Conteo). Foco visible siempre: anillo de
2px en `--ring` más 2px de separación. Todo botón asíncrono se deshabilita
mientras corre. Ninguna acción se comunica solo por color.

---

## 7. Navegación

### Móvil — tab bar con acción central

**Contar sale de la fila de tabs** y pasa a botón central de 56px. La app
existe para contar y esa acción pesaba exactamente lo mismo que "Productos".

Los tabs se reparten a los lados: la mitad a la izquierda, la mitad a la
derecha. Así la barra queda equilibrada tanto para un administrador (cuatro
tabs) como para un operario (dos), sin el hueco que dejaban antes los ítems
solo-admin.

**El activo se marca con una barra de luz** de 2.5px sobre el borde superior,
del ancho del ícono, con halo. Reemplaza a la gota líquida con filtro SVG:
el óvalo se montaba sobre la etiqueta y tapaba el texto del tab. En una app
que se usa con guantes y a media luz, leer el nombre del tab gana sobre el
efecto.

Historial y Usuarios siguen siendo solo-admin porque el middleware los
restringe de verdad (`RUTAS_SOLO_ADMIN`): mostrárselos a un operario le daría
un link que lo rebota.

### Escritorio — sidebar agrupado y colapsable

Los siete ítems se agrupan en dos bloques separados por un filete:
**Operación** (Dashboard, Contar, Productos) y **Administración** (Etiquetas,
Historial, Usuarios, Configuración). Antes eran una lista plana donde "Contar
stock" y "Configuración" pesaban lo mismo.

Se puede colapsar a 68px mostrando solo íconos, con la preferencia recordada
en `localStorage`.

El indicador activo es el mismo lenguaje de luz que en móvil, pero como
resaltado de fila completa: el contenedor es una fila con ícono y texto, no
un ícono suelto. Mismo significado, forma distinta según el contenedor.

---

## 8. Dashboard

Cuatro niveles de jerarquía, en vez de ocho tarjetas iguales compitiendo.

| Nivel | Qué | Por qué ahí |
|---|---|---|
| 1 · Protagonista | Avance del conteo: porcentaje grande, barra, absolutos | Es la pregunta que todos traen al abrir |
| 2 · Alerta | Solo si hay diferencias negativas sin revisar | Responde "¿hay problemas?" sin buscarlo. Si no hay, el bloque no existe |
| 3 · Estado | Coincidencias, faltantes, sobrantes, pendientes | Cuatro tarjetas del mismo tipo de dato. El importe baja a metadato |
| 4 · Análisis | Gráficos, tablas, exportaciones, acciones de admin | Debajo del pliegue. Quien los necesita, los busca |

Salieron "Productos totales" (es el denominador de la barra), "Contados" (el
numerador), "Avance" (la cifra protagonista) y "Última sincronización" (ya
vive en el topbar). **Cuatro tarjetas menos sin perder un solo dato.**

Todos los filtros se conservan: los cuatro estados en las tarjetas, y
"contados" pasa a ser el contador clickeable dentro de la barra de avance.

### Gráficos

Leyenda visible, tooltip tematizado con los tokens, paleta accesible (nunca
rojo/verde puro como única diferenciación), y **estado vacío explícito**
("Todavía no hay conteos") en vez de un gráfico en blanco. Los colores salen
de los tokens, nunca hex sueltos en el componente.

---

## 9. Interacción táctil

Contexto: operarios de depósito, a veces con guantes, escaneando con cámara o
lector Bluetooth mientras sostienen el producto.

- Objetivo táctil mínimo **44px**, y **48px** en el flujo de Conteo.
- Separación entre targets ≥8px, ≥12px en Conteo.
- Todo botón async muestra estado de carga y se deshabilita. Nunca doble envío.
- Triple confirmación en cada escaneo: sonido, vibración y texto.
- El estado de conexión y sincronización es UI de primera clase, siempre
  visible en el topbar. Nunca un ícono solo cuando hay pendientes: va con el
  número.

---

## 10. Responsive

| Ancho | Dispositivo | Qué define |
|---|---|---|
| 390px | Teléfono | **Referencia de diseño.** Tab bar con FAB, tarjetas apiladas |
| 768px | Tablet | Dispositivo de depósito. Dos columnas, fila híbrida en Productos |
| 1024px | Escritorio | Aparece el sidebar, desaparece la tab bar. Tablas completas |
| 1440px | Escritorio grande | Contenido tope a 1400px centrado. Nada se estira |

El teléfono no es "la versión chica": es el dispositivo principal.

Reglas que no se negocian: nunca scroll horizontal en la página —solo dentro
de una tabla, en su propio contenedor—; `min-h-dvh` en vez de `100vh`;
padding reservado para la tab bar fija y el área segura; inputs en 16px.

---

## 11. Anti-patrones

- ❌ Más de una acción primaria por pantalla.
- ❌ Glow o brillo en botones secundarios. La luz es información.
- ❌ Loops de animación ambiente fuera del login.
- ❌ Semáforo de estado solo por color, sin ícono ni texto.
- ❌ Colores pastel para los estados del conteo.
- ❌ Hex sueltos en componentes. Todo color sale de un token.
- ❌ Tamaños de fuente fuera de la escala de §3.
- ❌ Emoji como ícono estructural.
- ❌ Segunda librería de íconos. Solo `lucide-react`.
- ❌ Neutros fríos o azulados. Todos los grises tiran a tierra.
- ❌ Objetivos táctiles por debajo de 44px (48px en Conteo).
- ❌ Ocultar el estado de conexión o de sincronización.
- ❌ Botones async sin estado de carga, o que se queden mudos mientras trabajan.

---

## 12. Checklist de pre-entrega

- [ ] Una sola acción primaria por pantalla
- [ ] Todo color vía token, en los dos modos
- [ ] Contraste 4.5:1 verificado en claro y oscuro con los hex reales
- [ ] Los tres estados del conteo con ícono más texto
- [ ] Cifras tabulares en toda columna numérica
- [ ] Tamaños de fuente dentro de la escala
- [ ] Motion entre 100 y 280ms, con propósito, `prefers-reduced-motion` respetado
- [ ] Un elemento animado por vista
- [ ] Objetivos táctiles ≥44px (≥48px en Conteo), separación ≥8px
- [ ] Estado de conexión y sync visible
- [ ] Responsive verificado en 390 / 768 / 1024 / 1440px, sin scroll horizontal
- [ ] Acciones destructivas con confirmación, ícono y verbo explícito
- [ ] Estados vacíos escritos, nunca un bloque en blanco

---

## 13. Estado de implementación

| Fase | Alcance | Estado |
|---|---|---|
| 1 | Tokens, superficies, elevación, motion, tipografía, este documento | Aplicada |
| 2 | Sistema de botones, CardTitle, jerarquía en Productos | Aplicada |
| 3 | Tab bar con FAB, sidebar agrupado y colapsable, jerarquía del Dashboard | Aplicada |
| 4 | Escáner: siete estados, haptics, transición marco → ficha | Aplicada |
| 5 | Paginado del catálogo para 12.400+ ítems | Aplicada |

Sobre la fase 4: el marco del escáner ES el indicador de estado. Las dos
animaciones que duran en el tiempo viven en `globals.css`
(`.escaneo-barrido` para "buscando", `.escaneo-pulso` para "consultando");
los otros cinco estados son transiciones de color. El componente no sabe
nada de SAP: recibe una función `onResolver` que le contesta qué es el
código, y si no se le pasa ninguna se comporta como antes (lee y cierra).
Ese límite es lo que lo mantiene reutilizable desde cualquier pantalla.

Sobre la fase 5: se eligió paginado y no virtualización porque virtualizar
implica una dependencia nueva, y el problema real era poder **llegar** a
cualquier artículo — el orden por columna trabaja sobre todo el catálogo
filtrado, no sobre la página visible, así que ordenar por importe muestra
los artículos más caros del depósito y no los más caros de los primeros
300. La selección por casilla se limpia al cambiar de página: si no, un
"Eliminar seleccionados (300)" borraría filas que ya no están en pantalla.
