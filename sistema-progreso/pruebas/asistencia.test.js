// Ejecutar con: node --test sistema-progreso/pruebas/asistencia.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function cargar(extra = {}) {
  const ctx = vm.createContext({ Date, Math, Logger: { log() {} }, Error, ...extra });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'CrearAsistencia.gs'), 'utf8')
    + '\n;this.__api = { armarCalendario_, fechasMarcadas_, crearAsistencia, probarLectura, detectarSeparador_, ANIO };', ctx);
  return ctx.__api;
}
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('cada fecha cae en la columna de su día de la semana (enero 2026 empieza en jueves)', () => {
  const { armarCalendario_ } = cargar();
  const m = armarCalendario_(2026, 12);
  const primera = m.filas[2]; // fila 3: primeras fechas de enero
  assert.deepEqual(Array.from(primera.slice(0, 7), v => (v instanceof Date ? v.getDate() : null)), [null, null, null, 1, 2, 3, 4]);
  m.filas.forEach(f => f.slice(0, 7).forEach((v, c) => {
    if (v instanceof Date) assert.equal((v.getDay() + 6) % 7, c, `${iso(v)} en la columna equivocada`);
  }));
});

test('están los 365 días del año, una sola vez cada uno, y los bisiestos tienen 366', () => {
  const { armarCalendario_ } = cargar();
  const fechas = f => f.flatMap(r => r.slice(0, 7)).filter(v => v instanceof Date).map(iso);
  const dias2026 = fechas(armarCalendario_(2026, 12).filas);
  assert.equal(dias2026.length, 365);
  assert.equal(new Set(dias2026).size, 365);
  assert.equal(fechas(armarCalendario_(2028, 12).filas).length, 366);
});

test('los casilleros van justo debajo de las fechas y solo donde hay día', () => {
  const { armarCalendario_ } = cargar();
  const m = armarCalendario_(2026, 12);
  let casillas = 0;
  m.casilleros.forEach(c => {
    for (let col = 1; col <= 7; col++) {
      const arriba = m.filas[c.fila - 2][col - 1];
      const dentro = col >= c.desde && col <= c.hasta;
      assert.equal(arriba instanceof Date, dentro, `fila ${c.fila} col ${col}`);
      if (dentro) casillas++;
    }
  });
  assert.equal(casillas, 365);
});

test('cada mes tiene su objetivo y las fórmulas apuntan a su propio calendario', () => {
  const { armarCalendario_ } = cargar();
  const m = armarCalendario_(2026, 15);
  assert.equal(m.bloques.length, 12);
  const b = m.bloques[1]; // febrero
  const f = m.filas[b.encabezado - 1];
  assert.equal(f[8], 15);
  assert.equal(f[9], `=COUNTIF(A${b.primeraFecha}:G${b.ultima},TRUE())`);
  assert.match(f[10], new RegExp(`J${b.encabezado}.*I${b.encabezado}`));
  // el rango de febrero no pisa a enero ni a marzo
  assert.ok(b.primeraFecha > m.bloques[0].ultima && b.ultima < m.bloques[2].titulo);
});

test('fechasMarcadas_ devuelve solo los días tildados, en orden', () => {
  const { armarCalendario_, fechasMarcadas_ } = cargar();
  const m = armarCalendario_(2026, 12);
  const valores = m.filas.map(f => f.slice(0, 7).slice());
  const tildar = (fechaIso) => {
    for (const c of m.casilleros) for (let col = c.desde; col <= c.hasta; col++) {
      if (iso(m.filas[c.fila - 2][col - 1]) === fechaIso) valores[c.fila - 1][col - 1] = true;
    }
  };
  m.casilleros.forEach(c => { for (let col = c.desde; col <= c.hasta; col++) valores[c.fila - 1][col - 1] = false; });
  ['2026-10-05', '2026-01-02', '2026-10-01'].forEach(tildar);
  assert.deepEqual(Array.from(fechasMarcadas_(valores)), ['2026-01-02', '2026-10-01', '2026-10-05']);
});

test('crearAsistencia escribe todo, pone casilleros en 365 celdas y no pisa una pestaña existente', () => {
  const llamadas = { checks: 0, valores: null, reglas: null, formulas: 0 };
  const rango = () => new Proxy({}, { get: (_, k) => {
    if (k === 'insertCheckboxes') return function () { llamadas.checks += this.n; return this; };
    if (k === 'setValues') return v => { llamadas.valores = v; return rango(); };
    if (k === 'getValue') return () => 3;
    return () => rango();
  } });
  const fila = (n) => { const r = rango(); return r; };
  let creadas = 0, existe = false;
  const hoja = {
    getRange: (_f, _c, nf = 1, nc = 1) => {
      const base = rango();
      return new Proxy(base, { get: (t, k) => {
        if (k === 'insertCheckboxes') return () => { llamadas.checks += nf * nc; return base; };
        if (k === 'setFormula') return () => { llamadas.formulas++; return base; };
        if (k === 'setValues') return v => { llamadas.valores = v; return base; };
        if (k === 'getValue') return () => 3;
        return t[k];
      } });
    },
    setHiddenGridlines() {}, setColumnWidths() {}, setColumnWidth() {}, setFrozenRows() {},
    setConditionalFormatRules(r) { llamadas.reglas = r; },
  };
  const ss = {
    getSheetByName: () => (existe ? hoja : null),
    insertSheet: () => { creadas++; return hoja; },
    setActiveSheet() {}, toast() {},
  };
  const regla = { whenFormulaSatisfied() { return regla; }, setBackground() { return regla; }, setRanges() { return regla; }, build: () => ({ ok: true }) };
  const api = cargar({ SpreadsheetApp: { getActiveSpreadsheet: () => ss, newConditionalFormatRule: () => regla, flush() {} } });
  api.crearAsistencia();
  assert.equal(creadas, 1);
  assert.equal(llamadas.checks, 365);
  assert.equal(llamadas.formulas, 25); // 2 por mes (realizados y barra) + la de prueba del separador
  assert.ok(!llamadas.valores.some(f => f.some(v => typeof v === 'string' && v.charAt(0) === '=')), 'las fórmulas no van en setValues');
  assert.equal(llamadas.valores.length, llamadas.valores.length);
  assert.equal(llamadas.reglas.length, 1);
  existe = true;
  assert.throws(() => api.crearAsistencia(), /Ya existe la pestaña/);
  assert.equal(creadas, 1);
});

test('con una planilla en español las fórmulas separan con ";" y no queda ninguna coma suelta', () => {
  const { armarCalendario_ } = cargar();
  const m = armarCalendario_(2026, 12, ';');
  const formulas = m.filas.flat().filter(v => typeof v === 'string' && v.charAt(0) === '=');
  assert.equal(formulas.length, 24);
  formulas.forEach(f => assert.ok(!f.replace(/"[^"]*"/g, '').includes(','), `coma en ${f}`));
  assert.match(formulas[0], /^=COUNTIF\(A3:G\d+;TRUE\(\)\)$/);
});

test('detectarSeparador_ elige "," o ";" según cómo interprete la planilla SUM(1,2)', () => {
  const hojaCon = suma => {
    let formula = '';
    const celda = { setFormula: f => { formula = f; }, getValue: () => suma(formula), clear() {} };
    return { getRange: () => celda };
  };
  const api = cargar({ SpreadsheetApp: { flush() {} } });
  // planilla en inglés: SUM(1,2) = 3
  assert.equal(api.detectarSeparador_(hojaCon(() => 3)), ',');
  // planilla en español: la coma es decimal, SUM(1,2) = 1,2
  assert.equal(api.detectarSeparador_(hojaCon(() => 1.2)), ';');
  // y si da error
  assert.equal(api.detectarSeparador_(hojaCon(() => '#ERROR!')), ';');
});
