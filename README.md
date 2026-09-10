[README.md](https://github.com/user-attachments/files/32033802/README.md)
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
| **Contar stock** | 4 formas de identificar un artículo: código a mano, lector Bluetooth, cámara (código de barras) o foto con reconocimiento de texto (OCR) para artículos sin código impreso. Permite registrar una ubicación distinta a la de SAP sin perder el dato original. |
| **Dashboard** | Tarjetas clickeables con cantidades **e importes en pesos** (contados, pendientes, coincidencias, diferencias +/−), gráficos de avance y de importe, tabla de conteos con buscador, orden por cualquier columna, scroll de alto fijo y edición/eliminación. |
| **Valorización** | Cada producto tiene un precio unitario (calculado automáticamente al importar el export de SAP). Las diferencias se valorizan en pesos, para priorizar qué analizar primero y qué ajustar directo sin mayor análisis. |
| **Exportación** | A Excel y PDF, respetando el filtro activo (o el conteo completo), incluyendo precio unitario e importe por línea. |
| **Productos** | Catálogo completo, búsqueda, importación masiva desde Excel (formato simplificado o el export crudo de SAP), alta y edición manual. |
| **Generar etiqueta** | Genera e imprime etiquetas de código de barras (10×5 cm) para artículos nuevos o para reimprimir, con búsqueda automática en el catálogo o carga masiva desde Excel. |
| **Historial** | Registro cronológico de toda la actividad relevante, para auditoría. |
| **Usuarios** | Administración de cuentas, roles y agencias (solo administradores, con permisos delegados por planta). |
| **Modo sin conexión** | El catálogo y los conteos se guardan localmente y se sincronizan solos al recuperar señal. |

## Stack técnico

- **Frontend + API:** [Next.js 15](https://nextjs.org) (App Router) · TypeScript · React 19 · Tailwind CSS
- **Backend de datos:** Google Apps Script + Google Sheets
- **Autenticación:** JWT ([jose](https://github.com/panva/jose), compatible con Edge Runtime) + bcrypt para contraseñas
- **PDF y códigos de barras:** [jsPDF](https://github.com/parallax/jsPDF) + [bwip-js](https://github.com/metafloor/bwip-js), generados en el servidor
- **Escaneo:** [@zxing/browser](https://github.com/zxing-js/browser) (códigos de barras) · [Tesseract.js](https://github.com/naptha/tesseract.js) (OCR)
- **Modo offline:** IndexedDB vía [idb](https://github.com/jakearchibald/idb)
- **Gráficos:** [Recharts](https://recharts.org)
- **Despliegue:** [Vercel](https://vercel.com)

## Estructura del proyecto

```
stock-app/
├── src/
│   ├── app/
│   │   ├── (dashboard)/        # Páginas protegidas: dashboard, conteo, productos, etiquetas, usuarios…
│   │   ├── api/                # Rutas de API (auth, productos, conteos, usuarios, etiquetas)
│   │   ├── login/
│   │   └── recuperar/          # Recuperación de contraseña del super administrador
│   ├── components/             # Componentes de UI (dashboard, layout, formularios)
│   ├── contexts/               # AuthContext (sesión del usuario)
│   ├── db/                     # offlineDb (IndexedDB, cola de conteos sin conexión)
│   ├── hooks/                  # useDashboardData, useSync y otros
│   ├── lib/                    # auth, password, headers, permisos, validaciones, importación, utils
│   ├── services/               # Llamadas al backend desde el frontend
│   └── middleware.ts           # Autenticación, permisos por rol y propagación de identidad
├── Google-apps-script/         # Backend (Código.gs, Productos.gs, Conteos.gs, Usuarios.gs, Historial.gs, Code.gs)
└── package.json
```

## Cómo funciona el backend

El "servidor de datos" es una planilla de Google Sheets con un script de Apps Script publicado como Web App (`/exec`). Las rutas de la API de Next.js llaman a esa URL autenticándose con una clave compartida (`GAS_API_KEY`) — el navegador nunca se conecta directo a la planilla.

Variables de entorno necesarias en Vercel:

| Variable | Uso |
|---|---|
| `GAS_API_KEY` | Autentica las llamadas de Vercel hacia Apps Script (debe coincidir en ambos lados) |
| `GAS_WEB_APP_URL` | URL `/exec` de la implementación activa de Apps Script |
| `JWT_SECRET` | Clave para firmar las sesiones de login |
| `SUPER_ADMIN_EMAIL` | Email del super administrador (control total sobre todas las agencias) |
| `RECOVERY_CODE` | Código secreto para recuperar la contraseña del super administrador |

> Al crear o cambiar una variable de entorno en Vercel hay que forzar un **Redeploy** manual: los deployments que ya estaban corriendo no la toman solos.

## Importación de productos

El importador acepta dos formatos, sin necesidad de convertir nada:

**1. Export crudo de SAP** — se sube tal cual, con sus columnas originales: `Material`, `Texto breve de material`, `Libre utilización`, `Valor libre util.`, `Ubicación`, `Grupo de artículos`. El precio unitario se calcula solo (`Valor libre util. ÷ Libre utilización`).

**2. Formato simplificado** — `codigo`, `descripcion`, `ubicacion`, `familia`, `proveedor`, `stockSap` y, opcionalmente, `precioUnitario`. Si no se incluye el precio, no se pisa el que ya estaba cargado.

La importación **actualiza** el catálogo (stock, ubicación, precio) y **nunca toca los conteos ya realizados**.

## Funciones de mantenimiento (Apps Script)

En `Conteos.gs` hay funciones que se ejecutan manualmente desde el editor de Apps Script, no desde la app:

- `repararAgenciasCodificadas()` — corrige agencias guardadas con caracteres codificados (ej: `Centro Log%C3%ADstico`).
- `limpiarDuplicadosPorCodigo()` — deja un solo conteo por combinación código + ubicación para un código puntual (se configura en la constante `CODIGO_A_LIMPIAR`).

## Desarrollo y despliegue

El proyecto está pensado para mantenerse **sin entorno local**: el frontend se edita desde el editor web de GitHub, y el backend desde `script.google.com`. Cada commit en `main` dispara un redeploy automático en Vercel.

Después de cambiar código de Apps Script hay que **republicar la implementación**: Implementar → Administrar implementaciones → lápiz → Nueva versión → Implementar. Nunca crear una implementación nueva desde cero (cambia la URL `/exec`).

Si preferís trabajar en local:

```bash
npm install
npm run dev
```

## Licencia

Uso interno — SAMAN.
