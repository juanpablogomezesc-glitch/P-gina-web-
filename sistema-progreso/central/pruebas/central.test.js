// Ejecutar con: node --test sistema-progreso/central/pruebas/central.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CODIGO = fs.readFileSync(path.join(__dirname, '..', 'Central.gs'), 'utf8');
const ID_A = 'planillaAlumnaAAAAAAAAAAAAAAAAAAAAAA';
const ID_B = 'planillaAlumnoBBBBBBBBBBBBBBBBBBBBBB';
const CLAVE_A = 'AbCdEfGhJkLmNpQrStUvWxYz';   // 24 caracteres
const CLAVE_B = 'zYxWvUtSrQpNmLkJhGfEdCbA';

// ---- planillas falsas ----
const hoja = (nombre, filas, { maxFilas } = {}) => ({
  getName: () => nombre,
  getMaxRows: () => maxFilas || filas.length,
  getLastRow: () => filas.length,
  getRange: (f, c, nf, nc) => ({
    getValues: () => Array.from({ length: Math.min(nf, filas.length - f + 1) }, (_, i) => {
      const fila = filas[f - 1 + i] || [];
      return Array.from({ length: nc }, (_, j) => (fila[c - 1 + j] === undefined ? '' : fila[c - 1 + j]));
    }),
  }),
});
const planilla = hojas => ({ getSheets: () => hojas });
const fila = (nombre, ser, rep, ...kg) => ['', '', '', nombre, '', '', ser, rep, ...kg];
const ENCABEZADO_NUEVO = ['', '', '', 'Ejercicios ', 'Obs', '', 'SER', 'REP', 'KG', '', '', 'RIR'];
const ENCABEZADO_VIEJO = ['', '', '', 'Ejercicios ', 'Obs', '', 'Ser', 'Repeticiones ', '', '', '', '', '', 'Kilogramos'];
const semana = (n, filas, encabezado = ENCABEZADO_NUEVO) => hoja(`Semana ${n}`, [encabezado, ['', '', '', 'DÍA 1 '], ...filas]);

function entorno({ alumnos = [], planillas = {}, enlaces = {} } = {}) {
  const celdasCache = new Map();
  const filasAlumnos = [['Nombre', 'Email', 'Planilla (link o ID)', 'Clave', 'Link'], ...alumnos];
  const avisos = [];
  const hojaAlumnos = {
    getName: () => 'Alumnos',
    getLastRow: () => filasAlumnos.length,
    getRange: (f, c, nf = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nf }, (_, i) => Array.from({ length: nc }, (_, j) => (filasAlumnos[f - 1 + i] || [])[c - 1 + j] ?? '')),
      // una celda con ficha/link de Drive muestra el nombre del archivo, pero guarda la dirección real
      getRichTextValues: () => Array.from({ length: nf }, (_, i) => [{ getLinkUrl: () => enlaces[f - 1 + i] || null }]),
      setValues: v => v.forEach((fila, i) => fila.forEach((x, j) => { (filasAlumnos[f - 1 + i] = filasAlumnos[f - 1 + i] || [])[c - 1 + j] = x; })),
    }),
  };
  const ss = { getSheetByName: n => (n === 'Alumnos' ? hojaAlumnos : null), toast: t => avisos.push(t) };
  const lecturas = { n: 0 };
  const ctx = vm.createContext({
    Date, Math, Error, JSON, Map, Set, Logger: { log() {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: id => { lecturas.n++; if (!planillas[id]) throw new Error('sin acceso'); return planillas[id]; },
    },
    CacheService: { getScriptCache: () => ({ get: k => (celdasCache.has(k) ? celdasCache.get(k) : null), put: (k, v) => celdasCache.set(k, v) }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ texto: t, setMimeType() { return this; } }) },
  });
  vm.runInContext(CODIGO + '\n;this.__api = { leerSemana_, esFormatoNuevo_, leerReps_, fechasMarcadas_, objetivosMensuales_, leerPlanilla_, doGet, idDePlanilla_, generarClaves };', ctx);
  const get = parametros => JSON.parse(ctx.__api.doGet({ parameter: parametros }).texto);
  return { api: ctx.__api, get, lecturas, cache: celdasCache, filas: filasAlumnos, avisos };
}

// ---- lectura de pestañas ----
test('un kilo vale para todas las series; un kilo por serie; el nombre se limpia', () => {
  const { api } = entorno();
  const r = api.leerSemana_([ENCABEZADO_NUEVO, ['', '', '', 'DÍA 1 '], fila('Sentadilla  C/B ', 3, 1, 120), fila('Dominadas Supinas', 3, 3, 10, 12.5, 15)]);
  assert.deepEqual(Array.from(r, s => [s.ejercicio, s.kg, s.reps, s.dia]), [
    ['Sentadilla C/B', 120, 1, 1], ['Sentadilla C/B', 120, 1, 1], ['Sentadilla C/B', 120, 1, 1],
    ['Dominadas Supinas', 10, 3, 1], ['Dominadas Supinas', 12.5, 3, 1], ['Dominadas Supinas', 15, 3, 1]]);
});

test('"5   C/L" son 5 repeticiones; tiempos, "-" y títulos de bloque no generan series', () => {
  const { api } = entorno();
  assert.deepEqual(JSON.parse(JSON.stringify(api.leerReps_('5   C/L'))), { reps: 5, porLado: true });
  assert.equal(api.leerReps_('30"'), null);
  const r = api.leerSemana_([ENCABEZADO_NUEVO, ['', '', '', 'DÍA 2'], ['', '', '', 'PRESS PLANO'], fila('Plancha', 3, '30"', 10), fila('Remo en TRX', 3, 12, '-'), fila('Remo', 3, '8 C/L', 35)]);
  assert.equal(r.length, 3);
});

test('detecta el formato nuevo por el encabezado y descarta el viejo', () => {
  const { api } = entorno();
  assert.equal(api.esFormatoNuevo_([ENCABEZADO_NUEVO]), true);
  assert.equal(api.esFormatoNuevo_([['', '', '', 'Ejercicios ', 'Obs', '', 'Ser', 'Rep', 'Kilogramos']]), true);
  assert.equal(api.esFormatoNuevo_([ENCABEZADO_VIEJO]), false);
});

// ---- asistencia ----
test('fechas tildadas: solo las de casilleros en true, en orden', () => {
  const { api } = entorno();
  const d = (m, dia) => new Date(2026, m - 1, dia);
  const valores = [
    ['ENERO 2026'], ['LUN'],
    ['', '', '', d(1, 1), d(1, 2)], ['', '', '', true, false],
    [d(1, 5), d(1, 6)], [true, true],
  ];
  assert.deepEqual(Array.from(api.fechasMarcadas_(valores)), ['2026-01-01', '2026-01-05', '2026-01-06']);
});

test('objetivo de cada mes, leído de la fila de abajo del título', () => {
  const { api } = entorno();
  const v = [['OCTUBRE 2026', '', '', '', '', '', '', '', 'Objetivo'], ['LUN', '', '', '', '', '', '', '', 15], ['NOVIEMBRE 2026'], ['LUN', '', '', '', '', '', '', '', 0]];
  assert.deepEqual(JSON.parse(JSON.stringify(api.objetivosMensuales_(v))), { '2026-10': 15 }); // un 0 no es un objetivo
});

// ---- planilla completa ----
test('lee de la semana más nueva hacia atrás y se detiene en la primera pestaña con formato viejo', () => {
  const { api } = entorno();
  const ss = planilla([
    semana(94, [fila('Sentadilla C/B', 3, 5, 90)], ENCABEZADO_VIEJO),    // viejo: no se lee
    semana(95, [fila('Sentadilla C/B', 1, 5, 100)]),
    semana(97, [fila('Press Plano C/B', 1, 5, 80), fila('Remo en TRX', 3, 12, 40), fila('despegue c/b ', 2, 3, 140, 150)]),
    semana(96, [fila('Hip Trust C/B', 1, 6, 150)]),
    semana(93, [fila('Sentadilla C/B', 3, 5, 80)]),                       // detrás del viejo: tampoco
  ]);
  const r = api.leerPlanilla_(ss);
  assert.deepEqual(Array.from(r.series, s => [s.semana, s.ejercicio, s.kg, s.reps]), [
    [95, 'Sentadilla C/B', 100, 5], [96, 'Hip Trust C/B', 150, 6],
    [97, 'Press plano C/B', 80, 5], [97, 'Despegue C/B', 140, 3], [97, 'Despegue C/B', 150, 3]]);
  // el Remo en TRX no es de los 4 ejercicios del dashboard
});

test('también lee la asistencia y los objetivos', () => {
  const { api } = entorno();
  const asistencia = hoja('Asistencia 2026', [
    ['OCTUBRE 2026', '', '', '', '', '', '', '', 'Objetivo'], ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM', '', 12],
    [new Date(2026, 9, 5), new Date(2026, 9, 6)], [true, false],
  ]);
  const r = api.leerPlanilla_(planilla([semana(1, [fila('Sentadilla C/B', 1, 5, 60)]), asistencia]));
  assert.deepEqual(Array.from(r.asistencia), ['2026-10-05']);
  assert.deepEqual(JSON.parse(JSON.stringify(r.objetivos)), { '2026-10': 12 });
});

// ---- web app ----
const alumnos = [
  ['Ana', 'ana@ejemplo.com', `https://docs.google.com/spreadsheets/d/${ID_A}/edit`, CLAVE_A, ''],
  ['Beto', 'beto@ejemplo.com', ID_B, CLAVE_B, ''],
];
const planillas = {
  [ID_A]: planilla([semana(1, [fila('Sentadilla C/B', 1, 5, 60)])]),
  [ID_B]: planilla([semana(1, [fila('Sentadilla C/B', 1, 5, 200)])]),
};

test('con la clave correcta devuelve solo los datos de ese alumno', () => {
  const { get } = entorno({ alumnos, planillas });
  const a = get({ accion: 'progreso', clave: CLAVE_A });
  assert.equal(a.ok, true);
  assert.equal(a.nombre, 'Ana');
  assert.deepEqual(a.series.map(s => s.kg), [60]);
  const b = get({ accion: 'progreso', clave: CLAVE_B });
  assert.deepEqual(b.series.map(s => s.kg), [200]);
  assert.ok(!JSON.stringify(a).includes('ana@ejemplo.com'), 'no devuelve el email');
  assert.ok(!JSON.stringify(a).includes(ID_A), 'no devuelve el ID de la planilla');
});

test('claves mal formadas, inventadas o vacías no devuelven nada', () => {
  const { get, lecturas } = entorno({ alumnos, planillas });
  for (const clave of ['', 'corta', CLAVE_A + 'x', 'x'.repeat(24), CLAVE_A.toLowerCase(), undefined]) {
    const r = get({ accion: 'progreso', clave });
    assert.equal(r.ok, false, `clave ${clave}`);
    assert.ok(!('series' in r));
  }
  assert.equal(lecturas.n, 0, 'ni siquiera abrió una planilla');
  assert.equal(get({ accion: 'otra', clave: CLAVE_A }).ok, false);
});

test('tras demasiados intentos inventados se frena aun con una clave válida', () => {
  const { get } = entorno({ alumnos, planillas });
  for (let i = 0; i < 30; i++) get({ accion: 'progreso', clave: 'x'.repeat(24) });
  const r = get({ accion: 'progreso', clave: CLAVE_A });
  assert.equal(r.ok, false);
  assert.match(r.error, /Demasiados intentos/);
});

test('la segunda consulta usa la memoria y no vuelve a abrir la planilla', () => {
  const { get, lecturas } = entorno({ alumnos, planillas });
  get({ accion: 'progreso', clave: CLAVE_A });
  get({ accion: 'progreso', clave: CLAVE_A });
  assert.equal(lecturas.n, 1);
});

test('si la planilla no se puede abrir, responde un error sin detalles internos', () => {
  const { get } = entorno({ alumnos, planillas: {} });
  const r = get({ accion: 'progreso', clave: CLAVE_A });
  assert.equal(r.ok, false);
  assert.ok(!/sin acceso/.test(r.error));
});

test('el link o el ID de la planilla se reconocen', () => {
  const { api } = entorno();
  assert.equal(api.idDePlanilla_(`https://docs.google.com/spreadsheets/d/${ID_A}/edit?usp=drivesdk`), ID_A);
  assert.equal(api.idDePlanilla_(ID_B), ID_B);
  assert.equal(api.idDePlanilla_('hola'), '');
  assert.equal(api.idDePlanilla_(''), '');
});

// ---- generarClaves ----
test('generarClaves le pone clave y link a quien no tiene, sin tocar las claves que ya existen', () => {
  const { api, filas } = entorno({ alumnos: [
    ['Ana', 'a@x.com', ID_A, '', ''],
    ['Beto', 'b@x.com', ID_B, CLAVE_B, 'link-viejo'],
  ] });
  api.generarClaves();
  assert.match(filas[1][3], /^[a-zA-Z0-9]{24}$/);
  assert.equal(filas[1][4], 'https://juanpablogomezesc-glitch.github.io/P-gina-web-/progreso.html?c=' + filas[1][3]);
  assert.equal(filas[2][3], CLAVE_B);
  assert.equal(filas[2][4], 'link-viejo');
});

test('generarClaves reconoce la planilla aunque la celda sea una ficha de Drive con solo el nombre del archivo', () => {
  const { api, filas, avisos } = entorno({
    alumnos: [['Juan Pablo', 'jp@x.com', 'Juan Pablo Gomez', '', '']],
    enlaces: { 1: `https://docs.google.com/spreadsheets/d/${ID_A}/edit?usp=drivesdk` },
  });
  api.generarClaves();
  assert.match(filas[1][3], /^[a-zA-Z0-9]{24}$/);
  assert.match(avisos.join(' '), /1 alumno/);
});

test('generarClaves avisa por qué se saltea una fila: sin nombre o con un link que no reconoce', () => {
  const { api, filas, avisos } = entorno({ alumnos: [['', 'a@x.com', ID_A, '', ''], ['Beto', 'b@x.com', 'Juan Pablo Gomez', '', '']] });
  api.generarClaves();
  assert.equal(filas[1][3] || '', '');
  assert.equal(filas[2][3] || '', '');
  const texto = avisos.join(' ');
  assert.match(texto, /0 alumno/);
  assert.match(texto, /Fila 2: falta el nombre/);
  assert.match(texto, /Fila 3 \(Beto\): no reconozco el link/);
});

test('doGet también encuentra al alumno cuando su planilla es una ficha de Drive', () => {
  const { get } = entorno({
    alumnos: [['Ana', 'a@x.com', 'Mi planilla', CLAVE_A, '']],
    enlaces: { 1: `https://docs.google.com/spreadsheets/d/${ID_A}/edit` },
    planillas: { [ID_A]: planillas[ID_A] },
  });
  assert.equal(get({ accion: 'progreso', clave: CLAVE_A }).ok, true);
});
