/* Stubs de librerías externas y del puente google.script.run.
   Se inyecta en el <head> para que exista antes de los scripts de la app. */
window.__errores = [];
window.__charts = [];
window.__swal = [];

window.addEventListener('error', e => window.__errores.push('onerror: ' + (e.message || e)));
const _consoleError = console.error;
console.error = function () {
  window.__errores.push('console.error: ' + Array.from(arguments).map(String).join(' '));
  _consoleError.apply(console, arguments);
};

function ChartStub(el) { this.el = el; }
ChartStub.prototype.draw = function (data, opts) {
  window.__charts.push({ id: this.el && this.el.id, filas: data && data.filas });
};

window.google = {
  charts: {
    load() {},
    setOnLoadCallback(cb) { setTimeout(cb, 0); }
  },
  visualization: {
    arrayToDataTable: a => ({ filas: a.length - 1 }),
    BarChart: ChartStub, ColumnChart: ChartStub, ComboChart: ChartStub
  },
  script: {
    url: { getLocation: cb => setTimeout(() => cb({ parameter: {} }), 0) },
    run: (function () {
      const R = window.__RESPUESTAS;
      let success = null;
      const api = {};
      Object.keys(R).forEach(fn => {
        api[fn] = function () {
          const s = success;
          setTimeout(() => { if (s) s(JSON.parse(JSON.stringify(R[fn]))); }, 0);
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
