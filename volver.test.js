// Ejecutar con: node --test volver.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('./volver.js');

const CLAVE = 'AbCdEfGhJkLmNpQrStUvWxYz';

test('arma el enlace al dashboard con la clave', () => {
  assert.equal(V.enlace(CLAVE, ''), `progreso.html?c=${CLAVE}`);
  assert.equal(V.enlace(CLAVE, '../'), `../progreso.html?c=${CLAVE}`);
});

test('una clave que no sirve no genera enlace (nada de caracteres raros en la dirección)', () => {
  for (const c of [null, undefined, '', 'corta', CLAVE + 'x', '<script>alert(1)</script>', 'a'.repeat(23) + '&', 'a'.repeat(23) + '"', 5, {}]) assert.equal(V.enlace(c, ''), '', String(c));
});

function ventanaFalsa({ clave, ruta = '/P-gina-web-/turnos.html', falla = false }) {
  const creados = [];
  const body = { appendChild: n => creados.push(n), classList: { add: c => (body.clase = c) } };
  return {
    creados, body,
    localStorage: { getItem: k => { if (falla) throw new Error('bloqueado'); return k === 'pr-clave' ? clave : null; } },
    location: { pathname: ruta },
    document: { body, createElement: () => ({ setAttribute() {} }) },
  };
}

test('agrega el botón solo si hay una clave guardada', () => {
  const con = ventanaFalsa({ clave: CLAVE });
  V.iniciar(con);
  assert.equal(con.creados.length, 1);
  assert.equal(con.creados[0].href, `progreso.html?c=${CLAVE}`);
  assert.equal(con.body.clase, 'con-volver-progreso');

  const sin = ventanaFalsa({ clave: null });
  V.iniciar(sin);
  assert.equal(sin.creados.length, 0);
});

test('dentro de artículos el enlace sube una carpeta, y si el navegador bloquea el almacenamiento no pasa nada', () => {
  const art = ventanaFalsa({ clave: CLAVE, ruta: '/P-gina-web-/articulos/peso-muerto.html' });
  V.iniciar(art);
  assert.equal(art.creados[0].href, `../progreso.html?c=${CLAVE}`);
  const bloqueado = ventanaFalsa({ clave: CLAVE, falla: true });
  assert.doesNotThrow(() => V.iniciar(bloqueado));
  assert.equal(bloqueado.creados.length, 0);
});
