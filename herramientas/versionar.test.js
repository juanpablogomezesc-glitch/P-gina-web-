// Ejecutar con: node --test herramientas/versionar.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { versionar, ejecutar, huella, PAGINAS } = require('./versionar.js');

const RAIZ = path.join(__dirname, '..');

test('todas las páginas tienen sus estilos y scripts con el número de versión al día', () => {
  assert.deepEqual(ejecutar(true), [], 'Falta correr: node herramientas/versionar.js');
});

test('cada archivo local enlazado lleva ?v= con la huella de su contenido actual', () => {
  for (const pagina of PAGINAS) {
    const html = fs.readFileSync(path.join(RAIZ, pagina), 'utf8');
    const enlaces = [...html.matchAll(/(?:href|src)="((?:\.\.\/)?[\w\-/]+\.(?:css|js))\?v=([0-9a-f]+)"/g)];
    assert.ok(enlaces.length >= 1, `${pagina} no tiene archivos versionados`);
    for (const [, destino, v] of enlaces) {
      assert.equal(v, huella(path.join(RAIZ, path.dirname(pagina), destino)), `${pagina}: ${destino}`);
    }
  }
});

test('las páginas que usan el estilo general y el dashboard enlazan lo esperado', () => {
  const dash = fs.readFileSync(path.join(RAIZ, 'progreso.html'), 'utf8');
  for (const f of ['styles.css', 'progreso/progreso.css', 'progreso/calculos.js', 'progreso/progreso.js']) assert.match(dash, new RegExp(f.replace(/[./]/g, '\\$&') + '\\?v=[0-9a-f]{8}'));
});

test('no toca los enlaces externos ni los que no son css/js', () => {
  const pagina = PAGINAS[0];
  const html = versionar(pagina);
  assert.match(html, /href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com[^"]*\?v=/);
  assert.match(html, /href="favicon\.svg"/);
});
