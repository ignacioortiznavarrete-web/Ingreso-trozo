require(require('path').join(__dirname, 'harness.js'));
let fallos = 0;
const ok = (cond, msg, extra) => {
  console.log((cond ? '  PASA  ' : '  FALLA ') + msg + (extra !== undefined ? '  ->  ' + extra : ''));
  if (!cond) fallos++;
};

// Agosto 2026: días hábiles 3,4,5,6,7,10,11,12,13,14,17,18,19,20,21,24,25,26,27,28,31
// (15 de agosto es feriado y cae sábado). Referencia: día 21 = viernes.
const ref = new Date(2026, 7, 21);
const diasMes = businessDaysInMonth_(ref);
const diasTrans = businessDaysElapsedInMonth_(ref);
const calendario = buildCalendarData_(ref);

console.log('\n1. Calendario y días hábiles');
ok(diasMes === 21, 'agosto 2026 tiene 21 días hábiles', diasMes);
ok(diasTrans === 15, 'al 21 de agosto van 15 días hábiles', diasTrans);
ok(!isBusinessDay_(new Date(2026,7,15)), '15 de agosto (feriado) no es hábil');
ok(isBusinessDay_(new Date(2026,7,17)), '17 de agosto es hábil');

// Plan sintético
const plan = {
  businessDaysInMonth: diasMes,
  businessDaysElapsed: diasTrans,
  totalPlan: 21000,
  dailyPlan: 1000,
  proveedores: {
    'A LA BAJA':  { proveedor:'A LA BAJA',  plan: 6300, planToDate: 4500, faenas:{} },
    'ESTABLE':    { proveedor:'ESTABLE',    plan: 6300, planToDate: 4500, faenas:{} },
    'CORTADO':    { proveedor:'CORTADO',    plan: 4200, planToDate: 3000, faenas:{} },
    'SOBRE PLAN': { proveedor:'SOBRE PLAN', plan: 4200, planToDate: 3000, faenas:{} },
    'SIN NADA':   { proveedor:'SIN NADA',   plan: 2100, planToDate: 1500, faenas:{} }
  }
};
plan.planToDate = plan.dailyPlan * diasTrans;

// Series diarias por proveedor (día hábil -> m³)
function serie(nombre, valores) {
  const dias = {};
  let ultimoDia = 0, ultimaFecha = '';
  valores.forEach((v, i) => {
    const d = i + 1;
    if (v > 0) { dias[d] = { dia:d, fecha:'2026-08-' + String(d).padStart(2,'0'), trozos:v*3, cubicacion:v };
                 ultimoDia = d; ultimaFecha = dias[d].fecha; }
  });
  return { proveedor: nombre, dias, ultimoDia, ultimaFecha };
}

const series = {
  // Baja clara: últimos 3 días muy por debajo de los 3 previos
  'A LA BAJA':  serie('A LA BAJA',  [400,380,390,370,360,350,340,330,320,300,290,150,120,90,70]),
  'ESTABLE':    serie('ESTABLE',    [300,305,298,302,299,301,300,297,303,300,299,301,300,298,302]),
  // Dejó de despachar hace 5 días hábiles
  'CORTADO':    serie('CORTADO',    [250,240,260,255,245,250,248,252,250,0,0,0,0,0,0]),
  'SOBRE PLAN': serie('SOBRE PLAN', [260,270,280,290,300,310,320,330,340,350,360,370,380,390,400])
};

const tendencias = buildProviderTrends_(series, plan, calendario);

console.log('\n2. Clasificación de tendencia');
ok(tendencias['A LA BAJA'].tendencia === 'BAJA', 'serie descendente se clasifica BAJA', tendencias['A LA BAJA'].tendencia);
ok(tendencias['ESTABLE'].tendencia === 'ESTABLE', 'serie plana se clasifica ESTABLE', tendencias['ESTABLE'].tendencia);
ok(tendencias['CORTADO'].tendencia === 'CORTADO', 'sin despacho hace 5 días se clasifica CORTADO', tendencias['CORTADO'].tendencia);
ok(tendencias['SOBRE PLAN'].tendencia === 'SUBE', 'serie ascendente se clasifica SUBE', tendencias['SOBRE PLAN'].tendencia);
ok(tendencias['CORTADO'].diasSinIngreso === 6, 'días hábiles sin despacho bien contados', tendencias['CORTADO'].diasSinIngreso);
ok(tendencias['A LA BAJA'].pendiente < 0, 'pendiente negativa en serie a la baja', tendencias['A LA BAJA'].pendiente.toFixed(2));
ok(tendencias['SOBRE PLAN'].pendiente > 0, 'pendiente positiva en serie al alza', tendencias['SOBRE PLAN'].pendiente.toFixed(2));
ok(tendencias['A LA BAJA'].serie.length === diasTrans, 'la serie rellena todos los días hábiles transcurridos', tendencias['A LA BAJA'].serie.length);

console.log('\n3. Cumplimiento y plan de acción');
const cumplimiento = Object.keys(plan.proveedores).map(p => {
  const total = series[p] ? Object.values(series[p].dias).reduce((s,d)=>s+d.cubicacion,0) : 0;
  return { proveedor:p, nombrePlan:p, plan:plan.proveedores[p].plan, planToDate:plan.proveedores[p].planToDate,
           trozos: total*3, cubicacion: total, diametroPromedio: 24, faenas: [], cumplimiento:0, diferencia:0, estado:'' };
});
aplicarTendenciasACumplimiento_(cumplimiento, tendencias);
cumplimiento.forEach(c => { c.cumplimiento = c.planToDate ? c.cubicacion/c.planToDate : 0;
                            c.diferencia = c.cubicacion - c.planToDate; });

const acc = buildActionPlan_(cumplimiento, plan, { diasFaltantes: diasMes-diasTrans, m3PorCamion: 26 });
const byName = {}; acc.filas.forEach(f => byName[f.proveedor] = f);

ok(byName['SIN NADA'].nivel === 'CRITICO', 'proveedor con plan y cero despacho es CRITICO', byName['SIN NADA'].nivel);
ok(byName['CORTADO'].nivel === 'CRITICO', 'proveedor cortado es CRITICO', byName['CORTADO'].nivel);
ok(byName['SOBRE PLAN'].brecha > 0, 'proveedor al alza queda sobre plan', Math.round(byName['SOBRE PLAN'].brecha));
ok(acc.filas[0].riesgo >= acc.filas[acc.filas.length-1].riesgo, 'las filas vienen ordenadas por riesgo desc');
ok(acc.filas.every(f => f.riesgo >= 0 && f.riesgo <= 100), 'todo riesgo cae en el rango 0-100');
ok(acc.resumen.criticos >= 2, 'el resumen cuenta los críticos', acc.resumen.criticos);
ok(acc.resumen.m3Brecha > 0, 'el resumen acumula m³ de brecha', Math.round(acc.resumen.m3Brecha));
ok(acc.coberturas.some(c => c.proveedor === 'SOBRE PLAN'), 'el proveedor al alza aparece como cobertura');
ok(!acc.coberturas.some(c => c.tendencia === 'BAJA' || c.tendencia === 'CORTADO'),
   'ningún proveedor a la baja o cortado se propone como cobertura');

console.log('\n4. Ritmo requerido');
const f = byName['SIN NADA'];
const diasFalt = diasMes - diasTrans;
ok(Math.abs(f.m3PorRecuperar - 2100) < 0.01, 'm³ por recuperar = plan mes menos real', f.m3PorRecuperar);
ok(Math.abs(f.ritmoRequeridoDia - 2100/diasFalt) < 0.01, 'ritmo requerido = faltante / días hábiles restantes', f.ritmoRequeridoDia.toFixed(1));
ok(Math.abs(f.camionesRequeridosDia - (2100/diasFalt)/26) < 0.01, 'camiones/día coherente con 26 m³ por camión', f.camionesRequeridosDia.toFixed(2));

console.log('\n5. Textos generados');
ok(/no ha despachado nada/i.test(byName['SIN NADA'].accion), 'acción del proveedor sin despacho es específica');
ok(/Sin despacho hace 6 días/i.test(byName['CORTADO'].accion), 'acción del cortado nombra los días', byName['CORTADO'].accion.slice(0,60));
ok(byName['A LA BAJA'].pregunta.includes('A LA BAJA'), 'la pregunta nombra al proveedor');
ok(acc.filas.every(f => f.accion && f.pregunta), 'todas las filas traen acción y pregunta');
ok(acc.filas.every(f => !/—|–/.test(f.accion + f.pregunta)), 'ningún texto generado usa em-dash');

console.log('\n6. Concentración del suministro');
const conc = buildSupplyConcentration_([
  { proveedor:'A', cubicacion: 5000 }, { proveedor:'B', cubicacion: 3000 },
  { proveedor:'C', cubicacion: 1500 }, { proveedor:'D', cubicacion: 500 }
], 10000);
ok(Math.abs(conc.top3 - 0.95) < 1e-9, 'top3 correcto', conc.top3);
ok(Math.abs(conc.hhi - 0.3650) < 1e-9, 'HHI correcto', conc.hhi);
ok(conc.proveedoresActivos === 4, 'cuenta proveedores activos', conc.proveedoresActivos);
ok(buildSupplyConcentration_([], 0).top3 === 0, 'sin datos no divide por cero');

console.log('\n7. Bordes');
const vacio = buildProviderTrends_({}, plan, calendario);
ok(Object.keys(vacio).length === 0, 'sin series devuelve objeto vacío');
const accVacio = buildActionPlan_([], { totalPlan:0, businessDaysInMonth:0 }, {});
ok(accVacio.filas.length === 0 && accVacio.resumen.criticos === 0, 'plan de acción vacío no revienta');
ok(pendienteLineal_([]) === 0 && pendienteLineal_([5]) === 0, 'pendiente con 0 o 1 punto es 0');
ok(rachaDescendente_([10,9,8,7]) === 3, 'racha descendente bien contada', rachaDescendente_([10,9,8,7]));
ok(rachaFinalEnCero_([10,0,0]) === 2, 'racha final en cero bien contada', rachaFinalEnCero_([10,0,0]));

console.log('\n' + (fallos ? fallos + ' PRUEBAS FALLIDAS' : 'TODAS LAS PRUEBAS PASAN'));
process.exit(fallos ? 1 : 0);
