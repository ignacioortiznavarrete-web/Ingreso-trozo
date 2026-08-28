/* Comprueba en un navegador real que el encabezado, las pestañas y la barra de
   filtros quedan por encima del mapa al hacer scroll. */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  let fallos = 0;
  const ok = (c, m, e) => { console.log((c ? '  PASA  ' : '  FALLA ') + m + (e !== undefined ? '  ->  ' + e : '')); if (!c) fallos++; };

  await p.goto('file://' + path.join(__dirname, 'preview.html'), { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);

  await p.evaluate(() => activateTab('territorio'));
  await p.waitForTimeout(1500);

  // Scroll hasta que el mapa quede detrás de la barra pegajosa.
  await p.evaluate(() => {
    const m = document.getElementById('map');
    window.scrollTo(0, m.getBoundingClientRect().top + window.scrollY - 40);
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(__dirname, 'shot-apilamiento.png') });

  const quienManda = await p.evaluate(() => {
    const en = (x, y) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return 'nada';
      if (el.closest('header.app-header')) return 'header';
      if (el.closest('nav.tabs')) return 'tabs';
      if (el.closest('.filters-bar')) return 'filtros';
      if (el.closest('#map')) return 'mapa';
      return el.tagName.toLowerCase();
    };
    return {
      header: en(300, 30),
      tabs: en(300, 84),
      filtros: en(300, 140),
      mapaVisible: en(700, 600)
    };
  });

  console.log('\n  Apilamiento con el mapa detrás de la barra pegajosa');
  ok(quienManda.header === 'header', 'el encabezado queda sobre el mapa', quienManda.header);
  ok(quienManda.tabs === 'tabs', 'las pestañas quedan sobre el mapa', quienManda.tabs);
  ok(quienManda.filtros === 'filtros', 'la barra de filtros queda sobre el mapa', quienManda.filtros);
  ok(quienManda.mapaVisible === 'mapa', 'y el mapa sigue visible donde le toca', quienManda.mapaVisible);

  const desborde = await p.evaluate(() => {
    const c = document.getElementById('map').getBoundingClientRect();
    const tarjeta = document.getElementById('map').closest('.card').getBoundingClientRect();
    return { alto: Math.round(c.height), dentro: c.bottom <= tarjeta.bottom + 1 && c.top >= tarjeta.top - 1 };
  });
  ok(desborde.alto > 300 && desborde.alto < 700, 'el mapa conserva su alto', desborde.alto + 'px');
  ok(desborde.dentro, 'el mapa no se sale de su tarjeta');

  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await b.close();
  console.log('\n' + (fallos ? fallos + ' PRUEBAS FALLIDAS' : 'APILAMIENTO CORRECTO'));
  process.exit(fallos ? 1 : 0);
})();
