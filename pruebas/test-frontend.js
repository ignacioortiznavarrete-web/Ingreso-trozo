require(require('path').join(__dirname, 'harness.js'));
require(require('path').join(__dirname, 'planilla-falsa.js'));
const fs = require('fs'), vm = require('vm');
vm.runInThisContext(fs.readFileSync(require('path').join(__dirname, '..', 'src', 'Apuntes.gs'),'utf8'), {filename:'Apuntes.gs'});

const SRC = require('path').join(__dirname, '..', 'src') + '/';
let fallos = 0;
const ok = (c, m, e) => { console.log((c?'  PASA  ':'  FALLA ')+m+(e!==undefined?'  ->  '+e:'')); if(!c) fallos++; };

const core = buildDashboardCore_();
guardarApunte({ proveedor:'CAYUMANQUI SA', pregunta:'Por que viene a la baja tres dias seguidos',
                tipo:'Pregunta', prioridad:'Alta', estado:'Abierto', m3:400 });
guardarApunte({ proveedor:'D. RODRIGUEZ', pregunta:'Cuando retoma despacho', tipo:'Riesgo',
                prioridad:'Alta', estado:'En curso', m3:900 });
const apuntes = getApuntes();

const RESPUESTAS = {
  getDashboardData: core.summary,
  getDetalleIngresos: core.detalle,
  getRolesMapData: { items: [], diagnostics: { rolesEnHoja:5, rolesConArchivo:0, rolesSinArchivo:3, errores:[] } },
  getApuntes: apuntes,
  guardarApunte: apuntes,
  cambiarEstadoApunte: apuntes,
  eliminarApunte: apuntes,
  getValoresRecepcion: {
    unidad: 'm3',
    precios: core.detalle.map((_, i) => (i % 5 === 0 ? 0 : 52.5)),
    diagnostics: { ok:true, hoja:'Valores', preciosCargados:120, matchPorClave:100,
                   claveUsa:{ diametro:true, largo:true }, muestraValores:[], muestraDetalle:[] }
  }
};

let html = fs.readFileSync(SRC + 'Index.html', 'utf8')
  .replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, f) => fs.readFileSync(SRC + f + '.html', 'utf8'));
ok(!/<\?!=/.test(html), 'todos los scriptlets include quedaron resueltos');

html = html.replace(/<script[^>]*\ssrc="[^"]*"[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
html = html.replace('</head>',
  '<script>window.__RESPUESTAS = ' + JSON.stringify(RESPUESTAS) + ';</script>' +
  '<script>' + fs.readFileSync(require('path').join(__dirname, 'stubs-navegador.js'), 'utf8') + '</script></head>');

const { JSDOM } = require('jsdom');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/' });
const win = dom.window;

setTimeout(() => {
  const $ = id => win.document.getElementById(id);
  const txt = id => ($(id) ? $(id).textContent.trim() : '<<falta>>');
  const q = (sel, root) => (root || win.document).querySelectorAll(sel);

  console.log('\n1. Arranque sin excepciones');
  ok(win.__errores.length === 0, 'no hubo errores durante la carga', win.__errores.slice(0,3).join(' | ') || 'ninguno');
  // DATA se declara con let: es un binding léxico global, no una propiedad de window.
  ok(win.eval('typeof DATA === "object" && DATA !== null && !!DATA.kpis'), 'el payload llegó al cliente');
  ok(win.eval('DATA.detalleIngresos.length') > 100, 'el detalle también', win.eval('DATA.detalleIngresos.length'));

  console.log('\n2. KPIs pintados');
  ok(/%/.test(txt('kCumplimientoPlan')), 'cumplimiento a fecha', txt('kCumplimientoPlan'));
  ok(/m³/.test(txt('kDiferenciaPlan')), 'brecha vs plan', txt('kDiferenciaPlan'));
  ok(/m³\/día/.test(txt('kRitmoRequerido')), 'ritmo requerido', txt('kRitmoRequerido'));
  ok(txt('kCub') !== '-', 'cubicación ingresada', txt('kCub'));
  ok(txt('kProveedoresRiesgo') !== '-', 'proveedores en riesgo', txt('kProveedoresRiesgo'));
  ok(/%/.test(txt('kConcentracion')), 'concentración top 3', txt('kConcentracion'));
  ok(txt('lastUpdateLabel') === '21/08/2026', 'fecha del último ingreso', txt('lastUpdateLabel'));
  ok(parseFloat($('progressReal').style.width) > 0, 'la barra de avance tiene ancho', $('progressReal').style.width);
  ok(parseFloat($('progressMeta').style.left) > 0, 'la marca de meta está posicionada', $('progressMeta').style.left);
  ok(/critico|alerta|ok/.test($('cardCumplimiento').dataset.estado || ''), 'la tarjeta lleva estado de semáforo', $('cardCumplimiento').dataset.estado);

  console.log('\n3. Cumplimiento plan proveedores');
  const t = $('tablaProveedor');
  ok(q('tbody tr', t).length >= 6, 'una fila por proveedor', q('tbody tr', t).length);
  ok(q('thead th', t).length === 12, 'tiene 12 columnas', q('thead th', t).length);
  ok(/Tendencia/.test(t.textContent), 'incluye la columna Tendencia');
  ok(q('svg.spark', t).length >= 4, 'dibuja sparklines', q('svg.spark', t).length);
  ok(q('.trend-baja', t).length >= 1, 'marca proveedor a la baja', q('.trend-baja', t).length);
  ok(q('.trend-cortado', t).length >= 1, 'marca proveedor cortado');
  ok(q('.trend-sube', t).length >= 1, 'marca proveedor al alza');
  ok(q('.chip-nota', t).length >= 6, 'cada fila trae chip de apuntes', q('.chip-nota', t).length);
  ok(/1 abierto/.test(t.textContent), 'muestra el apunte abierto de CAYUMANQUI');
  ok(q('.row-critico, .row-alerta', t).length >= 1, 'resalta filas en riesgo', q('.row-critico, .row-alerta', t).length);
  ok(q('.inline-toggle', t).length === 1, 'MASISA trae el desplegable de faenas');
  ok(/proveedores/.test(txt('cumplimientoStatus')), 'informa el conteo', txt('cumplimientoStatus'));

  console.log('\n4. Plan de acción');
  ok(q('.semaforo-item').length === 5, 'el semáforo tiene 5 bloques', q('.semaforo-item').length);
  const p = $('tablaPlanAccion');
  ok(q('tbody tr', p).length >= 5, 'lista proveedores priorizados', q('tbody tr', p).length);
  ok(q('.riesgo-fill', p).length >= 5, 'cada fila trae barra de riesgo');
  ok(/camiones\/día/.test(p.textContent), 'muestra camiones por día requeridos');
  ok(q('.sugerencia').length >= 2, 'genera preguntas sugeridas', q('.sugerencia').length);
  ok(/Guardar en apuntes/.test($('sugerencias').textContent), 'las sugerencias se pueden guardar');
  ok(q('tbody tr', $('tablaCoberturas')).length >= 1, 'propone quién cubre el déficit');
  ok(/^[1-9]/.test(txt('tabCountPlan')), 'la pestaña muestra proveedores en riesgo', txt('tabCountPlan'));

  console.log('\n5. Apuntes');
  ok(txt('kApuntesAbiertos') === '1', 'cuenta apuntes abiertos', txt('kApuntesAbiertos'));
  ok(txt('kApuntesM3') !== '-', 'm³ comprometidos', txt('kApuntesM3'));
  ok(q('.apunte-item').length === 2, 'lista los dos apuntes', q('.apunte-item').length);
  ok(/CAYUMANQUI/.test($('listaApuntes').textContent), 'el apunte nombra al proveedor');
  ok(q('option', $('listaProveedores')).length >= 5, 'autocompletado poblado', q('option', $('listaProveedores')).length);
  ok(txt('tabCountApuntes') === '1', 'contador de la pestaña', txt('tabCountApuntes'));

  console.log('\n6. Valores');
  ok(/\$/.test(txt('kValorTotal')), 'valor total de recepción', txt('kValorTotal'));
  ok(/%/.test(txt('kCoberturaValor')), 'cobertura valorizada', txt('kCoberturaValor'));
  ok(q('tbody tr', $('tablaSinPrecio')).length >= 1, 'lista recepciones sin precio', q('tbody tr', $('tablaSinPrecio')).length);
  ok(q('tbody tr', $('tablaValorProveedor')).length >= 5, 'valor por proveedor');
  ok(/Precio prom/.test($('tablaProveedor').textContent), 'el precio promedio llega a la tabla de cumplimiento');

  console.log('\n7. Detalle y territorio');
  ok(q('tbody tr', $('tablaCalidad')).length >= 2, 'resumen por calidad');
  ok(q('tbody tr', $('tablaRegion')).length >= 2, 'resumen por región');
  ok(q('tbody tr', $('tablaGeneral')).length >= 5, 'tabla general de recepciones');
  ok(q('tbody tr', $('tablaMatriz')).length >= 1, 'matriz diámetro por largo');
  ok(/3 sin archivo en Drive/.test(txt('mapStatus')), 'el diagnóstico del mapa sobrevive al caso vacío', txt('mapStatus'));

  console.log('\n8. Pestañas y dibujo condicional de gráficos');
  ok(q('.tab-panel.is-active').length === 1, 'un solo panel activo', q('.tab-panel.is-active').length);
  ok(q('.tab-panel.is-active')[0].id === 'panel-resumen', 'arranca en Resumen');
  const dibujados = () => [...new Set(win.__charts.map(c => c.id))];
  ok(dibujados().includes('chartFecha'), 'dibuja la entrega diaria', dibujados().join(', '));
  ok(dibujados().includes('chartBrecha'), 'dibuja la brecha por proveedor');
  ok(!dibujados().includes('chartValorProveedores'), 'no dibuja el gráfico de una pestaña oculta');
  win.__charts.length = 0;
  win.activateTab('valores');
  ok(q('.tab-panel.is-active')[0].id === 'panel-valores', 'cambia a Valores');
  ok($('tab-btn-valores').getAttribute('aria-selected') === 'true', 'marca la pestaña activa');
  win.renderChartsForActiveTab();
  ok(dibujados().includes('chartValorProveedores'), 'al abrirla, dibuja su gráfico', dibujados().join(', '));
  win.activateTab('resumen');

  console.log('\n9. Filtros');
  const antes = q('tbody tr', $('tablaProveedor')).length;
  $('fProveedor').value = 'CAYUMANQUI';
  win.renderAllFiltered();
  const despues = q('tbody tr', $('tablaProveedor')).length;
  ok(despues < antes && despues >= 1, 'filtrar reduce la tabla', antes + ' -> ' + despues);
  ok(/CAYUMANQUI/.test($('tablaProveedor').textContent), 'queda el proveedor filtrado');
  ok(/Vista filtrada/.test(txt('filtersSummary')), 'lo informa en la barra', txt('filtersSummary'));
  ok(q('tbody tr', $('tablaGeneral')).length < 20, 'el filtro alcanza también al detalle');
  win.limpiarFiltros();
  ok(q('tbody tr', $('tablaProveedor')).length === antes, 'limpiar restaura la tabla');

  console.log('\n10. Interacciones');
  win.toggleSoloRiesgo();
  const bajo = q('tbody tr', $('tablaProveedor')).length;
  ok(bajo < antes, 'Solo bajo plan filtra', antes + ' -> ' + bajo);
  win.toggleSoloRiesgo();
  win.cycleSortCompliance('cumpl');
  ok(q('tbody tr', $('tablaProveedor')).length === antes, 'ordenar no pierde filas');
  win.cycleSortCompliance('tend');
  ok(q('thead th.sort-asc, thead th.sort-desc', $('tablaProveedor')).length >= 1, 'marca la columna ordenada');
  win.filtrarPlan('CRITICO');
  ok(q('tbody tr', $('tablaPlanAccion')).length >= 1, 'filtrar críticos deja filas', q('tbody tr', $('tablaPlanAccion')).length);
  win.filtrarPlan('BAJA');
  ok(q('tbody tr', $('tablaPlanAccion')).length >= 1, 'filtrar a la baja deja filas');
  win.filtrarPlan('');
  const masisaBtn = q('.inline-toggle', $('tablaProveedor'))[0];
  masisaBtn.onclick();
  ok(q('.child-row', $('tablaProveedor'))[0].style.display === 'table-row', 'desplegar MASISA muestra sus faenas');
  win.abrirApunteDesdeTabla('ANGOL LMTD', 'Confirma que sostiene el ritmo');
  ok($('apunteProveedor').value === 'ANGOL LMTD', 'el puente rellena el proveedor');
  ok(/sostiene el ritmo/.test($('apuntePregunta').value), 'y rellena la pregunta');
  ok(q('.tab-panel.is-active')[0].id === 'panel-apuntes', 'y salta a la pestaña Apuntes');
  win.resetFormApunte();
  ok($('apuntePregunta').value === '', 'limpiar el formulario funciona');

  console.log('\n11. Sin errores acumulados');
  ok(win.__errores.length === 0, 'ninguna excepción en toda la sesión', win.__errores.slice(0,4).join(' | ') || 'ninguna');

  console.log('\n' + (fallos ? fallos + ' PRUEBAS FALLIDAS' : 'TODAS LAS PRUEBAS PASAN'));
  process.exit(fallos ? 1 : 0);
}, 600);
