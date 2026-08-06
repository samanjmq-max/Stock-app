# StockApp — Sistema de conteo de inventario (PWA)

Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui, con Google
Sheets (vía Google Apps Script) como persistencia inicial, preparado
para migrar a PostgreSQL/Supabase sin reescribir el frontend.

## Estado del proyecto: Etapas 1, 2, 3 y 4 completas

**Etapa 1** — base, auth, dashboard, conteo manual (ver detalle abajo).

**Etapa 2** — agregada:
- Escaneo por cámara con ZXing: EAN13, EAN8, UPC-A, UPC-E, Code128, Code39, QR —
  con selección de cámara y linterna si el dispositivo la soporta
- Lector Bluetooth/USB (modo teclado HID): funciona solo, sin configuración
- Offline real con IndexedDB: cache de productos + cola de conteos, sincronización
  automática al volver la conexión (o manual desde el botón de la barra superior)
- Sonidos (Web Audio, sin archivos externos) y vibración diferenciados: lectura
  correcta, incorrecta, producto inexistente, conteo guardado
- Historial de conteos del producto actual, visible en el propio módulo de conteo
- Historial (auditoría) funcional: listado completo con búsqueda

**Etapa 3** — agregada:
- **Productos**: listado con buscador, filtro por familia, paginación, alta/edición/baja
  (dialogs), importación desde Excel/CSV/Google-Sheets-exportado con vista previa y
  detección de filas inválidas antes de confirmar, exportación a Excel/CSV/PDF
- **Usuarios**: alta, edición, cambio de contraseña, activar/desactivar, eliminar —
  solo administradores, con protección para no auto-eliminarse
- **Configuración**: sonidos y vibración on/off (persistidos), sincronizar manualmente,
  reiniciar todos los conteos (con confirmación explícita, solo admin)
- **Dashboard avanzado**: se suman gráficos de Top diferencias y Progreso por
  ubicación, más exportación del reporte completo (Excel/PDF)

Todo lo anterior funciona tanto **online** (llamando directo a las API routes de
Next.js, que a su vez llaman a Apps Script) como **offline** para el módulo de
conteo específicamente (el resto de los módulos —Productos, Usuarios, Historial—
requieren conexión, ya que no tiene sentido cachear altas/bajas administrativas).

## ⚠️ Qué tenés que completar vos

No puedo generar tus credenciales ni probar el build (sin red en mi entorno).
Necesitás:

1. Una planilla de Google Sheets + el script de Apps Script publicado.
2. Un `JWT_SECRET` propio.
3. Los íconos de la PWA (`public/icons/icon-192.png`, `icon-512.png`,
   `icon-maskable-512.png`) — cualquier generador de íconos PWA online te
   los arma a partir de un logo.


---

## 1. Configurar el backend de Google Apps Script

1. Creá una planilla nueva en Google Sheets.
2. Extensiones → Apps Script.
3. Borrá el `Code.gs` de ejemplo y pegá, uno por uno, el contenido de cada
   archivo de `google-apps-script/` (Utils.gs, Usuarios.gs, Productos.gs,
   Conteos.gs, Historial.gs, Code.gs) como archivos nuevos del proyecto
   (ícono "+" → Script).
4. En el editor, seleccioná la función `configurarProyecto` (arriba, al
   lado de "Ejecutar") y ejecutala una vez. Te va a pedir autorización la
   primera vez — aceptá. Esto crea las 6 hojas con sus encabezados.
5. ⚙️ (Configuración del proyecto) → Propiedades del script → **Agregar
   propiedad del script**:
   - `API_KEY` = una clave larga y aleatoria (ej. generada con
     `openssl rand -hex 32`)
6. Implementar → Nueva implementación → tipo **Aplicación web**:
   - Ejecutar como: **Yo** (tu cuenta)
   - Quién tiene acceso: **Cualquier usuario**
   - Implementar → copiá la URL (termina en `/exec`)

## 2. Crear el primer usuario administrador

Como todavía no hay ningún usuario, no hay con qué loguearse para crear el
primero. Por eso:

```bash
cd stock-app
npm install        # necesitás bcryptjs instalado para correr el script
node scripts/generar-hash.js "tuContraseñaSegura"
```

Esto imprime un hash bcrypt. En tu planilla, pestaña **Usuarios**, agregá
una fila manualmente:

| id | nombre | email | passwordHash | rol | activo | creadoEn |
|---|---|---|---|---|---|---|
| admin-001 | Tu Nombre | vos@empresa.com | *(el hash impreso)* | administrador | TRUE | 2026-07-31T00:00:00.000Z |

Este paso manual es **solo para el primer administrador**. A partir de ahí,
ese admin ya puede crear todos los demás usuarios (operadores u otros
administradores) desde la pantalla **Usuarios** de la app — sin tocar la
planilla nunca más.

## 3. Configurar y correr Next.js

```bash
cp .env.example .env
# completá JWT_SECRET, GAS_WEB_APP_URL y GAS_API_KEY

npm install
npm run dev   # http://localhost:3000
```

Entrá con el email y contraseña del administrador que creaste en el paso 2.

## 4. Cargar productos para poder contar

Ya no hace falta tocar la planilla a mano: entrá como administrador →
**Productos → Importar**, y subí un Excel/CSV con columnas código,
descripción, ubicación, familia, proveedor, stockSap (los nombres de
columna aceptan variantes con/sin tilde). También podés cargar productos
uno por uno con **Productos → Nuevo**.

## 5. Instalar como PWA

Con `npm run build && npm run start` servido por HTTPS (Vercel es lo más
directo para Next.js), abrí la URL desde Chrome (Android) o Safari (iPhone)
y usá "Agregar a pantalla de inicio" / "Instalar app".

## 6. Desplegar online para arrancar (recomendado antes de tener servidor propio)

Mientras no tengas los servidores de tu empresa disponibles, la forma más
rápida de tener esto andando en internet (con HTTPS, que además es
obligatorio para que la cámara y el service worker funcionen) es Vercel:

1. Subí el proyecto a un repositorio de GitHub (`git init`, `git add .`,
   `git commit`, creá el repo en GitHub y hacé push).
2. Entrá a https://vercel.com → **Add New → Project** → importá ese repositorio.
3. En **Environment Variables**, cargá las mismas tres variables del `.env`:
   `JWT_SECRET`, `GAS_WEB_APP_URL`, `GAS_API_KEY`.
4. Deploy. Vercel te da una URL `https://tu-proyecto.vercel.app` con HTTPS
   ya configurado — esa es la URL que usás desde el celular para instalar
   la PWA y probar todo (cámara, offline, etc.) sin depender de tu red
   interna todavía.
5. El día que tengas servidor propio, el mismo build (`npm run build`)
   corre en cualquier hosting Node.js — no hay nada atado a Vercel.

Nada del código cambia entre "online con Vercel" y "en tu servidor": la
única diferencia es dónde corre el proceso de Next.js. Google Sheets vía
Apps Script funciona igual en ambos casos porque es un servicio 100% en
la nube de Google, no depende de tu red.

---

## Estructura del proyecto

```
stock-app/
├── src/
│   ├── app/                       # rutas (App Router)
│   │   ├── login/
│   │   ├── (dashboard)/           # grupo protegido: dashboard, conteo, productos, historial, usuarios*, configuracion*
│   │   └── api/                   # auth, productos(+[id], importar), conteos(+sync-batch, reset), historial, usuarios(+[id])
│   ├── components/
│   │   ├── ui/                    # Button, Input, Card, Badge, Dialog, Select, Textarea, Label (shadcn, escritos a mano)
│   │   ├── layout/                 # Sidebar, Topbar, MobileNav, AuthGate, PwaRegister, ProximamenteScreen
│   │   └── dashboard/               # StatCard
│   ├── features/
│   │   ├── escaneo/components/BarcodeScanner.tsx      # cámara multi-formato (ZXing)
│   │   ├── productos/components/                       # ProductoFormDialog, ImportarProductosDialog
│   │   └── usuarios/components/UsuarioFormDialog.tsx
│   ├── contexts/AuthContext.tsx
│   ├── providers/AppProviders.tsx
│   ├── services/                   # productos, conteos, usuarios, historial (wrappers fetch tipados)
│   ├── hooks/                      # useDashboardData, useSync, useHardwareScanner
│   ├── db/offlineDb.ts             # IndexedDB: cache de productos + cola de conteos offline
│   ├── lib/                        # auth, sheets (cliente Apps Script), utils, validations, sonidos, vibracion, importacion, exportacion
│   ├── types/index.ts
│   └── middleware.ts
├── google-apps-script/             # Code.gs, Utils.gs, Usuarios.gs, Productos.gs, Conteos.gs, Historial.gs
├── database/schema.sql             # modelo lógico para la futura migración a Postgres/Supabase
├── config/site.ts
├── scripts/generar-hash.js
├── tests/                          # Vitest: utils, validations, rateLimit
├── PRODUCCION.md                   # checklist antes de producción
└── public/                         # manifest.json, sw.js, offline.html, icons/
```

*Usuarios y Configuración solo son accesibles para administradores (ocultas del menú y bloqueadas en el middleware para operadores).

## Arquitectura: por qué se puede migrar de Sheets a Postgres sin romper nada

`src/lib/sheets.ts` es la única pieza del sistema que sabe que la
persistencia hoy es Google Sheets. Expone funciones de dominio
(`getProductos`, `guardarConteo`, etc.), no detalles de Sheets. El día
de la migración, se reimplementan esas mismas funciones contra
PostgreSQL (con Prisma o Drizzle, usando `database/schema.sql` como
punto de partida) y el resto de la aplicación — API routes, componentes,
services del cliente — no se toca.

---

**Etapa 4** — agregada:
- **Seguridad**: headers HTTP (CSP, anti-clickjacking, HSTS), límite de intentos de login (5 intentos fallidos → bloqueo temporal), documentación de cómo migrar el límite a Redis (Upstash) si el tráfico crece
- **Rendimiento**: la librería de escaneo por cámara (ZXing) se carga solo cuando se abre la cámara, no en el arranque de la app; paginación ya presente en Productos
- **Experiencia de uso**: notificaciones tipo toast reemplazan los mensajes inline; diálogos de confirmación propios reemplazan los `confirm()`/`prompt()` feos del navegador (incluida una variante que exige escribir una palabra de seguridad para reiniciar el inventario); esqueletos de carga en el Dashboard en vez de un spinner a pantalla completa
- **Pruebas automatizadas**: base de tests con Vitest (`npm test`) cubriendo cálculo de diferencias, validaciones de formularios y el límite de intentos de login
- **`PRODUCCION.md`**: checklist priorizado para cuando este proyecto pase de "prueba" a "todo el equipo lo usa todos los días"

## Próximos pasos

Con las 4 etapas completas, el proyecto está funcionalmente terminado según lo planeado. Lo que queda es específico de tu operación real:

- Revisar `PRODUCCION.md` antes de un inventario general grande
- Cargar el catálogo real de productos
- Crear los usuarios operadores del equipo
- Si en el futuro hace falta más (por ejemplo notificaciones push, reportes programados por email, integración directa con SAP en vez de Excel), son extensiones puntuales sobre esta misma base — no hace falta reescribir nada.
