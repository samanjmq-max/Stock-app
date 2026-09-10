# Perfil — Overrides

> Aplica sobre `design-system/stockapp-saman/MASTER.md`. Solo se listan desviaciones.

**Tipo de página:** Formulario de configuración personal, baja frecuencia de uso.

## Layout
- Columna única centrada, ancho máximo `560px` — no es una vista de datos, no necesita grid de 12 columnas.
- Secciones agrupadas con `field-grouping`: datos de cuenta (nombre, email — probablemente de solo lectura si vienen de la fuente de identidad), rol/agencia (solo lectura, informativo), preferencias (tema claro/oscuro si se expone toggle), cambio de contraseña.
- **Cerrar sesión** al final de la página, separado espacialmente (`--space-2xl` de separación) del resto de las acciones, tratado como acción destructiva de navegación (`destructive-nav-separation`) — nunca junto a "Guardar cambios".

## Densidad
- Espaciosa (`--space-lg`/`--space-xl`), igual criterio que Login — no es una pantalla operativa de alta frecuencia.

## Componentes específicos
- **Rol y agencia:** mostrados como texto/badge de solo lectura, no como inputs editables (el usuario no se auto-asigna rol) — distinción visual clara entre read-only y editable (`read-only-distinction`).
- **Cambio de contraseña:** campo con toggle mostrar/ocultar, validación de fortaleza inline (on blur, no on keystroke), confirmación de contraseña nueva.
- **Toggle de tema:** si se expone, usar control nativo tipo switch, con los tres estados posibles (claro/oscuro/sistema) si aplica — coherente con que `darkMode: ["class"]` ya soporta ambos modos calibrados en este documento (§2.2 Master).
- **Cerrar sesión:** botón outline en color `--destructive`, con confirmación simple si hay conteos pendientes de sincronizar sin guardar en el servidor ("Tenés N conteos sin sincronizar. ¿Cerrar sesión igual?").

## Motion
- Ninguno más allá del estándar de formulario (fade-in de carga, transición de guardado).
