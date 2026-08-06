# features/

A medida que crezcan los módulos (Etapas 2-3: escaneo, importación,
reportes), el código específico de cada uno se organiza acá por
feature en vez de seguir amontonando todo en `components/` y `hooks/`
genéricos. Por ejemplo:

```
features/
  escaneo/
    components/BarcodeScanner.tsx
    hooks/useBarcodeScanner.ts
  importacion/
    components/ImportWizard.tsx
    hooks/useImportacion.ts
```

En la Etapa 1, todo el código todavía es lo bastante chico como para
vivir en `components/`, `hooks/` y `services/` sin necesidad de esta
capa — se activa cuando esos módulos crecen.
