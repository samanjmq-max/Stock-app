# Login — Overrides

> Aplica sobre `design-system/stockapp-saman/MASTER.md`. Solo se listan desviaciones.

**Tipo de página:** Formulario de autenticación de una sola tarea (no dashboard).

## Layout
- Contenedor centrado, ancho máximo `400px`, viewport completo (`min-h-dvh`), sin nav/topbar.
- Un solo card (`--card`, `--shadow-sm`, radius `0.75rem`) con: logo/marca SAMAN, título, 2 campos, 1 CTA primario.
- Fondo de página: `--background` sólido (el tono cálido `38 30% 97%` ya aporta calidez suficiente) — nada de imagen de héroe ni gradiente.

## Densidad
- Más espaciosa que el resto de la app: `--space-xl` (32px) entre bloques del formulario, no `--space-md`. Es la primera impresión, no una pantalla operativa de alta frecuencia.

## Componentes específicos
- **Campos:** email/usuario + contraseña, altura 44px mínimo, `autoComplete` correcto para permitir password managers (regla `accessible-authentication`), toggle mostrar/ocultar contraseña.
- **CTA primario único:** "Iniciar sesión" — ancho completo del card, sin CTA secundario compitiendo visualmente (un link de "olvidé mi contraseña" en texto plano, bajo el botón, nunca como segundo botón).
- **Error de credenciales:** mensaje inline sobre el formulario (no solo un toast que desaparece), `role="alert"`, sin señalar cuál campo es incorrecto por seguridad, pero sí una acción de recuperación clara.
- **Estado de carga:** botón pasa a estado disabled + spinner mientras autentica; nunca doble-submit (relevante porque el rate-limit de login es de 5 intentos/10 min).
- **Sin indicador de sync/offline aquí** — el login requiere conexión; si no hay red, mostrar un estado explícito ("Sin conexión — se requiere internet para iniciar sesión") en vez de dejar el botón fallar en silencio.

## Motion
- Solo `fade-in` de entrada del card (ya existe como keyframe, 0.2s) — nada más.
