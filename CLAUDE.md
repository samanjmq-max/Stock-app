# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The Next.js app lives in the **`stock-app/`** subdirectory, not the repo root — run all commands below from `stock-app/`.

## Commands

```bash
cd stock-app
npm install
npm run dev          # http://localhost:3000
npm run build
npm run start
npm run lint
npm test             # vitest run — all tests once
npm run test:watch   # vitest, watch mode
```

Run a single test file: `npx vitest run tests/rateLimit.test.ts`. Tests live in `stock-app/tests/` (`rateLimit.test.ts`, `utils.test.ts`, `validations.test.ts`), driven by `vitest.config.ts` with `@` aliased to `src/`.

There is no local database and no separate backend server to run — the "backend" is a Google Apps Script Web App URL (`GAS_WEB_APP_URL`) that the Next.js API routes call over HTTP. See `.env.example` for the required env vars (`JWT_SECRET`, `GAS_WEB_APP_URL`, `GAS_API_KEY`, `SUPER_ADMIN_EMAIL`).

## Architecture

StockApp is an inventory-counting PWA (Next.js 15 App Router + React 19 + TypeScript) for SAMAN's logistics warehouses. Workers count stock via barcode/camera/OCR/manual entry, the app diffs counts against SAP stock, and everything works offline-first.

### Persistence: Google Sheets behind one seam

There is no traditional database yet. `src/lib/sheets.ts` is the **only** file that knows persistence is Google Sheets — it exposes domain functions (`getProductos`, `guardarConteo`, `registrarHistorial`, etc.) rather than Sheets details. Every API route calls through this file, never the Apps Script URL directly. The Apps Script backend itself lives outside `src/`, in `google-apps-script/` (`Code.gs`, `Utils.gs`, `Usuarios.gs`, `Productos.gs`, `Conteos.gs`, `Historial.gs`) and is deployed by pasting into script.google.com — it is not built or run by this repo's tooling. `database/schema.sql` is the target schema for an eventual Postgres/Supabase migration; when that happens, only `sheets.ts` is expected to change.

Browser code never talks to Apps Script directly — every call goes browser → Next.js API route → `sheets.ts` → Apps Script Web App (`GAS_API_KEY` shared secret), because Apps Script is the only piece that touches the actual spreadsheet.

### Auth and route protection

`src/middleware.ts` is the single authorization chokepoint: it verifies the JWT (`src/lib/auth.ts`, using `jose` for Edge Runtime compatibility) from the `AUTH_COOKIE_NAME` cookie, redirects/401s unauthenticated requests, and additionally gates `RUTAS_SOLO_ADMIN` (`/configuracion`, `/usuarios`, `/api/usuarios`, `/etiquetas`) to `rol === "administrador"`. On success it injects the identity into request headers (`x-user-id`, `x-user-email`, `x-user-rol`, `x-user-agencia`, `x-user-es-super-admin`) for downstream API routes and server components to read — **any new admin-only route must be added to `RUTAS_SOLO_ADMIN` in `middleware.ts`, or it will be reachable by any logged-in user.** Passwords are hashed with bcrypt (`src/lib/password.ts`); `scripts/generar-hash.js` bootstraps the first admin's hash by hand since there's no admin yet to create one through the UI. Login brute-force protection is in-memory (`src/lib/ratelimit.ts`, 5 attempts / 10 min) — the file's own comment documents how to swap it for Upstash Redis if the app moves to multi-instance serverless, and that swap is scoped to that one file.

Super-admin is a single email (`SUPER_ADMIN_EMAIL`) checked via `src/lib/permisos.ts`, layered on top of the `administrador`/`operador` role stored per user. Multi-agencia scoping (an operator sees only their own `agencia`) is enforced per-route/per-query using the identity headers middleware injects, not by a single shared filter.

### Offline mode: IndexedDB queue + sync

Only the **Conteo** (counting) module works offline; Productos/Usuarios/Historial always require a connection (no sense caching admin writes). `src/db/offlineDb.ts` wraps IndexedDB (`idb`) with a cached product catalog and a pending-counts queue; `src/hooks/useSync.ts` reconciles that queue against `/api/conteos/sync-batch` when connectivity returns (auto on reconnect, or manually from the topbar). `public/sw.js` + `public/offline.html` provide the PWA app-shell precache/fallback; `public/manifest.json` makes it installable.

### Item identification has four parallel input paths

`src/features/escaneo/` holds camera scanning (`BarcodeScanner.tsx`, ZXing — lazy-loaded only when the camera opens, per the Etapa 4 perf pass) and OCR (`OcrScanner.tsx`, Tesseract.js) as separate components/hooks; `src/hooks/useHardwareScanner.ts` handles Bluetooth/USB scanners via keyboard-HID emulation; manual code entry is plain form input. These four paths converge on the same counting flow in `(dashboard)/conteo/page.tsx` but are not unified behind one abstraction — when changing "how an item gets identified," check all four.

### Directory conventions

- `src/features/<name>/{components,hooks}/` — code specific to one module (escaneo, productos, usuarios import/export). Small/shared UI stays in top-level `components/` and `hooks/` instead (see `src/features/README.md`); a feature only gets its own folder once it outgrows those.
- `src/services/` — typed fetch wrappers the client calls; these call the Next.js API routes in `src/app/api/`, which in turn call `src/lib/sheets.ts`.
- `src/components/ui/` — shadcn/ui primitives, hand-written (not generated via the shadcn CLI in this repo).
- `assets/` (source SVGs/logos, not served) vs `public/` (served as-is, PWA icons/manifest/sw.js) — see `stock-app/assets/README.md`.
- `config/site.ts` — app-wide constants (roles, route paths, count-state enum) shared by both client and server code.

### Deployment model

No CI pipeline — pushing to `main` triggers an automatic Vercel redeploy. The intended workflow is editing directly via GitHub's web editor for frontend changes and the Apps Script editor for backend changes, with `PRODUCCION.md` as the pre-production checklist (security headers in `next.config.mjs`, JWT/API key rotation, Sentry, etc.) — consult it before large changes that touch auth, security headers, or the rate limiter.
