require(require('path').join(__dirname, 'harness.js'));
require(require('path').join(__dirname, 'planilla-falsa.js'));
const fs = require('fs'), vm = require('vm');
vm.runInThisContext(fs.readFileSync(require('path').join(__dirname, '..', 'src', 'Apuntes.gs'),'utf8'), {filename:'Apuntes.gs'});

let fallos = 0;
const ok = (c, m, e) => { console.log((c?'  PASA  ':'  FALLA ')+m+(e!==undefined?'  ->  '+e:'')); if(!c) fallos++; };

console.log('\n1. buildDashboardCore_ end to end');
const core = buildDashboardCore_();
const d = core.summary;
ok(!!d && !!d.kpis, 'devuelve el resumen con KPIs');
ok(core.detalle.length > 0, 'devuelve el detalle de ingresos', core.detalle.length);
ok(d.planMonth === 'ago-26', 'detecta la columna de plan del mes', d.planMonth);
ok(d.kpis.planCubicacion === 26100, 'suma el plan del mes sin la fila TOTAL', d.kpis.planCubicacion);
ok(d.kpis.diasHabilesMes === 21, 'días hábiles del mes', d.kpis.diasHabilesMes);
ok(d.kpis.diasHabilesTranscurridos === 15, 'días hábiles transcurridos', d.kpis.diasHabilesTranscurridos);
ok(d.kpis.diasHabilesFaltantes === 6, 'días hábiles faltantes', d.kpis.diasHabilesFaltantes);

console.log('\n2. Coherencia aritmética de los KPIs');
const sumaDetalle = core.detalle.reduce((s,r)=>s+r.cubicacion,0);
ok(Math.abs(d.kpis.totalCubicacion - sumaDetalle) < 1e-6, 'total = suma del detalle', d.kpis.totalCubicacion.toFixed(1));
ok(Math.abs(d.kpis.planAFecha - d.kpis.planDiarioHabil*15) < 1e-6, 'plan a fecha = plan diario por días transcurridos');
ok(Math.abs(d.kpis.diferenciaPlanAFecha - (d.kpis.totalCubicacion - d.kpis.planAFecha)) < 1e-6, 'diferencia coherente');
ok(Math.abs(d.kpis.ritmoDiarioActual*d.kpis.diasHabilesMes - d.kpis.proyeccionCierreMes) < 1e-6, 'proyección = ritmo por días del mes');
ok(Math.abs(d.kpis.ritmoRequeridoDia*6 - d.kpis.m3FaltantesParaPlan) < 1e-6, 'ritmo requerido cierra la brecha en los días restantes');
ok(d.kpis.camionesRequeridosDia > 0 && Math.abs(d.kpis.camionesRequeridosDia - d.kpis.ritmoRequeridoDia/26) < 1e-9, 'camiones/día = m³/día sobre 26');
const sumaProv = d.proveedores.reduce((s,p)=>s+p.cubicacion,0);
ok(Math.abs(sumaProv - d.kpis.totalCubicacion) < 1e-6, 'los proveedores suman el total');
const sumaCal = d.calidades.reduce((s,c)=>s+c.cubicacion,0);
ok(Math.abs(sumaCal - d.kpis.totalCubicacion) < 1e-6, 'las calidades suman el total');
const sumaFechas = d.fechas.reduce((s,f)=>s+f.cubicacion,0);
ok(Math.abs(sumaFechas - d.kpis.totalCubicacion) < 1e-6, 'las fechas suman el total');

console.log('\n3. Tendencia inyectada en cumplimiento');
const byName = {}; d.cumplimientoProveedores.forEach(c => byName[c.proveedor]=c);
ok(byName['CAYUMANQUI SA'].tendencia === 'BAJA', 'CAYUMANQUI viene a la baja', byName['CAYUMANQUI SA'].tendencia);
ok(byName['FORESTAL FHO'].tendencia === 'ESTABLE', 'FHO estable', byName['FORESTAL FHO'].tendencia);
ok(byName['D. RODRIGUEZ'].tendencia === 'CORTADO', 'D. RODRIGUEZ cortado', byName['D. RODRIGUEZ'].tendencia);
ok(byName['ANGOL LMTD'].tendencia === 'SUBE', 'ANGOL al alza', byName['ANGOL LMTD'].tendencia);
ok(byName['SERGESAL'].tendencia === 'SIN INGRESO', 'proveedor con plan y sin ingreso', byName['SERGESAL'].tendencia);
ok(d.cumplimientoProveedores.every(c => Array.isArray(c.serieDiaria)), 'toda fila trae serie diaria para el sparkline');
ok(byName['CAYUMANQUI SA'].serieDiaria.length === 15, 'la serie tiene un punto por día hábil transcurrido', byName['CAYUMANQUI SA'].serieDiaria.length);
ok(byName['D. RODRIGUEZ'].diasSinIngreso === 6, 'cuenta los días sin despacho', byName['D. RODRIGUEZ'].diasSinIngreso);

console.log('\n4. Plan de acción');
const pa = d.planAccion;
ok(pa.filas.length > 0, 'genera filas', pa.filas.length);
ok(pa.filas.every(f => f.accion && f.pregunta && f.nivel), 'toda fila trae nivel, acción y pregunta');
ok(pa.resumen.criticos + pa.resumen.alerta + pa.resumen.seguimiento + pa.resumen.ok +
   pa.resumen.sobrePlan + pa.resumen.sinPlan === pa.filas.length, 'el semáforo suma el total de filas');
const sergesal = pa.filas.find(f=>f.proveedor==='SERGESAL');
ok(sergesal && sergesal.nivel === 'CRITICO', 'SERGESAL (plan sin ingreso) es crítico', sergesal && sergesal.nivel);
ok(pa.filas.find(f=>f.proveedor==='D. RODRIGUEZ').nivel === 'CRITICO', 'el cortado es crítico');
ok(d.kpis.proveedoresCriticos === pa.resumen.criticos, 'el KPI de críticos coincide con el plan');

console.log('\n5. MASISA y sus faenas');
const masisa = byName['MASISA SA'];
ok(masisa && masisa.faenas.length >= 1, 'MASISA trae desglose de faenas', masisa && masisa.faenas.length);
ok(masisa.faenas.some(f => /NAHUELTORO/.test(f.faena)), 'la faena NAHUELTORO aparece');
ok(Math.abs(masisa.plan - 3100) < 1e-6, 'el plan de MASISA suma sus dos faenas', masisa.plan);

console.log('\n6. Proyección de camiones y diagnóstico');
ok(d.proyeccionCamiones.length === 6, 'lee las celdas de proyección del mes', d.proyeccionCamiones.length);
ok(d.kpis.camionesProyectadosMes === 32, 'suma los camiones proyectados', d.kpis.camionesProyectadosMes);
ok(d.kpis.m3ProyectadosCamionesMes === 32*26, 'convierte camiones a m³', d.kpis.m3ProyectadosCamionesMes);
ok(d.diagnostico.planEncontrado === true, 'diagnostica que hay plan');
ok(d.diagnostico.mesesEnDatos.length === 1, 'detecta un solo mes en los datos', d.diagnostico.mesesEnDatos.length);

console.log('\n7. Caché por chunks');
const cache = CacheService.getScriptCache();
cacheDashboardCore_(cache, core);
const leido = getCacheChunked_(cache, CONFIG.CACHE_KEY);
ok(!!leido, 'el resumen vuelve desde la caché');
ok(JSON.stringify(leido) === JSON.stringify(core.summary), 'el resumen sobrevive intacto al troceado');
clearCacheChunked_(cache, CONFIG.CACHE_KEY);
ok(getCacheChunked_(cache, CONFIG.CACHE_KEY) === null, 'limpiar la caché la deja vacía');

console.log('\n8. Apuntes: alta, edición, cierre y borrado');
let ap = getApuntes();
ok(ap.existe === false && ap.items.length === 0, 'sin hoja Apuntes devuelve vacío sin reventar');
ap = guardarApunte({ proveedor:'CAYUMANQUI SA', pregunta:'Por que viene a la baja', tipo:'Pregunta',
                     prioridad:'Alta', estado:'Abierto', m3:500, cumplimiento:0.72, tendencia:'BAJA' });
ok(ap.items.length === 1, 'guarda el primer apunte y crea la hoja', ap.items.length);
ok(ap.resumen.abiertos === 1, 'lo cuenta como abierto');
ok(ap.resumen.porProveedor['CAYUMANQUI SA'].abiertos === 1, 'lo agrupa por proveedor canónico');
ok(ap.resumen.m3Comprometidos === 500, 'acumula m³ comprometidos', ap.resumen.m3Comprometidos);
const id = ap.items[0].id;
ok(/^AP\d{6}-\d{6}-\d{3}$/.test(id), 'el ID tiene formato estable', id);
ap = guardarApunte({ id, proveedor:'CAYUMANQUI SA', pregunta:'Por que viene a la baja (editada)',
                     tipo:'Compromiso', estado:'En curso', m3:500 });
ok(ap.items.length === 1, 'editar no duplica la fila', ap.items.length);
ok(/editada/.test(ap.items[0].pregunta), 'la edición se guardó');
ok(ap.resumen.enCurso === 1 && ap.resumen.abiertos === 0, 'el estado cambió a en curso');
ap = cambiarEstadoApunte(id, 'Cerrado', 'Repone con 3 camiones extra el lunes');
ok(ap.resumen.cerrados === 1, 'se cierra el apunte');
ok(/3 camiones/.test(ap.items[0].respuesta), 'guarda la respuesta al cerrar');
ok(ap.resumen.m3Comprometidos === 0, 'un apunte cerrado ya no compromete m³');
ap = guardarApunte({ proveedor:'ANGOL LMTD', pregunta:'Confirma ritmo', estado:'Abierto' });
ok(ap.items.length === 2, 'se agrega un segundo apunte', ap.items.length);
ap = eliminarApunte(id);
ok(ap.items.length === 1 && ap.items[0].proveedor === 'ANGOL LMTD', 'elimina el correcto', ap.items.length);
let err = null;
try { guardarApunte({ proveedor:'X', pregunta:'   ' }); } catch(e) { err = e; }
ok(!!err && /pregunta/i.test(err.message), 'rechaza un apunte sin pregunta');

console.log('\n9. GIS separado en índice y geometría');
__resetLecturasHoja();
const idx = getRolesIndex(true);
ok(idx.items.length === 12, 'el índice trae los roles con archivo', idx.items.length);
ok(idx.diagnostics.rolesEnHoja === 15, 'cuenta los roles de la hoja', idx.diagnostics.rolesEnHoja);
ok(idx.diagnostics.rolesSinArchivo === 3, 'cuenta los roles sin archivo', idx.diagnostics.rolesSinArchivo);
ok(idx.diagnostics.archivosEnCarpeta === 13, 'cuenta los archivos de la carpeta', idx.diagnostics.archivosEnCarpeta);
ok(idx.items.every(i => Array.isArray(i.polygons) && i.polygons.length === 0),
   'el índice NO trae geometría: esa es toda la gracia');
ok(idx.items.every(i => i.fileId === undefined), 'el fileId no se expone al cliente');
ok(idx.items.every(i => i.predio && i.proveedor && i.cubicacion >= 0),
   'el índice ya trae lo necesario para la lista lateral');
ok((__lecturasHoja()['Hoja 1'] || 0) === 0,
   'construir el índice no relee Hoja 1: reusa la agregación cacheada',
   __lecturasHoja()['Hoja 1'] || 0);

__resetLecturasDrive();
const lote = idx.items.slice(0, 2).map(i => i.rolKey);
const poly1 = getRolesPolygons(lote);
ok(Object.keys(poly1.polygons).length === 2, 'la primera tanda devuelve solo su lote',
   Object.keys(poly1.polygons).length);
ok(poly1.errores.length === 0, 'sin errores en la tanda');
ok(poly1.polygons[lote[0]][0].length >= 4, 'el anillo trae sus vértices',
   poly1.polygons[lote[0]][0].length);
ok(poly1.polygons[lote[0]][0].every(p => Array.isArray(p) && p.length === 2),
   'cada vértice es un par lat lng');
const lecturasPrimera = __lecturasDrive();
ok(lecturasPrimera === 2, 'abre un archivo por rol del lote', lecturasPrimera);

getRolesPolygons(lote);
ok(__lecturasDrive() === lecturasPrimera, 'repetir la tanda no vuelve a abrir los archivos',
   __lecturasDrive());

const resto = getRolesPolygons(idx.items.slice(2).map(i => i.rolKey));
ok(Object.keys(resto.polygons).length === 10, 'la segunda tanda completa el resto',
   Object.keys(resto.polygons).length);
const rolesKmz = idx.items.filter(i => /\.kmz$/i.test(i.fileName)).map(i => i.rolKey);
const todaLaGeometria = Object.assign({}, poly1.polygons, resto.polygons);
ok(rolesKmz.length >= 1, 'el fixture incluye archivos KMZ', rolesKmz.length);
ok(rolesKmz.every(k => (todaLaGeometria[k] || []).length > 0),
   'los KMZ se descomprimen y entregan geometría igual que los KML');

const inventado = getRolesPolygons(['ROL-QUE-NO-EXISTE']);
ok(Object.keys(inventado.polygons).length === 0 && inventado.errores.length === 1,
   'un rol inexistente devuelve error, no revienta');
ok(getRolesPolygons([]).errores.length === 0, 'un lote vacío es inofensivo');
ok(getRolesPolygons(null).errores.length === 0, 'un lote nulo es inofensivo');

console.log('\n10. Comunas y regiones');
ok(regionForComuna_('TOME') === 'Biobío', 'TOME quedó mapeada', regionForComuna_('TOME'));
ok(regionForComuna_('YUNGAY') === 'Ñuble', 'YUNGAY quedó mapeada', regionForComuna_('YUNGAY'));
ok(regionForComuna_('LOS ALAMOS') === 'Biobío', 'LOS ALAMOS quedó mapeada');
ok(regionForComuna_('QUILACO') === 'Biobío', 'QUILACO quedó mapeada');
ok(regionForComuna_('SANTA BARBARA') === 'Biobío', 'SANTA BARBARA quedó mapeada');
ok(regionForComuna_('STA BARBARA') === 'Biobío', 'la abreviatura STA BARBARA resuelve igual',
   regionForComuna_('STA BARBARA'));
ok(regionForComuna_('Concepción') === 'Biobío', 'resuelve con tilde y minúsculas');
ok(regionForComuna_('LAJAP') === 'Sin región asignada',
   'una comuna que no existe se queda sin región, no se adivina');
ok(d.regionesPorComuna && Object.keys(d.regionesPorComuna).length > 50,
   'la tabla de regiones viaja al cliente', Object.keys(d.regionesPorComuna || {}).length);

console.log('\n' + (fallos ? fallos + ' PRUEBAS FALLIDAS' : 'TODAS LAS PRUEBAS PASAN'));
process.exit(fallos ? 1 : 0);
