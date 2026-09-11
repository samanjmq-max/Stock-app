# Login — Overrides

> Aplica sobre `design-system/stockapp-saman/MASTER.md`. Solo se listan desviaciones.
> Este archivo refleja el estado real implementado (ver `src/app/login/page.tsx`,
> `src/components/login/RiceFieldVideoBackground.tsx` y `.../TiltCard.tsx`),
> no solo la intención original — se fue actualizando a medida que la pantalla
> evolucionó.

**Tipo de página:** Formulario de autenticación de una sola tarea (no dashboard).

## ⚠️ Excepciones deliberadas a MASTER.md (solo esta página)

El login es la **única** pantalla de la app con estas dos desviaciones respecto a las reglas generales del Master. Son decisiones de producto explícitas para el punto de entrada de la app — un momento de marca único, no repetido en cada pantalla — y **no habilitan** usar estos patrones en Dashboard, Conteo, Productos, Historial ni Perfil, que siguen estrictamente motion=3 y Flat Design tal como los describe el Master.

1. **Tilt 3D en el card** (`TiltCard.tsx`) — el Master (§11, Anti-patrones) prohíbe explícitamente "efectos 3D" fuera del dial motion=3/subtle. Acá se permite un tilt leve (máx. 6°) que sigue el mouse en desktop y la orientación del teléfono en mobile, como gesto de bienvenida. Reglas que sí se mantienen aunque el efecto exista:
   - Respeta `prefers-reduced-motion` igual que el resto del sistema — con esa preferencia activada, el tilt no se activa en absoluto (ni mouse ni orientación), el card queda estático.
   - Nada de luces animadas, glow, parallax de fondo ni textura de ruido — **solo** la rotación del card. Esas otras variantes de efecto "3D card" se evaluaron y se descartaron explícitamente para este proyecto.
   - En iOS 13+, `DeviceOrientationEvent.requestPermission()` exige un gesto del usuario — se resuelve con un botón discreto (ícono `Compass` + texto chico, `text-muted-foreground`) que solo aparece si hace falta pedir permiso, nunca un popup intrusivo. Si el permiso se rechaza o no está disponible, el card simplemente quedá sin inclinar — sin error visible.

2. **Glassmorphism en card e inputs** — el Master (§11) también prohíbe "glassmorphism" como estilo general (la app es Flat Design). Acá el card (`bg-card/30 backdrop-blur-xl border-white/20`) y los inputs (`bg-background/40 backdrop-blur-md border-white/25 shadow-inner`) son translúcidos a propósito, para que el video de fondo se note a través de la UI. El resto de la app sigue con superficies opacas (`--card`, `--background` sólidos) sin excepción.

## Layout
- Contenedor centrado, ancho máximo `400px`, viewport completo (`min-h-dvh`), sin nav/topbar.
- Un solo card con tilt (`TiltCard` → `Card`, radius `0.75rem` sin cambios) con: logo/marca, título, subtítulo, 2 campos, 1 CTA primario.
- **Fondo de página: video en loop** (`RiceFieldVideoBackground`, `/videos/campo-arroz-closeup.mp4`, `poster` en `/images/login-fallback.jpg`), no el `--background` sólido de la versión inicial — decisión posterior que reemplazó la idea original de "nada de imagen de héroe". Viñeta radial suave (`hsl(var(--background)/0.28)`, transparente al centro) para que el video se vea vivo en los bordes sin perder legibilidad donde está el contenido.
- Con `prefers-reduced-motion` activado, el video no reproduce — solo se ve el poster estático de fondo (mismo criterio que el tilt).

## Densidad
- Más espaciosa que el resto de la app: `--space-xl` (32px) entre bloques del formulario, no `--space-md`. Es la primera impresión, no una pantalla operativa de alta frecuencia.

## Componentes específicos
- **Marca:** ícono + "StockApp" (H1, `font-semibold`) + subtítulo "StockApp — Rice Logistics Intelligence" en `text-foreground` (mismo color base que el H1, sin negrita, `text-sm` — la jerarquía la da el tamaño/peso, no el color).
- **Campos:** email/usuario + contraseña, altura 44px mínimo, `autoComplete` correcto para permitir password managers (regla `accessible-authentication`), toggle mostrar/ocultar contraseña. Estilo glass (ver excepción #2 arriba) — texto sigue en `text-foreground` heredado, placeholder en `text-muted-foreground`, sin tocar esos tokens.
- **CTA primario único:** "Iniciar sesión" — ancho completo del card, sin CTA secundario compitiendo visualmente (un link de "olvidé mi contraseña" en texto plano, bajo el botón, nunca como segundo botón).
- **Error de credenciales:** mensaje inline sobre el formulario (no solo un toast que desaparece), `role="alert"`, sin señalar cuál campo es incorrecto por seguridad, pero sí una acción de recuperación clara.
- **Estado de carga:** botón pasa a estado disabled + spinner mientras autentica; nunca doble-submit (relevante porque el rate-limit de login es de 5 intentos/10 min).
- **Sin indicador de sync/offline aquí** — el login requiere conexión; si no hay red, mostrar un estado explícito ("Sin conexión — se requiere internet para iniciar sesión") en vez de dejar el botón fallar en silencio.

## Motion
- `fade-in` de entrada del card (0.35s) — igual que antes.
- **Tilt 3D del card** — ver excepción #1 arriba. Es la única animación continua/interactiva de toda la app; en todas las demás pantallas motion=3 sigue significando solo transiciones cortas de confirmación (150-250ms), nunca algo continuo ligado al mouse o al sensor de orientación.
- Video de fondo en loop — motion ambiental de baja intensidad, no interactivo, con fallback a poster estático vía `prefers-reduced-motion`.
