/* Stubs de librerías externas y del puente google.script.run.
   Se inyecta en el <head> para que exista antes de los scripts de la app. */
window.__errores = [];
window.__charts = [];
window.__listeners = [];
window.__seleccion = [];
window.__swal = [];

window.addEventListener('error', e => window.__errores.push('onerror: ' + (e.message || e)));
const _consoleError = console.error;
console.error = function () {
  window.__errores.push('console.error: ' + Array.from(arguments).map(String).join(' '));
  _consoleError.apply(console, arguments);
};

function ChartStub(el) { this.el = el; }
ChartStub.prototype.draw = function (data, opts) {
  window.__charts.push({ id: this.el && this.el.id, filas: data && data.filas,
                         datos: data, opts: opts });
};
ChartStub.prototype.getSelection = function () { return window.__seleccion || []; };

window.google = {
  charts: {
    load() {},
    setOnLoadCallback(cb) { setTimeout(cb, 0); }
  },
  visualization: {
    arrayToDataTable: a => ({ filas: a.length - 1, encabezado: a[0], cuerpo: a.slice(1) }),
    BarChart: ChartStub, ColumnChart: ChartStub, ComboChart: ChartStub,
    events: {
      addListener(grafico, evento, cb) { window.__listeners.push({ grafico, evento, cb }); }
    }
  },
  script: {
    url: { getLocation: cb => setTimeout(() => cb({ parameter: {} }), 0) },
    run: (function () {
      const R = window.__RESPUESTAS;
      let success = null;
      const api = {};

      window.__llamadas = {};
      window.__lotes = [];

      Object.keys(R).forEach(fn => {
        api[fn] = function () {
          const args = Array.prototype.slice.call(arguments);
          const s = success;
          window.__llamadas[fn] = (window.__llamadas[fn] || 0) + 1;

          // getRolesPolygons responde según el lote que le pidan, para poder
          // comprobar que el cliente realmente pagina la geometría.
          let respuesta = R[fn];
          if (fn === 'getRolesPolygons') {
            const pedidos = args[0] || [];
            window.__lotes.push(pedidos.length);
            const out = {};
            pedidos.forEach(k => { if (R.__poligonos[k]) out[k] = R.__poligonos[k]; });
            respuesta = { polygons: out, errores: [] };
          }

          setTimeout(() => { if (s) s(JSON.parse(JSON.stringify(respuesta))); }, 0);
          success = null;
          return api;
        };
      });

      api.withSuccessHandler = fn => { success = fn; return api; };
      api.withFailureHandler = () => api;
      return api;
    })()
  }
};

window.Swal = {
  fire(o) { window.__swal.push(o); return Promise.resolve({ isConfirmed: false }); },
  close() {}, showLoading() {}
};

const _layer = () => ({ addTo(){return this;}, clearLayers(){}, bindPopup(){return this;}, openPopup(){} });
window.L = {
  map: () => ({ setView(){return this;}, remove(){}, invalidateSize(){}, fitBounds(){}, addLayer(){} }),
  tileLayer: _layer, layerGroup: _layer, polygon: _layer, circleMarker: _layer,
  control: () => ({ onAdd: null, addTo() { if (this.onAdd) this.onAdd(); } }),
  DomUtil: { create: () => document.createElement('div') }
};

// jsdom no implementa scrollIntoView; en un navegador real existe siempre.
window.HTMLElement.prototype.scrollIntoView = function () {};

// jsdom no implementa offsetParent: los paneles ocultos deben medir cero para
// que la lógica "solo dibujo gráficos de la pestaña visible" se pueda probar.
Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
  get() {
    let el = this;
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('tab-panel') && !el.classList.contains('is-active')) return null;
      el = el.parentElement;
    }
    return document.body;
  }
});
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 900; } });
