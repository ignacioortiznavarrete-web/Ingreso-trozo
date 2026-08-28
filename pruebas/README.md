# Pruebas

Apps Script no se puede ejecutar localmente, así que estas pruebas cargan los
archivos `.gs` en Node con stubs mínimos de los servicios de Google
(`SpreadsheetApp`, `CacheService`, `Utilities`, `LockService`) y una planilla
simulada con la misma forma que la real.

```bash
cd pruebas
npm install                # jsdom y playwright
node test-analisis.js      # tendencia, riesgo y plan de acción
node test-pipeline.js      # pipeline completo del servidor y hoja Apuntes
node test-frontend.js      # render de la página en jsdom
```

`construir-preview.js` genera un `preview.html` autónomo con datos simulados
para revisar el diseño en un navegador sin necesidad de desplegar nada:

```bash
node construir-preview.js && open preview.html
```

Los stubs de `stubs-preview.js` reemplazan solo el puente `google.script.run`.
