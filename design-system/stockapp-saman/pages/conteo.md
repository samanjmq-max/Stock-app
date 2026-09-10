# Conteo — Overrides

> Aplica sobre `design-system/stockapp-saman/MASTER.md`. Solo se listan desviaciones.
> **Esta es la pantalla de mayor uso y mayor costo de error de toda la app — prioridad #1 de claridad y velocidad.**

**Tipo de página:** Flujo operativo de una sola tarea, usado repetidamente durante horas, offline-capable.

## Layout
- Columna única centrada en móvil/tablet (el dispositivo real de uso), ancho máximo `640px` incluso en desktop — nunca grid multi-columna que disperse la atención.
- Zona superior: identificación del producto (código, nombre, foto si existe, stock SAP de referencia).
- Zona media: los 4 métodos de identificación conviven pero **uno a la vez es protagonista** — tabs o selector claro entre Cámara / OCR / Lector / Manual, no los 4 simultáneos compitiendo (`avoid-mixed-patterns` aplicado a métodos de entrada, no solo a navegación).
- Zona inferior: barra de acción sticky con el resultado del conteo (semáforo) + botón de confirmar — siempre visible sin scroll (`fixed-element-offset` respetado, reservar padding).

## Densidad
- La más baja de toda la app (`--space-lg`/`--space-xl`) — más aire, menos elementos por pantalla, objetivos más grandes. Es la contracara intencional del Dashboard/Productos.

## Componentes específicos
- **Resultado de conteo (semáforo):** badge grande, ícono + texto + color (§2.3 Master) — nunca un simple cambio de fondo de pantalla sin texto.
- **Botón de confirmar cantidad:** mínimo 48×48px, ubicado en la barra sticky inferior, único CTA primario de la pantalla.
- **Input de cantidad:** `inputMode="numeric"`, steppers +/− grandes (48px) para ajuste rápido sin teclado, valor en fuente mono/tabular.
- **Feedback de escaneo:** sonido + vibración (si disponible) + cambio visual inmediato (<150ms) — patrón ya implementado en "Etapa 2", mantener las 3 señales juntas, nunca solo una.
- **Indicador de cola offline:** si el conteo se guarda sin conexión, mostrar de inmediato "Guardado localmente — se sincronizará" (no un simple checkmark ambiguo entre "guardado" y "sincronizado").
- **Cambio entre método de entrada:** transición de opacidad/cross-fade simple (150-200ms), nunca slide direccional que sugiera navegación entre páginas distintas.

## Accesibilidad y touch
- Objetivos táctiles 48×48px mínimo, separación ≥12px entre controles (guantes, uso repetitivo) — ver §7 Master, esta página es la razón de esa excepción.
- Foco de teclado visible también en el selector de método de entrada (uso con lector Bluetooth que emula teclado — `useHardwareScanner`).

## Motion
- Mínimo indispensable: transición de estado del semáforo (150ms color), aparición de la barra de confirmación. Nada de animación en la lista de resultados ni en el cambio de producto.
