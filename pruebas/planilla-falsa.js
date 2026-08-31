/* Planilla simulada: replica la forma real de las hojas para poder ejecutar
   buildDashboardCore_ completo (plan, proyección, tendencias, apuntes). */

// Cuatro largos distintos para poder probar la distribución y la apertura.
const LARGOS = [2.44, 3.2, 4, 5.5];

function hojaDatos() {
  const filas = [[
    'Fecha','Hora','Guia','Proveedor','Predio','Comuna','Rol','Cal Trz','Calidad',
    'Diametro','Largo','Cantidad','Cubicacion'
  ]];

  const habiles = [3,4,5,6,7,10,11,12,13,14,17,18,19,20,21];
  const perfiles = {
    'CAYUMANQUI SA':  d => 420 - d * 22,                       // a la baja
    'FORESTAL FHO':   d => 300,                                // estable
    'D. RODRIGUEZ':   d => (d <= 9 ? 250 : 0),                 // cortado
    'ANGOL LMTD':     d => 240 + d * 12,                       // al alza
    'MASISA SA':      d => 180
  };

  const predios = {
    'CAYUMANQUI SA': 'FUNDO EL ROBLE', 'FORESTAL FHO': 'LOMAS DE PENCO',
    'D. RODRIGUEZ': 'SANTA ELENA', 'ANGOL LMTD': 'RINCONADA', 'MASISA SA': 'NAHUELTORO'
  };
  const comunas = {
    'CAYUMANQUI SA': 'CABRERO', 'FORESTAL FHO': 'PENCO', 'D. RODRIGUEZ': 'CHILLAN',
    'ANGOL LMTD': 'LUMACO', 'MASISA SA': 'PARRAL'
  };

  habiles.forEach((dia, i) => {
    Object.keys(perfiles).forEach((prov, j) => {
      const m3 = Math.max(0, perfiles[prov](i + 1));
      if (!m3) return;
      // Dos calidades por día para probar el desglose
      [['2','VERDE', 0.7], ['3','MANCHADO', 0.3]].forEach(([cal, nom, share]) => {
        const cub = m3 * share;
        filas.push([
          new Date(2026, 7, dia), '08:30', 'G' + dia + j, prov, predios[prov], comunas[prov],
          '251-' + (10 + j * 3 + (i % 3)), cal, nom, 24 + j,
          LARGOS[(i + j) % LARGOS.length], Math.round(cub / 0.28), cub
        ]);
      });
    });
  });

  return filas;
}

const HOJAS = {
  'Hoja 1': hojaDatos(),

  'Hoja 2': [
    ['Proveedores', 'Origen', new Date(2026, 7, 1), new Date(2026, 8, 1)],
    ['CAYUMANQUI SA', '', 6300, 6000],
    ['FORESTAL FHO', '', 6300, 6000],
    ['D. RODRIGUEZ', '', 4200, 4000],
    ['ANGOL LMTD', '', 4200, 4000],
    ['MASISA SA', 'NAHUELTORO', 2100, 2000],
    ['MASISA SA', 'LLOHUE', 1000, 1000],
    ['SERGESAL', '', 2000, 2000],
    ['TOTAL', '', 26100, 25000]
  ],

  'ProyeccionCamiones': [
    ['Proveedor', 'Origen', new Date(2026,7,24), new Date(2026,7,25), new Date(2026,7,26)],
    ['CAYUMANQUI SA', 'FUNDO EL ROBLE', 4, 5, 4],
    ['ANGOL LMTD', 'RINCONADA', 6, 6, 7]
  ],

  'Apuntes': null
};

function crearRango(hoja, fila, col, nFilas, nCols) {
  return {
    getValues() {
      const out = [];
      for (let r = 0; r < nFilas; r++) {
        const src = hoja.datos[fila - 1 + r] || [];
        out.push(Array.from({ length: nCols }, (_, c) => src[col - 1 + c] === undefined ? '' : src[col - 1 + c]));
      }
      return out;
    },
    getDisplayValues() {
      return this.getValues().map(r => r.map(v =>
        v instanceof Date ? `${String(v.getDate()).padStart(2,'0')}/${String(v.getMonth()+1).padStart(2,'0')}/${v.getFullYear()}`
        : String(v == null ? '' : v)));
    },
    getValue() { return this.getValues()[0][0]; },
    setValues(v) {
      v.forEach((row, r) => {
        const idx = fila - 1 + r;
        if (!hoja.datos[idx]) hoja.datos[idx] = [];
        row.forEach((cell, c) => { hoja.datos[idx][col - 1 + c] = cell; });
      });
      return this;
    },
    setValue(v) { return this.setValues([[v]]); },
    setFontWeight(){return this;}, setFontColor(){return this;}, setBackground(){return this;},
    setVerticalAlignment(){return this;}, setWrap(){return this;}, setNumberFormat(){return this;},
    setDataValidation(){return this;}
  };
}

function crearHoja(nombre, datos) {
  const hoja = {
    nombre, datos,
    getName: () => nombre,
    getSheetId: () => 1234,
    getLastRow: () => hoja.datos.length,
    getLastColumn: () => Math.max(...hoja.datos.map(r => r.length), 0),
    getMaxRows: () => Math.max(hoja.datos.length, 500),
    getDataRange: () => { lecturasHoja[nombre] = (lecturasHoja[nombre] || 0) + 1;
                          return crearRango(hoja, 1, 1, hoja.datos.length, hoja.getLastColumn()); },
    getRange: (f, c, nf, nc) => crearRango(hoja, f, c, nf === undefined ? 1 : nf, nc === undefined ? 1 : nc),
    appendRow(row) { hoja.datos.push(row.slice()); return hoja; },
    deleteRow(i) { hoja.datos.splice(i - 1, 1); return hoja; },
    setFrozenRows(){return hoja;}, setRowHeight(){return hoja;}, setColumnWidth(){return hoja;},
    getConditionalFormatRules: () => [], setConditionalFormatRules(){return hoja;},
    isSheetHidden: () => false, hideSheet(){return hoja;}, clear(){return hoja;},
    getCharts: () => [], removeChart(){return hoja;}, insertChart(){return hoja;}
  };
  return hoja;
}

// Contador de lecturas completas por hoja: sirve para comprobar que el GIS
// ya no relee "Hoja 1" por su cuenta.
const lecturasHoja = {};
global.__lecturasHoja = () => Object.assign({}, lecturasHoja);
global.__resetLecturasHoja = () => { Object.keys(lecturasHoja).forEach(k => delete lecturasHoja[k]); };

const hojas = {};
Object.keys(HOJAS).forEach(n => { if (HOJAS[n]) hojas[n] = crearHoja(n, HOJAS[n]); });

const planilla = {
  getSheetByName: n => hojas[n] || null,
  getSheets: () => Object.values(hojas),
  insertSheet(n) { hojas[n] = crearHoja(n, [[]]); return hojas[n]; },
  getUrl: () => 'https://docs.google.com/spreadsheets/d/FAKE',
  setActiveSheet(){}, toast(){}
};

global.SpreadsheetApp = {
  openById: () => planilla,
  getActiveSpreadsheet: () => planilla,
  newDataValidation: () => ({ requireValueInList(){return this;}, setAllowInvalid(){return this;}, build(){return {};} }),
  newConditionalFormatRule: () => ({
    whenTextEqualTo(){return this;}, setBackground(){return this;}, setFontColor(){return this;},
    setBold(){return this;}, setRanges(){return this;}, build(){return {};}
  }),
  getUi: () => ({ alert(){}, prompt: () => ({ getSelectedButton: () => null, getResponseText: () => '' }),
                  createMenu: () => ({ addItem(){return this;}, addSeparator(){return this;}, addToUi(){} }),
                  ButtonSet: {}, Button: {} })
};

const memoria = {};
global.CacheService = {
  getScriptCache: () => ({
    get: k => (k in memoria ? memoria[k] : null),
    put: (k, v) => { memoria[k] = v; },
    remove: k => { delete memoria[k]; },
    removeAll: ks => ks.forEach(k => delete memoria[k])
  })
};

global.LockService = { getScriptLock: () => ({ waitLock(){}, releaseLock(){} }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty(){} }) };
global.__hojas = hojas;

/*************************
 DRIVE + XML: carpeta GIS simulada
**************************/

function kmlPoligono(lat, lng) {
  const p = (dlat, dlng) => `${(lng + dlng).toFixed(5)},${(lat + dlat).toFixed(5)},0`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><Polygon>
<outerBoundaryIs><LinearRing><coordinates>
${p(0,0)} ${p(0.01,0)} ${p(0.01,0.01)} ${p(0,0.01)} ${p(0,0)}
</coordinates></LinearRing></outerBoundaryIs>
</Polygon></Placemark></Document></kml>`;
}

// La hoja tiene 15 roles (251-10 a 251-24). Se dejan 12 con archivo, 3 sin
// archivo, y uno huérfano que no aparece en la hoja. Con 12 predios y tandas
// de 8, el cliente tiene que pedir la geometría en dos vueltas.
const ARCHIVOS_GIS = [];
for (let n = 10; n < 22; n++) {
  ARCHIVOS_GIS.push({
    nombre: '251-' + n + (n % 4 === 0 ? '.kmz' : '.kml'),
    lat: -36.4 - (n - 10) * 0.15,
    lng: -72.2 - (n - 10) * 0.08
  });
}
ARCHIVOS_GIS.push({ nombre: '999-99.kml', lat: -36.0, lng: -72.0 });

const archivosPorId = {};
let lecturasDrive = 0;

ARCHIVOS_GIS.forEach((a, i) => {
  const id = 'file-' + i;
  archivosPorId[id] = {
    getId: () => id,
    getName: () => a.nombre,
    getLastUpdated: () => new Date(2026, 0, 1),
    getBlob: () => ({
      getName: () => a.nombre,
      getDataAsString: () => { lecturasDrive++; return kmlPoligono(a.lat, a.lng); },
      setContentType() {}
    })
  };
});

global.DriveApp = {
  getFolderById: () => ({
    getFiles: () => {
      const ids = Object.keys(archivosPorId);
      let i = 0;
      return { hasNext: () => i < ids.length, next: () => archivosPorId[ids[i++]] };
    }
  }),
  getFileById: id => {
    if (!archivosPorId[id]) throw new Error('Archivo inexistente: ' + id);
    return archivosPorId[id];
  }
};

/* XmlService mínimo: alcanza para el KML simple de arriba. */
function parsearXml(texto) {
  const limpio = String(texto).replace(/<\?xml[^>]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const pila = [{ nombre: '#raiz', hijos: [], texto: '' }];
  const re = /<(\/?)([A-Za-z0-9_:]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;

  while ((m = re.exec(limpio)) !== null) {
    const [, cierre, nombre, , autoCierre, texto] = m;

    if (texto !== undefined) { pila[pila.length - 1].texto += texto; continue; }
    if (autoCierre) continue;

    if (cierre) {
      if (pila.length > 1) pila.pop();
    } else {
      const nodo = { nombre, hijos: [], texto: '' };
      pila[pila.length - 1].hijos.push(nodo);
      pila.push(nodo);
    }
  }

  return pila[0].hijos[0];
}

function envolverNodo(nodo) {
  return {
    getName: () => nodo.nombre,
    getText: () => nodo.texto,
    getChildren: () => nodo.hijos.map(envolverNodo)
  };
}

// Utilities.unzip para los .kmz: devuelve el KML interno.
global.Utilities.unzip = blob => [{
  getName: () => 'doc.kml',
  getDataAsString: () => blob.getDataAsString()
}];

global.XmlService = {
  parse: texto => ({ getRootElement: () => envolverNodo(parsearXml(texto)) })
};

global.__lecturasDrive = () => lecturasDrive;
global.__resetLecturasDrive = () => { lecturasDrive = 0; };
