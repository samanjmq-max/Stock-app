# StockApp

Aplicación de conteo de inventario para centros de distribución logística de **SAMAN** en Uruguay. Reemplaza el conteo manual en papel: el personal de depósito escanea o fotografía cada artículo, carga la cantidad encontrada, y el sistema compara automáticamente contra el stock de SAP para detectar diferencias (sobrantes/faltantes) — todo desde el celular, con o sin conexión a internet.

🔗 **App en producción:** [stock-app-gold-six.vercel.app](https://stock-app-gold-six.vercel.app)

---

## ¿Para qué sirve?

Antes del conteo se hacía a mano en planillas de papel, se cruzaba contra SAP después y los errores de tipeo y de trazabilidad eran constantes. StockApp digitaliza todo el proceso:

- El operador identifica un artículo (código manual, lector Bluetooth, cámara o foto del número) y carga lo que encontró.
- El sistema calcula la diferencia contra el stock teórico al instante.
- Un Dashboard en vivo muestra el avance del inventario, coincidencias y diferencias, para toda la empresa o filtrado por depósito.
- Todo queda auditado: quién contó qué, cuándo, y qué se corrigió o eliminó.

## Funcionalidades principales

| Módulo | Qué hace |
|---|---|
| **Login y roles** | Acceso por email/contraseña. Roles operador y administrador, con una jerarquía de super administrador (control total) y administradores de planta (limitados a su propia agencia). |
| **Multi-agencia** | Cada usuario y cada producto pertenecen a una agencia (depósito). Los operadores solo ven y cuentan la suya; los administradores pueden ver o filtrar cualquiera. |
| **Contar stock** | 4 formas de identificar un artículo: código a mano, lector Bluetooth, cámara (código de barras), o foto con reconocimiento de texto (OCR) para artículos sin código impreso. |
| **Dashboard** | Tarjetas con indicadores clickeables (coincidencias, diferencias, pendientes), gráficos de avance, tabla de conteos con edición/eliminación, búsqueda, scroll con altura fija, y actualización automática. |
| **Productos** | Catálogo completo, búsqueda, importación masiva desde Excel, alta y edición manual. |
| **Generar etiqueta** | Genera e imprime etiquetas de código de barras (10×5 cm) para artículos nuevos o para reimprimir, con búsqueda automática en el catálogo o carga masiva desde Excel. |
| **Historial** | Registro cronológico de toda la actividad relevante, para auditoría. |
| **Usuarios** | Administración de cuentas, roles y agencias (solo administradores). |
| **Modo sin conexión** | El catálogo y los conteos se guardan localmente y se sincronizan solos al recuperar señal. |

## Stack técnico

- **Frontend + API:** [Next.js 15](https://nextjs.org) (App Router) · TypeScript · React 19 · Tailwind CSS
- **Backend de datos:** Google Apps Script + Google Sheets
- **Autenticación:** JWT ([jose](https://github.com/panva/jose), compatible con Edge Runtime) + bcrypt para contraseñas
- **PDF y códigos de barras:** [jsPDF](https://github.com/parallax/jsPDF) + [bwip-js](https://github.com/metafloor/bwip-js), generados en el servidor
- **Escaneo:** [@zxing/browser](https://github.com/zxing-js/browser) (códigos de barras) · [Tesseract.js](https://github.com/naptha/tesseract.js) (OCR)
- **Modo offline:** IndexedDB vía [idb](https://github.com/jakearchibald/idb)
- **Despliegue:** [Vercel](https://vercel.com)

## Estructura del proyecto

```
stock-app/
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # Páginas protegidas: Dashboard, Conteo, Productos, Etiquetas, Usuarios, etc.
│   │   ├── api/                # Rutas de API (auth, productos, conteos, usuarios, etiquetas)
│   │   └── login/
│   ├── components/             # Componentes de UI (dashboard, layout, formularios)
│   ├── contexts/                # AuthContext (sesión del usuario)
│   ├── hooks/                    # useDashboardData y otros hooks
│   ├── lib/                        # auth, password, headers, permisos, validaciones, utils
│   ├── services/                  # Llamadas al backend desde el frontend
│   └── middleware.ts              # Autenticación, permisos por rol y propagación de identidad
├── Google-apps-script/         # Código del backend (Code.gs, Productos.gs, Conteos.gs, Usuarios.gs, Utils.gs)
└── package.json
```

## Cómo funciona el backend

El "servidor de datos" es una planilla de Google Sheets con un script de Apps Script publicado como Web App (`/exec`). Las rutas de la API de Next.js llaman a esa URL autenticándose con una clave compartida (`GAS_API_KEY`), nunca se conecta directo desde el navegador.

Variables de entorno necesarias en Vercel:

| Variable | Uso |
|---|---|
| `GAS_API_KEY` | Autentica las llamadas de Vercel hacia Apps Script (debe coincidir en ambos lados) |
| `GAS_WEB_APP_URL` | URL `/exec` de la implementación activa de Apps Script |
| `JWT_SECRET` | Clave para firmar las sesiones de login |
| `SUPER_ADMIN_EMAIL` | Email del super administrador (control total sobre todas las agencias) |

## Desarrollo y despliegue

Este proyecto está pensado para mantenerse **sin entorno local**: todo cambio de frontend se edita desde el editor web de GitHub, y todo cambio de backend desde el editor de Apps Script en `script.google.com`. Cada commit en `main` dispara un redeploy automático en Vercel.

Si preferís trabajar en local:

```bash
npm install
npm run dev
```

## Licencia

Uso interno — SAMAN.
