/*******************************************************
 MASISA GIS: NÚCLEO DEL DASHBOARD DE INGRESO DE TROZO
 -------------------------------------------------------
 Lee la hoja de ingresos, la cruza con el plan mensual y
 la proyección de camiones, y arma el payload que consume
 Index.html.

 Módulos que acompañan a este archivo:
   Analisis.gs  → tendencia día a día y plan de acción
   Apuntes.gs   → bitácora de preguntas y compromisos
   Valores.gs   → precios de recepción (opcional)
   Slides.gs    → envío de gráficos a Slides (opcional)
*******************************************************/

const CONFIG = {
  SPREADSHEET_ID: '1q_6ojGWI0OPjopobAIMtIdlRaLOHAMNyUhSKJzlSvgg',
  SHEET_NAME: 'Hoja 1',
  PLAN_SHEET_NAME: 'Hoja 2',
  PROJECTION_SHEET_NAME: 'ProyeccionCamiones',
  NOTES_SHEET_NAME: 'Apuntes',
  M3_PER_CAMION: 26,

  // La versión de la clave se sube cada vez que cambia la FORMA del payload.
  // Si no se sube, un usuario con caché tibia recibe el payload viejo y el
  // dashboard nuevo se queda sin los campos que espera.
  CACHE_KEY: 'MASISA_DASHBOARD_SUMMARY_V20',
  DETAIL_CACHE_KEY: 'MASISA_DASHBOARD_DETALLE_V20',
  CACHE_SECONDS: 21600,
  CACHE_CHUNK_CHARS: 45000,
  MAX_ROLES_MAPA: 150
};

const GIS_FOLDER_ID = '1sBJdN_6PHCyxVt-dwEbyhtqWp9aNcEqW';

const FERIADOS_CHILE = new Set([
  '2024-01-01','2024-04-19','2024-05-01','2024-05-21',
  '2024-06-20','2024-06-29','2024-07-16','2024-08-15',
  '2024-09-18','2024-09-19','2024-10-12','2024-10-31',
  '2024-11-01','2024-12-08','2024-12-25',

  '2025-01-01','2025-04-18','2025-04-19','2025-05-01',
  '2025-05-21','2025-06-20','2025-06-29','2025-07-16',
  '2025-08-15','2025-09-18','2025-09-19','2025-10-12',
  '2025-10-31','2025-11-01','2025-12-08','2025-12-25',

  '2026-01-01','2026-04-03','2026-04-04','2026-05-01',
  '2026-05-21','2026-06-29','2026-07-16',
  '2026-08-15','2026-09-18','2026-09-19','2026-09-21',
  '2026-10-12','2026-10-31','2026-11-01','2026-12-08',
  '2026-12-25'
]);

const PROVIDER_ALIASES = {
  'ALSAL': 'ALSAL',
  'ANGOL': 'ANGOL LMTD',
  'C LAGOS': 'CESAR LAGOS',
  'CAYUMANQUI': 'CAYUMANQUI SA',
  'CAYUMANQUI SA': 'CAYUMANQUI SA',
  'COMACO': 'COMACO',
  'COMERCIAL QUILODRAN': 'COMERCIAL QUILODRAN S.A.',
  'COMERCIAL QUILODRAN S A': 'COMERCIAL QUILODRAN S.A.',
  'D RODRIGUEZ': 'D. RODRIGUEZ',
  'EL VOLCAN': 'VOLCAN',
  'F ARANEDA': 'F. ARANEDA',
  'FHO': 'FORESTAL FHO',
  'FORESOL': 'FORESTAL FORESOL SPA',
  'FORESTAL ANGOL': 'ANGOL LMTD',
  'FORESTAL BIO CHIPER': 'FORESTAL BIOCHIPER LTDA',
  'FORESTAL BIOCHIPER': 'FORESTAL BIOCHIPER LTDA',
  'FORESTAL BIOCHIPER LTDA': 'FORESTAL BIOCHIPER LTDA',
  'FORESTAL CHILE VERDE': 'FORESTAL CHILE VERDE SPA',
  'FORESTAL CHILE VERDE SPA': 'FORESTAL CHILE VERDE SPA',
  'FORESTAL FORESOL SPA': 'FORESTAL FORESOL SPA',
  'FORESTAL FHO': 'FORESTAL FHO',
  'FORESTAL LA TRINIDAD SPA': 'FORESTAL LA TRINIDAD SPA',
  'FORESTAL NUBLE': 'COMERCIAL FORESTAL NUBLE LTDA',
  'COMERCIAL FORESTAL NUBLE LTDA': 'COMERCIAL FORESTAL NUBLE LTDA',
  'FORESTAL TRINIDAD': 'FORESTAL LA TRINIDAD SPA',
  'FOREXMA': 'FOREXMA',
  'H SILVA': 'H. SILVA',
  'H ZENTENO': 'H. ZENTENO',
  'J ELGUETA': 'J. ELGUETA',
  'J JARA': 'J. JARA',
  'LAS ASTAS': 'LAS ASTAS',
  'LOS SAUCES': 'FORESTAL LOS SAUCES SPA',
  'FORESTAL LOS SAUCES SPA': 'FORESTAL LOS SAUCES SPA',
  'M MORALES': 'MARCO MORALES',
  'M NAVARRO': 'M. NAVARRO',
  'MASISA': 'MASISA SA',
  'MASISA S A': 'MASISA SA',
  'MASISA SA': 'MASISA SA',
  'P AGUAYO': 'P. AGUAYO',
  'QUILODRAN': 'COMERCIAL QUILODRAN S.A.',
  'RC FOREST': 'RODRIGO CAMPOS FOREST SPA',
  'RODRIGO CAMPOS FOREST SPA': 'RODRIGO CAMPOS FOREST SPA',
  'RIO ITATA': 'SOCIEDAD BOSQUES RIO ITATA SPA',
  'SOCIEDAD BOSQUES RIO ITATA SPA': 'SOCIEDAD BOSQUES RIO ITATA SPA',
  'SAVI': 'SAVI',
  'SERFOREST': 'SERFORES FYF SPA',
  'SERFORES': 'SERFORES FYF SPA',
  'SERFORES FYF SPA': 'SERFORES FYF SPA',
  'SERGESAL': 'SERGESAL',
  'U MELGAREJO': 'U. MELGAREJO',
  'V TORRES': 'SERVICIOS FORESTALES VICTOR TORRES',
  'SERVICIOS FORESTALES VICTOR TORRES': 'SERVICIOS FORESTALES VICTOR TORRES',
  'VOLCAN': 'VOLCAN',
  'WOOD CARFU': 'WOOD CARFU',
  'X CUNCO': 'X-CUNCO'
};

const REGION_BY_COMUNA = {
  CABRERO: 'Biobío',
  FLORIDA: 'Biobío',
  'LA FLORIDA': 'Biobío',
  HUALQUI: 'Biobío',
  LAJA: 'Biobío',
  'LOS ANGELES': 'Biobío',
  PENCO: 'Biobío',
  QUILLECO: 'Biobío',
  YUMBEL: 'Biobío',
  'CHILLAN VIEJO': 'Ñuble',
  CHILLAN: 'Ñuble',
  'SAN FABIAN': 'Ñuble',
  'SAN IGNACIO': 'Ñuble',
  COIHUECO: 'Ñuble',
  'EL CARMEN': 'Ñuble',
  NINHUE: 'Ñuble',
  PEMUCO: 'Ñuble',
  PORTEZUELO: 'Ñuble',
  QUIRIHUE: 'Ñuble',
  MULCHEN: 'Biobío',
  CAUQUENES: 'Maule',
  PARRAL: 'Maule',
  RETIRO: 'Maule',
  ARAUCO: 'Biobío',
  HUALPEN: 'Biobío',
  LUMACO: 'La Araucanía',
  'LOS SAUCES': 'La Araucanía'
};

const MASISA_FAENAS = [
  'NAHUELTORO',
  'LLOHUE',
  'MASISA LLOHUE',
  'DIGUA',
  'SAN FRANCISCO',
  'LA MONTANA',
  'EL CAPAO',
  'SAN ANTONIO'
];

/*******************************************************
 UI
*******************************************************/

function onOpen() {
  const menu = SpreadsheetApp.getUi()
    .createMenu('MASISA GIS')
    .addItem('Abrir Dashboard', 'abrirDashboard')
    .addSeparator()
    .addItem('Abrir hoja de apuntes', 'abrirHojaApuntes')
    .addItem('Registrar apunte rápido...', 'menuNuevoApunte');

  // Las opciones de Slides solo aparecen si el archivo opcional
  // Slides.gs está agregado al proyecto.
  if (typeof enviarGraficoDirectoASlides === 'function') {
    menu.addSeparator()
      .addItem('Conectar presentación de Slides...', 'menuConfigurarPresentacion')
      .addItem('Actualizar gráficos para Slides', 'menuActualizarGraficosSlides')
      .addItem('Auto-actualizar gráficos Slides (cada 1 h)', 'activarActualizacionAutomaticaGraficos');
  }

  // Valores.gs también es opcional.
  if (typeof asignarValoresHoja1 === 'function') {
    menu.addSeparator()
      .addItem('Asignar valores a Hoja 1', 'asignarValoresHoja1')
      .addItem('Diagnosticar cobertura de valores', 'diagnosticarCoberturaValores');
  }

  menu.addSeparator()
    .addItem('Limpiar caché', 'limpiarCache')
    .addToUi();
}

// El parámetro ?present=1 (modo presentación directo) lo lee el propio
// HTML con google.script.url; aquí no se necesita plantilla con variables.
function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('MASISA · Ingreso de trozo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function abrirDashboard() {
  const html = HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setWidth(1600)
    .setHeight(950);

  SpreadsheetApp.getUi().showModalDialog(html, 'MASISA · Ingreso de trozo');
}

function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

function limpiarCache() {
  const cache = CacheService.getScriptCache();
  clearCacheChunked_(cache, CONFIG.CACHE_KEY);
  clearCacheChunked_(cache, CONFIG.DETAIL_CACHE_KEY);
  clearGisCache_(cache);
  SpreadsheetApp.getUi().alert('Caché limpiada correctamente.');
}

/*******************************************************
 FERIADOS / DÍAS HÁBILES
*******************************************************/

function isFeriado_(date) {
  if (!date || isNaN(date)) return false;
  const key = Utilities.formatDate(date, 'America/Santiago', 'yyyy-MM-dd');
  return FERIADOS_CHILE.has(key);
}

function isBusinessDay_(date) {
  if (!date || isNaN(date)) return false;
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !isFeriado_(date);
}

function getLastIngresoDate_(values, col) {
  let lastDate = null;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (rowEmpty_(row)) continue;

    const value = row[col.fecha];
    let d = null;

    if (value instanceof Date && !isNaN(value)) {
      d = value;
    } else {
      d = parseDateKey_(String(value || '').trim());
    }

    if (d && (!lastDate || d > lastDate)) lastDate = d;
  }

  return lastDate;
}

function businessDaysInMonth_(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  let count = 0;

  for (let day = 1; day <= lastDay; day++) {
    if (isBusinessDay_(new Date(year, month, day))) count++;
  }

  return count;
}

function businessDaysElapsedInMonth_(refDate) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const dayOfMonth = refDate.getDate();

  let count = 0;

  for (let day = 1; day <= dayOfMonth; day++) {
    if (isBusinessDay_(new Date(year, month, day))) count++;
  }

  return count;
}

function businessDayNumberInMonth_(date) {
  if (!(date instanceof Date) || isNaN(date)) return 0;
  return businessDaysElapsedInMonth_(date);
}

function prevOrSameBusinessDay_(date) {
  if (!(date instanceof Date) || isNaN(date)) return date;

  let d = new Date(date);

  for (let i = 0; i < 10; i++) {
    if (isBusinessDay_(d)) return d;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }

  return date;
}

function businessDayNumberFromValue_(value) {
  let date;

  if (value instanceof Date && !isNaN(value)) {
    date = value;
  } else {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (!match) return 0;
    date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  }

  const effective = prevOrSameBusinessDay_(date);
  return businessDayNumberInMonth_(effective);
}

function buildCalendarData_(refDate) {
  const base = (refDate instanceof Date && !isNaN(refDate)) ? refDate : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const days = [];
  let numHabil = 0;

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month, day);
    const dow = date.getDay();
    const feriado = isFeriado_(date);
    const habil = isBusinessDay_(date);

    if (habil) numHabil++;

    days.push({
      day,
      dow,
      fecha: Utilities.formatDate(date, 'America/Santiago', 'yyyy-MM-dd'),
      feriado,
      habil,
      numHabil: habil ? numHabil : 0
    });
  }

  return {
    year,
    month,
    monthLabel: monthNames[month] + ' ' + year,
    refDay: base.getDate(),
    days
  };
}

/*******************************************************
 DASHBOARD DATA
*******************************************************/

function getDashboardData(force) {
  const cache = CacheService.getScriptCache();

  if (!force) {
    const cached = getCacheChunked_(cache, CONFIG.CACHE_KEY);
    if (cached) return cached;
  }

  const built = buildDashboardCore_();
  cacheDashboardCore_(cache, built);

  return built.summary;
}

function getDetalleIngresos(force) {
  const cache = CacheService.getScriptCache();

  if (!force) {
    const cached = getCacheChunked_(cache, CONFIG.DETAIL_CACHE_KEY);
    if (cached) return cached;
  }

  const built = buildDashboardCore_();
  cacheDashboardCore_(cache, built);

  return built.detalle;
}

function cacheDashboardCore_(cache, built) {
  putCacheChunked_(cache, CONFIG.CACHE_KEY, built.summary, CONFIG.CACHE_SECONDS);
  putCacheChunked_(cache, CONFIG.DETAIL_CACHE_KEY, built.detalle, CONFIG.CACHE_SECONDS);
}

function buildDashboardCore_() {
  const ss = getSpreadsheet_();
  const sh = getDataSheet_(ss);
  const values = sh.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('La hoja no tiene datos suficientes.');
  }

  const headers = values[0].map(normalize_);
  const col = getColumns_(headers);

  validateColumns_(col, [
    'calTrz',
    'diametro',
    'largo',
    'cantidad',
    'cubicacion',
    'fecha',
    'proveedor',
    'comuna',
    'rol',
    'predio'
  ]);

  const lastIngresoDate = getLastIngresoDate_(values, col);
  const lastUpdateISO = lastIngresoDate
    ? Utilities.formatDate(lastIngresoDate, 'America/Santiago', 'dd/MM/yyyy')
    : 'Sin datos';

  let totalCub = 0;
  let totalTrozos = 0;
  let diamPond = 0;

  const proveedores = {};
  const proveedorFaenas = {};
  const comunas = {};
  const regiones = {};
  const fechas = {};
  const matriz = {};
  const roles = {};
  const predios = {};
  const calidades = {};
  const recepciones = {};
  const detalleIngresos = [];
  const masisaFaenasActuales = {};

  // Series diarias por proveedor: alimentan la tendencia día a día que se
  // muestra en "Cumplimiento plan proveedores" y en el plan de acción.
  const seriesProveedor = {};
  const mesesEnDatos = {};

  values.slice(1).forEach(row => {
    if (rowEmpty_(row)) return;

    const calTrz = rawText_(row[col.calTrz]);
    const calidad = qualityLabel_(calTrz, rawText_(row[col.calidad]));
    const diametro = num_(row[col.diametro]);
    const largo = num_(row[col.largo]);
    const cantidad = num_(row[col.cantidad]);
    const cubicacion = num_(row[col.cubicacion]);

    if (!cantidad && !cubicacion) return;

    const proveedor = providerCanonical_(row[col.proveedor]) || 'SIN PROVEEDOR';
    const comuna = text_(row[col.comuna]) || 'SIN COMUNA';
    const region = regionForComuna_(comuna);
    const fecha = dateKey_(row[col.fecha]) || 'SIN FECHA';
    const rol = rawText_(row[col.rol]) || 'SIN ROL';
    const predio = text_(row[col.predio]) || 'SIN PREDIO';
    const diaHabil = businessDayNumberFromValue_(row[col.fecha]);

    totalCub += cubicacion;
    totalTrozos += cantidad;
    diamPond += diametro * cantidad;

    addAgg_(proveedores, proveedor, cantidad, cubicacion, diametro, largo);

    if (!proveedorFaenas[proveedor]) proveedorFaenas[proveedor] = {};
    addAgg_(proveedorFaenas[proveedor], predio, cantidad, cubicacion, diametro, largo);

    addAgg_(comunas, comuna, cantidad, cubicacion, diametro, largo);
    addAgg_(regiones, region, cantidad, cubicacion, diametro, largo);
    addAgg_(fechas, fecha, cantidad, cubicacion, diametro, largo);

    addProviderSeriesPoint_(seriesProveedor, proveedor, diaHabil, fecha, cantidad, cubicacion);

    const mesKey = monthKeyFromDateKey_(fecha);
    if (mesKey) {
      if (!mesesEnDatos[mesKey]) mesesEnDatos[mesKey] = { mes: mesKey, cubicacion: 0, trozos: 0 };
      mesesEnDatos[mesKey].cubicacion += cubicacion;
      mesesEnDatos[mesKey].trozos += cantidad;
    }

    const predioKey = proveedor + '|' + predio;

    if (!predios[predioKey]) {
      predios[predioKey] = {
        _proveedor: proveedor,
        _predio: predio,
        trozos: 0,
        cubicacion: 0,
        diametroPonderado: 0,
        largoPonderado: 0
      };
    }

    predios[predioKey].trozos += cantidad;
    predios[predioKey].cubicacion += cubicacion;
    predios[predioKey].diametroPonderado += diametro * cantidad;
    predios[predioKey].largoPonderado += largo * cantidad;

    addAgg_(calidades, calidad, cantidad, cubicacion, diametro, largo);

    if (isMasisaFaena_(predio) && providerCanonical_(row[col.proveedor]) === 'MASISA SA') {
      addAggByKey_(masisaFaenasActuales, faenaKey_(predio), predio, cantidad, cubicacion, diametro, largo);
    }

    addRecepcionAgg_(
      recepciones,
      { proveedor, predio, comuna, calidad, largo },
      cantidad,
      cubicacion,
      diametro
    );

    detalleIngresos.push({
      proveedor,
      predio,
      comuna,
      region,
      rol,
      calidad,
      largo,
      fecha,
      dia: diaHabil,
      trozos: cantidad,
      cubicacion,
      diametroPromedio: diametro,
      eficiencia: cantidad ? cubicacion / cantidad : 0
    });

    roles[rol] = true;

    const key = diametro + '|' + largo;

    if (!matriz[key]) {
      matriz[key] = {
        diametro,
        largo,
        trozos: 0,
        cubicacion: 0,
        eficiencia: 0
      };
    }

    matriz[key].trozos += cantidad;
    matriz[key].cubicacion += cubicacion;
  });

  const plan = getProviderPlanData_(ss, lastIngresoDate);
  const projection = getTruckProjectionData_(ss, lastIngresoDate);
  const calendario = buildCalendarData_(lastIngresoDate || new Date());
  const proveedoresArray = objectToArray_(proveedores, 'proveedor');

  const cumplimientoProveedores = buildProviderCompliance_(
    proveedoresArray,
    plan,
    proveedorFaenas,
    masisaFaenasActuales
  );

  const ritmoDiarioActual = plan.businessDaysElapsed
    ? totalCub / plan.businessDaysElapsed
    : 0;

  const proyeccionCierreMes = ritmoDiarioActual * plan.businessDaysInMonth;
  const diasFaltantes = Math.max(0, plan.businessDaysInMonth - plan.businessDaysElapsed);
  const brechaCierre = proyeccionCierreMes - plan.totalPlan;
  const faltaParaPlan = Math.max(0, plan.totalPlan - totalCub);

  // Tendencia día a día y plan de acción (Analisis.gs).
  const tendencias = buildProviderTrends_(seriesProveedor, plan, calendario);
  aplicarTendenciasACumplimiento_(cumplimientoProveedores, tendencias);

  const planAccion = buildActionPlan_(cumplimientoProveedores, plan, {
    diasFaltantes,
    ritmoDiarioActual,
    m3PorCamion: Number(CONFIG.M3_PER_CAMION) || 26
  });

  const concentracion = buildSupplyConcentration_(proveedoresArray, totalCub);

  const output = {
    generatedAt: new Date().toISOString(),
    lastUpdate: lastUpdateISO,
    planMonth: plan.monthLabel,

    kpis: {
      totalCubicacion: totalCub,
      totalTrozos: totalTrozos,
      diametroPromedio: totalTrozos ? diamPond / totalTrozos : 0,
      eficienciaGlobal: totalTrozos ? totalCub / totalTrozos : 0,

      planCubicacion: plan.totalPlan,
      planAFecha: plan.planToDate,
      planDiarioHabil: plan.dailyPlan,

      diasHabilesMes: plan.businessDaysInMonth,
      diasHabilesTranscurridos: plan.businessDaysElapsed,
      diasHabilesFaltantes: diasFaltantes,

      camionesProyectadosMes: projection.totalCamiones,
      m3ProyectadosCamionesMes: projection.totalM3,
      m3PorCamion: Number(CONFIG.M3_PER_CAMION) || 26,

      diferenciaPlanAFecha: totalCub - plan.planToDate,
      cumplimientoPlan: plan.planToDate ? totalCub / plan.planToDate : 0,

      ritmoDiarioActual,
      proyeccionCierreMes,
      cumplimientoProyectado: plan.totalPlan ? proyeccionCierreMes / plan.totalPlan : 0,

      // KPIs de compra: cuánto falta y a qué ritmo hay que ir para cerrar.
      brechaCierreMes: brechaCierre,
      m3FaltantesParaPlan: faltaParaPlan,
      ritmoRequeridoDia: diasFaltantes ? faltaParaPlan / diasFaltantes : 0,
      camionesRequeridosDia: diasFaltantes
        ? (faltaParaPlan / diasFaltantes) / (Number(CONFIG.M3_PER_CAMION) || 26)
        : 0,
      esfuerzoAdicional: ritmoDiarioActual
        ? ((diasFaltantes ? faltaParaPlan / diasFaltantes : 0) / ritmoDiarioActual) - 1
        : 0,

      proveedoresActivos: proveedoresArray.filter(p => p.cubicacion > 0).length,
      proveedoresCriticos: planAccion.resumen.criticos,
      proveedoresAlerta: planAccion.resumen.alerta,
      m3EnRiesgo: planAccion.resumen.m3Brecha,
      m3SobrePlan: planAccion.resumen.m3Excedente,

      concentracionTop3: concentracion.top3,
      concentracionHHI: concentracion.hhi
    },

    proveedores: proveedoresArray,
    cumplimientoProveedores,
    tendenciaProveedores: tendencias,
    planAccion,
    concentracion,

    comunas: enrichComunasWithRegion_(objectToArray_(comunas, 'comuna')),
    regiones: objectToArray_(regiones, 'region'),
    fechas: dateAggToArray_(fechas, plan),
    calendario,

    proyeccionCamiones: projection.rows,

    predios: Object.values(predios).map(x => ({
      proveedor: x._proveedor,
      predio: x._predio,
      trozos: x.trozos,
      cubicacion: x.cubicacion,
      diametroPromedio: x.trozos ? x.diametroPonderado / x.trozos : 0,
      largoPromedio: x.trozos ? x.largoPonderado / x.trozos : 0
    })).sort((a, b) => b.cubicacion - a.cubicacion),

    calidades: objectToArray_(calidades, 'calidad'),
    recepciones: recepcionesToArray_(recepciones),
    roles: Object.keys(roles),

    diagnostico: {
      mesesEnDatos: Object.values(mesesEnDatos).sort((a, b) => a.mes < b.mes ? -1 : 1),
      filasLeidas: values.length - 1,
      planEncontrado: Boolean(plan.totalPlan),
      proyeccionEncontrada: Boolean(projection.rows.length)
    },

    matriz: Object.values(matriz)
      .map(x => {
        x.eficiencia = x.trozos ? x.cubicacion / x.trozos : 0;
        return x;
      })
      .sort((a, b) => a.diametro - b.diametro || a.largo - b.largo)
  };

  return { summary: output, detalle: detalleIngresos };
}

function addProviderSeriesPoint_(series, proveedor, dia, fecha, trozos, cubicacion) {
  if (!series[proveedor]) {
    series[proveedor] = { proveedor, dias: {}, ultimoDia: 0, ultimaFecha: '' };
  }

  const item = series[proveedor];
  const key = Number(dia) || 0;

  if (!key) return;

  if (!item.dias[key]) item.dias[key] = { dia: key, fecha, trozos: 0, cubicacion: 0 };

  item.dias[key].trozos += trozos;
  item.dias[key].cubicacion += cubicacion;

  if (key >= item.ultimoDia) {
    item.ultimoDia = key;
    item.ultimaFecha = fecha;
  }
}

function monthKeyFromDateKey_(value) {
  const date = parseDateKey_(value);
  if (!date) return '';
  return Utilities.formatDate(date, 'America/Santiago', 'yyyy-MM');
}

// Concentración del suministro: cuánto depende la planta de pocos proveedores.
// HHI sobre participaciones (0 = atomizado, 1 = un solo proveedor).
function buildSupplyConcentration_(proveedoresArray, totalCub) {
  const activos = (proveedoresArray || []).filter(x => Number(x.cubicacion) > 0);
  const total = Number(totalCub) || activos.reduce((s, x) => s + x.cubicacion, 0);

  if (!total) {
    return { top3: 0, top5: 0, hhi: 0, proveedoresActivos: 0, detalle: [] };
  }

  const ordenados = activos.slice().sort((a, b) => b.cubicacion - a.cubicacion);
  const share = ordenados.map(x => x.cubicacion / total);

  return {
    top3: share.slice(0, 3).reduce((s, x) => s + x, 0),
    top5: share.slice(0, 5).reduce((s, x) => s + x, 0),
    hhi: share.reduce((s, x) => s + x * x, 0),
    proveedoresActivos: ordenados.length,
    detalle: ordenados.slice(0, 10).map((x, i) => ({
      proveedor: x.proveedor,
      cubicacion: x.cubicacion,
      participacion: share[i]
    }))
  };
}

/*******************************************************
 CACHÉ (por chunks, para no toparse con el límite de
 100KB por clave de CacheService en payloads grandes)
*******************************************************/

function putCacheSafe_(cache, key, value, seconds) {
  try {
    const text = JSON.stringify(value);
    if (text.length <= CONFIG.CACHE_CHUNK_CHARS) {
      cache.put(key, text, seconds);
    }
  } catch (err) {
    Logger.log('No se pudo guardar cache (' + key + '): ' + err);
  }
}

function putCacheChunked_(cache, key, value, seconds) {
  try {
    const text = JSON.stringify(value);
    const chunkSize = CONFIG.CACHE_CHUNK_CHARS;
    const count = Math.max(1, Math.ceil(text.length / chunkSize));

    for (let i = 0; i < count; i++) {
      cache.put(key + '_' + i, text.slice(i * chunkSize, (i + 1) * chunkSize), seconds);
    }

    cache.put(key + '_meta', String(count), seconds);
  } catch (err) {
    Logger.log('No se pudo guardar cache (' + key + '): ' + err);
  }
}

function getCacheChunked_(cache, key) {
  try {
    const countRaw = cache.get(key + '_meta');
    if (!countRaw) return null;

    const count = Number(countRaw) || 0;
    if (!count) return null;

    let text = '';

    for (let i = 0; i < count; i++) {
      const part = cache.get(key + '_' + i);
      if (part === null) return null;
      text += part;
    }

    return JSON.parse(text);
  } catch (err) {
    Logger.log('No se pudo leer cache (' + key + '): ' + err);
    return null;
  }
}

function clearCacheChunked_(cache, key) {
  const countRaw = cache.get(key + '_meta');

  if (!countRaw) {
    cache.remove(key);
    return;
  }

  const count = Number(countRaw) || 0;
  const keys = [key + '_meta'];

  for (let i = 0; i < count; i++) keys.push(key + '_' + i);

  cache.removeAll(keys);
}

/*******************************************************
 GIS DATA: KML / KMZ POR ROL
*******************************************************/

function getRolesMapData() {
  const sh = getDataSheet_();
  const values = sh.getDataRange().getValues();

  const response = {
    items: [],
    diagnostics: {
      rolesEnHoja: 0,
      rolesConArchivo: 0,
      rolesSinArchivo: 0,
      archivosEnCarpeta: 0,
      errores: []
    }
  };

  if (values.length < 2) return response;

  const headers = values[0].map(normalize_);
  const col = getColumns_(headers);

  validateColumns_(col, [
    'rol',
    'comuna',
    'proveedor',
    'cubicacion',
    'cantidad',
    'predio'
  ]);

  const filesByRol = getGisFilesByRol_();
  response.diagnostics.archivosEnCarpeta = Object.keys(filesByRol).length;

  const rolesInSheet = {};
  const rolesWithoutFile = {};
  const aggByRol = {};
  let countRoles = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    if (rowEmpty_(row)) continue;

    const rol = rawText_(row[col.rol]);
    const rolKey = roleKey_(rol);

    if (!rolKey) continue;

    rolesInSheet[rolKey] = rol;

    if (!filesByRol[rolKey]) {
      rolesWithoutFile[rolKey] = rol;
      continue;
    }

    if (!aggByRol[rolKey]) {
      if (countRoles >= CONFIG.MAX_ROLES_MAPA) continue;

      aggByRol[rolKey] = {
        rol,
        rolKey,
        comuna: rawText_(row[col.comuna]),
        region: regionForComuna_(row[col.comuna]),
        proveedor: rawText_(row[col.proveedor]),
        predio: rawText_(row[col.predio]),
        cubicacion: 0,
        trozos: 0,
        fileId: filesByRol[rolKey].fileId,
        fileName: filesByRol[rolKey].fileName,
        originalRoleName: filesByRol[rolKey].originalRoleName,
        extension: filesByRol[rolKey].extension
      };

      countRoles++;
    }

    aggByRol[rolKey].cubicacion += num_(row[col.cubicacion]);
    aggByRol[rolKey].trozos += num_(row[col.cantidad]);
  }

  const cache = CacheService.getScriptCache();
  const gisCacheKeys = [];

  Object.keys(aggByRol).forEach(rolKey => {
    const item = aggByRol[rolKey];

    try {
      const file = DriveApp.getFileById(item.fileId);
      const polygons = getCachedPolygonsForFile_(cache, file, gisCacheKeys);

      if (!polygons.length) {
        response.diagnostics.errores.push('Sin polígonos válidos: ' + item.fileName);
        return;
      }

      response.items.push({
        rol: item.rol,
        rolKey: item.rolKey,
        comuna: item.comuna,
        region: item.region,
        proveedor: item.proveedor,
        predio: item.predio,
        cubicacion: item.cubicacion,
        trozos: item.trozos,
        fileName: item.fileName,
        polygons
      });
    } catch (err) {
      const message = 'Error leyendo GIS ROL ' + item.rol + ': ' + err;
      Logger.log(message);
      response.diagnostics.errores.push(message);
    }
  });

  if (gisCacheKeys.length) {
    putCacheSafe_(cache, GIS_CACHE_INDEX_KEY, gisCacheKeys, GIS_CACHE_SECONDS);
  }

  response.diagnostics.rolesEnHoja = Object.keys(rolesInSheet).length;
  response.diagnostics.rolesConArchivo = Object.keys(aggByRol).length;
  response.diagnostics.rolesSinArchivo = Object.keys(rolesWithoutFile).length;

  return response;
}

const GIS_CACHE_PREFIX = 'MASISA_GIS_POLY_V1_';
const GIS_CACHE_INDEX_KEY = 'MASISA_GIS_CACHE_INDEX_V1';
const GIS_CACHE_SECONDS = 21600;

function getCachedPolygonsForFile_(cache, file, gisCacheKeysOut) {
  const cacheKey = GIS_CACHE_PREFIX + file.getId();
  const updatedIso = file.getLastUpdated().toISOString();

  gisCacheKeysOut.push(cacheKey);

  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);

      if (parsed && parsed.updated === updatedIso && Array.isArray(parsed.polygons)) {
        return parsed.polygons;
      }
    } catch (err) {}
  }

  const kml = extractKmlTextFromFile_(file);
  const polygons = simplifyPolygons_(parseKmlPolygonsServer_(kml));

  putCacheSafe_(cache, cacheKey, { updated: updatedIso, polygons }, GIS_CACHE_SECONDS);

  return polygons;
}

function clearGisCache_(cache) {
  try {
    const raw = cache.get(GIS_CACHE_INDEX_KEY);

    if (raw) {
      const keys = JSON.parse(raw);

      if (Array.isArray(keys) && keys.length) {
        cache.removeAll(keys);
      }
    }
  } catch (err) {
    Logger.log('No se pudo limpiar caché GIS: ' + err);
  }

  cache.remove(GIS_CACHE_INDEX_KEY);
}

function simplifyPolygons_(polygons) {
  return polygons.map(simplifyRing_).filter(ring => ring.length >= 3);
}

function simplifyRing_(ring) {
  const out = [];

  for (let i = 0; i < ring.length; i++) {
    const point = [round5_(ring[i][0]), round5_(ring[i][1])];
    const prev = out[out.length - 1];

    if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) {
      out.push(point);
    }
  }

  return out;
}

function round5_(value) {
  return Math.round(value * 100000) / 100000;
}

function getGisFilesByRol_() {
  const folder = DriveApp.getFolderById(GIS_FOLDER_ID);
  const files = folder.getFiles();
  const out = {};

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    const lower = fileName.toLowerCase();

    if (!lower.endsWith('.kml') && !lower.endsWith('.kmz')) continue;

    const rolKey = roleKey_(fileName);

    if (!rolKey) continue;

    const extension = lower.endsWith('.kmz') ? 'kmz' : 'kml';
    const originalRoleName = fileName.replace(/\.(kml|kmz)$/i, '').trim();

    out[rolKey] = {
      fileId: file.getId(),
      fileName,
      originalRoleName,
      extension
    };
  }

  return out;
}

function extractKmlTextFromFile_(file) {
  const name = file.getName().toLowerCase();
  const blob = file.getBlob();

  if (name.endsWith('.kml')) {
    return blob.getDataAsString('UTF-8');
  }

  if (name.endsWith('.kmz')) {
    try {
      blob.setContentType('application/zip');

      const parts = Utilities.unzip(blob);
      const kmlBlob = parts.find(p => p.getName().toLowerCase().endsWith('.kml'));

      if (!kmlBlob) {
        throw new Error('KMZ sin KML interno');
      }

      return kmlBlob.getDataAsString('UTF-8');
    } catch (err) {
      throw new Error('No se pudo descomprimir KMZ ' + file.getName() + ': ' + err);
    }
  }

  return '';
}

function parseKmlPolygonsServer_(kmlText) {
  const text = String(kmlText || '').trim();

  if (!text) return [];

  const document = XmlService.parse(text);
  const root = document.getRootElement();
  const coordinateNodes = [];

  collectCoordinateNodes_(root, coordinateNodes);

  return coordinateNodes
    .map(node => coordinatesTextToLatLng_(node.getText()))
    .filter(coords => coords.length >= 3);
}

function collectCoordinateNodes_(element, out) {
  if (element.getName && element.getName() === 'coordinates') {
    out.push(element);
  }

  element.getChildren().forEach(child => collectCoordinateNodes_(child, out));
}

function coordinatesTextToLatLng_(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .map(pair => {
      const parts = pair.split(',');
      const lng = Number(parts[0]);
      const lat = Number(parts[1]);

      if (!isFinite(lat) || !isFinite(lng)) return null;

      return [lat, lng];
    })
    .filter(Boolean);
}

function roleKey_(value) {
  return String(value || '')
    .replace(/\.(kml|kmz)$/i, '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/*******************************************************
 COLUMNAS / VALIDACIÓN
*******************************************************/

function getColumns_(headers) {
  return {
    estado: findHeader_(headers, ['estado']),
    producto: findHeader_(headers, ['producto']),
    calTrz: findHeader_(headers, ['cal trz', 'caltrz', 'calidad trozo', 'calidad trozos']),
    calidad: findHeader_(headers, ['calidad']),
    largo: findHeader_(headers, ['largo']),
    diametro: findHeader_(headers, ['diametro']),
    cantidad: findHeader_(headers, ['cantidad']),
    cubicacion: findHeader_(headers, ['cubicacion']),
    fecha: findHeader_(headers, ['fecha']),
    hora: findHeader_(headers, ['hora']),
    guia: findHeader_(headers, ['guia']),
    proveedor: findHeader_(headers, ['proveedor']),
    comuna: findHeader_(headers, ['comuna']),
    rol: findHeader_(headers, ['rol']),
    predio: findHeader_(headers, ['predio'])
  };
}

function findHeader_(headers, aliases) {
  for (let i = 0; i < headers.length; i++) {
    if (aliases.indexOf(headers[i]) !== -1) return i;
  }

  return -1;
}

function validateColumns_(col, required) {
  const missing = required.filter(k => col[k] === -1 || col[k] === undefined);

  if (missing.length) {
    throw new Error('Faltan columnas: ' + missing.join(', '));
  }
}

/*******************************************************
 PLAN
*******************************************************/

function getProviderPlanData_(ss, lastIngresoDate) {
  const sh = getPlanSheet_(ss);

  const empty = {
    monthLabel: '',
    monthColumn: -1,
    totalPlan: 0,
    planToDate: 0,
    dailyPlan: 0,
    businessDaysInMonth: 0,
    businessDaysElapsed: 0,
    proveedores: {}
  };

  if (!sh) return empty;

  const values = sh.getDataRange().getValues();

  if (values.length < 2) return empty;

  // Los encabezados de mes en "Hoja 2" suelen quedar como fecha real (Sheets
  // autodetecta texto tipo "jul-2026" y lo convierte a una celda con formato
  // mmm-yyyy), no como texto plano. Por eso se conserva el valor crudo de la
  // celda (rawHeaders) para la columna de mes, en vez de forzarlo a String()
  // antes de comparar.
  const rawHeaders = values[0];
  const headers = rawHeaders.map(rawText_);

  const providerColumn = findPlanColumn_(headers, ['proveedores', 'proveedor']);
  const originColumn = findPlanColumn_(headers, ['origen', 'predio', 'faena']);

  // El mes del plan y los días hábiles transcurridos deben calcularse SIEMPRE
  // sobre la misma fecha de referencia: la del último ingreso cargado en la
  // hoja de datos. Si se usara la fecha real de "hoy" para elegir la columna
  // del plan, el dashboard saltaría al plan del mes siguiente apenas cambia
  // el mes calendario, aunque los datos cargados todavía sean del mes anterior
  // (ej: datos cargados el 30, hoy ya es día 1 del mes nuevo).
  const refDate = lastIngresoDate || new Date();
  const monthColumn = findPlanMonthColumn_(rawHeaders, refDate, [providerColumn, originColumn]);

  if (monthColumn === -1) return empty;

  const out = {
    monthLabel: planHeaderLabel_(rawHeaders[monthColumn]),
    monthColumn,
    totalPlan: 0,
    planToDate: 0,
    dailyPlan: 0,
    businessDaysInMonth: businessDaysInMonth_(refDate),
    businessDaysElapsed: businessDaysElapsedInMonth_(refDate),
    proveedores: {}
  };

  values.slice(1).forEach(row => {
    if (rowEmpty_(row)) return;

    const rawProvider = providerColumn === -1 ? '' : rawText_(row[providerColumn]);
    const rawOrigin = originColumn === -1 ? '' : rawText_(row[originColumn]);
    const rawName = rawOrigin || rawProvider;
    const plan = num_(row[monthColumn]);

    if (!rawName || isPlanTotalRow_(rawName)) return;

    const explicitProvider = rawProvider ? providerCanonical_(rawProvider) : null;
    const isMasisaByProvider = explicitProvider === 'MASISA SA' || (!rawProvider && isMasisaFaena_(rawName));
    const isMasisaFaena = isMasisaByProvider && isMasisaFaena_(rawOrigin || rawName);

    let proveedor;

    if (isMasisaFaena) {
      proveedor = 'MASISA SA';
    } else if (explicitProvider) {
      proveedor = explicitProvider;
    } else {
      proveedor = providerCanonical_(rawName);
    }

    if (!proveedor) return;

    if (!out.proveedores[proveedor]) {
      out.proveedores[proveedor] = {
        proveedor,
        nombrePlan: isMasisaFaena ? 'MASISA S.A' : (rawProvider || rawName),
        plan: 0,
        planToDate: 0,
        faenas: {}
      };
    }

    out.proveedores[proveedor].plan += plan;
    out.totalPlan += plan;

    if (isMasisaFaena) {
      const fk = faenaKey_(rawName);

      if (!out.proveedores[proveedor].faenas[fk]) {
        out.proveedores[proveedor].faenas[fk] = {
          faena: faenaLabel_(rawName),
          plan: 0,
          planToDate: 0
        };
      }

      out.proveedores[proveedor].faenas[fk].plan += plan;
    }
  });

  out.dailyPlan = out.businessDaysInMonth ? out.totalPlan / out.businessDaysInMonth : 0;
  out.planToDate = out.dailyPlan * out.businessDaysElapsed;

  Object.keys(out.proveedores).forEach(pv => {
    const item = out.proveedores[pv];

    item.planToDate = out.businessDaysInMonth
      ? item.plan * out.businessDaysElapsed / out.businessDaysInMonth
      : 0;

    Object.keys(item.faenas || {}).forEach(fk => {
      const faena = item.faenas[fk];

      faena.planToDate = out.businessDaysInMonth
        ? faena.plan * out.businessDaysElapsed / out.businessDaysInMonth
        : 0;
    });
  });

  return out;
}

/*******************************************************
 CUMPLIMIENTO
*******************************************************/

function buildProviderCompliance_(actualProviders, plan, proveedorFaenas, masisaFaenasActuales) {
  const byProvider = {};

  proveedorFaenas = proveedorFaenas || {};
  masisaFaenasActuales = masisaFaenasActuales || {};

  actualProviders.forEach(item => {
    byProvider[item.proveedor] = {
      proveedor: item.proveedor,
      nombrePlan: '',
      plan: 0,
      planToDate: 0,
      trozos: item.trozos,
      cubicacion: item.cubicacion,
      diametroPromedio: item.diametroPromedio,
      faenas: mergeProviderFaenas_(proveedorFaenas[item.proveedor] || {}, {}),
      cumplimiento: 0,
      diferencia: 0,
      estado: 'SIN PLAN'
    };
  });

  Object.keys(plan.proveedores || {}).forEach(proveedor => {
    const planned = plan.proveedores[proveedor];

    if (!byProvider[proveedor]) {
      byProvider[proveedor] = {
        proveedor,
        nombrePlan: planned.nombrePlan,
        plan: 0,
        planToDate: 0,
        trozos: 0,
        cubicacion: 0,
        diametroPromedio: 0,
        faenas: [],
        cumplimiento: 0,
        diferencia: 0,
        estado: 'SIN INGRESO'
      };
    }

    byProvider[proveedor].nombrePlan = planned.nombrePlan;
    byProvider[proveedor].plan = planned.plan;
    byProvider[proveedor].planToDate = planned.planToDate;

    if (proveedor === 'MASISA SA') {
      byProvider[proveedor].faenas = mergeProviderFaenas_(masisaFaenasActuales, planned.faenas || {});
      applyFaenaTotalsToProvider_(byProvider[proveedor]);
    } else {
      byProvider[proveedor].faenas = mergeProviderFaenas_(proveedorFaenas[proveedor] || {}, planned.faenas || {});
    }
  });

  return Object.values(byProvider)
    .map(item => {
      item.cumplimiento = item.planToDate ? item.cubicacion / item.planToDate : 0;
      item.diferencia = item.cubicacion - item.planToDate;

      if (item.planToDate && item.cumplimiento >= 1) {
        item.estado = 'CUMPLIDO';
      } else if (item.planToDate && item.cubicacion > 0) {
        item.estado = 'EN CURSO';
      }

      return item;
    })
    .sort((a, b) => {
      if (a.plan && !b.plan) return -1;
      if (!a.plan && b.plan) return 1;
      return b.cubicacion - a.cubicacion;
    });
}

function mergeProviderFaenas_(actualFaenas, plannedFaenas) {
  const out = {};

  objectToArray_(actualFaenas || {}, 'faena').forEach(item => {
    const key = text_(item.faena);

    out[key] = {
      faena: item.faena,
      plan: 0,
      planToDate: 0,
      trozos: item.trozos,
      cubicacion: item.cubicacion,
      diametroPromedio: item.diametroPromedio,
      cumplimiento: 0,
      diferencia: item.cubicacion
    };
  });

  Object.keys(plannedFaenas || {}).forEach(key => {
    const planned = plannedFaenas[key];
    const normalized = faenaKey_(planned.faena || key);

    if (!out[normalized]) {
      out[normalized] = {
        faena: planned.faena || normalized,
        plan: 0,
        planToDate: 0,
        trozos: 0,
        cubicacion: 0,
        diametroPromedio: 0,
        cumplimiento: 0,
        diferencia: 0
      };
    }

    out[normalized].plan = planned.plan || 0;
    out[normalized].planToDate = planned.planToDate || 0;
    out[normalized].cumplimiento = out[normalized].planToDate
      ? out[normalized].cubicacion / out[normalized].planToDate
      : 0;
    out[normalized].diferencia = out[normalized].cubicacion - out[normalized].planToDate;
  });

  return Object.values(out).sort((a, b) => {
    if (a.plan && !b.plan) return -1;
    if (!a.plan && b.plan) return 1;
    return b.cubicacion - a.cubicacion;
  });
}

function applyFaenaTotalsToProvider_(provider) {
  const totals = (provider.faenas || []).reduce((acc, faena) => {
    const t = Number(faena.trozos) || 0;
    const c = Number(faena.cubicacion) || 0;
    const d = Number(faena.diametroPromedio) || 0;

    acc.trozos += t;
    acc.cubicacion += c;
    acc.diametroPonderado += d * t;

    return acc;
  }, {
    trozos: 0,
    cubicacion: 0,
    diametroPonderado: 0
  });

  provider.trozos = totals.trozos;
  provider.cubicacion = totals.cubicacion;
  provider.diametroPromedio = totals.trozos
    ? totals.diametroPonderado / totals.trozos
    : 0;
}

/*******************************************************
 PROYECCIÓN CAMIONES
*******************************************************/

function getProjectionSheet_(ss) {
  ss = ss || getSpreadsheet_();
  return ss.getSheetByName(CONFIG.PROJECTION_SHEET_NAME);
}

function parseProjectionHeaderDate_(value) {
  if (value instanceof Date && !isNaN(value)) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value || '').trim();

  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  return null;
}

function sameMonth_(a, b) {
  return a
    && b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth();
}

function getTruckProjectionData_(ss, lastIngresoDate) {
  const sh = getProjectionSheet_(ss);
  const empty = {
    rows: [],
    totalCamiones: 0,
    totalM3: 0
  };

  if (!sh) return empty;

  const values = sh.getDataRange().getValues();

  if (values.length < 2) return empty;

  const headers = values[0];
  const refDate = lastIngresoDate || new Date();
  const dateColumns = [];

  for (let c = 2; c < headers.length; c++) {
    const date = parseProjectionHeaderDate_(headers[c]);

    if (!date || !sameMonth_(date, refDate)) continue;

    dateColumns.push({
      col: c,
      date,
      fecha: Utilities.formatDate(date, 'America/Santiago', 'yyyy-MM-dd')
    });
  }

  if (!dateColumns.length) return empty;

  const rows = [];
  let totalCamiones = 0;

  values.slice(1).forEach(row => {
    if (rowEmpty_(row)) return;

    const rawProvider = rawText_(row[0]);
    const rawOrigin = rawText_(row[1]);
    const rawName = rawOrigin || rawProvider;

    if (!rawName || isPlanTotalRow_(rawName)) return;

    let proveedor = providerCanonical_(rawProvider || rawOrigin);

    if (isMasisaFaena_(rawOrigin || rawProvider)) {
      proveedor = 'MASISA SA';
    }

    if (!proveedor) {
      proveedor = providerCanonical_(rawName) || text_(rawName) || 'SIN PROVEEDOR';
    }

    dateColumns.forEach(dc => {
      const camiones = num_(row[dc.col]);

      if (!camiones) return;

      const m3 = camiones * (Number(CONFIG.M3_PER_CAMION) || 26);

      totalCamiones += camiones;

      rows.push({
        proveedor,
        origen: rawOrigin || rawProvider || 'SIN ORIGEN',
        fecha: dc.fecha,
        dia: businessDayNumberFromValue_(dc.date),
        camiones,
        cubicacion: m3
      });
    });
  });

  return {
    rows,
    totalCamiones,
    totalM3: totalCamiones * (Number(CONFIG.M3_PER_CAMION) || 26)
  };
}

/*******************************************************
 SHEETS
*******************************************************/

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getDataSheet_(ss) {
  ss = ss || getSpreadsheet_();

  const sh = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sh) {
    throw new Error('No existe la hoja: ' + CONFIG.SHEET_NAME);
  }

  return sh;
}

function getPlanSheet_(ss) {
  ss = ss || getSpreadsheet_();
  return ss.getSheetByName(CONFIG.PLAN_SHEET_NAME);
}

/*******************************************************
 HELPERS
*******************************************************/

function normalize_(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

function num_(value) {
  if (typeof value === 'number') return value;

  const n = String(value || '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  return Number(n) || 0;
}

function text_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function rawText_(value) {
  return String(value || '').trim();
}

function rowEmpty_(row) {
  return row.every(v => String(v || '').trim() === '');
}

function dateKey_(value) {
  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return String(value || '').trim();
}

function qualityLabel_(calTrz, fallback) {
  const key = String(calTrz || '').trim();

  if (key === '1') return 'SINIESTRADO';
  if (key === '2') return 'VERDE';
  if (key === '3') return 'MANCHADO';

  return text_(fallback) || 'SIN CALIDAD';
}

function findPlanMonthColumn_(headers, now, excludeColumns) {
  now = now || new Date();

  const monthKey = planMonthKey_(now);
  const exclude = new Set((excludeColumns || []).filter(i => i !== -1));

  for (let i = 1; i < headers.length; i++) {
    if (planHeaderKey_(headers[i]) === monthKey) {
      return i;
    }
  }

  for (let j = 1; j < headers.length; j++) {
    if (exclude.has(j)) continue;
    if (hasHeaderContent_(headers[j])) {
      return j;
    }
  }

  return -1;
}

function hasHeaderContent_(value) {
  if (value instanceof Date) return !isNaN(value);
  return Boolean(rawText_(value));
}

function findPlanColumn_(headers, names) {
  const normalizedNames = names.map(normalize_);

  for (let i = 0; i < headers.length; i++) {
    if (normalizedNames.indexOf(normalize_(headers[i])) !== -1) {
      return i;
    }
  }

  return -1;
}

function planMonthKey_(date) {
  const monthNames = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sept', 'oct', 'nov', 'dic'
  ];

  return monthNames[date.getMonth()] + '-' + String(date.getFullYear()).slice(-2);
}

function planHeaderKey_(value) {
  // Si Sheets convirtió el encabezado en una fecha real (p.ej. al escribir
  // "jul-2026" en una columna con formato mmm-yyyy), se calcula la clave
  // directamente desde la fecha en vez de comparar texto.
  if (value instanceof Date && !isNaN(value)) {
    return planMonthKey_(value);
  }

  const text = normalize_(value).replace(/\s+/g, '');
  // Acepta año en 2 o 4 dígitos y "sep" o "sept" ("jul-26", "jul-2026", "jul2026"...).
  const match = text.match(/^([a-z]+)-?(\d+)$/);

  if (!match) return text.replace('sep-', 'sept-');

  const month = match[1] === 'sep' ? 'sept' : match[1];
  const year = match[2].slice(-2);

  return month + '-' + year;
}

function planHeaderLabel_(value) {
  if (value instanceof Date && !isNaN(value)) {
    return planMonthKey_(value);
  }
  return rawText_(value);
}

function isPlanTotalRow_(value) {
  return normalize_(value).indexOf('total') === 0;
}

function faenaKey_(value) {
  return text_(value)
    .replace(/^MASISA\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function faenaLabel_(value) {
  const key = faenaKey_(value);

  if (key === 'LLOHUE') return 'MASISA LLOHUE';
  if (key === 'LA MONTANA') return 'LA MONTANA';

  return key || text_(value);
}

function isMasisaFaena_(value) {
  const key = faenaKey_(value);
  return MASISA_FAENAS.map(faenaKey_).indexOf(key) !== -1;
}

function enrichComunasWithRegion_(arr) {
  return arr.map(item => {
    item.region = regionForComuna_(item.comuna);
    return item;
  });
}

function regionForComuna_(value) {
  return REGION_BY_COMUNA[text_(value)] || 'Sin región asignada';
}

function providerCanonical_(value) {
  const key = providerKey_(value);

  if (!key) return '';

  return PROVIDER_ALIASES[key] || key;
}

function providerKey_(value) {
  return text_(value)
    .replace(/[.]/g, ' ')
    .replace(/&/g, ' Y ')
    .replace(/Ñ/g, 'N')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addAgg_(obj, key, trozos, cubicacion, diametro, largo) {
  if (!key) key = 'SIN';

  if (!obj[key]) {
    obj[key] = {
      trozos: 0,
      cubicacion: 0,
      diametroPonderado: 0,
      largoPonderado: 0
    };
  }

  obj[key].trozos += trozos;
  obj[key].cubicacion += cubicacion;
  obj[key].diametroPonderado += diametro * trozos;
  obj[key].largoPonderado += largo * trozos;
}

function addAggByKey_(obj, key, label, trozos, cubicacion, diametro, largo) {
  if (!key) key = 'SIN';

  if (!obj[key]) {
    obj[key] = {
      label: label || key,
      trozos: 0,
      cubicacion: 0,
      diametroPonderado: 0,
      largoPonderado: 0
    };
  }

  obj[key].trozos += trozos;
  obj[key].cubicacion += cubicacion;
  obj[key].diametroPonderado += diametro * trozos;
  obj[key].largoPonderado += largo * trozos;
}

function addRecepcionAgg_(obj, meta, trozos, cubicacion, diametro) {
  const key = [
    meta.proveedor,
    meta.predio,
    meta.comuna,
    meta.calidad,
    meta.largo
  ].join('|');

  if (!obj[key]) {
    obj[key] = {
      proveedor: meta.proveedor,
      predio: meta.predio,
      comuna: meta.comuna,
      calidad: meta.calidad,
      largo: meta.largo,
      trozos: 0,
      cubicacion: 0,
      diametroPonderado: 0
    };
  }

  obj[key].trozos += trozos;
  obj[key].cubicacion += cubicacion;
  obj[key].diametroPonderado += diametro * trozos;
}

function recepcionesToArray_(obj) {
  return Object.values(obj)
    .map(item => {
      item.diametroPromedio = item.trozos
        ? item.diametroPonderado / item.trozos
        : 0;

      item.eficiencia = item.trozos
        ? item.cubicacion / item.trozos
        : 0;

      return item;
    })
    .sort((a, b) => b.cubicacion - a.cubicacion);
}

function objectToArray_(obj, labelName) {
  const arr = Object.keys(obj).map(key => {
    const x = obj[key];

    return {
      [labelName]: key,
      trozos: x.trozos,
      cubicacion: x.cubicacion,
      eficiencia: x.trozos ? x.cubicacion / x.trozos : 0,
      diametroPromedio: x.trozos ? x.diametroPonderado / x.trozos : 0,
      largoPromedio: x.trozos ? x.largoPonderado / x.trozos : 0
    };
  });

  const totalCub = arr.reduce((s, x) => s + x.cubicacion, 0);
  const totalTrozos = arr.reduce((s, x) => s + x.trozos, 0);

  arr.forEach(x => {
    x.participacionCubicacion = totalCub ? x.cubicacion / totalCub : 0;
    x.participacionTrozos = totalTrozos ? x.trozos / totalTrozos : 0;
  });

  return arr.sort((a, b) => b.cubicacion - a.cubicacion);
}

function dateAggToArray_(obj, plan) {
  plan = plan || {};

  const arr = objectToArray_(obj, 'fecha')
    .sort((a, b) => dateSortValue_(a.fecha) - dateSortValue_(b.fecha));

  arr.forEach((x, index) => {
    const date = parseDateKey_(x.fecha);
    const effective = prevOrSameBusinessDay_(date);

    x.dia = businessDayNumberInMonth_(effective) || index + 1;
    x.planDiarioHabil = plan.dailyPlan || 0;
  });

  return arr;
}

function parseDateKey_(value) {
  const text = String(value || '').trim();

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  }

  return null;
}

function dateSortValue_(value) {
  const text = String(value || '').trim();

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return Number(iso[1] + iso[2] + iso[3]);
  }

  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return Number(dmy[3] + pad2_(dmy[2]) + pad2_(dmy[1]));
  }

  return 99999999;
}

function pad2_(value) {
  return String(value || '').padStart(2, '0');
}
