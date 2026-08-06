-- ============================================================
-- database/schema.sql
--
-- Esquema lógico de las entidades del sistema, pensado para una futura
-- migración de Google Sheets a PostgreSQL / Supabase.
--
-- Hoy NO se ejecuta nada de esto (la persistencia real es Google Sheets
-- vía Apps Script, ver /google-apps-script). Este archivo documenta el
-- modelo de datos para que esa migración sea mecánica: cada tabla espeja
-- 1 a 1 una hoja + sus columnas (ver Utils.gs -> HEADERS), y los tipos
-- de src/types/index.ts. El día de la migración, solo se reimplementan
-- las funciones de src/lib/sheets.ts contra estas tablas (por ejemplo
-- con Prisma o Drizzle) — el resto de la app no cambia.
-- ============================================================

CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    rol             TEXT NOT NULL CHECK (rol IN ('administrador', 'operador')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE productos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          TEXT NOT NULL UNIQUE,
    descripcion     TEXT NOT NULL,
    ubicacion       TEXT DEFAULT '',
    familia         TEXT DEFAULT '',
    proveedor       TEXT DEFAULT '',
    stock_sap       NUMERIC NOT NULL DEFAULT 0,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_productos_codigo ON productos (codigo);
CREATE INDEX idx_productos_ubicacion ON productos (ubicacion);

CREATE TABLE conteos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          TEXT NOT NULL,
    descripcion     TEXT DEFAULT '',
    ubicacion       TEXT DEFAULT '',
    stock_sap       NUMERIC NOT NULL DEFAULT 0,
    stock_contado   NUMERIC NOT NULL,
    diferencia      NUMERIC NOT NULL,
    estado          TEXT NOT NULL CHECK (estado IN ('coincide', 'sobra', 'falta', 'no_existe')),
    observaciones   TEXT DEFAULT '',
    usuario_id      UUID REFERENCES usuarios (id),
    usuario_email   TEXT NOT NULL,
    fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
    hora            TIME NOT NULL DEFAULT CURRENT_TIME,
    sincronizado    BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conteos_codigo ON conteos (codigo);
CREATE INDEX idx_conteos_creado_en ON conteos (creado_en DESC);

CREATE TABLE historial (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID REFERENCES usuarios (id),
    usuario_email   TEXT NOT NULL,
    rol             TEXT NOT NULL,
    accion          TEXT NOT NULL,
    entidad         TEXT DEFAULT '',
    valor_anterior  TEXT DEFAULT '',
    valor_nuevo     TEXT DEFAULT '',
    observacion     TEXT DEFAULT '',
    fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
    hora            TIME NOT NULL DEFAULT CURRENT_TIME,
    dispositivo     TEXT DEFAULT '',
    ip              TEXT DEFAULT '',
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_historial_usuario ON historial (usuario_id);
CREATE INDEX idx_historial_accion ON historial (accion);

CREATE TABLE configuracion (
    clave           TEXT PRIMARY KEY,
    valor           TEXT NOT NULL,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    accion          TEXT NOT NULL,
    detalle         TEXT DEFAULT '',
    error           TEXT DEFAULT ''
);

-- Sesiones: no existen como hoja separada en la etapa de Google Sheets
-- (la sesión hoy vive solo en el JWT, sin estado en el servidor). Se
-- deja modelada acá para cuando se quiera soportar invalidación de
-- sesiones activas / "cerrar sesión en todos los dispositivos".
CREATE TABLE sesiones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES usuarios (id),
    token_hash      TEXT NOT NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en       TIMESTAMPTZ NOT NULL,
    revocada        BOOLEAN NOT NULL DEFAULT FALSE
);

-- Sincronizaciones: registro de cada corrida de import/export o de
-- sincronización offline en lote, para poder mostrar "última
-- sincronización" con detalle de qué se sincronizó.
CREATE TABLE sincronizaciones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo            TEXT NOT NULL, -- 'importacion_productos' | 'conteos_offline' | 'exportacion'
    usuario_id      UUID REFERENCES usuarios (id),
    cantidad_filas  INTEGER NOT NULL DEFAULT 0,
    estado          TEXT NOT NULL DEFAULT 'completado', -- 'completado' | 'error' | 'parcial'
    detalle         TEXT DEFAULT '',
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
