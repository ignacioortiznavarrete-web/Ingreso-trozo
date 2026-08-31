/*******************************************************
 MÓDULO OPCIONAL: GRÁFICOS DIRECTOS A GOOGLE SLIDES
 -------------------------------------------------------
 Este archivo es OPCIONAL. El dashboard funciona completo
 sin él. Al agregarlo, el proyecto pedirá autorizar (una
 sola vez) el permiso de Presentaciones de Google.

 Qué hace: el botón "Enviar a Slides" de cada gráfico del
 dashboard inserta ese gráfico directo en la presentación
 conectada (como imagen etiquetada) y los envíos/refrescos
 siguientes lo reemplazan en el mismo lugar y tamaño. La
 hoja oculta "GraficosSlides" se usa solo como motor
 interno para renderizar el PNG de cada gráfico.
*******************************************************/

const SLIDES_SHEET_NAME = 'GraficosSlides';

const SLIDES_PROP_KEY = 'MASISA_SLIDES_PRESENTATION_ID';

const SLIDES_CHARTS = {
  entregaDiaria: { titulo: 'Entrega diaria: m³ real vs meta diaria hábil' },
  topProveedores: { titulo: 'Top proveedores por cubicación' },
  calidadTrozos: { titulo: 'Trozos por calidad' },
  calidadCubicacion: { titulo: 'Cubicación por calidad' },
  brechaProveedores: { titulo: 'Brecha vs plan a fecha por proveedor' },
  distribucionLargo: { titulo: 'Distribución de la cubicación por largo' }
};

function extractSlidesId_(url) {
  const text = String(url || '').trim();
  const byUrl = text.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
  if (byUrl) return byUrl[1];
  const bare = text.match(/^([a-zA-Z0-9-_]{20,})$/);
  return bare ? bare[1] : '';
}

function configurarPresentacionSlides(url) {
  const id = extractSlidesId_(url);

  if (!id) {
    throw new Error('El enlace no parece de Google Slides. Pega la URL completa de la presentación.');
  }

  // Valida que la presentación exista y sea accesible antes de guardarla.
  SlidesApp.openById(id);
  PropertiesService.getScriptProperties().setProperty(SLIDES_PROP_KEY, id);

  return id;
}

function enviarGraficoDirectoASlides(chartKey, presentationUrl) {
  if (!SLIDES_CHARTS[chartKey]) {
    throw new Error('Gráfico desconocido: ' + chartKey);
  }

  const props = PropertiesService.getScriptProperties();

  if (presentationUrl) configurarPresentacionSlides(presentationUrl);

  const presId = props.getProperty(SLIDES_PROP_KEY);
  if (!presId) return { needsConfig: true };

  actualizarGraficosPresentacion(false);

  const blob = getChartBlob_(chartKey);
  const pres = SlidesApp.openById(presId);
  const upsert = upsertChartImage_(pres, chartKey, blob);

  return {
    needsConfig: false,
    created: upsert.created,
    url: pres.getUrl(),
    nombrePresentacion: pres.getName(),
    actualizadoEn: Utilities.formatDate(new Date(), 'America/Santiago', 'dd/MM/yyyy HH:mm')
  };
}

function getChartBlob_(chartKey) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(SLIDES_SHEET_NAME);
  const baseTitle = SLIDES_CHARTS[chartKey].titulo;

  if (!sh) {
    throw new Error('No existe la hoja interna ' + SLIDES_SHEET_NAME);
  }

  const chart = sh.getCharts().find(c => {
    const title = String(c.getOptions().get('title') || '');
    return title.indexOf(baseTitle) === 0;
  });

  if (!chart) {
    throw new Error('No se encontró el gráfico "' + baseTitle + '" para exportar.');
  }

  return chart.getAs('image/png').setName(baseTitle + '.png');
}

function upsertChartImage_(pres, chartKey, blob) {
  const tag = 'MASISA_CHART:' + chartKey;
  const slides = pres.getSlides();

  for (let s = 0; s < slides.length; s++) {
    const images = slides[s].getImages();

    for (let i = 0; i < images.length; i++) {
      if (images[i].getDescription() === tag) {
        // Reemplaza la imagen manteniendo posición y tamaño en la diapositiva.
        images[i].replace(blob);
        return { created: false };
      }
    }
  }

  const slide = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  const image = slide.insertImage(blob);
  const pageWidth = pres.getPageWidth();
  const pageHeight = pres.getPageHeight();
  const scale = Math.min(
    (pageWidth * 0.92) / image.getWidth(),
    (pageHeight * 0.86) / image.getHeight()
  );

  image.setWidth(image.getWidth() * scale);
  image.setHeight(image.getHeight() * scale);
  image.setLeft((pageWidth - image.getWidth()) / 2);
  image.setTop((pageHeight - image.getHeight()) / 2);
  image.setDescription(tag);

  return { created: true };
}

function actualizarGraficosPresentacion(force) {
  const data = getDashboardData(force === true);
  const ss = getSpreadsheet_();

  let sh = ss.getSheetByName(SLIDES_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SLIDES_SHEET_NAME);

  sh.getCharts().forEach(chart => sh.removeChart(chart));
  sh.clear();

  const monthLabel = data.planMonth || '';

  // ── Bloque 1: entrega diaria (día calendario en el eje X) ──
  const dayLabelByBusinessDay = {};
  (((data.calendario || {}).days) || []).forEach(d => {
    if (d.habil && d.numHabil) dayLabelByBusinessDay[d.numHabil] = d.day;
  });

  const realByDay = {};
  const projByDay = {};
  let maxDay = Number(data.kpis.diasHabilesMes) || 0;

  (data.fechas || []).forEach(f => {
    const dia = Number(f.dia) || 0;
    if (!dia) return;
    realByDay[dia] = (realByDay[dia] || 0) + (Number(f.cubicacion) || 0);
    maxDay = Math.max(maxDay, dia);
  });

  (data.proyeccionCamiones || []).forEach(p => {
    const dia = Number(p.dia) || 0;
    if (!dia) return;
    projByDay[dia] = (projByDay[dia] || 0) + (Number(p.cubicacion) || 0);
    maxDay = Math.max(maxDay, dia);
  });

  const meta = Number(data.kpis.planDiarioHabil) || 0;
  const entrega = [['Día del mes', 'Proyección camiones m³', 'm³ real', 'Meta diaria hábil']];

  for (let dia = 1; dia <= maxDay; dia++) {
    entrega.push([
      String(dayLabelByBusinessDay[dia] || dia),
      projByDay[dia] || 0,
      realByDay[dia] || 0,
      meta
    ]);
  }

  sh.getRange(1, 1, entrega.length, 4).setValues(entrega);

  // ── Bloque 2: top proveedores por cubicación ──
  const top = [['Proveedor', 'm³']].concat(
    (data.proveedores || [])
      .filter(p => Number(p.cubicacion) > 0)
      .slice(0, 8)
      .map(p => [p.proveedor, Number(p.cubicacion) || 0])
  );

  sh.getRange(1, 6, top.length, 2).setValues(top);

  // ── Bloques 3 y 4: calidad (trozos y m³) ──
  const ordenCalidad = { SINIESTRADO: 1, VERDE: 2, MANCHADO: 3 };
  const calidades = (data.calidades || []).slice().sort((a, b) => {
    return (ordenCalidad[a.calidad] || 99) - (ordenCalidad[b.calidad] || 99);
  });

  const calidadTrozos = [['Calidad', 'Trozos']].concat(
    calidades.map(c => [c.calidad, Number(c.trozos) || 0])
  );
  const calidadCub = [['Calidad', 'm³']].concat(
    calidades.map(c => [c.calidad, Number(c.cubicacion) || 0])
  );

  sh.getRange(1, 9, calidadTrozos.length, 2).setValues(calidadTrozos);
  sh.getRange(1, 12, calidadCub.length, 2).setValues(calidadCub);

  // ── Bloque 5: brecha vs plan a fecha (los 10 más desviados) ──
  const brechas = ((data.planAccion || {}).filas || [])
    .filter(f => Number(f.plan) > 0)
    .slice()
    .sort((a, b) => Math.abs(b.brecha) - Math.abs(a.brecha))
    .slice(0, 10)
    .sort((a, b) => a.brecha - b.brecha);

  const brechaTabla = [['Proveedor', 'm³ vs plan a fecha']].concat(
    brechas.map(f => [f.proveedor, Math.round(Number(f.brecha) || 0)])
  );

  if (brechaTabla.length > 1) {
    sh.getRange(1, 15, brechaTabla.length, 2).setValues(brechaTabla);
  }

  // ── Bloque 6: distribución de la cubicación por largo ──
  // Se agrega desde la matriz diámetro por largo, que ya viaja en el resumen.
  const porLargo = {};
  (data.matriz || []).forEach(m => {
    const largo = Number(m.largo) || 0;
    if (!largo) return;
    porLargo[largo] = (porLargo[largo] || 0) + (Number(m.cubicacion) || 0);
  });

  const largoTabla = [['Largo', 'm³']].concat(
    Object.keys(porLargo)
      .map(Number)
      .sort((a, b) => a - b)
      .map(largo => [String(largo) + ' m', Math.round(porLargo[largo])])
  );

  if (largoTabla.length > 1) {
    sh.getRange(1, 18, largoTabla.length, 2).setValues(largoTabla);
  }

  // ── Gráficos incrustados (mismos colores del dashboard) ──
  const chartRowStart = Math.max(entrega.length, top.length, calidadTrozos.length,
                                 brechaTabla.length, largoTabla.length) + 3;

  sh.insertChart(
    sh.newChart()
      .setChartType(Charts.ChartType.COMBO)
      .addRange(sh.getRange(1, 1, entrega.length, 4))
      .setPosition(chartRowStart, 1, 0, 0)
      .setOption('title', 'Entrega diaria: m³ real vs meta diaria hábil' + (monthLabel ? ' · ' + monthLabel : ''))
      .setOption('seriesType', 'bars')
      .setOption('legend', { position: 'top' })
      // Los gráficos de Slides se leen proyectados: la cifra va sobre la barra.
      .setOption('series', {
        0: { color: '#DCE5DF' },
        1: { color: '#2D6A4F', dataLabel: 'value' },
        2: { type: 'line', color: '#B3261E' }
      })
      .setOption('hAxis', { title: 'Día del mes (días hábiles)' })
      .setOption('vAxis', { title: 'm³' })
      .setOption('width', 900)
      .setOption('height', 420)
      .build()
  );

  sh.insertChart(
    sh.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(sh.getRange(1, 6, top.length, 2))
      .setPosition(chartRowStart + 24, 1, 0, 0)
      .setOption('title', 'Top proveedores por cubicación' + (monthLabel ? ' · ' + monthLabel : ''))
      .setOption('colors', ['#2D6A4F'])
      .setOption('series', { 0: { dataLabel: 'value' } })
      .setOption('legend', { position: 'none' })
      .setOption('hAxis', { title: 'm³' })
      .setOption('width', 900)
      .setOption('height', 420)
      .build()
  );

  sh.insertChart(
    sh.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(sh.getRange(1, 9, calidadTrozos.length, 2))
      .setPosition(chartRowStart + 48, 1, 0, 0)
      .setOption('title', 'Trozos por calidad' + (monthLabel ? ' · ' + monthLabel : ''))
      .setOption('colors', ['#52796F'])
      .setOption('series', { 0: { dataLabel: 'value' } })
      .setOption('legend', { position: 'none' })
      .setOption('width', 700)
      .setOption('height', 380)
      .build()
  );

  sh.insertChart(
    sh.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(sh.getRange(1, 12, calidadCub.length, 2))
      .setPosition(chartRowStart + 48, 8, 0, 0)
      .setOption('title', 'Cubicación por calidad' + (monthLabel ? ' · ' + monthLabel : ''))
      .setOption('colors', ['#2D6A4F'])
      .setOption('series', { 0: { dataLabel: 'value' } })
      .setOption('legend', { position: 'none' })
      .setOption('vAxis', { title: 'm³' })
      .setOption('width', 700)
      .setOption('height', 380)
      .build()
  );

  if (brechaTabla.length > 1) {
    sh.insertChart(
      sh.newChart()
        .setChartType(Charts.ChartType.BAR)
        .addRange(sh.getRange(1, 15, brechaTabla.length, 2))
        .setPosition(chartRowStart + 72, 1, 0, 0)
        .setOption('title', 'Brecha vs plan a fecha por proveedor' + (monthLabel ? ' · ' + monthLabel : ''))
        .setOption('colors', ['#B3261E'])
        .setOption('series', { 0: { dataLabel: 'value' } })
        .setOption('legend', { position: 'none' })
        .setOption('hAxis', { title: 'm³ sobre (+) o bajo (-) el plan a fecha' })
        .setOption('width', 900)
        .setOption('height', 460)
        .build()
    );
  }

  if (largoTabla.length > 1) {
    sh.insertChart(
      sh.newChart()
        .setChartType(Charts.ChartType.COLUMN)
        .addRange(sh.getRange(1, 18, largoTabla.length, 2))
        .setPosition(chartRowStart + 96, 1, 0, 0)
        .setOption('title', 'Distribución de la cubicación por largo' + (monthLabel ? ' · ' + monthLabel : ''))
        .setOption('colors', ['#2D6A4F'])
        .setOption('series', { 0: { dataLabel: 'value' } })
        .setOption('legend', { position: 'none' })
        .setOption('vAxis', { title: 'm³' })
        .setOption('hAxis', { title: 'Largo' })
        .setOption('width', 900)
        .setOption('height', 420)
        .build()
    );
  }

  // Hoja de trabajo interna: se mantiene oculta para el usuario.
  if (!sh.isSheetHidden()) sh.hideSheet();

  return {
    url: ss.getUrl(),
    sheetName: SLIDES_SHEET_NAME,
    planMonth: monthLabel,
    actualizadoEn: Utilities.formatDate(new Date(), 'America/Santiago', 'dd/MM/yyyy HH:mm')
  };
}

function menuConfigurarPresentacion() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt(
    'Conectar presentación de Google Slides',
    'Pega el enlace de la presentación donde quieres los gráficos en vivo:',
    ui.ButtonSet.OK_CANCEL
  );

  if (res.getSelectedButton() !== ui.Button.OK) return;

  configurarPresentacionSlides(res.getResponseText());
  ui.alert('Presentación conectada. Ahora usa "Enviar a Slides" en el dashboard o "Actualizar gráficos para Slides".');
}

function menuActualizarGraficosSlides() {
  const refrescados = refrescarGraficosSlidesTrigger();
  SpreadsheetApp.getUi().alert(
    refrescados === -1
      ? 'Gráficos regenerados, pero no hay presentación conectada.\n\nUsa "Conectar presentación de Slides..." o el botón "Enviar a Slides" del dashboard.'
      : 'Gráficos regenerados y ' + refrescados + ' gráfico(s) actualizados en la presentación conectada.'
  );
}

// También lo ejecuta el trigger horario: regenera los gráficos y reemplaza
// las imágenes etiquetadas en la presentación conectada, sin intervención.
function refrescarGraficosSlidesTrigger() {
  actualizarGraficosPresentacion(true);

  const presId = PropertiesService.getScriptProperties().getProperty(SLIDES_PROP_KEY);
  if (!presId) return -1;

  const pres = SlidesApp.openById(presId);
  let refrescados = 0;

  Object.keys(SLIDES_CHARTS).forEach(chartKey => {
    try {
      const tag = 'MASISA_CHART:' + chartKey;
      let blob = null;

      pres.getSlides().forEach(slide => {
        slide.getImages().forEach(img => {
          if (img.getDescription() !== tag) return;
          if (!blob) blob = getChartBlob_(chartKey);
          img.replace(blob);
          refrescados++;
        });
      });
    } catch (err) {
      Logger.log('No se pudo refrescar en Slides el gráfico ' + chartKey + ': ' + err);
    }
  });

  return refrescados;
}

function activarActualizacionAutomaticaGraficos() {
  const handler = 'refrescarGraficosSlidesTrigger';
  const yaExiste = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === handler);

  if (!yaExiste) {
    ScriptApp.newTrigger(handler).timeBased().everyHours(1).create();
  }

  SpreadsheetApp.getUi().alert(
    yaExiste
      ? 'La actualización automática ya estaba activa (cada 1 hora).'
      : 'Listo: cada 1 hora los gráficos se regeneran con los datos nuevos y se reemplazan ' +
        'automáticamente en la presentación de Slides conectada, sin que tengas que hacer nada.'
  );
}
