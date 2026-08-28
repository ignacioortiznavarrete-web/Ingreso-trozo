/* Solo reemplaza google.script.run y Swal: Charts y Leaflet son los de verdad. */
window.__swal = [];
window.google = window.google || {};
window.google.script = {
  url: { getLocation: cb => setTimeout(() => cb({ parameter: {} }), 0) },
  run: (function () {
    const R = window.__RESPUESTAS; let success = null; const api = {};
    Object.keys(R).forEach(fn => {
      api[fn] = function () {
        const s = success;
        setTimeout(() => { if (s) s(JSON.parse(JSON.stringify(R[fn]))); }, 60);
        success = null; return api;
      };
    });
    api.withSuccessHandler = fn => { success = fn; return api; };
    api.withFailureHandler = () => api;
    return api;
  })()
};

/* Chromium del sandbox no alcanza las CDN: se sustituyen Charts y Leaflet por
   marcadores con la misma caja, para revisar el layout completo. */
function _placeholder(el, texto, tono) {
  if (!el) return;
  el.innerHTML = '<div style="height:100%;display:grid;place-items:center;text-align:center;' +
    'border-radius:10px;background:' + (tono || '#F1F6F3') + ';border:1px dashed #CFDDD5;' +
    'color:#52796F;font:600 12px Inter,sans-serif;line-height:1.6">' + texto + '</div>';
}
function ChartStub(el) { this.el = el; }
ChartStub.prototype.draw = function (data, opts) {
  const tipo = this._tipo || 'gráfico';
  _placeholder(this.el, tipo + '<br><span style="font-weight:400;color:#738579">' +
    (data.filas || 0) + ' series de datos</span>');
};
function mk(nombre) { const F = function (el) { ChartStub.call(this, el); this._tipo = nombre; };
  F.prototype = Object.create(ChartStub.prototype); return F; }
window.google.charts = { load(){}, setOnLoadCallback(cb){ setTimeout(cb, 30); } };
window.google.visualization = {
  arrayToDataTable: a => ({ filas: a.length - 1 }),
  BarChart: mk('Barras horizontales'), ColumnChart: mk('Columnas'), ComboChart: mk('Combo barras y línea')
};
const _ml = () => ({ addTo(){return this;}, clearLayers(){}, bindPopup(){return this;}, openPopup(){} });
window.L = {
  map(id) { _placeholder(document.getElementById(id), 'Mapa Leaflet<br>' +
    '<span style="font-weight:400;color:#738579">no disponible sin red en esta vista previa</span>');
    return { setView(){return this;}, remove(){}, invalidateSize(){}, fitBounds(){}, addLayer(){} }; },
  tileLayer: _ml, layerGroup: _ml, polygon: _ml, circleMarker: _ml,
  control: () => ({ onAdd:null, addTo(){} }), DomUtil: { create: () => document.createElement('div') }
};

/* SweetAlert tampoco carga sin red: se stubbea para que la red de seguridad
   no tape el encabezado en la vista previa. */
window.Swal = { fire(o){ window.__swal.push(o); return Promise.resolve({ isConfirmed:false }); },
                close(){}, showLoading(){} };
