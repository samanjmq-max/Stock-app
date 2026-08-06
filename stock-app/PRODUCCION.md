# Checklist antes de producción

Esta lista es para cuando decidas pasar de "probando" a "todo el equipo lo usa todos los días". No hace falta completarla toda de una vez — priorizá de arriba hacia abajo.

## Seguridad

- [ ] `JWT_SECRET` generado con `openssl rand -base64 48` (no un texto inventado a mano) y cargado solo como variable de entorno, nunca en el código.
- [ ] `GAS_API_KEY` con la misma exigencia: larga y aleatoria.
- [ ] Rotar `JWT_SECRET` si alguna vez se filtró o lo vio alguien que ya no debería tenerlo — esto invalida todas las sesiones activas (todos tienen que volver a loguearse), así que se hace con aviso previo al equipo.
- [ ] Revisar la lista de usuarios administradores — que sean solo los que realmente necesitan poder borrar/crear/importar.
- [ ] Confirmar que `middleware.ts` sigue protegiendo `/usuarios`, `/configuracion` y `/api/usuarios` (cualquier ruta nueva de administración debe agregarse a `RUTAS_SOLO_ADMIN`).
- [ ] Si el tráfico crece mucho (varias decenas de personas contando al mismo tiempo), migrar el límite de intentos de login (`src/lib/rateLimit.ts`) de memoria en proceso a Upstash Redis — el comentario en ese archivo explica cómo.
- [ ] Revisar los headers de seguridad en `next.config.mjs` si en algún momento se agregan imágenes o scripts de un dominio externo (hay que sumarlos a la Content-Security-Policy o se van a bloquear).

## Datos y respaldos

- [ ] Activar el historial de versiones de Google Sheets (Archivo → Historial de versiones) — es automático, pero conviene saber que está ahí para poder restaurar si alguien borra algo por error.
- [ ] Exportar una copia de la planilla completa (Archivo → Descargar → Excel) al menos una vez por semana durante el primer mes, hasta confiar en el proceso.
- [ ] Definir con qué frecuencia se hace "Reiniciar todos los conteos" (¿cada inventario mensual? ¿cada semana?) y quién tiene permiso de hacerlo.

## Rendimiento

- [x] La cámara de escaneo (ZXing) se carga solo cuando se abre — no pesa en el arranque de la app.
- [x] Los productos se paginan de a 15 en la pantalla de Productos, para que catálogos grandes no hagan lenta la lista.
- [ ] Si el catálogo supera varios miles de productos, considerar mover el filtrado/búsqueda al servidor en vez de traer todo el listado al dispositivo.
- [ ] Revisar el tamaño de la planilla de Historial cada tanto — si crece mucho (decenas de miles de filas), las lecturas se hacen más lentas; en ese caso, migrar a PostgreSQL (`database/schema.sql`) es el paso natural.

## Confiabilidad

- [x] Pruebas automáticas de las funciones críticas (`npm test`): cálculo de diferencias, clasificación de estado, validaciones de formularios, límite de intentos de login.
- [ ] Antes de cada cambio grande al código, correr `npm test` y `npm run build` localmente para confirmar que no se rompió nada.
- [ ] Configurar un servicio de monitoreo de errores en producción (por ejemplo Sentry, gratis para proyectos chicos) para enterarte de errores reales de usuarios sin depender de que te escriban.
- [ ] Dominio propio en Vercel (en vez de `xxx.vercel.app`) si esto va a ser una herramienta permanente del equipo — da más confianza y es más fácil de recordar.

## Experiencia de uso

- [x] Notificaciones (toast) en vez de mensajes de error perdidos en el medio de la pantalla.
- [x] Confirmaciones con diálogo propio en vez de las ventanas feas del navegador (`confirm`/`prompt`).
- [ ] Cargar los íconos reales de la PWA (hoy son un placeholder) — con el logo definitivo de la empresa si lo tenés.
- [ ] Probar la app en al menos un Android de gama media y un iPhone, no solo en el celular con el que se desarrolló — el rendimiento de cámara y vibración varía bastante entre fabricantes.

## Antes de anunciarlo al equipo

- [ ] Crear los usuarios operadores reales desde **Usuarios** (no reutilizar el usuario administrador para contar).
- [ ] Cargar el catálogo real de productos (importación desde Excel/CSV).
- [ ] Hacer una prueba de "inventario piloto" con 2-3 personas antes de un inventario general grande.
- [ ] Tener a mano la Parte 6 de la guía (qué hacer si algo no funciona) el día del primer inventario grande.
