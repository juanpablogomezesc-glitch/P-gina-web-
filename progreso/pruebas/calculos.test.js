// Ejecutar con: node --test progreso/pruebas/calculos.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../calculos.js');

const s = (semana, ejercicio, kg, reps) => ({ semana, ejercicio, kg, reps });

test('1RM estimado (Epley): ejemplos conocidos y límites', () => {
  assert.equal(P.epley(100, 1), 100);          // una repetición: es el mismo peso
  assert.equal(P.epley(100, 5), 116.5);        // 100 × (1 + 5/30) = 116,67 → se redondea a 0,5
  assert.equal(P.epley(80, 10), 106.5);        // 80 × (1 + 10/30) = 106,67
  assert.equal(P.epley(60, 12), null);         // más de 10 repeticiones: no se estima
  assert.equal(P.epley(0, 5), null);
  assert.equal(P.epley(100, 0), null);
  assert.equal(P.epley('x', 5), null);
});

test('las semanas del calendario van de lunes a domingo', () => {
  assert.equal(P.lunes('2026-10-05'), '2026-10-05'); // lunes
  assert.equal(P.lunes('2026-10-07'), '2026-10-05'); // miércoles
  assert.equal(P.lunes('2026-10-11'), '2026-10-05'); // domingo
  assert.equal(P.lunes('2026-10-12'), '2026-10-12'); // lunes siguiente
  assert.equal(P.lunes('2026-01-01'), '2025-12-29'); // cruza el año
});

test('mejor 1RM de cada semana, por ejercicio y en orden numérico', () => {
  const series = [
    s(99, 'Sentadilla C/B', 100, 5), s(99, 'Sentadilla C/B', 110, 3), s(99, 'Press plano C/B', 60, 8),
    s(101, 'Sentadilla C/B', 105, 5), s(101, 'Sentadilla C/B', 90, 15), // 15 reps no cuenta
    s(100, 'Sentadilla C/B', 100, 1),
  ];
  const sem = P.rmPorSemana(series, 'Sentadilla C/B');
  assert.deepEqual(sem.map(x => x.semana), [99, 100, 101]); // 99, 100, 101 y no "100, 101, 99" como texto
  assert.equal(sem[0].valor, 121);   // 110 × (1 + 3/30) = 121; 100 × (1 + 5/30) = 116,5
  assert.equal(sem[2].valor, 122.5); // 105 × (1 + 5/30) = 122,5
  assert.equal(P.rmPorSemana(series, 'Despegue C/B').length, 0);
});

test('récord personal: mayor peso; a igualdad, más repeticiones', () => {
  const series = [s(1, 'Sentadilla C/B', 100, 5), s(2, 'Sentadilla C/B', 120, 1), s(3, 'Sentadilla C/B', 120, 3), s(3, 'Press plano C/B', 70, 5)];
  assert.deepEqual(P.recordPersonal(series, 'Sentadilla C/B'), { kg: 120, reps: 3, semana: 3 });
  assert.equal(P.recordPersonal(series, 'Despegue C/B'), null);
});

test('mejores marcas por repeticiones: cuenta las series con al menos esas repeticiones', () => {
  const series = [s(1, 'Sentadilla C/B', 100, 5), s(2, 'Sentadilla C/B', 120, 1), s(3, 'Sentadilla C/B', 110, 3)];
  const m = P.mejoresPorReps(series, 'Sentadilla C/B', [1, 3, 5, 8]);
  assert.equal(m[1].kg, 120);  // el mejor con 1 o más repeticiones
  assert.equal(m[3].kg, 110);  // 100×5 y 110×3 cuentan; 120×1 no
  assert.equal(m[5].kg, 100);
  assert.equal(m[5].semana, 1);
  assert.equal(m[8], null);    // nunca hizo 8 repeticiones
});

test('resumen del ejercicio: 1RM actual y cambio desde el inicio del período', () => {
  const series = [s(1, 'Hip Trust C/B', 100, 8), s(2, 'Hip Trust C/B', 110, 8), s(3, 'Hip Trust C/B', 120, 8)];
  const r = P.resumenEjercicio(series, 'Hip Trust C/B');
  assert.equal(r.actual, 152);   // 120 × (1 + 8/30) = 152
  assert.equal(r.cambio, 25.5);  // 152 − 126,5
  assert.equal(r.record.kg, 120);
  const vacio = P.resumenEjercicio(series, 'Sentadilla C/B');
  assert.equal(vacio.actual, null);
  assert.equal(P.resumenEjercicio([s(1, 'Hip Trust C/B', 100, 8)], 'Hip Trust C/B').cambio, null); // un solo dato: no hay cambio
});

test('el nombre del ejercicio se compara sin mayúsculas, tildes ni espacios de más', () => {
  const series = [{ semana: 100, ejercicio: 'Sentadilla  Búlgara C/M ', kg: 40, reps: 5 }];
  assert.equal(P.recordPersonal(series, 'sentadilla bulgara c/m').kg, 40);
});

test('el período "últimas N semanas" cuenta números de semana y termina en la última con datos', () => {
  const series = [s(90, 'Sentadilla C/B', 100, 5), s(102, 'Sentadilla C/B', 100, 5)];
  assert.equal(P.desdeUltimasSemanas(series, 8), 95);     // 95 a 102 son 8 semanas
  assert.equal(P.desdeUltimasSemanas(series, null), null); // "todo": sin límite
  assert.deepEqual(P.desdeSemana(series, 95).map(x => x.semana), [102]);
  assert.equal(P.desdeSemana(series, null).length, 2);
});

test('días entrenados no cuenta dos veces el mismo día', () => {
  assert.equal(P.diasEntrenados(['2026-10-05', '2026-10-05', '2026-10-07']), 2);
});

test('días entrenados por mes: ordenados y sin contar dos veces el mismo día', () => {
  const r = P.diasPorMes(['2026-09-14', '2026-08-30', '2026-09-02', '2026-09-02']);
  assert.deepEqual(r, [{ mes: '2026-08', cantidad: 1 }, { mes: '2026-09', cantidad: 2 }]);
});

test('semana completa: 3 días o más entre lunes y domingo, sin contar dos veces el mismo día', () => {
  const fechas = [
    '2026-10-05', '2026-10-07', '2026-10-09', // lunes, miércoles y viernes: completa
    '2026-10-12', '2026-10-14',                // solo 2 días: no
    '2026-10-19', '2026-10-19', '2026-10-20',  // el mismo día repetido cuenta una vez: 2 días, no
    '2026-11-01', '2026-11-02',                // domingo y lunes siguiente: cada uno cae en una semana distinta
  ];
  assert.strictEqual(P.semanasCompletas(fechas), 1);
  assert.strictEqual(P.semanasCompletas(fechas, 2), 3);
});

test('limpiarRespuesta descarta lo que no tiene la forma esperada y no deja pasar texto raro', () => {
  const r = P.limpiarRespuesta({
    nombre: '  <img src=x onerror=alert(1)> Pérez  ',
    series: [
      { semana: 99, ejercicio: 'sentadilla  c/b ', kg: 100, reps: 5 },     // válida (se normaliza el nombre)
      { semana: 99, ejercicio: 'Sentadilla C/B', kg: -5, reps: 5 },        // kg negativo
      { semana: 99, ejercicio: 'Sentadilla C/B', kg: 100, reps: 0 },       // reps 0
      { semana: '99', ejercicio: 'Sentadilla C/B', kg: 100, reps: 5 },     // semana como texto
      { semana: 99, ejercicio: '<b>Hack</b>', kg: 100, reps: 5 },          // vale: cualquier ejercicio es válido, se muestra siempre como texto
      { semana: 99, ejercicio: '', kg: 100, reps: 5 },                     // sin nombre
      { semana: 99, ejercicio: 7, kg: 100, reps: 5 },                      // nombre que no es texto
      { semana: 99, ejercicio: 'Sentadilla C/B', kg: 1e9, reps: 5 },       // peso imposible
      null, 'x', { kg: 1 },
    ],
    asistencia: ['2026-10-05', '2026-10-05', '2026-02-30', 'hoy', 5, '2026-1-5', '<script>'],
    objetivos: { '2026-10': 15, '2026-13': 10, '2026-09': 0, '2026-08': '12', 'x': 3 },
  });
  assert.deepEqual(r.series.map(x => x.ejercicio), ['sentadilla c/b', '<b>Hack</b>']);
  assert.deepEqual(r.asistencia, ['2026-10-05']);
  assert.deepEqual(r.objetivos, { '2026-10': 15 });
  assert.equal(r.nombre, '<img'); // solo la primera palabra; igual se muestra como texto, nunca como HTML
});

test('limpiarRespuesta aguanta respuestas vacías o de otro tipo', () => {
  for (const x of [null, undefined, 5, 'hola', [], {}, { series: 'x', asistencia: {}, objetivos: [] }]) {
    assert.deepEqual(P.limpiarRespuesta(x), { nombre: '', series: [], categorias: {}, asistencia: [], objetivos: {}, actualizado: '', rutina: '', rutinaSemana: null });
  }
});

// ---- récords, cambio semanal, racha, mensajes, "hace cuánto" ----

test('nuevo récord: solo si la última semana supera todo lo anterior (un solo dato no cuenta)', () => {
  const base = [s(1, 'Sentadilla C/B', 100, 5), s(2, 'Sentadilla C/B', 110, 3)];
  assert.equal(P.nuevoRecord(base, 'Sentadilla C/B').kg, 110);
  assert.equal(P.nuevoRecord(base, 'Sentadilla C/B').anterior, 100);
  assert.equal(P.nuevoRecord([...base, s(3, 'Sentadilla C/B', 105, 5)], 'Sentadilla C/B'), null);   // la última semana no superó los 110
  assert.equal(P.nuevoRecord([...base, s(3, 'Sentadilla C/B', 110, 8)], 'Sentadilla C/B'), null);   // igualar no es récord
  assert.equal(P.nuevoRecord([s(1, 'Sentadilla C/B', 100, 5)], 'Sentadilla C/B'), null);            // primer dato: nada con qué comparar
  assert.equal(P.nuevoRecord(base, 'Despegue C/B'), null);
  const dos = P.nuevoRecord([...base, s(3, 'Sentadilla C/B', 115, 1), s(3, 'Sentadilla C/B', 120, 1)], 'Sentadilla C/B');
  assert.deepEqual([dos.kg, dos.semana, dos.anterior], [120, 3, 110]);
});

test('récords recientes: solo los de la última semana con datos o la anterior', () => {
  const series = [
    s(1, 'Sentadilla C/B', 100, 5), s(8, 'Sentadilla C/B', 110, 5),   // récord, pero viejo (dos semanas antes de la última)
    s(1, 'Despegue C/B', 100, 5), s(10, 'Despegue C/B', 130, 3),      // récord de la última semana
    s(9, 'Press plano C/B', 60, 5), s(10, 'Press plano C/B', 70, 5),  // primer dato en la 9, récord en la 10
  ];
  const r = P.recordsRecientes(series);
  assert.deepEqual(r.map(x => x.ejercicio).sort(), ['Despegue C/B', 'Press plano C/B']);
  assert.deepEqual(P.recordsRecientes([]), []);
});

test('cambio semanal del 1RM entre las dos últimas semanas con datos', () => {
  const series = [s(97, 'Despegue C/B', 120, 5), s(99, 'Despegue C/B', 130, 5), s(100, 'Despegue C/B', 135, 5)];
  const c = P.cambioSemanal(series, 'Despegue C/B');
  assert.deepEqual([c.anteriorSemana, c.semana, c.actual, c.anterior, c.diferencia], [99, 100, 157.5, 151.5, 6]); // 135×5 → 157,5 · 130×5 → 151,5 (Epley, a 0,5)
  assert.equal(P.cambioSemanal([s(1, 'Despegue C/B', 100, 5)], 'Despegue C/B'), null);
});

test('racha: semanas completas seguidas; la semana en curso no corta la racha hasta que termina', () => {
  // semanas del 5/10, 12/10 y 19/10 con 3 días cada una; el 26/10 hay un día
  const fechas = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-26'];
  assert.deepEqual(P.rachaSemanas(fechas, '2026-10-27'), { racha: 3, diasSemanaActual: 1, faltan: 2 }); // la semana del 26 va por 1 día: no corta
  assert.equal(P.rachaSemanas([...fechas, '2026-10-28', '2026-10-30'], '2026-10-30').racha, 4);         // la completó: suma
  assert.equal(P.rachaSemanas(fechas, '2026-11-09').racha, 0);                                           // dos semanas sin entrenar: se corta
  assert.equal(P.rachaSemanas([], '2026-10-27').racha, 0);
  const salto = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-19', '2026-10-20', '2026-10-21']; // falta la semana del 12
  assert.equal(P.rachaSemanas(salto, '2026-10-21').racha, 1);
});

test('mensaje motivacional: prioridades y textos', () => {
  const m = P.mensajeMotivacional;
  assert.match(m({ hayDatos: false }), /Cuando empieces/);
  assert.match(m({ objetivoCumplido: true, record: { ejercicio: 'Despegue C/B', kg: 150 } }), /objetivo del mes/);  // el objetivo gana al récord
  assert.match(m({ record: { ejercicio: 'Despegue C/B', kg: 150 }, racha: 5, diasSemanaActual: 3 }), /Nuevo récord en Despegue: 150 kg/);
  assert.match(m({ racha: 5, diasSemanaActual: 3, faltan: 0 }), /5 semanas seguidas entrenando/);
  assert.match(m({ racha: 2, diasSemanaActual: 3, faltan: 0 }), /2 semanas seguidas\. Seguí/);
  assert.equal(m({ racha: 1, diasSemanaActual: 3, faltan: 0 }), 'Semana completa. Buen trabajo.');
  assert.match(m({ racha: 3, diasSemanaActual: 1, faltan: 2 }), /Llevás 3 semanas completas seguidas\. Te faltan 2 días/);
  assert.match(m({ racha: 3, diasSemanaActual: 2, faltan: 1 }), /Te falta 1 día/);
  assert.match(m({ racha: 0, diasSemanaActual: 1, faltan: 2 }), /Llevás 1 día esta semana\. Con 2 más/);
  assert.match(m({ racha: 0, diasSemanaActual: 0 }), /nueva oportunidad/);
  assert.doesNotMatch(m({ racha: 0, diasSemanaActual: 0 }), /undefined|NaN/);
});

test('"hace cuánto" en minutos, horas y días; fechas inválidas dan texto vacío', () => {
  const ahora = Date.parse('2026-10-14T12:00:00Z');
  assert.equal(P.haceCuanto('2026-10-14T11:59:40Z', ahora), 'hace un momento');
  assert.equal(P.haceCuanto('2026-10-14T11:55:00Z', ahora), 'hace 5 min');
  assert.equal(P.haceCuanto('2026-10-14T09:00:00Z', ahora), 'hace 3 h');
  assert.equal(P.haceCuanto('2026-10-13T11:00:00Z', ahora), 'hace 1 día');
  assert.equal(P.haceCuanto('2026-10-10T12:00:00Z', ahora), 'hace 4 días');
  assert.equal(P.haceCuanto('2026-10-14T13:00:00Z', ahora), 'hace un momento'); // un reloj adelantado no da números negativos
  assert.equal(P.haceCuanto('nunca', ahora), '');
  assert.equal(P.haceCuanto(undefined, ahora), '');
});

test('limpiarRespuesta conserva una fecha de actualización válida y descarta una inventada', () => {
  assert.equal(P.limpiarRespuesta({ actualizado: '2026-10-14T12:00:00.000Z' }).actualizado, '2026-10-14T12:00:00.000Z');
  assert.equal(P.limpiarRespuesta({ actualizado: 'ayer' }).actualizado, '');
  assert.equal(P.limpiarRespuesta({ actualizado: '1999-01-01' }).actualizado, '');
  assert.equal(P.limpiarRespuesta({ actualizado: 5 }).actualizado, '');
});

test('limpiarRespuesta solo acepta como rutina una planilla de Google, y descarta cualquier otra dirección', () => {
  const ID = '1u6rp_PwKUNYy-yCtVPYxuPjYEC6gEmhYucfauLoBwAE';
  const ok = `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=123456`;
  assert.deepEqual([P.limpiarRespuesta({ rutina: ok, rutinaSemana: 103 }).rutina, P.limpiarRespuesta({ rutina: ok, rutinaSemana: 103 }).rutinaSemana], [ok, 103]);
  assert.equal(P.limpiarRespuesta({ rutina: `https://docs.google.com/spreadsheets/d/${ID}/edit` }).rutina, `https://docs.google.com/spreadsheets/d/${ID}/edit`); // sin pestaña
  for (const mala of [
    'javascript:alert(1)', `http://docs.google.com/spreadsheets/d/${ID}/edit`, `https://evil.com/spreadsheets/d/${ID}/edit`,
    `https://docs.google.com.evil.com/spreadsheets/d/${ID}/edit`, `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=abc`,
    `https://docs.google.com/spreadsheets/d/${ID}/edit?x=1`, `https://docs.google.com/spreadsheets/d/corto/edit`, '', 5, null,
  ]) assert.equal(P.limpiarRespuesta({ rutina: mala, rutinaSemana: 5 }).rutina, '', String(mala));
  assert.equal(P.limpiarRespuesta({ rutina: ok, rutinaSemana: '103' }).rutinaSemana, null); // la semana tiene que ser un número
  assert.equal(P.limpiarRespuesta({ rutinaSemana: 103 }).rutinaSemana, null);               // sin link no hay semana
});

test('limpiarRespuesta junta nombres escritos distinto, recorta nombres largos y limpia las categorías', () => {
  const r = P.limpiarRespuesta({
    series: [
      { semana: 1, ejercicio: 'Despegue C/B', kg: 100, reps: 5 },
      { semana: 2, ejercicio: ' despegue  c/b ', kg: 110, reps: 5 },
      { semana: 2, ejercicio: 'x'.repeat(500), kg: 10, reps: 5 },
    ],
    categorias: { 'Despegue C/B': 'Piernas · cadera dominante', 'No está': 'Grupo', ['x'.repeat(500)]: 5, Remo: { a: 1 } },
  });
  assert.deepEqual(r.series.slice(0, 2).map(x => x.ejercicio), ['Despegue C/B', 'Despegue C/B']);
  assert.equal(r.series[2].ejercicio.length, 60);
  assert.deepEqual(r.categorias, { 'Despegue C/B': 'Piernas · cadera dominante' }); // solo de ejercicios que existen, con texto
  assert.deepEqual(P.limpiarRespuesta({ categorias: [1, 2] }).categorias, {});
});

test('agruparEjercicios deja siempre tren superior, tren inferior y core, y "Otros" al final', () => {
  const sr = (semana, ejercicio) => ({ semana, ejercicio, kg: 50, reps: 5 });
  const series = [sr(1, 'Remo en TRX'), sr(1, 'Press Plano C/B'), sr(2, 'Press Plano C/B'), sr(3, 'Press Plano C/B'), sr(1, 'Press Plano C/M'), sr(1, 'Sentadilla C/B'), sr(2, 'Sentadilla C/B'), sr(1, 'Swing'), sr(2, 'Swing'), sr(3, 'Swing'), sr(4, 'Swing')];
  const g = P.agruparEjercicios(series, { 'Press Plano C/B': 'Tren superior', 'Press Plano C/M': 'Tren superior', 'Sentadilla C/B': 'Tren inferior', Swing: 'Core' });
  assert.deepEqual(g.map(x => x.grupo), ['Tren superior', 'Tren inferior', 'Core', 'Otros']); // aunque Core tenga más semanas de datos
  assert.deepEqual(g[0].ejercicios, ['Press Plano C/B', 'Press Plano C/M']);
  assert.deepEqual(g[3].ejercicios, ['Remo en TRX']);
  assert.deepEqual(P.agruparEjercicios(series.slice(5, 7), { 'Sentadilla C/B': 'Tren inferior' }).map(x => x.grupo), ['Tren inferior']); // solo los que tienen datos
  assert.deepEqual(P.agruparEjercicios([], {}), []);
});

test('ejercicioInicial abre con uno de los 4 principales si hay datos, y si no con el más entrenado', () => {
  const sr = (semana, ejercicio) => ({ semana, ejercicio, kg: 50, reps: 5 });
  assert.equal(P.ejercicioInicial([sr(1, 'Remo'), sr(1, 'despegue c/b')], {}), 'despegue c/b');
  assert.equal(P.ejercicioInicial([sr(1, 'Remo'), sr(1, 'Prensa'), sr(2, 'Prensa')], {}), 'Prensa');
  assert.equal(P.ejercicioInicial([], {}), P.EJERCICIOS[0]);
});

test('recordsRecientes mira todos los ejercicios, no solo los 4 principales', () => {
  const sr = (semana, ejercicio, kg) => ({ semana, ejercicio, kg, reps: 5 });
  const r = P.recordsRecientes([sr(1, 'Prensa 45º', 100), sr(2, 'Prensa 45º', 120), sr(2, 'Sentadilla C/B', 90)]);
  assert.deepEqual(r.map(x => [x.ejercicio, x.kg]), [['Prensa 45º', 120]]); // la sentadilla no tiene una marca anterior para superar
});

test('semanasEntrenadas cuenta las semanas con pesos o con días tildados, lo que dé más', () => {
  const sr = semana => ({ semana, ejercicio: 'Prensa', kg: 50, reps: 5 });
  assert.equal(P.semanasEntrenadas([sr(1), sr(1), sr(2), sr(5)], []), 3);                          // 3 semanas distintas con pesos
  assert.equal(P.semanasEntrenadas([], ['2026-10-05', '2026-10-07', '2026-10-14']), 2);             // 2 semanas del calendario
  assert.equal(P.semanasEntrenadas([sr(1)], ['2026-10-05', '2026-10-14', '2026-10-21']), 3);        // gana el calendario
  assert.equal(P.semanasEntrenadas([], []), 0);
});
