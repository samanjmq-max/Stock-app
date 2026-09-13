# StockApp

Aplicación de conteo de inventario para los centros de distribución de **SAMAN** en Uruguay. Reemplaza el conteo manual en papel: el personal de depósito escanea o fotografía cada artículo, carga la cantidad encontrada, y el sistema compara automáticamente contra el stock de SAP para detectar diferencias (sobrantes/faltantes) — todo desde el celular, con o sin conexión a internet.

🔗 **App en producción:** [stock-app-gold-six.vercel.app](https://stock-app-gold-six.vercel.app)

---

## ¿Para qué sirve?

Antes el conteo se hacía a mano en planillas de papel, se cruzaba contra SAP después, y los errores de tipeo y de trazabilidad eran constantes. StockApp digitaliza todo el proceso:

- El operador identifica un artículo (código manual, lector Bluetooth, cámara o foto del número) y carga lo que encontró.
- El sistema calcula la diferencia contra el stock teórico al instante, **y la valoriza en pesos** usando el precio unitario de cada artículo.
- Un Dashboard en vivo muestra el avance del inventario, las coincidencias y las diferencias — en cantidades y en importe — para toda la empresa o filtrado por depósito.
- Todo queda auditado: quién contó qué, cuándo, y qué se corrigió o eliminó.

Está pensado tanto para inventarios completos como para **conteos cíclicos** (por sector, semanales, etc.).

## Funcionalidades principales

| Módulo | Qué hace |
|---|---|
| **Login y roles** | Acceso por email/contraseña. Roles operador y administrador, con una jerarquía de super administrador (control total) y administradores de planta (limitados a su propia agencia). Incluye recuperación de contraseña por código secreto para el super administrador. |
| **Multi-agencia** | Cada usuario y cada producto pertenecen a una agencia (depósito). Los operadores solo ven y cuentan la suya; los administradores pueden ver o filtrar cualquiera. |
| **Contar stock** | 4 formas de identificar un artículo: código a mano, lector Bluetooth, cámara (código de barras) o foto con reconocimiento de texto (OCR) para artículos sin código impreso. Permite registrar una ubicación distinta a la de SAP sin perder el dato original. Blancos táctiles de 48px: es la única pantalla que se usa parado y con guantes. |
| **Escáner con estado** | El visor no se cierra al leer: informa los siete desenlaces posibles con color, ícono, texto, sonido y vibración — buscando, código detectado, consultando SAP, encontrado, no existe en SAP (ámbar, no rojo: es un hallazgo, no un error), ya contado hoy (con quién y a qué hora) y error de lectura con su causa. Desde el propio visor se puede registrar igual, contar igual o reintentar. |
| **Dashboard** | Jerarquía de cuatro niveles: el avance del conteo como cifra protagonista, un aviso de faltantes sin revisar, cuatro tarjetas de estado clickeables (coincidencias, diferencias −/+, pendientes) con su importe en pesos, y debajo los gráficos, la tabla de conteos y las exportaciones. |
| **Valorización** | Cada producto tiene un precio unitario (calculado automáticamente al importar el export de SAP). Las diferencias se valorizan en pesos, para priorizar qué analizar primero y qué ajustar directo sin mayor análisis. |
| **Exportación** | A Excel, CSV y PDF, respetando el filtro activo (o el conteo completo), incluyendo precio unitario e importe por línea. |
| **Productos** | Catálogo completo paginado (100/300/1.000 por página, con el rango exacto a la vista), búsqueda, filtros por ubicación y familia, orden por cualquier columna sobre **todo** el catálogo filtrado y no solo la página visible, importación masiva desde Excel (formato simplificado o el export crudo de SAP), alta y edición manual, edición de precio en línea y borrado individual con deshacer. |
| **Generar etiqueta** | Genera e imprime etiquetas de código de barras (10×5 cm) para artículos nuevos o para reimprimir, con búsqueda automática en el catálogo o carga masiva desde Excel. |
| **Historial** | Registro cronológico de toda la actividad relevante, para auditoría. |
| **Usuarios** | Administración de cuentas, roles y agencias (solo administradores, con permisos delegados por planta). |
| **Modo sin conexión** | El catálogo y los conteos se guardan localmente. La cola pendiente se sube sola al abrir la app, al recuperar señal y cada 2 minutos mientras quede algo; si el servidor rechaza un lote, el motivo queda a la vista en la barra superior y **nada se borra de la cola local**. |

## Diseño

El sistema visual es **"Turno noche"**, documentado en [`design-system/stockapp-saman/MASTER.md`](design-system/stockapp-saman/MASTER.md). Ese archivo es la fuente de verdad: antes de tocar cualquier cosa visual, leerlo.

Lo esencial:

- **Modo oscuro por defecto**, aplicado antes del primer pintado para que no haya parpadeo. El modo claro existe y se elige desde el botón sol/luna del encabezado; la elección queda guardada.
- **Paleta cálida** inspirada en el arroz y el depósito: terracota de marca, verde grano, dorado y rojo para el semáforo del conteo, y un azul de señal reservado a la sincronización. Todos los neutros tiran a tierra, nunca a azul.
- **El color es información**: los tres estados del conteo (coincide / sobra / falta) van siempre con ícono y texto, nunca solo color.
- **Tipografías**: Archivo para titulación y cifras, Inter para la interfaz, JetBrains Mono para códigos y datos. Se sirven desde el propio dominio vía `next/font`.
- **Navegación**: en celular, barra inferior con "Contar" como botón central; en escritorio, sidebar agrupado en Operación y Administración, colapsable.
- **El login siempre es oscuro**, con `dark` fijo en su contenedor: no hereda el tema elegido, porque el video de fondo y el panel de vidrio están calibrados para una sola temperatura.

## Stack técnico

- **Frontend + API:** [Next.js 15](https://nextjs.org) (App Router) · TypeScript · React 19 · Tailwind CSS
- **Backend de datos:** Google Apps Script + Google Sheets
- **Autenticación:** JWT ([jose](https://github.com/panva/jose), compatible con Edge Runtime) + bcrypt para contraseñas
- **PDF y códigos de barras:** [jsPDF](https://github.com/parallax/jsPDF) + [bwip-js](https://github.com/metafloor/bwip-js), generados en el servidor
- **Escaneo:** [@zxing/browser](https://github.com/zxing-js/browser) (códigos de barras) · [Tesseract.js](https://github.com/naptha/tesseract.js) (OCR)
- **Modo offline:** IndexedDB vía [idb](https://github.com/jakearchibald/idb)
- **Gráficos:** [Recharts](https://recharts.org)
- **Animación:** [Framer Motion](https://www.framer.com/motion/)
- **Despliegue:** [Vercel](https://vercel.com)

## Estructura del proyecto

```
├── design-system/
│   └── stockapp-saman/         # MASTER.md + specs por pantalla — leer antes de tocar lo visual
└── stock-app/
    ├── src/
    │   ├── app/
    │   │   ├── (dashboard)/    # Páginas protegidas: dashboard, conteo, productos, etiquetas, usuarios…
    │   │   ├── api/            # Rutas de API (auth, productos, conteos, usuarios, etiquetas)
    │   │   ├── login/
    │   │   ├── recuperar/      # Recuperación de contraseña del super administrador
    │   │   ├── globals.css     # Tokens del sistema de diseño (colores, elevación, motion)
    │   │   └── layout.tsx      # Fuentes, tema oscuro por defecto
    │   ├── components/         # UI (ui/, dashboard/, layout/, login/)
    │   ├── contexts/           # AuthContext (sesión del usuario)
    │   ├── db/                 # offlineDb (IndexedDB, cola de conteos sin conexión)
    │   ├── features/           # Módulos: escaneo, productos, usuarios
    │   ├── hooks/              # useDashboardData, useSync, useConfirm y otros
    │   ├── lib/                # auth, password, sheets, permisos, validaciones, importación, utils
    │   ├── services/           # Llamadas al backend desde el frontend
    │   └── middleware.ts       # Autenticación, permisos por rol y propagación de identidad
    ├── google-apps-script/     # Backend (Code.gs, Utils.gs, Productos.gs, Conteos.gs, Usuarios.gs, Historial.gs)
    └── package.json
```

## Cómo funciona el backend

El "servidor de datos" es una planilla de Google Sheets con un script de Apps Script publicado como Web App (`/exec`). Las rutas de la API de Next.js llaman a esa URL autenticándose con una clave compartida (`GAS_API_KEY`) — el navegador nunca se conecta directo a la planilla.

Todas las llamadas pasan por `src/lib/sheets.ts`, que es el único archivo que sabe que la persistencia es Google Sheets. Tiene **corte por tiempo**: 15 segundos para una operación normal y hasta 60 para las de lote. Sin ese corte, una demora de Apps Script dejaba la pantalla girando para siempre sin ningún mensaje.

Variables de entorno necesarias en Vercel:

| Variable | Uso |
|---|---|
| `GAS_API_KEY` | Autentica las llamadas de Vercel hacia Apps Script (debe coincidir en ambos lados) |
| `GAS_WEB_APP_URL` | URL `/exec` de la implementación activa de Apps Script |
| `JWT_SECRET` | Clave para firmar las sesiones de login |
| `SUPER_ADMIN_EMAIL` | Email del super administrador (control total sobre todas las agencias) |
| `RECOVERY_CODE` | Código secreto para recuperar la contraseña del super administrador |

> Al crear o cambiar una variable de entorno en Vercel hay que forzar un **Redeploy** manual: los deployments que ya estaban corriendo no la toman solos.
>
> Ojo: Vercel guarda estas variables como tipo *Sensitive*, lo que las vuelve ilegibles para siempre desde el panel, la API y `vercel env pull`. Para armar un `.env.local` hay que sacarlas del origen (la URL de implementación y las propiedades del script en Apps Script), no de Vercel.

## Importación de productos

El importador acepta dos formatos, sin necesidad de convertir nada:

**1. Export crudo de SAP** — se sube tal cual, con sus columnas originales: `Material`, `Texto breve de material`, `Libre utilización`, `Valor libre util.`, `Ubicación`, `Grupo de artículos`. El precio unitario se calcula solo (`Valor libre util. ÷ Libre utilización`, solo cuando hay stock).

**2. Formato simplificado** — `codigo`, `descripcion`, `ubicacion`, `familia`, `proveedor`, `stockSap` y, opcionalmente, `precioUnitario`. Si no se incluye el precio, no se pisa el que ya estaba cargado.

La importación **actualiza** el catálogo (stock, ubicación, precio) y **nunca toca los conteos ya realizados**.

Se envía **en lotes de 1.000 productos** con barra de avance, no de una sola vez: un catálogo de 10.000+ artículos en un solo viaje excede el tiempo que una función de Vercel puede esperar. Si un lote se corta, el diálogo avisa cuántos entraron; reintentar con el mismo archivo es seguro, porque los códigos existentes se actualizan en vez de duplicarse.

> Las últimas filas del export de SAP son **subtotales por unidad de medida** (KG, UN, L, T…) y no tienen código de material. El importador las rechaza solo, con el motivo "Falta el código". Es esperable y no hay que corregir el archivo.

## Funciones de mantenimiento (Apps Script)

En `Conteos.gs` hay funciones que se ejecutan manualmente desde el editor de Apps Script, no desde la app:

- `repararAgenciasCodificadas()` — corrige agencias guardadas con caracteres codificados (ej: `Centro Log%C3%ADstico`).
- `limpiarDuplicadosPorCodigo()` — deja un solo conteo por combinación código + ubicación para un código puntual (se configura en la constante `CODIGO_A_LIMPIAR`).

## Desarrollo y despliegue

```bash
cd stock-app
npm install
npm run dev     # http://localhost:3000
npm run build   # verificación completa: tipos, lint y rutas
npm test        # vitest
```

Cada push a `main` dispara un redeploy automático en Vercel. **Un `npm run build` local no publica nada**: compila la copia local. Sin `git push` no hay deploy.

El frontend también se puede editar desde el editor web de GitHub, sin entorno local — así se mantuvo el proyecto durante su primera etapa.

Después de cambiar código de Apps Script hay que **republicar la implementación**: Implementar → Administrar implementaciones → lápiz → Nueva versión → Implementar. Nunca crear una implementación nueva desde cero (cambia la URL `/exec` y rompe la variable de Vercel).

> La copia de los archivos `.gs` que está en este repositorio puede estar desactualizada respecto de lo que corre en Apps Script, porque se despliegan copiando y pegando a mano. Antes de reemplazar un `.gs` entero, verificar contra el editor de Apps Script.

## Licencia

Uso interno — SAMAN.
