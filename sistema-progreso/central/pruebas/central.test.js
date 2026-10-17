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
let proximoGid = 100;
const hoja = (nombre, filas, { maxFilas, oculta = false } = {}) => ({
  getName: () => nombre,
  getSheetId: (() => { const g = proximoGid++; return () => g; })(),
  isSheetHidden: () => oculta,
  getMaxRows: () => maxFilas || filas.length,
  getLastRow: () => filas.length,
  getRange: (f, c, nf, nc) => ({
    getValues: () => Array.from({ length: Math.min(nf, filas.length - f + 1) }, (_, i) => {
      const fila = filas[f - 1 + i] || [];
      return Array.from({ length: nc }, (_, j) => (fila[c - 1 + j] === undefined ? '' : fila[c - 1 + j]));
    }),
  }),
});
const ID_CATALOGO = /CATALOGO_ID = '([^']+)'/.exec(CODIGO)[1];
const planilla = hojas => ({ getSheets: () => hojas });
const fila = (nombre, ser, rep, ...kg) => ['', '', '', nombre, '', '', ser, rep, ...kg];
const ENCABEZADO_NUEVO = ['', '', '', 'Ejercicios ', 'Obs', '', 'SER', 'REP', 'KG', '', '', 'RIR'];
const ENCABEZADO_VIEJO = ['', '', '', 'Ejercicios ', 'Obs', '', 'Ser', 'Repeticiones ', '', '', '', '', '', 'Kilogramos'];
const semana = (n, filas, encabezado = ENCABEZADO_NUEVO, opciones) => hoja(`Semana ${n}`, [encabezado, ['', '', '', 'DÍA 1 '], ...filas], opciones);

function entorno({ alumnos = [], planillas = {}, enlaces = {} } = {}) {
  const celdasCache = new Map();
  const filasAlumnos = [['Nombre', 'Email', 'Planilla (link o ID)', 'Clave', 'Link'], ...alumnos];
  const avisos = [];
  const lecturasAlumnos = { n: 0 };
  const hojaAlumnos = {
    getName: () => 'Alumnos',
    getLastRow: () => filasAlumnos.length,
    getRange: (f, c, nf = 1, nc = 1) => ({
      getValues: () => (lecturasAlumnos.n++, null) || Array.from({ length: nf }, (_, i) => Array.from({ length: nc }, (_, j) => (filasAlumnos[f - 1 + i] || [])[c - 1 + j] ?? '')),
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
      openById: id => { if (id !== ID_CATALOGO) lecturas.n++; if (!planillas[id]) throw new Error('sin acceso'); return planillas[id]; },
    },
    CacheService: { getScriptCache: () => ({ get: k => (celdasCache.has(k) ? celdasCache.get(k) : null), put: (k, v) => celdasCache.set(k, v) }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ texto: t, setMimeType() { return this; } }) },
  });
  vm.runInContext(CODIGO + '\n;this.__api = { esHojaAsistencia_, leerSemana_, esFormatoNuevo_, leerReps_, fechasMarcadas_, objetivosMensuales_, leerPlanilla_, etiquetaCategoria_, armarCatalogo_, leerCatalogo_, doGet, idDePlanilla_, generarClaves, medirTiempos };', ctx);
  const get = parametros => JSON.parse(ctx.__api.doGet({ parameter: parametros }).texto);
  return { api: ctx.__api, get, lecturas, cache: celdasCache, filas: filasAlumnos, avisos, lecturasAlumnos };
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
  // ahora entran todos los ejercicios con peso; las 3 series iguales del Remo valen una sola vez
  assert.deepEqual(Array.from(r.series, s => [s.semana, s.ejercicio, s.kg, s.reps]), [
    [95, 'Sentadilla C/B', 100, 5], [96, 'Hip Trust C/B', 150, 6],
    [97, 'Press Plano C/B', 80, 5], [97, 'Remo en TRX', 40, 12], [97, 'despegue c/b', 140, 3], [97, 'despegue c/b', 150, 3]]);
  assert.deepEqual(JSON.parse(JSON.stringify(r.categorias)), {}, 'sin catálogo no hay categorías');
});

test('con catálogo usa el nombre del catálogo y agrega la categoría; lo que no está queda sin categoría', () => {
  const { api } = entorno();
  const catalogo = api.armarCatalogo_([
    ['Piernas_Rodilla_Dominante', 'Empuje_Tren_Superior', 'Core_Abdominales_Crunch'],
    ['Sentadilla C/B ', 'Press Plano C/B', 'Abdominales Sit Ups'],
    ['Prensa 45º', 'Press Plano C/M ', ''],
  ]);
  const ss = planilla([semana(1, [fila('sentadilla  c/b', 3, 5, 100), fila('Remo en TRX', 1, 12, 40), fila('press plano c/b', 1, 5, 80)]), semana(2, [fila('Sentadilla C/B', 1, 5, 100)])]);
  const r = api.leerPlanilla_(ss, catalogo);
  assert.deepEqual(Array.from(r.series, s => [s.semana, s.ejercicio, s.kg, s.reps]), [
    [1, 'Sentadilla C/B', 100, 5], [1, 'Remo en TRX', 40, 12], [1, 'Press Plano C/B', 80, 5], [2, 'Sentadilla C/B', 100, 5]]);
  assert.deepEqual(JSON.parse(JSON.stringify(r.categorias)), { 'Sentadilla C/B': 'Piernas · rodilla dominante', 'Press Plano C/B': 'Empuje · tren superior' });
});

test('los nombres de categoría quedan legibles', () => {
  const { api } = entorno();
  assert.equal(api.etiquetaCategoria_('Piernas_Rodilla_Dominante'), 'Piernas · rodilla dominante');
  assert.equal(api.etiquetaCategoria_('PLYO_BOX'), 'Plyo · box');
  assert.equal(api.etiquetaCategoria_('Med Ball '), 'Med ball');
  assert.equal(api.etiquetaCategoria_(''), '');
  assert.deepEqual(JSON.parse(JSON.stringify(api.armarCatalogo_([['', 'X_Y'], ['sin título', 'a'], ['', ' b  c ']]))), [{ nombre: 'a', categoria: 'X · y' }, { nombre: 'b c', categoria: 'X · y' }]);
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
  assert.ok(!JSON.stringify(a).includes(ID_B), 'no devuelve datos ni links de otro alumno');
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

test('probar muchas claves inventadas no bloquea a un alumno con su clave válida', () => {
  const { get } = entorno({ alumnos, planillas });
  for (let i = 0; i < 500; i++) assert.equal(get({ accion: 'progreso', clave: 'x'.repeat(23) + (i % 10) }).ok, false);
  assert.equal(get({ accion: 'progreso', clave: CLAVE_A }).ok, true);
});

test('las claves inventadas no leen la planilla de alumnos cada vez', () => {
  const { get, lecturasAlumnos } = entorno({ alumnos, planillas });
  for (let i = 0; i < 50; i++) get({ accion: 'progreso', clave: 'y'.repeat(23) + (i % 10) });
  assert.ok(lecturasAlumnos.n <= 2, `se leyó ${lecturasAlumnos.n} veces`); // la lista queda en memoria
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

// ---- última actualización y "Actualizar" ----
test('la respuesta dice cuándo se leyó la planilla', () => {
  const { get } = entorno({ alumnos, planillas });
  const r = get({ accion: 'progreso', clave: CLAVE_A });
  assert.ok(Math.abs(Date.now() - Date.parse(r.actualizado)) < 5000);
});

test('"fresco" no vuelve a leer la planilla si los datos tienen menos de 30 segundos', () => {
  const { get, lecturas } = entorno({ alumnos, planillas });
  get({ accion: 'progreso', clave: CLAVE_A });
  get({ accion: 'progreso', clave: CLAVE_A, fresco: '1' });
  get({ accion: 'progreso', clave: CLAVE_A, fresco: '1' });
  assert.equal(lecturas.n, 1);
});

test('"fresco" sí vuelve a leer la planilla cuando los datos guardados tienen más de 30 segundos', () => {
  const { get, lecturas, cache } = entorno({ alumnos, planillas });
  get({ accion: 'progreso', clave: CLAVE_A });
  const vieja = JSON.parse(cache.get('p_' + CLAVE_A));
  vieja.actualizado = new Date(Date.now() - 60000).toISOString();   // se leyó hace un minuto
  cache.set('p_' + CLAVE_A, JSON.stringify(vieja));
  get({ accion: 'progreso', clave: CLAVE_A });                        // sin "fresco" sigue usando lo guardado
  assert.equal(lecturas.n, 1);
  const r = get({ accion: 'progreso', clave: CLAVE_A, fresco: '1' });  // con "fresco" lee de nuevo
  assert.equal(lecturas.n, 2);
  assert.ok(Date.now() - Date.parse(r.actualizado) < 5000);
});

test('"fresco" con una clave inválida no devuelve nada ni lee planillas', () => {
  const { get, lecturas } = entorno({ alumnos, planillas });
  const r = get({ accion: 'progreso', clave: 'z'.repeat(24), fresco: '1' });
  assert.equal(r.ok, false);
  assert.equal(lecturas.n, 0);
});

// ---- la pestaña "Control Mensual" (la que usan los alumnos) ----
const calendarioControlMensual = nombre => hoja(nombre, [
  [new Date(2026, 9, 1), '', '', '', '', '', '', '', 'Objetivo', 'Realizados'],              // título: una fecha mostrada como mes
  ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM', '', 16],                                  // encabezado + objetivo en la columna I
  ['', '', '', new Date(2026, 9, 1), new Date(2026, 9, 2), new Date(2026, 9, 3), new Date(2026, 9, 4)],
  ['', '', '', true, false, true, false],
  [new Date(2026, 9, 5), new Date(2026, 9, 6)],
  [true, true],
]);

test('las pestañas "Control Mensual" y "Asistencia AAAA" cuentan; "Control Mensual (anterior)" no', () => {
  const { api } = entorno();
  assert.equal(api.esHojaAsistencia_('Control Mensual'), true);
  assert.equal(api.esHojaAsistencia_(' control mensual '), true);
  assert.equal(api.esHojaAsistencia_('Asistencia 2026'), true);
  assert.equal(api.esHojaAsistencia_('Control Mensual (anterior)'), false);
  assert.equal(api.esHojaAsistencia_('Semana 5'), false);
});

test('lee los días tildados y el objetivo de "Control Mensual", con el título del mes como fecha', () => {
  const { api } = entorno();
  const r = api.leerPlanilla_(planilla([semana(1, [fila('Sentadilla C/B', 1, 5, 60)]), calendarioControlMensual('Control Mensual')]));
  assert.deepEqual(Array.from(r.asistencia), ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-06']);
  assert.deepEqual(JSON.parse(JSON.stringify(r.objetivos)), { '2026-10': 16 });
});

test('la pestaña "Control Mensual (anterior)" no suma días', () => {
  const { api } = entorno();
  const r = api.leerPlanilla_(planilla([calendarioControlMensual('Control Mensual (anterior)')]));
  assert.deepEqual(Array.from(r.asistencia), []);
});

test('medirTiempos informa cada paso y el total, y pide una planilla si falta', () => {
  const { api } = entorno({ planillas: { [ID_A]: planilla([semana(1, [fila('Sentadilla C/B', 1, 5, 60)]), calendarioControlMensual('Control Mensual')]) } });
  const lineas = api.medirTiempos(ID_A);
  const texto = Array.from(lineas).join('\n');
  for (const paso of ['Abrir la planilla', 'Listar las pestañas', 'Leer el nombre de 2 pestañas', 'Lectura completa', 'Series leídas: 1 · días tildados: 4', 'TOTAL']) assert.ok(texto.includes(paso), paso);
  assert.throws(() => api.medirTiempos(''), /Pegá el link/);
});

// ---- botón "Mi rutina" ----
test('la respuesta trae el link de la planilla del alumno, abierto en la pestaña de la semana más nueva', () => {
  const nueva = semana(103, [fila('Sentadilla C/B', 1, 5, 60)]);
  const { get } = entorno({ alumnos, planillas: { [ID_A]: planilla([semana(102, []), nueva, semana(101, [])]), [ID_B]: planillas[ID_B] } });
  const r = get({ accion: 'progreso', clave: CLAVE_A });
  assert.equal(r.rutina, `https://docs.google.com/spreadsheets/d/${ID_A}/edit#gid=${nueva.getSheetId()}`);
  assert.equal(r.rutinaSemana, 103);
  assert.ok(!JSON.stringify(r).includes(ID_B), 'nada de otro alumno');
  assert.ok(!('semanaActual' in r), 'el dato interno no sale');
});

test('si la pestaña más nueva está oculta, el link abre la planilla sin apuntar a esa pestaña', () => {
  const { get } = entorno({ alumnos, planillas: { [ID_A]: planilla([semana(5, [], ENCABEZADO_NUEVO, { oculta: true })]) } });
  const r = get({ accion: 'progreso', clave: CLAVE_A });
  assert.equal(r.rutina, `https://docs.google.com/spreadsheets/d/${ID_A}/edit`);
  assert.equal(r.rutinaSemana, 5);
});

test('un alumno sin pestañas de semana recibe el link a la planilla y ninguna semana', () => {
  const { get } = entorno({ alumnos, planillas: { [ID_A]: planilla([]) } });
  const r = get({ accion: 'progreso', clave: CLAVE_A });
  assert.equal(r.rutina, `https://docs.google.com/spreadsheets/d/${ID_A}/edit`);
  assert.equal(r.rutinaSemana, null);
});

test('cada alumno recibe el link de su propia planilla y nunca el del otro', () => {
  const { get } = entorno({ alumnos, planillas });
  assert.ok(get({ accion: 'progreso', clave: CLAVE_A }).rutina.includes(ID_A));
  assert.ok(get({ accion: 'progreso', clave: CLAVE_B }).rutina.includes(ID_B));
  assert.ok(!get({ accion: 'progreso', clave: CLAVE_B }).rutina.includes(ID_A));
});

test('la respuesta del dashboard trae las categorías de los ejercicios del catálogo', () => {
  const catalogo = { getSheets: () => [{ getDataRange: () => ({ getValues: () => [['Piernas_Rodilla_Dominante', 'Empuje_Tren_Superior'], ['Sentadilla C/B', 'Press Plano C/B']] }) }] };
  const { get } = entorno({ alumnos, planillas: { ...planillas, [ID_CATALOGO]: catalogo } });
  const a = get({ accion: 'progreso', clave: CLAVE_A });
  assert.deepEqual(a.series.map(s => s.ejercicio), ['Sentadilla C/B']);
  assert.deepEqual(a.categorias, { 'Sentadilla C/B': 'Piernas · rodilla dominante' });
});

test('si el catálogo no se puede leer, el dashboard sigue funcionando sin categorías', () => {
  const { get } = entorno({ alumnos, planillas });
  const a = get({ accion: 'progreso', clave: CLAVE_A });
  assert.equal(a.ok, true);
  assert.deepEqual(a.categorias, {});
});
