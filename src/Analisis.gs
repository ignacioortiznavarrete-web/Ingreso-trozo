/*******************************************************
 ANÁLISIS DE COMPRA: TENDENCIA Y PLAN DE ACCIÓN
 -------------------------------------------------------
 Este módulo responde las tres preguntas que el analista
 de compra de trozo se hace todos los días:

   1. ¿Quién viene a la baja?          → tendencia día a día
   2. ¿Cuánto me falta y a qué ritmo?  → brecha y ritmo requerido
   3. ¿A quién llamo primero?          → riesgo y acción sugerida

 Lo consume Codigo.gs (buildDashboardCore_) y se publica
 en el payload como `tendenciaProveedores` y `planAccion`.
*******************************************************/

const ANALISIS_CONFIG = {
  // Días hábiles de cada mitad de la comparación. Con 3, se comparan los
  // últimos 3 días hábiles contra los 3 anteriores.
  VENTANA_COMPARACION: 3,

  // Días hábiles usados para la pendiente (regresión lineal simple).
  VENTANA_PENDIENTE: 6,

  // Variación mínima para dejar de considerar la serie "estable".
  UMBRAL_VARIACION: 0.15,

  // Días hábiles sin ingresar que gatillan alerta de corte de suministro.
  DIAS_SIN_INGRESO_ALERTA: 2,
  DIAS_SIN_INGRESO_CRITICO: 4,

  // Cortes de cumplimiento a fecha.
  CORTE_CRITICO: 0.60,
  CORTE_ALERTA: 0.85,
  CORTE_SEGUIMIENTO: 0.95,
  CORTE_SOBRE_PLAN: 1.05
};

/*******************************************************
 TENDENCIA DÍA A DÍA POR PROVEEDOR
*******************************************************/

function buildProviderTrends_(seriesProveedor, plan, calendario) {
  const out = {};
  const diasTranscurridos = Number(plan && plan.businessDaysElapsed) || 0;
  const etiquetas = calendarDayLabels_(calendario);

  Object.keys(seriesProveedor || {}).forEach(proveedor => {
    const item = seriesProveedor[proveedor];
    const serie = serieCompleta_(item.dias, diasTranscurridos, etiquetas);

    out[proveedor] = analizarSerie_(proveedor, serie, item, plan);
  });

  return out;
}

// Mapa díaHábil → día calendario, para que la serie se pueda leer con las
// fechas reales del mes y no con un correlativo abstracto.
function calendarDayLabels_(calendario) {
  const out = {};

  (((calendario || {}).days) || []).forEach(d => {
    if (d.habil && d.numHabil) {
      out[d.numHabil] = { dia: d.day, fecha: d.fecha };
    }
  });

  return out;
}

// Rellena con ceros los días hábiles sin ingreso: un día en blanco es
// información (el proveedor no despachó), no un hueco que se pueda omitir.
function serieCompleta_(dias, diasTranscurridos, etiquetas) {
  const out = [];
  const maxDia = diasTranscurridos || Math.max(0, ...Object.keys(dias || {}).map(Number));

  for (let d = 1; d <= maxDia; d++) {
    const punto = (dias || {})[d];
    const etiqueta = etiquetas[d] || {};

    out.push({
      dia: d,
      diaCalendario: etiqueta.dia || d,
      fecha: (punto && punto.fecha) || etiqueta.fecha || '',
      cubicacion: punto ? punto.cubicacion : 0,
      trozos: punto ? punto.trozos : 0
    });
  }

  return out;
}

function analizarSerie_(proveedor, serie, item, plan) {
  const valores = serie.map(x => x.cubicacion);
  const diasConIngreso = valores.filter(v => v > 0).length;
  const total = valores.reduce((s, v) => s + v, 0);
  const diasTranscurridos = serie.length;

  const ventana = ANALISIS_CONFIG.VENTANA_COMPARACION;
  const ultimos = valores.slice(-ventana);
  const previos = valores.slice(-(ventana * 2), -ventana);

  const sumaUltimos = ultimos.reduce((s, v) => s + v, 0);
  const sumaPrevios = previos.reduce((s, v) => s + v, 0);

  const variacion = sumaPrevios > 0
    ? (sumaUltimos - sumaPrevios) / sumaPrevios
    : (sumaUltimos > 0 ? 1 : 0);

  const pendiente = pendienteLineal_(valores.slice(-ANALISIS_CONFIG.VENTANA_PENDIENTE));
  const ultimoDia = Number(item && item.ultimoDia) || 0;
  const diasSinIngreso = ultimoDia ? Math.max(0, diasTranscurridos - ultimoDia) : diasTranscurridos;

  return {
    proveedor,
    serie,
    valores,
    total,
    diasTranscurridos,
    diasConIngreso,
    regularidad: diasTranscurridos ? diasConIngreso / diasTranscurridos : 0,
    promedioDiario: diasTranscurridos ? total / diasTranscurridos : 0,
    promedioDiaActivo: diasConIngreso ? total / diasConIngreso : 0,
    maximoDiario: Math.max(0, ...valores),

    m3Ultimos: sumaUltimos,
    m3Previos: sumaPrevios,
    ventana,
    variacion,
    pendiente,

    ultimoDia,
    ultimaFecha: (item && item.ultimaFecha) || '',
    diasSinIngreso,
    rachaSinIngreso: rachaFinalEnCero_(valores),
    rachaBaja: rachaDescendente_(valores),

    tendencia: clasificarTendencia_(diasConIngreso, variacion, pendiente, diasSinIngreso),
    planDiario: planDiarioProveedor_(proveedor, plan)
  };
}

// Pendiente por mínimos cuadrados: m³ que gana o pierde por día hábil.
function pendienteLineal_(valores) {
  const n = (valores || []).length;

  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += valores[i];
    sumXY += i * valores[i];
    sumXX += i * i;
  }

  const denominador = n * sumXX - sumX * sumX;

  return denominador ? (n * sumXY - sumX * sumY) / denominador : 0;
}

function rachaFinalEnCero_(valores) {
  let racha = 0;

  for (let i = valores.length - 1; i >= 0; i--) {
    if (valores[i] > 0) break;
    racha++;
  }

  return racha;
}

// Días hábiles seguidos en que el proveedor entregó menos que el día previo.
function rachaDescendente_(valores) {
  let racha = 0;

  for (let i = valores.length - 1; i > 0; i--) {
    if (valores[i] < valores[i - 1]) racha++;
    else break;
  }

  return racha;
}

function clasificarTendencia_(diasConIngreso, variacion, pendiente, diasSinIngreso) {
  if (!diasConIngreso) return 'SIN INGRESO';
  if (diasSinIngreso >= ANALISIS_CONFIG.DIAS_SIN_INGRESO_CRITICO) return 'CORTADO';
  if (diasConIngreso < 2) return 'SIN DATOS';

  const umbral = ANALISIS_CONFIG.UMBRAL_VARIACION;

  if (variacion <= -umbral || pendiente < -1) return 'BAJA';
  if (variacion >= umbral || pendiente > 1) return 'SUBE';

  return 'ESTABLE';
}

function planDiarioProveedor_(proveedor, plan) {
  const item = ((plan || {}).proveedores || {})[proveedor];

  if (!item || !plan.businessDaysInMonth) return 0;

  return item.plan / plan.businessDaysInMonth;
}

/*******************************************************
 INYECCIÓN DE LA TENDENCIA EN LA TABLA DE CUMPLIMIENTO
 La tabla "Cumplimiento plan proveedores" del dashboard
 muestra la tendencia junto al cumplimiento: es la lectura
 que pide el analista (bajó / subió / cortado, y hace
 cuántos días hábiles que no despacha).
*******************************************************/

function aplicarTendenciasACumplimiento_(cumplimiento, tendencias) {
  (cumplimiento || []).forEach(fila => {
    const t = (tendencias || {})[fila.proveedor];

    if (!t) {
      fila.tendencia = fila.plan ? 'SIN INGRESO' : 'SIN DATOS';
      fila.variacion = 0;
      fila.pendiente = 0;
      fila.diasSinIngreso = 0;
      fila.regularidad = 0;
      fila.serieDiaria = [];
      fila.promedioDiario = 0;
      fila.ultimaFecha = '';
      return;
    }

    fila.tendencia = t.tendencia;
    fila.variacion = t.variacion;
    fila.pendiente = t.pendiente;
    fila.diasSinIngreso = t.diasSinIngreso;
    fila.rachaBaja = t.rachaBaja;
    fila.regularidad = t.regularidad;
    fila.promedioDiario = t.promedioDiario;
    fila.ultimaFecha = t.ultimaFecha;
    fila.m3Ultimos = t.m3Ultimos;
    fila.m3Previos = t.m3Previos;
    fila.ventanaTendencia = t.ventana;

    // Serie compacta: solo los m³ por día hábil, que es lo que necesita el
    // sparkline de la tabla. La serie completa viaja en tendenciaProveedores.
    fila.serieDiaria = t.valores;
  });
}

/*******************************************************
 PLAN DE ACCIÓN
*******************************************************/

function buildActionPlan_(cumplimiento, plan, ctx) {
  ctx = ctx || {};

  const diasFaltantes = Number(ctx.diasFaltantes) || 0;
  const m3PorCamion = Number(ctx.m3PorCamion) || 26;
  const totalPlan = Number((plan || {}).totalPlan) || 0;

  const filas = (cumplimiento || [])
    .filter(x => Number(x.plan) > 0 || Number(x.cubicacion) > 0)
    .map(x => construirFilaAccion_(x, {
      diasFaltantes,
      m3PorCamion,
      totalPlan,
      diasHabilesMes: Number((plan || {}).businessDaysInMonth) || 0
    }))
    .sort((a, b) => b.riesgo - a.riesgo || a.brecha - b.brecha);

  const resumen = filas.reduce((acc, fila) => {
    if (fila.nivel === 'CRITICO') acc.criticos++;
    else if (fila.nivel === 'ALERTA') acc.alerta++;
    else if (fila.nivel === 'SEGUIMIENTO') acc.seguimiento++;
    else if (fila.nivel === 'SOBRE PLAN') acc.sobrePlan++;
    else if (fila.nivel === 'OK') acc.ok++;
    else if (fila.nivel === 'SIN PLAN') acc.sinPlan++;

    if (fila.brecha < 0) acc.m3Brecha += Math.abs(fila.brecha);
    else acc.m3Excedente += fila.brecha;

    return acc;
  }, {
    criticos: 0,
    alerta: 0,
    seguimiento: 0,
    ok: 0,
    sobrePlan: 0,
    sinPlan: 0,
    m3Brecha: 0,
    m3Excedente: 0
  });

  resumen.totalProveedores = filas.length;
  resumen.m3NetoVsPlan = resumen.m3Excedente - resumen.m3Brecha;

  // Quién tiene margen para absorber el déficit de los que van atrasados.
  const coberturas = filas
    .filter(x => x.brecha > 0 && x.tendencia !== 'BAJA' && x.tendencia !== 'CORTADO')
    .sort((a, b) => b.brecha - a.brecha)
    .slice(0, 8)
    .map(x => ({
      proveedor: x.proveedor,
      excedente: x.brecha,
      cumplimiento: x.cumplimiento,
      tendencia: x.tendencia,
      // La variación y los días sin despacho viajan también aquí: sin ellos la
      // etiqueta de tendencia de esta tabla mostraría siempre 0%.
      variacion: x.variacion,
      diasSinIngreso: x.diasSinIngreso,
      promedioDiario: x.promedioDiario,
      margenCamionesDia: diasFaltantes ? (x.brecha / diasFaltantes) / m3PorCamion : 0
    }));

  return { resumen, filas, coberturas };
}

function construirFilaAccion_(fila, ctx) {
  const planMes = Number(fila.plan) || 0;
  const planFecha = Number(fila.planToDate) || 0;
  const real = Number(fila.cubicacion) || 0;
  const cumplimiento = planFecha ? real / planFecha : 0;
  const brecha = real - planFecha;

  const faltaMes = Math.max(0, planMes - real);
  const ritmoRequerido = ctx.diasFaltantes ? faltaMes / ctx.diasFaltantes : 0;
  const promedioDiario = Number(fila.promedioDiario) || 0;

  const nivel = clasificarNivel_(planMes, planFecha, real, cumplimiento, fila.tendencia, fila.diasSinIngreso);
  const riesgo = calcularRiesgo_(fila, {
    cumplimiento,
    planMes,
    totalPlan: ctx.totalPlan,
    nivel
  });

  const item = {
    proveedor: fila.proveedor,
    nombrePlan: fila.nombrePlan || fila.proveedor,
    plan: planMes,
    planToDate: planFecha,
    cubicacion: real,
    cumplimiento,
    brecha,

    tendencia: fila.tendencia || 'SIN DATOS',
    variacion: Number(fila.variacion) || 0,
    pendiente: Number(fila.pendiente) || 0,
    diasSinIngreso: Number(fila.diasSinIngreso) || 0,
    rachaBaja: Number(fila.rachaBaja) || 0,
    regularidad: Number(fila.regularidad) || 0,
    promedioDiario,
    ultimaFecha: fila.ultimaFecha || '',
    serieDiaria: fila.serieDiaria || [],

    pesoEnPlan: ctx.totalPlan ? planMes / ctx.totalPlan : 0,
    m3PorRecuperar: faltaMes,
    ritmoRequeridoDia: ritmoRequerido,
    camionesRequeridosDia: ritmoRequerido / (ctx.m3PorCamion || 26),
    esfuerzoVsRitmoActual: promedioDiario ? (ritmoRequerido / promedioDiario) - 1 : 0,

    nivel,
    riesgo
  };

  item.accion = accionSugerida_(item, ctx);
  item.pregunta = preguntaSugerida_(item);

  return item;
}

function clasificarNivel_(planMes, planFecha, real, cumplimiento, tendencia, diasSinIngreso) {
  if (!planMes) return 'SIN PLAN';
  if (!real) return 'CRITICO';
  if (tendencia === 'CORTADO') return 'CRITICO';
  if (!planFecha) return 'OK';

  if (cumplimiento < ANALISIS_CONFIG.CORTE_CRITICO) return 'CRITICO';
  if (cumplimiento < ANALISIS_CONFIG.CORTE_ALERTA) return 'ALERTA';
  if (cumplimiento < ANALISIS_CONFIG.CORTE_SEGUIMIENTO) return 'SEGUIMIENTO';
  if (cumplimiento >= ANALISIS_CONFIG.CORTE_SOBRE_PLAN) return 'SOBRE PLAN';

  // Cumple, pero viene cayendo: no es una alerta todavía, sí un seguimiento.
  if (tendencia === 'BAJA' && diasSinIngreso >= ANALISIS_CONFIG.DIAS_SIN_INGRESO_ALERTA) {
    return 'SEGUIMIENTO';
  }

  return 'OK';
}

// Riesgo 0-100. Pondera cuánto falta, hacia dónde va la serie, hace cuánto
// que no despacha y cuánto pesa ese proveedor dentro del plan del mes: un
// proveedor grande al 80% duele más que uno chico al 50%.
function calcularRiesgo_(fila, ctx) {
  if (ctx.nivel === 'SIN PLAN') return 0;

  const deficit = Math.min(1, Math.max(0, 1 - (Number(ctx.cumplimiento) || 0)));
  let score = deficit * 45;

  const tendencia = fila.tendencia;
  if (tendencia === 'CORTADO') score += 25;
  else if (tendencia === 'BAJA') score += 20;
  else if (tendencia === 'SIN INGRESO') score += 22;
  else if (tendencia === 'ESTABLE') score += 6;

  const dias = Number(fila.diasSinIngreso) || 0;
  score += Math.min(1, dias / ANALISIS_CONFIG.DIAS_SIN_INGRESO_CRITICO) * 18;

  const peso = ctx.totalPlan ? (Number(ctx.planMes) || 0) / ctx.totalPlan : 0;
  score += Math.min(1, peso / 0.15) * 12;

  const regularidad = Number(fila.regularidad) || 0;
  if (regularidad && regularidad < 0.4) score += 5;

  return Math.round(Math.min(100, Math.max(0, score)));
}

// Instrucción concreta, en el lenguaje de la gestión diaria de compra.
function accionSugerida_(item, ctx) {
  const m3 = v => Math.round(v).toLocaleString('es-CL') + ' m³';
  const dias = Number(ctx.diasFaltantes) || 0;

  if (item.nivel === 'SIN PLAN') {
    return 'Ingreso sin plan asignado. Confirmar si corresponde a una compra spot ' +
      'o si falta cargarlo en la Hoja 2.';
  }

  if (!item.cubicacion) {
    return 'No ha despachado nada del plan de ' + m3(item.plan) + '. Contactar hoy y ' +
      'confirmar fecha de primer camión antes de reasignar el volumen.';
  }

  if (item.tendencia === 'CORTADO') {
    return 'Sin despacho hace ' + item.diasSinIngreso + ' días hábiles. Verificar faena, ' +
      'clima o disponibilidad de camiones. Quedan ' + m3(item.m3PorRecuperar) + ' por recibir.';
  }

  if (item.nivel === 'CRITICO') {
    return 'Al ' + Math.round(item.cumplimiento * 100) + '% del plan a fecha. Requiere ' +
      m3(item.ritmoRequeridoDia) + '/día hábil (' + item.camionesRequeridosDia.toFixed(1) +
      ' camiones) por ' + dias + ' días. Escalar y evaluar volumen de respaldo.';
  }

  if (item.nivel === 'ALERTA') {
    return 'Atrasado en ' + m3(Math.abs(item.brecha)) + '. Comprometer recuperación en ' +
      'los próximos días hábiles: subir a ' + m3(item.ritmoRequeridoDia) + '/día.';
  }

  if (item.tendencia === 'BAJA') {
    return 'Cumple el plan pero viene a la baja (' + fmtPorcentajeServidor_(item.variacion) +
      ' en los últimos ' + ANALISIS_CONFIG.VENTANA_COMPARACION + ' días hábiles). ' +
      'Confirmar que el ritmo se sostiene hasta fin de mes.';
  }

  if (item.nivel === 'SOBRE PLAN') {
    return 'Sobre plan en ' + m3(item.brecha) + '. Candidato para absorber el déficit ' +
      'de proveedores atrasados.';
  }

  return 'En línea con el plan. Mantener seguimiento semanal.';
}

// Pregunta lista para guardar en la bitácora de apuntes: es el enunciado que
// el analista lleva a la reunión o a la llamada con el proveedor.
function preguntaSugerida_(item) {
  const pct = fmtPorcentajeServidor_(item.variacion);

  if (item.nivel === 'SIN PLAN') {
    return '¿' + item.proveedor + ' tiene plan asignado para este mes o es compra spot?';
  }

  if (!item.cubicacion) {
    return '¿Por qué ' + item.proveedor + ' no ha despachado ningún camión del plan ' +
      'y cuándo entra el primero?';
  }

  if (item.tendencia === 'CORTADO') {
    return '¿Qué cortó el despacho de ' + item.proveedor + ' hace ' + item.diasSinIngreso +
      ' días hábiles y cuándo se retoma?';
  }

  if (item.tendencia === 'BAJA') {
    return '¿Por qué ' + item.proveedor + ' viene a la baja (' + pct + ' en los últimos ' +
      ANALISIS_CONFIG.VENTANA_COMPARACION + ' días hábiles) y cómo recupera?';
  }

  if (item.nivel === 'CRITICO' || item.nivel === 'ALERTA') {
    return '¿Cómo recupera ' + item.proveedor + ' los ' +
      Math.round(Math.abs(item.brecha)).toLocaleString('es-CL') + ' m³ de atraso ' +
      'antes de fin de mes?';
  }

  if (item.regularidad && item.regularidad < 0.5) {
    return '¿Puede ' + item.proveedor + ' entregar de forma más pareja? Solo despachó ' +
      'en ' + Math.round(item.regularidad * 100) + '% de los días hábiles del mes.';
  }

  return '¿' + item.proveedor + ' confirma que sostiene el ritmo hasta el cierre del mes?';
}

function fmtPorcentajeServidor_(value) {
  const n = (Number(value) || 0) * 100;
  const signo = n > 0 ? '+' : '';
  return signo + n.toFixed(0) + '%';
}
