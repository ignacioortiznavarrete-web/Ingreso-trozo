/*******************************************************
 BITÁCORA DE APUNTES DEL ANALISTA
 -------------------------------------------------------
 Crea y administra la hoja "Apuntes" dentro de la misma
 planilla del dashboard. Ahí queda registrado lo que no
 cabe en un número: por qué un proveedor viene a la baja,
 qué se le preguntó, qué comprometió y para cuándo.

 El dashboard escribe y lee esta hoja sin caché, para que
 lo que se anota se vea de inmediato en la tabla
 "Cumplimiento plan proveedores" y en el plan de acción.
*******************************************************/

const APUNTES = {
  SHEET_NAME: 'Apuntes',

  TIPOS: ['Pregunta', 'Compromiso', 'Riesgo', 'Reclamo', 'Nota'],
  ESTADOS: ['Abierto', 'En curso', 'Cerrado'],
  PRIORIDADES: ['Alta', 'Media', 'Baja'],

  HEADERS: [
    'ID',
    'Fecha registro',
    'Mes plan',
    'Proveedor',
    'Faena / Predio',
    'Tipo',
    'Prioridad',
    'Pregunta u observación',
    'Respuesta / acuerdo',
    'Responsable',
    'Fecha compromiso',
    'm³ comprometidos',
    'Estado',
    'Cumplimiento al registrar',
    'Tendencia al registrar',
    'Origen',
    'Actualizado'
  ]
};

// Índice 0-based de cada columna dentro de APUNTES.HEADERS.
const APUNTES_COL = {
  id: 0,
  fecha: 1,
  mes: 2,
  proveedor: 3,
  faena: 4,
  tipo: 5,
  prioridad: 6,
  pregunta: 7,
  respuesta: 8,
  responsable: 9,
  fechaCompromiso: 10,
  m3: 11,
  estado: 12,
  cumplimiento: 13,
  tendencia: 14,
  origen: 15,
  actualizado: 16
};

/*******************************************************
 HOJA
*******************************************************/

function getApuntesSheet_(crearSiFalta) {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(APUNTES.SHEET_NAME);

  if (sh) return sh;
  if (!crearSiFalta) return null;

  sh = ss.insertSheet(APUNTES.SHEET_NAME);
  formatearHojaApuntes_(sh);

  return sh;
}

function formatearHojaApuntes_(sh) {
  const headers = APUNTES.HEADERS;

  sh.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setFontColor('#FFFFFF')
    .setBackground('#1E4D38')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sh.setFrozenRows(1);
  sh.setRowHeight(1, 40);

  const anchos = [110, 110, 90, 190, 170, 110, 90, 380, 380, 150, 120, 120, 110, 130, 130, 150, 130];
  anchos.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  const filas = Math.max(sh.getMaxRows() - 1, 200);

  // Listas desplegables para que la hoja se pueda llenar a mano sin romper
  // los filtros del dashboard.
  aplicarListaApuntes_(sh, APUNTES_COL.tipo + 1, filas, APUNTES.TIPOS);
  aplicarListaApuntes_(sh, APUNTES_COL.prioridad + 1, filas, APUNTES.PRIORIDADES);
  aplicarListaApuntes_(sh, APUNTES_COL.estado + 1, filas, APUNTES.ESTADOS);

  sh.getRange(2, APUNTES_COL.pregunta + 1, filas, 2).setWrap(true).setVerticalAlignment('top');
  sh.getRange(2, APUNTES_COL.fecha + 1, filas, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sh.getRange(2, APUNTES_COL.fechaCompromiso + 1, filas, 1).setNumberFormat('dd/MM/yyyy');
  sh.getRange(2, APUNTES_COL.actualizado + 1, filas, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sh.getRange(2, APUNTES_COL.m3 + 1, filas, 1).setNumberFormat('#,##0');
  sh.getRange(2, APUNTES_COL.cumplimiento + 1, filas, 1).setNumberFormat('0.0%');

  aplicarColoresEstado_(sh, filas);

  return sh;
}

function aplicarListaApuntes_(sh, columna, filas, valores) {
  const regla = SpreadsheetApp.newDataValidation()
    .requireValueInList(valores, true)
    .setAllowInvalid(true)
    .build();

  sh.getRange(2, columna, filas, 1).setDataValidation(regla);
}

function aplicarColoresEstado_(sh, filas) {
  const rango = sh.getRange(2, APUNTES_COL.estado + 1, filas, 1);

  const reglas = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Abierto')
      .setBackground('#F7E2E1').setFontColor('#B3261E').setBold(true)
      .setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('En curso')
      .setBackground('#FAF0DC').setFontColor('#8A6114').setBold(true)
      .setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Cerrado')
      .setBackground('#E6EFEA').setFontColor('#1E4D38').setBold(true)
      .setRanges([rango]).build()
  ];

  sh.setConditionalFormatRules(sh.getConditionalFormatRules().concat(reglas));
}

/*******************************************************
 API PARA EL DASHBOARD
*******************************************************/

// Se lee siempre en vivo: un apunte recién guardado tiene que aparecer al
// instante, así que esta ruta no pasa por CacheService.
function getApuntes() {
  const sh = getApuntesSheet_(false);

  if (!sh) {
    return { existe: false, hoja: APUNTES.SHEET_NAME, items: [], resumen: resumenVacioApuntes_() };
  }

  const ultima = sh.getLastRow();

  if (ultima < 2) {
    return { existe: true, hoja: APUNTES.SHEET_NAME, items: [], resumen: resumenVacioApuntes_() };
  }

  const values = sh.getRange(2, 1, ultima - 1, APUNTES.HEADERS.length).getValues();
  const items = [];

  values.forEach((row, i) => {
    if (rowEmpty_(row)) return;

    const pregunta = rawText_(row[APUNTES_COL.pregunta]);
    const proveedor = rawText_(row[APUNTES_COL.proveedor]);

    if (!pregunta && !proveedor) return;

    items.push({
      fila: i + 2,
      id: rawText_(row[APUNTES_COL.id]),
      fecha: fechaApunteISO_(row[APUNTES_COL.fecha]),
      fechaTexto: fechaApunteTexto_(row[APUNTES_COL.fecha]),
      mes: rawText_(row[APUNTES_COL.mes]),
      proveedor: proveedor,
      proveedorKey: providerCanonical_(proveedor) || text_(proveedor),
      faena: rawText_(row[APUNTES_COL.faena]),
      tipo: rawText_(row[APUNTES_COL.tipo]) || 'Nota',
      prioridad: rawText_(row[APUNTES_COL.prioridad]) || 'Media',
      pregunta: pregunta,
      respuesta: rawText_(row[APUNTES_COL.respuesta]),
      responsable: rawText_(row[APUNTES_COL.responsable]),
      fechaCompromiso: fechaApunteTexto_(row[APUNTES_COL.fechaCompromiso], 'dd/MM/yyyy'),
      fechaCompromisoISO: fechaApunteISO_(row[APUNTES_COL.fechaCompromiso]),
      m3: num_(row[APUNTES_COL.m3]),
      estado: rawText_(row[APUNTES_COL.estado]) || 'Abierto',
      cumplimientoSnapshot: Number(row[APUNTES_COL.cumplimiento]) || 0,
      tendenciaSnapshot: rawText_(row[APUNTES_COL.tendencia]),
      origen: rawText_(row[APUNTES_COL.origen]) || 'Manual',
      vencido: apunteVencido_(row)
    });
  });

  items.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

  return {
    existe: true,
    hoja: APUNTES.SHEET_NAME,
    urlHoja: getSpreadsheet_().getUrl() + '#gid=' + sh.getSheetId(),
    items: items,
    resumen: construirResumenApuntes_(items)
  };
}

function guardarApunte(payload) {
  payload = payload || {};

  const pregunta = rawText_(payload.pregunta);

  if (!pregunta) {
    throw new Error('El apunte necesita una pregunta u observación.');
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(20000);
  } catch (err) {
    throw new Error('Otra persona está guardando un apunte en este momento. Reintenta en unos segundos.');
  }

  try {
    const sh = getApuntesSheet_(true);
    const ahora = new Date();
    const idExistente = rawText_(payload.id);
    const fila = idExistente ? buscarFilaApunte_(sh, idExistente) : -1;

    const registro = new Array(APUNTES.HEADERS.length).fill('');

    registro[APUNTES_COL.id] = idExistente || nuevoIdApunte_();
    registro[APUNTES_COL.fecha] = ahora;
    registro[APUNTES_COL.mes] = rawText_(payload.mes);
    registro[APUNTES_COL.proveedor] = rawText_(payload.proveedor);
    registro[APUNTES_COL.faena] = rawText_(payload.faena);
    registro[APUNTES_COL.tipo] = valorEnLista_(payload.tipo, APUNTES.TIPOS, 'Pregunta');
    registro[APUNTES_COL.prioridad] = valorEnLista_(payload.prioridad, APUNTES.PRIORIDADES, 'Media');
    registro[APUNTES_COL.pregunta] = pregunta;
    registro[APUNTES_COL.respuesta] = rawText_(payload.respuesta);
    registro[APUNTES_COL.responsable] = rawText_(payload.responsable);
    registro[APUNTES_COL.fechaCompromiso] = parseFechaCompromiso_(payload.fechaCompromiso);
    registro[APUNTES_COL.m3] = num_(payload.m3);
    registro[APUNTES_COL.estado] = valorEnLista_(payload.estado, APUNTES.ESTADOS, 'Abierto');
    registro[APUNTES_COL.cumplimiento] = Number(payload.cumplimiento) || '';
    registro[APUNTES_COL.tendencia] = rawText_(payload.tendencia);
    registro[APUNTES_COL.origen] = rawText_(payload.origen) || 'Dashboard';
    registro[APUNTES_COL.actualizado] = ahora;

    if (fila > 0) {
      // Al editar se conserva la fecha original de registro.
      const fechaOriginal = sh.getRange(fila, APUNTES_COL.fecha + 1).getValue();
      if (fechaOriginal) registro[APUNTES_COL.fecha] = fechaOriginal;

      sh.getRange(fila, 1, 1, registro.length).setValues([registro]);
    } else {
      sh.appendRow(registro);
    }

    return getApuntes();
  } finally {
    lock.releaseLock();
  }
}

function cambiarEstadoApunte(id, estado, respuesta) {
  const sh = getApuntesSheet_(false);

  if (!sh) throw new Error('Todavía no existe la hoja "' + APUNTES.SHEET_NAME + '".');

  const fila = buscarFilaApunte_(sh, rawText_(id));

  if (fila < 0) throw new Error('No se encontró el apunte ' + id + '.');

  sh.getRange(fila, APUNTES_COL.estado + 1)
    .setValue(valorEnLista_(estado, APUNTES.ESTADOS, 'Abierto'));

  const textoRespuesta = rawText_(respuesta);
  if (textoRespuesta) {
    sh.getRange(fila, APUNTES_COL.respuesta + 1).setValue(textoRespuesta);
  }

  sh.getRange(fila, APUNTES_COL.actualizado + 1).setValue(new Date());

  return getApuntes();
}

function eliminarApunte(id) {
  const sh = getApuntesSheet_(false);

  if (!sh) throw new Error('Todavía no existe la hoja "' + APUNTES.SHEET_NAME + '".');

  const fila = buscarFilaApunte_(sh, rawText_(id));

  if (fila < 0) throw new Error('No se encontró el apunte ' + id + '.');

  sh.deleteRow(fila);

  return getApuntes();
}

/*******************************************************
 RESUMEN
*******************************************************/

function construirResumenApuntes_(items) {
  const porProveedor = {};
  const resumen = resumenVacioApuntes_();

  (items || []).forEach(item => {
    const abierto = item.estado !== 'Cerrado';
    const key = item.proveedorKey || 'SIN PROVEEDOR';

    resumen.total++;
    if (item.estado === 'Abierto') resumen.abiertos++;
    else if (item.estado === 'En curso') resumen.enCurso++;
    else resumen.cerrados++;

    if (abierto && item.vencido) resumen.vencidos++;
    if (abierto && item.prioridad === 'Alta') resumen.altaPrioridad++;
    if (abierto) resumen.m3Comprometidos += Number(item.m3) || 0;

    if (!porProveedor[key]) {
      porProveedor[key] = {
        proveedor: item.proveedor,
        total: 0,
        abiertos: 0,
        vencidos: 0,
        m3Comprometidos: 0,
        ultimo: '',
        ultimaPregunta: ''
      };
    }

    const p = porProveedor[key];
    p.total++;
    if (abierto) {
      p.abiertos++;
      p.m3Comprometidos += Number(item.m3) || 0;
      if (item.vencido) p.vencidos++;
    }

    if (!p.ultimo || String(item.fecha) > p.ultimo) {
      p.ultimo = item.fecha;
      p.ultimaPregunta = item.pregunta;
    }
  });

  resumen.porProveedor = porProveedor;

  return resumen;
}

function resumenVacioApuntes_() {
  return {
    total: 0,
    abiertos: 0,
    enCurso: 0,
    cerrados: 0,
    vencidos: 0,
    altaPrioridad: 0,
    m3Comprometidos: 0,
    porProveedor: {}
  };
}

/*******************************************************
 HELPERS
*******************************************************/

function buscarFilaApunte_(sh, id) {
  if (!id) return -1;

  const ultima = sh.getLastRow();
  if (ultima < 2) return -1;

  const ids = sh.getRange(2, APUNTES_COL.id + 1, ultima - 1, 1).getValues();

  for (let i = 0; i < ids.length; i++) {
    if (rawText_(ids[i][0]) === id) return i + 2;
  }

  return -1;
}

function nuevoIdApunte_() {
  const sello = Utilities.formatDate(new Date(), 'America/Santiago', 'yyMMdd-HHmmss');
  const sufijo = Math.floor(Math.random() * 900 + 100);
  return 'AP' + sello + '-' + sufijo;
}

function valorEnLista_(valor, lista, porDefecto) {
  const texto = rawText_(valor);
  const encontrado = lista.find(x => x.toLowerCase() === texto.toLowerCase());
  return encontrado || porDefecto;
}

function parseFechaCompromiso_(valor) {
  if (valor instanceof Date && !isNaN(valor)) return valor;

  const texto = rawText_(valor);
  if (!texto) return '';

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const dmy = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));

  return texto;
}

function fechaApunteISO_(valor) {
  if (valor instanceof Date && !isNaN(valor)) {
    return Utilities.formatDate(valor, 'America/Santiago', "yyyy-MM-dd'T'HH:mm:ss");
  }
  return rawText_(valor);
}

function fechaApunteTexto_(valor, formato) {
  if (valor instanceof Date && !isNaN(valor)) {
    return Utilities.formatDate(valor, 'America/Santiago', formato || 'dd/MM/yyyy HH:mm');
  }
  return rawText_(valor);
}

function apunteVencido_(row) {
  const estado = rawText_(row[APUNTES_COL.estado]) || 'Abierto';
  if (estado === 'Cerrado') return false;

  const compromiso = row[APUNTES_COL.fechaCompromiso];
  if (!(compromiso instanceof Date) || isNaN(compromiso)) return false;

  const hoy = new Date();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  return compromiso < hoySinHora;
}

/*******************************************************
 MENÚ
*******************************************************/

function abrirHojaApuntes() {
  const sh = getApuntesSheet_(true);
  const ss = getSpreadsheet_();

  ss.setActiveSheet(sh);

  SpreadsheetApp.getUi().alert(
    'Hoja "' + APUNTES.SHEET_NAME + '" lista.\n\n' +
    'Puedes escribir directamente en ella o usar la pestaña "Apuntes" del ' +
    'dashboard, que además propone las preguntas del mes según la tendencia ' +
    'de cada proveedor.'
  );
}

function menuNuevoApunte() {
  const ui = SpreadsheetApp.getUi();

  const proveedor = ui.prompt(
    'Nuevo apunte',
    'Proveedor (déjalo vacío si el apunte es general):',
    ui.ButtonSet.OK_CANCEL
  );

  if (proveedor.getSelectedButton() !== ui.Button.OK) return;

  const pregunta = ui.prompt(
    'Nuevo apunte',
    'Pregunta u observación:',
    ui.ButtonSet.OK_CANCEL
  );

  if (pregunta.getSelectedButton() !== ui.Button.OK) return;

  const texto = rawText_(pregunta.getResponseText());

  if (!texto) {
    ui.alert('No se guardó: el apunte necesita una pregunta u observación.');
    return;
  }

  guardarApunte({
    proveedor: proveedor.getResponseText(),
    pregunta: texto,
    tipo: 'Pregunta',
    prioridad: 'Media',
    estado: 'Abierto',
    origen: 'Menú planilla'
  });

  ui.alert('Apunte guardado en la hoja "' + APUNTES.SHEET_NAME + '".');
}
