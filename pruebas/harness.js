// Arnés mínimo: stubs de Apps Script para ejecutar la lógica pura en Node.
const fs = require('fs');
const vm = require('vm');

global.Logger = { log: () => {} };
global.Session = { getScriptTimeZone: () => 'America/Santiago' };
global.Utilities = {
  formatDate(d, tz, fmt) {
    const p = n => String(n).padStart(2, '0');
    const map = {
      'yyyy-MM-dd': `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`,
      'yyyy-MM': `${d.getFullYear()}-${p(d.getMonth()+1)}`,
      'dd/MM/yyyy': `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}`,
      'dd/MM/yyyy HH:mm': `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`,
      'yyMMdd-HHmmss': `${String(d.getFullYear()).slice(-2)}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`,
      "yyyy-MM-dd'T'HH:mm:ss": `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    };
    return map[fmt] || d.toISOString();
  }
};

// runInThisContext: las declaraciones quedan en el ámbito global, igual que
// en Apps Script, donde todos los archivos comparten un solo espacio.
const load = p => vm.runInThisContext(
  fs.readFileSync(require('path').join(__dirname, '..', 'src', p), 'utf8'), { filename: p });

load('Codigo.gs');
load('Analisis.gs');
