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
