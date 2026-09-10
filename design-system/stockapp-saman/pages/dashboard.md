# Dashboard — Overrides

> Aplica sobre `design-system/stockapp-saman/MASTER.md`. Solo se listan desviaciones.

**Tipo de página:** Data-dense dashboard — vista de aterrizaje tras login, resumen operativo.

## Layout
- Grid de 12 columnas, ancho completo (hasta `1400px` max-width en desktop, con `container` centrado ya definido en `tailwind.config.ts`).
- Fila superior de KPI cards (conteos hoy, discrepancias abiertas, productos pendientes de contar, % sincronizado) — 2 columnas en móvil, 4 en desktop.
- Debajo: gráficos con `recharts` (ya instalado) para tendencia de conteos/discrepancias por agencia o período.
- Indicador de sync del topbar (§9 Master) es el elemento más prominente de la franja superior — nunca compite en jerarquía con las KPI cards, va por encima de ellas.

## Densidad
- Alta (más cercana a `--space-sm`/`--space-md` que a `--space-lg`) — es la única vista donde se prioriza ver mucho de un vistazo sobre el aire visual.

## Color
- Las KPI cards de discrepancia usan los tokens de semáforo (`--warning`/`--destructive`) solo en el número y un ícono pequeño, nunca tiñendo toda la card — mantiene la calidez neutra del fondo general.

## Componentes específicos
- **KPI card:** número grande (Display, tabular-nums), label debajo (Caption), ícono de tendencia opcional, click navega al detalle filtrado (ej. click en "discrepancias" → Historial filtrado).
- **Gráficos:** leyenda visible, tooltip on-hover/tap, paleta accesible (no rojo/verde puro como única diferenciación — usar además forma/patrón o etiqueta directa), estado vacío explícito ("Sin conteos registrados hoy") en vez de gráfico en blanco.
- **Acceso rápido a Conteo:** CTA secundario destacado ("Nuevo conteo") — no es el CTA primario de la página (la página no tiene una sola acción, es de resumen), pero sí el más prominente entre los accesos.

## Motion
- `fade-in`/`slide-up` (0.2–0.3s) solo en la carga inicial de las KPI cards, sin stagger complejo — dial motion=3 no habilita choreography.
