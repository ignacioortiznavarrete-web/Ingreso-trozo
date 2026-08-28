/* Arma un HTML autónomo con datos simulados, para revisar el diseño en el
   navegador sin necesidad de Apps Script. */
require(require('path').join(__dirname, 'harness.js'));
require(require('path').join(__dirname, 'planilla-falsa.js'));
const fs = require('fs'), vm = require('vm');
vm.runInThisContext(fs.readFileSync(require('path').join(__dirname, '..', 'src', 'Apuntes.gs'),'utf8'), {filename:'Apuntes.gs'});

const SRC = require('path').join(__dirname, '..', 'src') + '/';
const core = buildDashboardCore_();
guardarApunte({ proveedor:'CAYUMANQUI SA', pregunta:'Por que viene a la baja 42% en los ultimos 3 dias habiles y como recupera?',
  tipo:'Pregunta', prioridad:'Alta', estado:'Abierto', m3:400, responsable:'Ignacio Ortiz',
  fechaCompromiso:'2026-08-27', cumplimiento:0.86, tendencia:'BAJA' });
guardarApunte({ proveedor:'D. RODRIGUEZ', pregunta:'Que corto el despacho hace 6 dias habiles y cuando se retoma?',
  tipo:'Riesgo', prioridad:'Alta', estado:'En curso', m3:900, responsable:'Ignacio Ortiz',
  fechaCompromiso:'2026-08-26', respuesta:'Camino de saca cortado por lluvia. Retoma el lunes con 4 camiones.',
  cumplimiento:0.62, tendencia:'CORTADO' });
guardarApunte({ proveedor:'ANGOL LMTD', pregunta:'Confirma que sostiene el ritmo hasta el cierre del mes?',
  tipo:'Compromiso', prioridad:'Baja', estado:'Cerrado', m3:600, responsable:'Ignacio Ortiz',
  respuesta:'Confirmado: mantiene 6 camiones diarios hasta el 31.', cumplimiento:1.18, tendencia:'SUBE' });

const indiceGis = getRolesIndex(true);
const poligonosGis = getRolesPolygons(indiceGis.items.map(i => i.rolKey)).polygons;

const RESPUESTAS = {
  getDashboardData: core.summary,
  getDetalleIngresos: core.detalle,
  getRolesIndex: indiceGis,
  getRolesPolygons: null,
  __poligonos: poligonosGis,
  getApuntes: getApuntes(),
  guardarApunte: getApuntes(), cambiarEstadoApunte: getApuntes(), eliminarApunte: getApuntes(),
  getValoresRecepcion: {
    unidad:'m3',
    precios: core.detalle.map((_, i) => (i % 7 === 0 ? 0 : 48 + (i % 9))),
    diagnostics: { ok:true, hoja:'Valores', preciosCargados:184, matchPorClave:118,
                   claveUsa:{ diametro:true, largo:true }, muestraValores:[], muestraDetalle:[] }
  }
};

let html = fs.readFileSync(SRC + 'Index.html','utf8')
  .replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, f) => fs.readFileSync(SRC + f + '.html','utf8'));

// Se quita solo el puente de Apps Script; fuentes, Leaflet y Charts se dejan
// para que la vista previa sea fiel.
html = html.replace('</head>',
  '<script>window.__RESPUESTAS = ' + JSON.stringify(RESPUESTAS) + ';</script>' +
  '<script>' + fs.readFileSync(require('path').join(__dirname, 'stubs-preview.js'),'utf8') + '</script></head>');

fs.writeFileSync(require('path').join(__dirname, 'preview.html'), html);
console.log('preview.html generado (' + (html.length/1024).toFixed(0) + ' KB)');
