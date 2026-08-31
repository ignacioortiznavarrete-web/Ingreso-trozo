/* Solo reemplaza google.script.run y Swal: Charts y Leaflet son los de verdad. */
window.__swal = [];
window.google = window.google || {};
window.google.script = {
  url: { getLocation: cb => setTimeout(() => cb({ parameter: {} }), 0) },
  run: (function () {
    const R = window.__RESPUESTAS; let success = null; const api = {};
    Object.keys(R).forEach(fn => {
      api[fn] = function () {
        const args = Array.prototype.slice.call(arguments);
        const s = success;

        let respuesta = R[fn];
        if (fn === 'getRolesPolygons') {
          const out = {};
          (args[0] || []).forEach(k => { if (R.__poligonos[k]) out[k] = R.__poligonos[k]; });
          respuesta = { polygons: out, errores: [] };
        }

        setTimeout(() => { if (s) s(JSON.parse(JSON.stringify(respuesta))); }, 60);
        success = null; return api;
      };
    });
    api.withSuccessHandler = fn => { success = fn; return api; };
    api.withFailureHandler = () => api;
    return api;
  })()
};

/* El sandbox no alcanza las CDN de Google Charts, así que la vista previa
   dibuja los gráficos con un render SVG propio. No pretende igualar a Google
   Charts: existe para poder MIRAR si las cifras caben, si se pisan y si la
   tinta contrasta con el relleno, que es justamente lo que hay que revisar. */

function esRol(col) { return col && typeof col === 'object' && col.role; }

function columnasDeDatos(encabezado) {
  const series = [];
  for (let i = 1; i < encabezado.length; i++) {
    if (esRol(encabezado[i])) continue;
    const roles = {};
    for (let j = i + 1; j < encabezado.length && esRol(encabezado[j]); j++) {
      roles[encabezado[j].role] = j;
    }
    series.push({ col: i, nombre: String(encabezado[i]), roles });
  }
  return series;
}

function tintaAnotacion(opts, indiceSerie) {
  const propia = opts.series && opts.series[indiceSerie] && opts.series[indiceSerie].annotations;
  if (propia && propia.textStyle) return propia.textStyle.color;
  return (opts.annotations && opts.annotations.textStyle && opts.annotations.textStyle.color) || '#24352B';
}

function tamanoAnotacion(opts, indiceSerie) {
  const propia = opts.series && opts.series[indiceSerie] && opts.series[indiceSerie].annotations;
  if (propia && propia.textStyle) return propia.textStyle.fontSize || 10;
  return (opts.annotations && opts.annotations.textStyle && opts.annotations.textStyle.fontSize) || 11;
}

function dibujarSvg(el, datos, opts, tipo) {
  if (!el || !datos || !datos.encabezado) return;

  const W = el.clientWidth || 700;
  const H = el.clientHeight || 330;
  const series = columnasDeDatos(datos.encabezado);
  const filas = datos.cuerpo || [];
  const apilado = Boolean(opts.isStacked);
  const horizontal = tipo === 'bar';

  const esLinea = i => opts.series && opts.series[i] && opts.series[i].type === 'line';
  const colores = opts.colors || ['#2D6A4F'];
  const estiloCol = (datos.encabezado.findIndex(c => esRol(c) && c.role === 'style'));

  // Escala
  let max = 0, min = 0;
  filas.forEach(f => {
    let acumulado = 0;
    series.forEach((s, i) => {
      const v = Number(f[s.col]) || 0;
      if (esLinea(i)) { max = Math.max(max, v); return; }
      if (apilado) { acumulado += v; } else { max = Math.max(max, v); min = Math.min(min, v); }
    });
    if (apilado) max = Math.max(max, acumulado);
  });

  const vw = (opts.hAxis && opts.hAxis.viewWindow) || (opts.vAxis && opts.vAxis.viewWindow) || {};
  if (typeof vw.max === 'number') max = Math.max(max, vw.max);
  if (typeof vw.min === 'number') min = Math.min(min, vw.min);

  const margen = horizontal ? { t: 26, r: 20, b: 24, l: 150 } : { t: 34, r: 16, b: 40, l: 56 };
  const anchoUtil = W - margen.l - margen.r;
  const altoUtil = H - margen.t - margen.b;
  const rango = (max - min) || 1;
  const escala = v => (v - min) / rango;
  const cero = escala(0);

  const partes = ['<svg width="' + W + '" height="' + H + '" font-family="Inter, sans-serif">'];
  partes.push('<rect width="' + W + '" height="' + H + '" fill="#FFFFFF"/>');

  const nBarras = filas.length;
  const paso = (horizontal ? altoUtil : anchoUtil) / Math.max(1, nBarras);
  const grosor = paso * 0.72;

  filas.forEach((fila, idx) => {
    const centro = (horizontal ? margen.t : margen.l) + paso * idx + paso / 2;
    let base = 0;

    series.forEach((s, i) => {
      const v = Number(fila[s.col]) || 0;
      const anot = s.roles.annotation !== undefined ? fila[s.roles.annotation] : null;

      if (esLinea(i)) {
        const y = margen.t + altoUtil * (1 - escala(v));
        partes.push('<line x1="' + (centro - paso / 2) + '" y1="' + y + '" x2="' + (centro + paso / 2) +
          '" y2="' + y + '" stroke="' + (colores[i] || '#B3261E') + '" stroke-width="2" stroke-dasharray="5 4"/>');
        return;
      }

      const color = estiloCol !== -1 ? (fila[estiloCol] || colores[0]) : (colores[i] || colores[0]);

      if (horizontal) {
        const x0 = margen.l + anchoUtil * cero;
        const x1 = margen.l + anchoUtil * escala(v);
        const x = Math.min(x0, x1), ancho = Math.max(1, Math.abs(x1 - x0));
        partes.push('<rect x="' + x + '" y="' + (centro - grosor / 2) + '" width="' + ancho +
          '" height="' + grosor + '" fill="' + color + '" rx="2"/>');

        if (anot) {
          const fuera = !opts.annotations || opts.annotations.alwaysOutside !== false;
          const tx = fuera ? (v >= 0 ? x + ancho + 6 : x - 6) : x + ancho / 2;
          partes.push('<text x="' + tx + '" y="' + (centro + 4) + '" font-size="' + tamanoAnotacion(opts, i) +
            '" font-weight="700" fill="' + tintaAnotacion(opts, i) + '" text-anchor="' +
            (fuera ? (v >= 0 ? 'start' : 'end') : 'middle') + '">' + anot + '</text>');
        }
      } else {
        const desde = apilado ? base : 0;
        const hasta = apilado ? base + v : v;
        const y1 = margen.t + altoUtil * (1 - escala(hasta));
        const y0 = margen.t + altoUtil * (1 - escala(desde));
        const y = Math.min(y0, y1), alto = Math.max(1, Math.abs(y0 - y1));
        partes.push('<rect x="' + (centro - grosor / 2) + '" y="' + y + '" width="' + grosor +
          '" height="' + alto + '" fill="' + color + '" rx="2"/>');

        if (anot) {
          const dentro = opts.annotations && opts.annotations.alwaysOutside === false;
          const ty = dentro ? y + alto / 2 + 3 : y - 5;
          partes.push('<text x="' + centro + '" y="' + ty + '" font-size="' + tamanoAnotacion(opts, i) +
            '" font-weight="700" fill="' + tintaAnotacion(opts, i) + '" text-anchor="middle">' + anot + '</text>');
        }

        if (apilado) base = hasta;
      }
    });

    const etiqueta = String(fila[0]);
    if (horizontal) {
      partes.push('<text x="' + (margen.l - 8) + '" y="' + (centro + 4) +
        '" font-size="11" fill="#24352B" text-anchor="end">' +
        (etiqueta.length > 20 ? etiqueta.slice(0, 19) + '…' : etiqueta) + '</text>');
    } else if (nBarras <= 30) {
      partes.push('<text x="' + centro + '" y="' + (H - margen.b + 14) +
        '" font-size="10" fill="#738579" text-anchor="middle">' + etiqueta + '</text>');
    }
  });

  // Leyenda cuando hay más de una serie de barras
  const barras = series.filter((s, i) => !esLinea(i));
  if (barras.length > 1) {
    let x = margen.l;
    partes.push('<g font-size="10" fill="#24352B">');
    series.forEach((s, i) => {
      if (x > W - 120) return;
      partes.push('<rect x="' + x + '" y="8" width="9" height="9" rx="2" fill="' + (colores[i] || '#999') + '"/>');
      const t = s.nombre.length > 14 ? s.nombre.slice(0, 13) + '…' : s.nombre;
      partes.push('<text x="' + (x + 13) + '" y="16">' + t + '</text>');
      x += 20 + t.length * 5.6;
    });
    partes.push('</g>');
  }

  partes.push('</svg>');
  el.innerHTML = partes.join('');
}

function ChartStub(el) { this.el = el; }
ChartStub.prototype.getSelection = function () { return []; };
function mk(tipo) {
  const F = function (el) { ChartStub.call(this, el); };
  F.prototype = Object.create(ChartStub.prototype);
  F.prototype.draw = function (datos, opts) { dibujarSvg(this.el, datos, opts || {}, tipo); };
  return F;
}

window.google.charts = { load() {}, setOnLoadCallback(cb) { setTimeout(cb, 30); } };
window.google.visualization = {
  arrayToDataTable: a => ({ filas: a.length - 1, encabezado: a[0], cuerpo: a.slice(1) }),
  BarChart: mk('bar'), ColumnChart: mk('column'), ComboChart: mk('column'),
  events: { addListener() {} }
};

const _ml = () => ({ addTo(){return this;}, clearLayers(){}, bindPopup(){return this;}, openPopup(){} });

/* Sustituto de Leaflet que reproduce su apilamiento real: los panes usan
   z-index 200-700 y los controles 800. Sirve para comprobar que el mapa no
   se dibuja sobre el encabezado pegajoso al hacer scroll. */
window.L = {
  map(id) {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML =
        '<div class="leaflet-pane" style="position:absolute;inset:0;z-index:400;' +
        'background:repeating-linear-gradient(45deg,#E8EFE9 0 14px,#DFE9E1 14px 28px)"></div>' +
        '<div class="leaflet-pane" style="position:absolute;inset:0;z-index:700"></div>' +
        '<div class="leaflet-control" style="position:absolute;top:10px;left:10px;z-index:800;' +
        'background:#fff;border:1px solid #ccc;border-radius:4px;padding:2px 7px;font:600 14px sans-serif">+</div>' +
        '<div style="position:absolute;inset:0;display:grid;place-items:center;z-index:401;' +
        'color:#52796F;font:600 12px Inter,sans-serif;text-align:center">Mapa Leaflet' +
        '<br><span style="font-weight:400">simulado: el sandbox no alcanza las teselas</span></div>';
    }
    return { setView(){return this;}, remove(){}, invalidateSize(){}, fitBounds(){}, addLayer(){} };
  },
  tileLayer: _ml, layerGroup: _ml, polygon: _ml, circleMarker: _ml,
  control: () => ({ onAdd: null, addTo(){} }),
  DomUtil: { create: () => document.createElement('div') }
};

/* SweetAlert tampoco carga sin red. */
window.__swal = window.__swal || [];
window.Swal = { fire(o) { window.__swal.push(o); return Promise.resolve({ isConfirmed: false }); },
                close() {}, showLoading() {} };
