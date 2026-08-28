/***********************************************************************
 ASIGNACIÓN DE VALOR UNITARIO A HOJA 1  (cruce por código)
 ---------------------------------------------------------------------
 Archivo independiente. NO modifica ni depende de Codigo.gs.

 Cruza cada fila de "Hoja 1" contra la hoja de valores usando la clave:

       RUT  +  Rol  +  Diametro  +  Largo

 y escribe en "Hoja 1" el "Valor Unitario USD" que corresponde, más un
 "Valor Total USD" = valor unitario × Cubicación (m³).

 PUNTOS QUE RESUELVE EL CÓDIGO
   1) El Largo viene con distinto formato en cada hoja:
        - Hoja de valores: "3.20", "4.00"  (punto, dos decimales)
        - Hoja 1:          "3,2",  "4"      (coma, sin ceros)
      Un reemplazo de separadores NO basta ("3,2" no es "3.20"). Por eso el
      Largo (y el Diámetro) se comparan como NÚMERO, no como texto.

   2) El Valor Unitario usa coma decimal chilena ("52,5"); se interpreta
      con coma = decimal y punto = miles.

   3) Si la hoja de valores tiene la MISMA clave con valores DISTINTOS,
      se aplica la política VAL_CONFLICTO (por defecto "ultimo" gana) y
      se informa la cantidad y ejemplos en el registro y en el resumen.

 CÓMO USAR
   - previsualizarValores()         informe rápido, NO escribe.
   - diagnosticarCoberturaValores() explica POR QUÉ faltan valores: separa
                                    los roles sin ninguna tarifa cargada de
                                    los que solo les falta un diámetro/largo.
   - asignarValoresHoja1()          escribe los valores en Hoja 1.

   El total se calcula sobre m³ (Cubicacion). Si el precio fuera por trozo,
   cambia VAL_CONFIG.BASE_TOTAL a 'cantidad'.

   El menú lo arma Codigo.gs: si este archivo está en el proyecto, agrega
   solo las opciones de valores.
***********************************************************************/


/*************************
 CONFIGURACIÓN
**************************/
const VAL_CONFIG = {
  // Si queda "", usa la planilla activa. Si la corres desde el editor del
  // dashboard, ya es la correcta. El ID es el mismo que usa Codigo.gs.
  SPREADSHEET_ID: '1q_6ojGWI0OPjopobAIMtIdlRaLOHAMNyUhSKJzlSvgg',

  MAIN_SHEET: 'Hoja 1',

  // Nombre de la hoja de valores. Si queda "", se detecta sola por sus
  // encabezados (la que tenga "Valor Unitario USD").
  VALUES_SHEET: '',

  // Columnas de salida en Hoja 1 (se crean al final si no existen).
  OUT_UNIT_HEADER:  'Valor Unitario USD',
  OUT_TOTAL_HEADER: 'Valor Total USD',
  ESCRIBIR_TOTAL: true,

  // Sobre qué se multiplica el valor unitario para obtener el total:
  //   'cubicacion' → USD por m³   (valor × Cubicacion)
  //   'cantidad'   → USD por trozo (valor × Cantidad)
  BASE_TOTAL: 'cubicacion',

  // Qué hacer si la hoja de valores repite la misma clave con distinto
  // valor: "ultimo" (gana la fila más abajo) o "primero".
  VAL_CONFLICTO: 'ultimo'
};


/*************************
 FUNCIÓN PRINCIPAL: ESCRIBE EN HOJA 1
**************************/
function asignarValoresHoja1() {
  const ss = valAbrirPlanilla_();
  const shMain = ss.getSheetByName(VAL_CONFIG.MAIN_SHEET);
  if (!shMain) throw new Error("No existe la hoja '" + VAL_CONFIG.MAIN_SHEET + "'.");

  const lookup = valConstruirLookup_(ss);
  const cols = valColumnasMain_(shMain);

  const ultimaFila = shMain.getLastRow();
  if (ultimaFila < 2) {
    valMostrar_('No hay filas de datos en ' + VAL_CONFIG.MAIN_SHEET + '.');
    return;
  }

  const nFilas = ultimaFila - 1;
  const datos = shMain.getRange(2, 1, nFilas, shMain.getLastColumn()).getDisplayValues();

  const salidaUnit = new Array(nFilas);
  const salidaTotal = new Array(nFilas);

  let coincidencias = 0;
  let sinValor = 0;
  let sinClave = 0;
  const ejemplosSinValor = [];

  for (let i = 0; i < nFilas; i++) {
    const fila = datos[i];

    const rut = cols.rut !== -1 ? fila[cols.rut - 1] : '';
    const rol = cols.rol !== -1 ? fila[cols.rol - 1] : '';
    const diam = cols.diametro !== -1 ? fila[cols.diametro - 1] : '';
    const largo = cols.largo !== -1 ? fila[cols.largo - 1] : '';

    const clave = valClave_(rut, rol, diam, largo);

    // Fila sin datos suficientes para armar la clave (ej. Rol "-").
    if (!clave) {
      salidaUnit[i] = [''];
      salidaTotal[i] = [''];
      sinClave++;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(lookup.map, clave)) {
      const valor = lookup.map[clave];
      salidaUnit[i] = [valor];

      if (VAL_CONFIG.ESCRIBIR_TOTAL) {
        const colBase = (VAL_CONFIG.BASE_TOTAL === 'cantidad') ? cols.cantidad : cols.cubicacion;
        const base = colBase !== -1 ? valNumero_(fila[colBase - 1]) : NaN;
        salidaTotal[i] = [isNaN(base) ? '' : Math.round(valor * base * 100) / 100];
      }
      coincidencias++;
    } else {
      salidaUnit[i] = [''];
      salidaTotal[i] = [''];
      sinValor++;
      if (ejemplosSinValor.length < 8) {
        ejemplosSinValor.push(valClaveLegible_(rut, rol, diam, largo));
      }
    }
  }

  // Escribir columnas de salida (creándolas al final si no existen).
  const colUnit = valObtenerOCrearColumna_(shMain, VAL_CONFIG.OUT_UNIT_HEADER);
  shMain.getRange(2, colUnit, nFilas, 1).setValues(salidaUnit);

  if (VAL_CONFIG.ESCRIBIR_TOTAL) {
    const colTotal = valObtenerOCrearColumna_(shMain, VAL_CONFIG.OUT_TOTAL_HEADER);
    shMain.getRange(2, colTotal, nFilas, 1).setValues(salidaTotal);
  }

  const resumen = valArmarResumen_(
    { coincidencias, sinValor, sinClave, nFilas, ejemplosSinValor },
    lookup, true
  );
  Logger.log(resumen);
  valMostrar_(resumen);
  return resumen;
}


/*************************
 PREVISUALIZACIÓN: NO ESCRIBE
**************************/
function previsualizarValores() {
  const ss = valAbrirPlanilla_();
  const shMain = ss.getSheetByName(VAL_CONFIG.MAIN_SHEET);
  if (!shMain) throw new Error("No existe la hoja '" + VAL_CONFIG.MAIN_SHEET + "'.");

  const lookup = valConstruirLookup_(ss);
  const cols = valColumnasMain_(shMain);

  const ultimaFila = shMain.getLastRow();
  const nFilas = Math.max(0, ultimaFila - 1);
  let coincidencias = 0, sinValor = 0, sinClave = 0;
  const ejemplosSinValor = [];

  if (nFilas > 0) {
    const datos = shMain.getRange(2, 1, nFilas, shMain.getLastColumn()).getDisplayValues();
    datos.forEach(function (fila) {
      const rut = cols.rut !== -1 ? fila[cols.rut - 1] : '';
      const rol = cols.rol !== -1 ? fila[cols.rol - 1] : '';
      const diam = cols.diametro !== -1 ? fila[cols.diametro - 1] : '';
      const largo = cols.largo !== -1 ? fila[cols.largo - 1] : '';
      const clave = valClave_(rut, rol, diam, largo);
      if (!clave) { sinClave++; return; }
      if (Object.prototype.hasOwnProperty.call(lookup.map, clave)) {
        coincidencias++;
      } else {
        sinValor++;
        if (ejemplosSinValor.length < 8) ejemplosSinValor.push(valClaveLegible_(rut, rol, diam, largo));
      }
    });
  }

  const resumen = valArmarResumen_(
    { coincidencias, sinValor, sinClave, nFilas, ejemplosSinValor },
    lookup, false
  );
  Logger.log(resumen);
  valMostrar_(resumen);
  return resumen;
}


/*************************
 DIAGNÓSTICO DE COBERTURA: POR QUÉ FALTAN VALORES
 No escribe nada. Agrupa las filas de Hoja 1 que quedarían sin precio y
 distingue dos causas muy distintas:
   A) Al proveedor+rol no le cargaron NINGUNA tarifa.
   B) La tarifa existe, pero falta ese diámetro/largo puntual.
**************************/
function diagnosticarCoberturaValores() {
  const ss = valAbrirPlanilla_();
  const shMain = ss.getSheetByName(VAL_CONFIG.MAIN_SHEET);
  if (!shMain) throw new Error("No existe la hoja '" + VAL_CONFIG.MAIN_SHEET + "'.");

  const lookup = valConstruirLookup_(ss);
  const cols = valColumnasMain_(shMain);

  const ultimaFila = shMain.getLastRow();
  const nFilas = Math.max(0, ultimaFila - 1);
  const grupos = {};
  let conValor = 0, sinClave = 0, sinValor = 0;
  let m3Sin = 0, m3Con = 0;

  if (nFilas > 0) {
    const datos = shMain.getRange(2, 1, nFilas, shMain.getLastColumn()).getDisplayValues();

    datos.forEach(function (fila) {
      const rut = cols.rut !== -1 ? fila[cols.rut - 1] : '';
      const rol = cols.rol !== -1 ? fila[cols.rol - 1] : '';
      const diam = cols.diametro !== -1 ? fila[cols.diametro - 1] : '';
      const largo = cols.largo !== -1 ? fila[cols.largo - 1] : '';
      const cub = cols.cubicacion !== -1 ? valNumero_(fila[cols.cubicacion - 1]) : NaN;
      const m3 = isNaN(cub) ? 0 : cub;

      const clave = valClave_(rut, rol, diam, largo);
      if (!clave) { sinClave++; return; }

      if (Object.prototype.hasOwnProperty.call(lookup.map, clave)) {
        conValor++; m3Con += m3; return;
      }

      sinValor++; m3Sin += m3;

      const gKey = valNormRut_(rut) + '|' + valNormRol_(rol) + '|' + valNumKey_(largo);
      if (!grupos[gKey]) {
        grupos[gKey] = {
          rut: String(rut).trim(),
          rol: String(rol).trim(),
          largo: valNumKey_(largo),
          filas: 0,
          m3: 0,
          diametros: {},
          tieneTarifaElRol: !!lookup.rutRolDisponibles[valNormRut_(rut) + '|' + valNormRol_(rol)]
        };
      }
      grupos[gKey].filas++;
      grupos[gKey].m3 += m3;
      grupos[gKey].diametros[valNumKey_(diam)] = true;
    });
  }

  const lista = Object.keys(grupos).map(function (k) { return grupos[k]; })
    .sort(function (a, b) { return b.m3 - a.m3; });

  let s = 'COBERTURA DE VALORES: ' + VAL_CONFIG.MAIN_SHEET + '\n';
  s += '===========================================\n';
  s += 'Hoja de valores: ' + lookup.hojaValores +
       '  (' + lookup.clavesUnicas + ' claves únicas)\n\n';
  s += 'Filas con valor : ' + conValor + '   (' + valRedondear_(m3Con) + ' m³)\n';
  s += 'Filas sin valor : ' + sinValor + '   (' + valRedondear_(m3Sin) + ' m³)\n';
  s += 'Filas sin clave : ' + sinClave + '   (Rol o RUT vacío / "-")\n';

  const totalClasificado = conValor + sinValor;
  if (totalClasificado > 0) {
    s += 'Cobertura       : ' + Math.round(conValor * 1000 / totalClasificado) / 10 + '%\n';
  }

  if (!lista.length) {
    s += '\nNo hay filas sin valor.\n';
    Logger.log(s);
    valMostrar_(s);
    return s;
  }

  const sinTarifa = lista.filter(function (g) { return !g.tieneTarifaElRol; });
  const parcial   = lista.filter(function (g) { return g.tieneTarifaElRol; });

  if (sinTarifa.length) {
    s += '\nA) SIN NINGUNA TARIFA CARGADA para ese RUT + Rol\n';
    s += '   (hay que agregarlos a la hoja de valores)\n';
    sinTarifa.forEach(function (g) {
      s += '   · RUT ' + g.rut + ' · Rol ' + g.rol + ' · Largo ' + g.largo +
           '  ->  ' + g.filas + ' filas, ' + valRedondear_(g.m3) + ' m³\n';
    });
  }

  if (parcial.length) {
    s += '\nB) EL ROL TIENE TARIFAS, pero falta esa combinación\n';
    parcial.forEach(function (g) {
      const ds = Object.keys(g.diametros).sort(function (a, b) { return a - b; });
      s += '   · RUT ' + g.rut + ' · Rol ' + g.rol + ' · Largo ' + g.largo +
           '  ->  ' + g.filas + ' filas, ' + valRedondear_(g.m3) + ' m³\n';
      s += '       diámetros sin precio: ' + ds.join(', ') + '\n';
    });
  }

  Logger.log(s);
  valMostrar_(s);
  return s;
}

function valRedondear_(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}


/*************************
 CONSTRUCCIÓN DEL DICCIONARIO DE VALORES
 Clave  →  valor unitario (número).
**************************/
function valConstruirLookup_(ss) {
  const sh = valHojaValores_(ss);
  if (!sh) {
    throw new Error(
      "No se encontró la hoja de valores. Indica su nombre en " +
      "VAL_CONFIG.VALUES_SHEET, o revisa que tenga la columna 'Valor Unitario USD'."
    );
  }

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const c = {
    rol:   valBuscarColumna_(headers, ['rol predio', 'rol', 'predio']),
    diametro: valBuscarColumna_(headers, ['diametro']),
    largo: valBuscarColumna_(headers, ['largo']),
    valor: valBuscarColumna_(headers, ['valor unitario usd', 'valor unitario', 'valor']),
    rut:   valBuscarColumna_(headers, ['rut', 'rut proveedor', 'n identificacion fiscal'])
  };

  const faltan = [];
  ['rol', 'diametro', 'largo', 'valor', 'rut'].forEach(function (k) {
    if (c[k] === -1) faltan.push(k);
  });
  if (faltan.length) {
    throw new Error(
      "En la hoja de valores '" + sh.getName() + "' faltan columnas: " + faltan.join(', ') +
      ". Encabezados encontrados: " + headers.join(' | ')
    );
  }

  // Una sola pasada construye los DOS diccionarios que se necesitan:
  //   map    → clave RUT+Rol+Diámetro+Largo  (para escribir en Hoja 1)
  //   mapRol → clave     Rol+Diámetro+Largo  (para el dashboard, cuyo
  //            detalle no trae RUT)
  // Antes eran dos funciones separadas que leían la hoja dos veces y podían
  // quedar con reglas distintas.
  const map = {};
  const mapRol = {};
  const conflictos = [];
  const clavesEnConflicto = {};
  const rutRolDisponibles = {};
  const rutsPorRol = {};
  const muestraRol = [];
  let filasValidas = 0, filasIgnoradas = 0;

  const ultima = sh.getLastRow();
  if (ultima > 1) {
    const datos = sh.getRange(2, 1, ultima - 1, sh.getLastColumn()).getDisplayValues();

    datos.forEach(function (fila) {
      const rut = fila[c.rut - 1];
      const rol = fila[c.rol - 1];
      const diam = fila[c.diametro - 1];
      const largo = fila[c.largo - 1];
      const valor = valNumero_(fila[c.valor - 1]);

      const clave = valClave_(rut, rol, diam, largo);
      if (!clave || isNaN(valor)) { filasIgnoradas++; return; }
      filasValidas++;

      // Registro de qué (RUT + Rol) tienen alguna tarifa cargada. Sirve para
      // distinguir "a este predio no le cargaron precios" de "falta este
      // diámetro/largo puntual".
      const rutN = valNormRut_(rut);
      const rolN = valNormRol_(rol);
      rutRolDisponibles[rutN + '|' + rolN] = true;

      // ¿Un mismo Rol pertenece a más de un RUT? El dashboard cruza sin RUT,
      // así que en ese caso su precio sería ambiguo. Se detecta para avisar.
      if (!rutsPorRol[rolN]) rutsPorRol[rolN] = {};
      rutsPorRol[rolN][rutN] = true;

      if (Object.prototype.hasOwnProperty.call(map, clave)) {
        const previo = map[clave];
        if (Math.abs(previo - valor) > 1e-9) {
          clavesEnConflicto[clave] = true;
          if (conflictos.length < 10) {
            conflictos.push({
              clave: valClaveLegible_(rut, rol, diam, largo),
              previo: previo,
              nuevo: valor
            });
          }
          if (VAL_CONFIG.VAL_CONFLICTO === 'ultimo') map[clave] = valor;
          // si es 'primero', se conserva el previo
        }
      } else {
        map[clave] = valor;
      }

      // Diccionario sin RUT, con la misma política de conflicto.
      const claveRol = valClaveRol_(rol, diam, largo);
      if (claveRol) {
        const nuevoRol = !Object.prototype.hasOwnProperty.call(mapRol, claveRol);
        if (nuevoRol || VAL_CONFIG.VAL_CONFLICTO === 'ultimo') mapRol[claveRol] = valor;
        if (nuevoRol && muestraRol.length < 6) {
          muestraRol.push(valClaveRolLegible_(rol, diam, largo));
        }
      }
    });
  }

  // Roles compartidos por más de un RUT (ambigüedad para el cruce sin RUT).
  const rolesAmbiguos = Object.keys(rutsPorRol)
    .filter(function (r) { return Object.keys(rutsPorRol[r]).length > 1; })
    .map(function (r) { return { rol: r, ruts: Object.keys(rutsPorRol[r]) }; });

  return {
    map: map,
    mapRol: mapRol,
    muestraRol: muestraRol,
    hojaValores: sh.getName(),
    filasValidas: filasValidas,
    filasIgnoradas: filasIgnoradas,
    clavesUnicas: Object.keys(map).length,
    clavesUnicasRol: Object.keys(mapRol).length,
    conflictos: conflictos,
    totalClavesEnConflicto: Object.keys(clavesEnConflicto).length,
    rutRolDisponibles: rutRolDisponibles,
    rolesAmbiguos: rolesAmbiguos
  };
}


/*************************
 CLAVE DE CRUCE
 RUT + Rol + Diámetro(num) + Largo(num). Devuelve '' si falta algo.
**************************/
function valClave_(rut, rol, diam, largo) {
  const r = valNormRut_(rut);
  const ro = valNormRol_(rol);
  const d = valNumKey_(diam);
  const l = valNumKey_(largo);
  // Un Rol/RUT sin caracteres alfanuméricos (ej. "-") se trata como vacío.
  if (!r || !ro || !/[0-9A-Z]/.test(ro) || d === '' || l === '') return '';
  return r + '|' + ro + '|' + d + '|' + l;
}

function valClaveLegible_(rut, rol, diam, largo) {
  return valNormRut_(rut) + ' · ' + valNormRol_(rol) + ' · D' + valNumKey_(diam) + ' · L' + valNumKey_(largo);
}


/*************************
 NORMALIZACIÓN
**************************/
// Número canónico para la clave: acepta coma o punto como decimal.
// "3,2"→"3.2"  "3.20"→"3.2"  "4"→"4"  "24"→"24"
function valNumKey_(x) {
  const n = valNumero_(x);
  if (isNaN(n)) return '';
  return String(Math.round(n * 1000) / 1000);
}

// Parser numérico único para TODOS los campos (largo, diámetro, cubicación,
// cantidad y valor). Reglas, pensadas para lo que devuelve getDisplayValues()
// en una planilla con locale chileno mezclada con texto en formato US:
//
//   - Si hay coma  → la coma es el decimal y los puntos son miles.
//       "52,5" → 52.5      "1.234,56" → 1234.56
//   - Si solo hay UN punto → es decimal (así viene el Largo de la hoja de
//     valores, que está guardado como TEXTO: "3.20", "4.00").
//       "3.20" → 3.2       "4.00" → 4
//   - Si hay VARIOS puntos → son separadores de miles.
//       "1.234.567" → 1234567
//
// Nota: un único punto se interpreta siempre como decimal. Es lo correcto
// para esta planilla (largo y diámetro nunca llegan a los miles, y las
// cifras con miles reales llegan con coma decimal).
function valNumero_(x) {
  if (typeof x === 'number') return isFinite(x) ? x : NaN;

  let s = String(x === null || x === undefined ? '' : x).trim();
  if (!s) return NaN;

  const negativo = /^-/.test(s);
  s = s.replace(/\s+/g, '').replace(/[^0-9.,]/g, '');
  if (!s) return NaN;

  if (s.indexOf(',') !== -1) {
    s = s.replace(/\./g, '');                 // puntos = miles
    const partes = s.split(',');
    s = partes.shift() + '.' + partes.join('');  // primera coma = decimal
  } else {
    const puntos = s.split('.').length - 1;
    if (puntos > 1) s = s.replace(/\./g, '');    // varios puntos = miles
    // un solo punto: se deja como decimal
  }

  const n = parseFloat(s);
  if (!isFinite(n)) return NaN;
  return negativo ? -n : n;
}

function valNormRut_(rut) {
  return String(rut || '').toUpperCase().replace(/[.\-\s]/g, '').replace(/[^0-9K]/g, '');
}

function valNormRol_(rol) {
  return String(rol || '')
    .trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}


/*************************
 DETECCIÓN DE HOJAS / COLUMNAS
**************************/
function valHojaValores_(ss) {
  if (VAL_CONFIG.VALUES_SHEET) {
    return ss.getSheetByName(VAL_CONFIG.VALUES_SHEET);
  }

  // Auto-detección: la hoja que tenga "valor unitario" + "rut" + "largo".
  const hojas = ss.getSheets();
  for (let i = 0; i < hojas.length; i++) {
    const sh = hojas[i];
    if (sh.getName() === VAL_CONFIG.MAIN_SHEET) continue;
    if (sh.getLastColumn() < 3 || sh.getLastRow() < 2) continue;

    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    const tieneValor = valBuscarColumna_(headers, ['valor unitario usd', 'valor unitario']) !== -1;
    const tieneRut   = valBuscarColumna_(headers, ['rut', 'rut proveedor']) !== -1;
    const tieneLargo = valBuscarColumna_(headers, ['largo']) !== -1;
    if (tieneValor && tieneRut && tieneLargo) return sh;
  }
  return null;
}

function valColumnasMain_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  return {
    rol:   valBuscarColumna_(headers, ['rol']),
    diametro: valBuscarColumna_(headers, ['diametro']),
    largo: valBuscarColumna_(headers, ['largo']),
    rut:   valBuscarColumna_(headers, ['rut proveedor', 'rut']),
    cubicacion: valBuscarColumna_(headers, ['cubicacion']),
    cantidad: valBuscarColumna_(headers, ['cantidad'])
  };
}

function valBuscarColumna_(headers, aliases) {
  const norm = headers.map(valNormTexto_);
  for (let i = 0; i < aliases.length; i++) {
    const objetivo = valNormTexto_(aliases[i]);
    const idx = norm.indexOf(objetivo);
    if (idx !== -1) return idx + 1;
  }
  return -1;
}

function valNormTexto_(t) {
  return String(t || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[°º]/g, '')
    .replace(/[.\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().toLowerCase();
}

function valObtenerOCrearColumna_(sh, nombre) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const idx = valBuscarColumna_(headers, [nombre]);
  if (idx !== -1) return idx;
  const col = sh.getLastColumn() + 1;
  sh.getRange(1, col).setValue(nombre);
  return col;
}


/*************************
 UTILIDADES DE PLANILLA / SALIDA
**************************/
// IMPORTANTE: Codigo.gs abre la planilla SIEMPRE por ID
// (getSpreadsheet_ → SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)).
// Aquí se usa el mismo criterio a propósito: si este archivo abriera la
// planilla activa y el script estuviera vinculado a otra, el dashboard
// leería una planilla y los precios otra, dando cero coincidencias sin
// ningún error visible. La planilla activa queda solo como último recurso.
function valAbrirPlanilla_() {
  if (typeof getSpreadsheet_ === 'function') {
    try { return getSpreadsheet_(); } catch (e) { /* sigue con las otras vías */ }
  }

  if (VAL_CONFIG.SPREADSHEET_ID) {
    try { return SpreadsheetApp.openById(VAL_CONFIG.SPREADSHEET_ID); } catch (e) { /* idem */ }
  }

  const activa = SpreadsheetApp.getActiveSpreadsheet();
  if (activa) return activa;

  throw new Error('No se pudo abrir la planilla: revisa VAL_CONFIG.SPREADSHEET_ID.');
}

function valMostrar_(texto) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      texto.split('\n').slice(0, 3).join('  '), 'Valores', 8
    );
  } catch (e) { /* sin UI (ejecución por trigger o web app): solo queda en el log */ }
}

function valArmarResumen_(stats, lookup, escribio) {
  let s = escribio ? 'VALORES ASIGNADOS A ' + VAL_CONFIG.MAIN_SHEET + '\n' : 'PREVISUALIZACIÓN (no se escribió nada)\n';
  s += '===========================================\n';
  s += 'Hoja de valores: ' + lookup.hojaValores + '\n';
  s += 'Claves únicas en valores: ' + lookup.clavesUnicas +
       '  (filas válidas ' + lookup.filasValidas + ', ignoradas ' + lookup.filasIgnoradas + ')\n\n';

  s += 'Filas de ' + VAL_CONFIG.MAIN_SHEET + ': ' + stats.nFilas + '\n';
  s += '  Con valor asignado : ' + stats.coincidencias + '\n';
  s += '  Sin valor en tabla : ' + stats.sinValor + '\n';
  s += '  Sin clave (Rol/RUT vacío o "-") : ' + stats.sinClave + '\n';

  if (stats.ejemplosSinValor && stats.ejemplosSinValor.length) {
    s += '\nEjemplos sin coincidencia:\n';
    stats.ejemplosSinValor.forEach(function (e) { s += '   · ' + e + '\n'; });
  }

  if (lookup.conflictos && lookup.conflictos.length) {
    s += '\nAviso: ' + lookup.totalClavesEnConflicto + ' clave(s) repetidas con valor ' +
         'distinto en la hoja de valores (política: gana el ' +
         VAL_CONFIG.VAL_CONFLICTO + '). Primeras:\n';
    lookup.conflictos.forEach(function (cf) {
      s += '   · ' + cf.clave + '  ->  ' + cf.previo + '  vs  ' + cf.nuevo + '\n';
    });
    s += '   Revisa esas filas en la hoja de valores si el precio no es el esperado.\n';
  }

  return s;
}


/***********************************************************************
 API PARA EL DASHBOARD :  getValoresRecepcion(force)
 ---------------------------------------------------------------------
 El Index.html del dashboard ya trae el bloque de valores y llama a esta
 función. Vive aquí (no en Codigo.gs) porque Apps Script comparte funciones
 entre archivos del mismo proyecto: no hay que tocar Codigo.gs ni Index.html.

 CONTRATO que espera el frontend:
   { unidad: 'm3' | 'trozo',
     precios: [ <precio unitario por cada fila de getDetalleIngresos, alineado> ],
     diagnostics: { ... } }

 Alineación: el frontend hace precios[i] → detalleIngresos[i]. Para que
 calce SIEMPRE, esta función pide las MISMAS filas con getDetalleIngresos()
 y las recorre en el mismo orden. Así la alineación queda garantizada por
 construcción, sin depender de que ambos lean la hoja igual por separado.

 Clave de cruce: Rol + Diámetro + Largo. El detalle del dashboard no trae
 RUT, pero el Rol ya identifica al predio (y por tanto al proveedor). El
 Largo es parte de la clave porque el precio cambia con él: en la hoja de
 valores, un mismo Rol+Diámetro tiene precios distintos según el largo
 (p.ej. 251-19 D30 vale 70 a L4.00 y 54,68 a L3.20).
***********************************************************************/
function getValoresRecepcion(force) {
  const ss = valAbrirPlanilla_();
  const unidad = (VAL_CONFIG.BASE_TOTAL === 'cantidad') ? 'trozo' : 'm3';

  const lk = valLookupPorRol_(ss);

  const diag = {
    ok: false,
    hoja: lk.hoja,
    preciosCargados: lk.clavesUnicas,
    mensaje: '',
    claveUsa: { calidad: false, diametro: true, rangoDiametro: false, largo: true },
    matchPorClave: 0,
    matchPorColumnas: 0,
    columnaClave: 'Rol Predio + Diametro + Largo',
    muestraValores: lk.muestra,
    muestraDetalle: []
  };

  if (!lk.clavesUnicas) {
    diag.mensaje = lk.error
      ? lk.error
      : 'La hoja "' + lk.hoja + '" no tiene precios legibles.';
    return { unidad: unidad, precios: [], diagnostics: diag };
  }

  // El cruce del dashboard no usa RUT. Si un mismo Rol aparece con más de un
  // RUT, su precio es ambiguo y hay que avisarlo.
  const ambiguos = lk.rolesAmbiguos || [];
  if (ambiguos.length) {
    diag.rolesAmbiguos = ambiguos.slice(0, 5).map(function (a) {
      return a.rol + ' (' + a.ruts.join(', ') + ')';
    });
    diag.avisoAmbiguedad = ambiguos.length + ' rol(es) con más de un RUT en la hoja de ' +
      'valores: su precio puede ser ambiguo porque el dashboard cruza sin RUT.';
  }

  // Mismas filas que ve el frontend → alineación garantizada.
  if (typeof getDetalleIngresos !== 'function') {
    diag.mensaje = 'No se encontró getDetalleIngresos (Codigo.gs) en el proyecto.';
    return { unidad: unidad, precios: [], diagnostics: diag };
  }

  const detalle = getDetalleIngresos(force === true) || [];
  const precios = new Array(detalle.length);
  const muestraDetalle = [];
  let match = 0;

  for (let i = 0; i < detalle.length; i++) {
    const row = detalle[i];
    const clave = valClaveRol_(row.rol, row.diametroPromedio, row.largo);

    if (clave && muestraDetalle.length < 6) {
      muestraDetalle.push(valClaveRolLegible_(row.rol, row.diametroPromedio, row.largo));
    }

    if (clave && Object.prototype.hasOwnProperty.call(lk.map, clave)) {
      precios[i] = lk.map[clave];
      match++;
    } else {
      precios[i] = 0;
    }
  }

  diag.ok = match > 0;
  diag.matchPorClave = match;
  diag.muestraDetalle = muestraDetalle;
  if (!match) diag.mensaje = 'Ninguna recepción calzó con la hoja "' + lk.hoja + '".';

  return { unidad: unidad, precios: precios, diagnostics: diag };
}

// Diccionario Rol+Diámetro+Largo → valor unitario, para el dashboard.
// Delega en valConstruirLookup_, que arma ambos diccionarios en una sola
// lectura de la hoja: así no puede haber dos reglas de cruce distintas.
function valLookupPorRol_(ss) {
  let lk;
  try {
    lk = valConstruirLookup_(ss);
  } catch (err) {
    return { hoja: '(no encontrada)', map: {}, clavesUnicas: 0, muestra: [], rolesAmbiguos: [], error: String(err.message || err) };
  }

  return {
    hoja: lk.hojaValores,
    map: lk.mapRol,
    clavesUnicas: lk.clavesUnicasRol,
    muestra: lk.muestraRol,
    rolesAmbiguos: lk.rolesAmbiguos
  };
}

function valClaveRol_(rol, diam, largo) {
  const ro = valNormRol_(rol);
  const d = valNumKey_(diam);
  const l = valNumKey_(largo);
  if (!ro || !/[0-9A-Z]/.test(ro) || d === '' || l === '') return '';
  return ro + '|' + d + '|' + l;
}

function valClaveRolLegible_(rol, diam, largo) {
  return valNormRol_(rol) + '·D' + valNumKey_(diam) + '·L' + valNumKey_(largo);
}
