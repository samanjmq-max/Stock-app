# Historial — Overrides

> Aplica sobre `design-system/stockapp-saman/MASTER.md`. Solo se listan desviaciones.

**Tipo de página:** Vista de solo lectura de conteos pasados — auditoría y exportación, no requiere estar offline.

## Layout
- Filtros persistentes arriba (rango de fecha, agencia, producto, tipo de resultado — coincide/sobra/falta) — igual que Productos, alineados a la derecha o en una barra colapsable en móvil.
- Tabla/lista cronológica como contenido principal; en móvil, cada fila colapsa a un card compacto en vez de forzar scroll horizontal de tabla.
- Exportación (`jspdf`/`xlsx`, ya instalados) como acción secundaria visible pero no compitiendo con el CTA de filtrar.

## Densidad
- Alta en la tabla, igual criterio que Productos. En vista de card móvil, densidad estándar (`--space-md`) para que cada card siga siendo legible.

## Componentes específicos
- **Resultado por fila:** mismo badge de semáforo que en Conteo/Dashboard (ícono + texto + color) — consistencia total con §2.3 Master, es literalmente el mismo dato en otra vista.
- **Fecha/hora:** formato localizado (es-UY), tabular donde haya alineación de columnas.
- **Fila expandible:** click en una fila muestra detalle (quién contó, valor SAP vs. contado, diferencia) sin navegar a otra página — evita perder el contexto de filtros aplicados (`state-preservation`).
- **Export:** feedback de "generando archivo..." con estado de carga, no un botón que parece no responder mientras genera el PDF/XLSX.
- **Estado vacío:** "Sin conteos en este rango" + sugerencia de ampliar filtros, nunca tabla en blanco.

## Motion
- Ninguno más allá de lo estándar (fade-in de carga inicial). Expansión de fila de detalle: transición de altura corta (150-200ms) — es de las pocas animaciones de layout permitidas porque comunica jerarquía padre/hijo, pero debe usar altura real medida, no una animación que cause salto de contenido.
