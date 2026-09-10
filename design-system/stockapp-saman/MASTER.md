# Design System Master File — StockApp (SAMAN)

> **LOGIC:** When building a specific page, first check `design-system/stockapp-saman/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** StockApp SAMAN — PWA de conteo de inventario para logística arrocera (Uruguay)
**Industry:** Logística y distribución de arroz (campo, producción, industria, almacenes, distribución)
**Generated:** 2026-09-10
**Design Dials:** Variance 4/10 (Balanced/Modern) · Motion 3/10 (Subtle) · Density 5/10 (Standard)
**Status:** Documento de diseño únicamente. Ningún archivo de la aplicación fue modificado para producir esto.

---

## 0. Relación con el sistema actual — "Depósito v2" (evolución cálida)

El repo ya tiene un design system implementado y documentado en `src/app/globals.css` / `tailwind.config.ts`: el sistema **"Depósito"**, con arquitectura de tokens HSL estilo shadcn (`--background`, `--primary`, `--success`, etc.), `darkMode: ["class"]`, radius `0.75rem`, tipografía Inter, y semáforos de estado (`success`/`warning`/`destructive`) ya cableados en componentes reales — con este comentario explícito en el código:

> *"...semáforos de estado nítidos (verde esmeralda / ámbar / rojo) porque en un conteo físico el color ES la información (coincide / sobra / falta)."*

Ese principio es correcto y se conserva intacto. Lo que este documento cambia es la **temperatura de marca**: de azul cobalto frío a una paleta cálida inspirada en el arroz y la cosecha (terracota/siena + verde grano + dorado), pedida explícitamente para este proyecto. Se decidió (con el usuario) que sea una **evolución de bajo riesgo**, no una reinvención:

- Misma arquitectura de tokens (mismos nombres de variable, mismo shape HSL `H S% L%`).
- Mismo `--radius` (0.75rem), misma familia tipográfica (Inter + JetBrains Mono), mismas keyframes de motion.
- Mismo modo oscuro basado en clase, misma librería de iconos (`lucide-react`, ya instalada — **no** se introduce Phosphor aunque sea la recomendación por defecto del skill, para no duplicar sistema de íconos).
- Solo cambian los **valores numéricos** de color. Migrar es swap-and-check-contrast, no reescritura de componentes.

Cuando se aplique (fuera del alcance de esta tarea), el cambio se limita a `globals.css` (bloques `:root` y `.dark`) — cero cambios de lógica de negocio o de props de componentes.

---

## 1. Principios de diseño

1. **Cálido y profesional, no decorativo.** "Vida con propósito": cada color, sombra y transición comunica algo (estado, jerarquía, foco). Nada se anima porque sí.
2. **El color ES información.** Los tres estados de conteo (coincide / sobra / falta) siempre van acompañados de ícono + texto, nunca solo color (regla `color-not-only`, crítica en `ux-guidelines`).
3. **Diseño para manos ocupadas y guantes.** Los operarios escanean códigos, sostienen productos y a veces usan guantes en depósito/campo. Los objetivos táctiles del flujo de conteo son más grandes que el mínimo web estándar (ver §7).
4. **Offline-first se ve, no se oculta.** El estado de conexión/sincronización es un elemento de UI de primera clase, no un detalle técnico escondido en una esquina.
5. **Densidad media, sin saturar.** Dashboards y tablas (historial, productos) pueden ser densos; el flujo de conteo en sí debe quedar despejado — es la pantalla de mayor uso y de mayor costo de error.
6. **Motion bajo-moderado.** Transiciones que confirman una acción (guardado, sync, error), no efectos de "wow". Nada de scroll-jacking ni animaciones de entrada complejas.

---

## 2. Paleta de color — "Depósito v2" (evolución cálida)

Formato: HSL en triples `H S% L%`, listo para pegar en `:root` / `.dark` de `globals.css` (mismo formato que hoy).

### 2.1 Modo claro

| Token | Valor actual (frío) | Valor nuevo (cálido) | Uso |
|---|---|---|---|
| `--background` | `210 20% 98%` | `38 30% 97%` | Fondo general — blanco cálido, tono "grano de arroz" |
| `--foreground` | `222 30% 11%` | `20 25% 12%` | Texto principal — casi-negro cálido, no azulado |
| `--card` | `0 0% 100%` | `0 0% 100%` | Sin cambio |
| `--card-foreground` | `222 30% 11%` | `20 25% 12%` | = foreground |
| `--popover` / `--popover-foreground` | — | `0 0% 100%` / `20 25% 12%` | Sin cambio de arquitectura |
| `--primary` | `221 83% 53%` (cobalto) | **`28 68% 33%`** (terracota/siena — "tierra cosechada") | Marca, botones primarios, links, estado activo |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | Sin cambio (contraste ya alto contra el nuevo primary, más oscuro que el azul original) |
| `--secondary` | `210 20% 94%` | `38 22% 93%` | Superficies secundarias, botones secundarios |
| `--secondary-foreground` | `222 30% 15%` | `20 25% 18%` | — |
| `--muted` | `210 20% 94%` | `38 20% 94%` | Fondos discretos, filas alternadas de tabla |
| `--muted-foreground` | `215 16% 47%` | `30 12% 42%` | Texto secundario — gris cálido, no slate |
| `--accent` | `221 83% 96%` | `142 45% 94%` | Chips/tabs activos — tinte verde suave (campo) |
| `--accent-foreground` | `221 83% 40%` | `142 60% 22%` | Texto sobre accent |
| `--destructive` | `0 72% 51%` | `0 72% 51%` | **Sin cambio** — rojo semántico universal |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 100%` | — |
| `--success` | `152 60% 36%` (verde esmeralda/teal) | **`142 60% 32%`** (verde grano/pradera, más cálido) | Conteo **coincide** |
| `--success-foreground` | `0 0% 100%` | `0 0% 100%` | — |
| `--warning` | `38 92% 50%` | `38 90% 46%` | Conteo **sobra** / alertas — ya era cálido, apenas recalibrado |
| `--warning-foreground` | `26 40% 15%` | `26 45% 14%` | — |
| `--border` | `214 20% 90%` | `34 22% 88%` | — |
| `--input` | `214 20% 88%` | `34 22% 85%` | — |
| `--ring` | `221 83% 53%` | `28 68% 33%` (= primary) | Foco de teclado |
| `--radius` | `0.75rem` | `0.75rem` | **Sin cambio** |

**Nota crítica de contraste marca-vs-error:** `--primary` (terracota, H26–28°) y `--destructive` (rojo, H0°) están a solo ~28° de distancia de matiz. Para que un botón primario nunca se lea como "peligro" a primera vista: el primary es notablemente más oscuro y menos saturado (L33% / S68%) que el rojo (L51% / S72%), y las acciones destructivas **siempre** llevan ícono (`Trash`, `AlertTriangle`) + texto explícito ("Eliminar", nunca solo color) — regla ya exigida en §6 y §8.

### 2.2 Modo oscuro

| Token | Valor actual (frío) | Valor nuevo (cálido) |
|---|---|---|
| `--background` | `222 30% 7%` | `20 18% 8%` |
| `--foreground` | `210 20% 96%` | `38 25% 94%` |
| `--card` / `--popover` | `222 26% 10%` | `20 16% 11%` |
| `--card-foreground` / `--popover-foreground` | `210 20% 96%` | `38 25% 94%` |
| `--primary` | `221 83% 60%` | `28 70% 52%` |
| `--primary-foreground` | `222 30% 8%` | `20 25% 10%` |
| `--secondary` | `222 20% 15%` | `22 14% 16%` |
| `--secondary-foreground` | `210 20% 92%` | `38 20% 90%` |
| `--muted` | `222 20% 15%` | `22 14% 16%` |
| `--muted-foreground` | `215 16% 60%` | `30 10% 62%` |
| `--accent` | `221 40% 18%` | `142 30% 16%` |
| `--accent-foreground` | `221 83% 75%` | `142 55% 76%` |
| `--destructive` | `0 72% 55%` | `0 72% 55%` (sin cambio) |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--success` | `152 55% 45%` | `142 50% 46%` |
| `--success-foreground` | `152 60% 8%` | `142 60% 8%` |
| `--warning` | `38 92% 55%` | `38 88% 55%` |
| `--warning-foreground` | `26 40% 10%` | `26 40% 10%` |
| `--border` / `--input` | `222 20% 18%` | `22 14% 19%` |
| `--ring` | `221 83% 60%` | `28 70% 52%` |

Contraste verificado a nivel de tono (L%): todas las combinaciones texto/fondo mantienen o mejoran la diferencia de luminancia respecto al sistema actual (regla `color-accessible-pairs`, AA 4.5:1). Antes de aplicar, correr un chequeo de contraste real sobre los hex renderizados (no asumir por HSL nominal).

### 2.3 Semáforo de conteo (patrón de dominio — no tocar la lógica, solo el color)

| Estado | Token | Ícono (lucide-react) | Texto obligatorio |
|---|---|---|---|
| Coincide | `--success` | `CheckCircle2` | "Coincide" |
| Sobra | `--warning` | `TrendingUp` o `PlusCircle` | "Sobra (+N)" |
| Falta | `--destructive` | `TrendingDown` o `AlertCircle` | "Falta (−N)" |
| Pendiente de sync | `--muted-foreground` + ícono animado sutil | `RefreshCw` (spin discreto, respeta `prefers-reduced-motion`) | "Pendiente de sincronizar" |

---

## 3. Tipografía

**Sin cambios respecto al sistema actual** — Inter ya es cálida-neutra, profesional y de alta legibilidad; cambiarla no aportaba nada a la dirección "cálido" y sí rompía continuidad visual.

- `--font-sans` / `--font-display`: `"Inter", system-ui, sans-serif`
- `--font-mono`: `"JetBrains Mono", ui-monospace, monospace` — usar para códigos de barra, SKUs y cualquier columna numérica en tablas (`font-feature-settings: "tnum"` o clase mono) para que las cifras no salten de ancho al actualizarse (regla `number-tabular`).

### Escala tipográfica

| Rol | Tamaño | Peso | Uso |
|---|---|---|---|
| Display | 28–32px | 600–700 | Título de página (Dashboard, Conteo) |
| H1 | 24px | 600 | Encabezado de sección |
| H2 | 18–20px | 600 | Subsección, título de card |
| Body | 16px | 400 | Texto de formularios, listas — nunca menos de 16px en inputs (evita auto-zoom iOS) |
| Label | 13–14px | 500 | Labels de input, badges |
| Caption | 12px | 400–500 | Metadatos, timestamps, ayuda |

---

## 4. Espaciado (Density 5/10 — Standard)

| Token | Valor | Uso |
|---|---|---|
| `--space-xs` | `4px` | Gaps internos de ícono+texto |
| `--space-sm` | `8px` | Espaciado inline, gaps de chip |
| `--space-md` | `16px` | Padding estándar de card/input |
| `--space-lg` | `24px` | Padding de sección |
| `--space-xl` | `32px` | Separación entre bloques mayores |
| `--space-2xl` | `48px` | Márgenes de sección en desktop |

Excepción documentada por página en `pages/*.md`: Productos e Historial suben densidad en tablas (filas más compactas); Conteo baja densidad (más aire, objetivos más grandes) porque es la pantalla de mayor presión operativa.

---

## 5. Elevación y bordes (Variance 4/10 — Balanced)

Nada de sombras dramáticas ni 3D — coherente con Flat/Data-Dense. Se usan sombras muy sutiles solo para separar capas flotantes (modal, dropdown, toast), nunca en cards de contenido estático.

| Nivel | Valor | Uso |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(20,10,5,0.06)` | Cards con hover, inputs con foco |
| `--shadow-md` | `0 4px 10px rgba(20,10,5,0.08)` | Dropdowns, popovers |
| `--shadow-lg` | `0 12px 24px rgba(20,10,5,0.12)` | Modales, sheets |

Border-radius: `0.75rem` (cards, botones grandes), `0.5rem` (inputs, botones estándar), `9999px` (badges/chips de estado, avatar).

---

## 6. Motion (Motion 3/10 — Subtle)

El código actual ya está bien calibrado para este dial: `tailwindcss-animate` con `fade-in 0.2s ease-out`, `slide-up 0.3s ease-out`, accordion en `0.2s`, y un bloque `@media (prefers-reduced-motion: reduce)` global que ya fuerza duración casi nula. **Conservar tal cual**; no agregar animaciones de scroll-reveal, parallax ni choreography — quedan fuera de alcance para densidad 3.

Reglas para nuevas interacciones:

- Duración estándar: **150–250ms**, easing `ease-out` (entrada) / `ease-in` (salida). Nunca linear salvo para spinners de carga.
- Motion con propósito únicamente: confirmar guardado de conteo, transición de estado del semáforo, aparición/desaparición de toast (`sonner`, ya instalado), indicador de sync.
- 1 elemento animado por vista como máximo — nunca animar la lista completa de productos al cargar.
- Feedback de tap en botones/cards interactivas: cambio de opacidad o color, **no** `transform: scale()` que desplace layout (regla `layout-shift-avoid`).
- Respetar siempre `prefers-reduced-motion` (ya implementado globalmente — extender el mismo criterio a cualquier animación nueva vía Framer Motion, ya instalado).

---

## 7. Interacción y accesibilidad táctil

Contexto: operarios de depósito/campo, a veces con guantes, escaneando con cámara/lector Bluetooth mientras sostienen el producto.

- **Objetivo táctil mínimo:** 44×44px en general (regla estándar), mínimo **48×48px** en el flujo de Conteo específicamente (botón de confirmar cantidad, +/− de cantidad, acción de escanear) — más generoso que el mínimo por el contexto de uso con guantes.
- **Espaciado entre targets:** ≥8px siempre, ≥12px en Conteo para evitar toques accidentales con guantes.
- **Feedback inmediato:** todo botón async (guardar conteo, sync) muestra estado de carga y se deshabilita durante la operación — nunca doble-submit.
- **Feedback sonoro + visual + textual** en cada escaneo exitoso/fallido (ya implementado — "Etapa 2: escaneo, offline, sonidos" — mantener ese patrón de triple confirmación).
- **Foco de teclado visible** en todo control interactivo, incluidos los de modales (usa `--ring`).
- **Contraste:** texto normal ≥4.5:1 sobre fondo en ambos modos; los tres colores de semáforo verificados independientemente en claro y oscuro antes de shippear.
- **Color nunca solo:** cada estado de conteo lleva ícono + texto además del color de fondo/borde.

---

## 8. Iconografía

**Librería:** `lucide-react` (ya instalada — no introducir Phosphor pese a ser la recomendación por defecto del skill; evita una segunda librería de íconos en el proyecto). Trazo consistente 1.5–2px, tamaño por token (`16px` inline, `20px` estándar, `24px` acciones primarias).

| Concepto | Ícono lucide-react |
|---|---|
| Escaneo cámara | `Camera` / `ScanLine` |
| Escaneo OCR | `ScanText` |
| Lector Bluetooth/USB | `Bluetooth` o `Usb` |
| Entrada manual | `Keyboard` |
| Producto | `Package` |
| Depósito/almacén | `Warehouse` |
| Distribución/transporte | `Truck` |
| Historial | `History` |
| Sincronización pendiente | `RefreshCw` |
| Sin conexión | `WifiOff` |
| Conectado | `Wifi` |
| Perfil/usuario | `User` |
| Coincide | `CheckCircle2` |
| Sobra | `TrendingUp` |
| Falta | `TrendingDown` / `AlertCircle` |
| Eliminar (destructivo) | `Trash2` |
| Exportar | `Download` / `FileSpreadsheet` |

Nunca usar emoji como ícono estructural (regla crítica, ya respetada en el proyecto).

---

## 9. Componentes clave (patrones, no CSS literal — el proyecto ya usa shadcn/ui + CVA)

### Botones
- **Primario:** fondo `--primary`, texto `--primary-foreground`, radius `0.5rem`, un solo CTA primario por vista (regla `primary-action`).
- **Secundario:** outline con `--border`, texto `--foreground`.
- **Destructivo:** fondo/borde `--destructive`, siempre con ícono + confirmación (`confirmation-dialogs`) antes de ejecutar.
- **Estado disabled:** opacidad 0.5, `cursor: not-allowed`, sin acción al click.

### Cards
- Fondo `--card`, borde `--border` 1px, radius `0.75rem`, sombra solo en hover si es interactiva (`--shadow-sm`). Sin `transform` en hover.

### Badges de estado (semáforo)
- Forma píldora (`radius: 9999px`), fondo tenue del color semántico + texto en el tono fuerte del mismo color (ej. `bg-success/10 text-success`), ícono a la izquierda, nunca solo color.

### Inputs
- Altura mínima 44px (48px en Conteo), label visible siempre (nunca solo placeholder), tipo semántico (`inputMode="numeric"` para cantidades), mensaje de error debajo del campo vinculado con `aria-describedby`.

### Indicador de sync/offline (nuevo — patrón de dominio, no existe en el skill genérico)
- Barra o chip persistente en el topbar: `Wifi`/`WifiOff` + texto de estado ("En línea" / "Sin conexión — N conteos pendientes"). Nunca un ícono solo sin conteo/texto cuando hay pendientes.

---

## 10. Layout responsive

Breakpoints: `375px` (móvil chico) · `768px` (tablet — dispositivo principal en depósito) · `1024px` (desktop/admin) · `1440px` (desktop grande).

- Mobile-first; el flujo de Conteo se diseña primero para tablet en mano (768px), no para desktop.
- Sin scroll horizontal nunca. Tablas de Productos/Historial usan contenedor `overflow-x: auto` propio, no la página entera.
- Contenido nunca oculto detrás de topbar/bottom-bar fijos — reservar padding equivalente a su altura.
- `min-h-dvh` en vez de `100vh` (barras de navegador móvil).

---

## 11. Anti-patrones (evitar explícitamente)

- ❌ Animaciones de scroll-reveal, parallax o choreography compleja (fuera de dial motion=3).
- ❌ Sombras dramáticas, gradientes, efectos 3D o glassmorphism.
- ❌ Semáforo de estado solo por color, sin ícono ni texto.
- ❌ Emoji como ícono estructural.
- ❌ Botones sin `cursor: pointer` o sin estado de carga en acciones async.
- ❌ Segunda librería de íconos (mantener solo `lucide-react`).
- ❌ Cambiar tipografía a algo distinto de Inter sin razón funcional (ya es cálida y accesible).
- ❌ Ocultar el estado de conexión/sync — siempre visible en el topbar.
- ❌ Reducir objetivos táctiles por debajo de 44px (48px en Conteo).

---

## 12. Checklist de pre-entrega

- [ ] Paleta cálida aplicada solo vía tokens HSL en `globals.css` (sin hex sueltos en componentes)
- [ ] Contraste 4.5:1 verificado en claro y oscuro, con hex reales (no solo HSL nominal)
- [ ] Los 3 estados de conteo llevan ícono + texto, no solo color
- [ ] `lucide-react` como única librería de íconos
- [ ] Objetivos táctiles ≥44px (≥48px en Conteo), separación ≥8px (≥12px en Conteo)
- [ ] Motion limitado a 150–250ms, con propósito, `prefers-reduced-motion` respetado
- [ ] Indicador de conexión/sync visible en todo momento
- [ ] Responsive verificado en 375 / 768 / 1024 / 1440px, sin scroll horizontal
- [ ] Un solo CTA primario por vista
- [ ] Acciones destructivas con confirmación + ícono + texto explícito
