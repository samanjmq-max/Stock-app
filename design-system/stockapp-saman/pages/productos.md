# Productos — Overrides

> Aplica sobre `design-system/stockapp-saman/MASTER.md`. Solo se listan desviaciones.

**Tipo de página:** Tabla/lista administrativa (gestión de catálogo), acceso probablemente restringido a `administrador` según `RUTAS_SOLO_ADMIN`.

## Layout
- Tabla de datos como elemento principal, ancho completo, `overflow-x: auto` propio (nunca la página entera con scroll horizontal).
- Barra superior: búsqueda + filtros (categoría, agencia, estado de stock) + acciones de import/export (`xlsx`, ya instalado) alineadas a la derecha.
- Fila de tabla con acciones secundarias (editar, ver historial del producto) reveladas al hover/focus, no siempre visibles compitiendo con los datos.

## Densidad
- Alta en la tabla (`--table-row-height` compacto, `--space-sm` de padding interno de celda) — más filas visibles por scroll, consistente con el patrón Data-Dense Dashboard.
- Los controles de filtro/búsqueda por encima de la tabla mantienen densidad estándar (`--space-md`) para no volverse difíciles de tocar en tablet.

## Componentes específicos
- **Columnas numéricas** (stock, precio) en fuente mono/tabular, alineadas a la derecha.
- **Estado de producto** (activo/inactivo, con o sin discrepancia) como badge de semáforo, mismo patrón que §2.3/§9 Master.
- **Import/Export:** feedback de progreso explícito durante la operación (puede tardar con catálogos grandes), y confirmación post-import con resumen ("120 productos actualizados, 3 errores") en vez de un toast genérico de "éxito".
- **Edición inline vs. modal:** ediciones simples (precio, categoría) inline; alta de producto nuevo en modal/sheet dedicado.
- **Bulk actions:** al seleccionar múltiples filas, barra de acciones contextual aparece (no un menú oculto) — acciones destructivas (eliminar en lote) separadas visualmente y con confirmación.
- **Tabla vacía / sin resultados de filtro:** mensaje + acción clara ("Limpiar filtros" o "Agregar primer producto"), nunca una tabla en blanco sin explicación.

## Motion
- Filtrado/ordenado de tabla: sin animación de reflow compleja, solo actualización de contenido; opcionalmente un `opacity` breve (100-150ms) en las filas al refiltrar.
