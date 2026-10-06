// Ejecutar con: node --test progreso/pruebas
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../calculos.js');

const s = (fecha, ejercicio, kg, reps) => ({ fecha, ejercicio, kg, reps });

test('1RM estimado (Epley): ejemplos conocidos y límites', () => {
  assert.equal(P.epley(100, 1), 100);          // una repetición: es el mismo peso
  assert.equal(P.epley(100, 5), 116.5);        // 100 × (1 + 5/30) = 116,67 → se redondea a 0,5
  assert.equal(P.epley(80, 10), 106.5);        // 80 × (1 + 10/30) = 106,67
  assert.equal(P.epley(60, 12), null);         // más de 10 repeticiones: no se estima
  assert.equal(P.epley(0, 5), null);
  assert.equal(P.epley(100, 0), null);
  assert.equal(P.epley('x', 5), null);
});

test('las semanas van de lunes a domingo', () => {
  assert.equal(P.lunes('2026-10-05'), '2026-10-05'); // lunes
  assert.equal(P.lunes('2026-10-07'), '2026-10-05'); // miércoles
  assert.equal(P.lunes('2026-10-11'), '2026-10-05'); // domingo
  assert.equal(P.lunes('2026-10-12'), '2026-10-12'); // lunes siguiente
  assert.equal(P.lunes('2026-01-01'), '2025-12-29'); // cruza el año
});

test('mejor 1RM de cada semana, por ejercicio y en orden', () => {
  const series = [
    s('2026-10-06', 'Sentadilla', 100, 5), s('2026-10-08', 'Sentadilla', 110, 3), s('2026-10-08', 'Press plano', 60, 8),
    s('2026-10-13', 'Sentadilla', 105, 5), s('2026-10-14', 'Sentadilla', 90, 15), // 15 reps no cuenta
  ];
  const sem = P.rmPorSemana(series, 'Sentadilla');
  assert.deepEqual(sem.map(x => x.semana), ['2026-10-05', '2026-10-12']);
  assert.equal(sem[0].valor, 121);   // 110 × (1 + 3/30) = 121; 100 × (1 + 5/30) = 116,5
  assert.equal(sem[1].valor, 122.5); // 105 × (1 + 5/30) = 122,5
  assert.equal(P.rmPorSemana(series, 'Peso muerto').length, 0);
});

test('récord personal: mayor peso; a igualdad, más repeticiones', () => {
  const series = [s('2026-10-01', 'Sentadilla', 100, 5), s('2026-10-08', 'Sentadilla', 120, 1), s('2026-10-15', 'Sentadilla', 120, 3), s('2026-10-16', 'Press plano', 70, 5)];
  assert.deepEqual(P.recordPersonal(series, 'Sentadilla'), { kg: 120, reps: 3, fecha: '2026-10-15' });
  assert.equal(P.recordPersonal(series, 'Peso muerto'), null);
});

test('mejores marcas por repeticiones: cuenta las series con al menos esas repeticiones', () => {
  const series = [s('2026-10-01', 'Sentadilla', 100, 5), s('2026-10-08', 'Sentadilla', 120, 1), s('2026-10-15', 'Sentadilla', 110, 3)];
  const m = P.mejoresPorReps(series, 'Sentadilla', [1, 3, 5, 8]);
  assert.equal(m[1].kg, 120);  // el mejor con 1 o más repeticiones
  assert.equal(m[3].kg, 110);  // 100×5 y 110×3 cuentan; 120×1 no
  assert.equal(m[5].kg, 100);
  assert.equal(m[8], null);    // nunca hizo 8 repeticiones
});

test('resumen del ejercicio: 1RM actual y cambio desde el inicio del período', () => {
  const series = [s('2026-09-01', 'Hip thrust', 100, 8), s('2026-09-15', 'Hip thrust', 110, 8), s('2026-09-29', 'Hip thrust', 120, 8)];
  const r = P.resumenEjercicio(series, 'Hip thrust');
  assert.equal(r.actual, 152);   // 120 × (1 + 8/30) = 152
  assert.equal(r.cambio, 25.5);  // 152 − 126,5
  assert.equal(r.record.kg, 120);
  const vacio = P.resumenEjercicio(series, 'Sentadilla');
  assert.equal(vacio.actual, null);
  assert.equal(P.resumenEjercicio([s('2026-09-01', 'Hip thrust', 100, 8)], 'Hip thrust').cambio, null); // un solo dato: no hay cambio
});

test('semanas entrenadas y días completados no cuentan dos veces lo mismo', () => {
  const series = [s('2026-10-05', 'Sentadilla', 100, 5), s('2026-10-05', 'Press plano', 60, 5), s('2026-10-07', 'Peso muerto', 100, 5), s('2026-10-19', 'Sentadilla', 100, 5)];
  assert.equal(P.diasCompletados(series), 3);     // 2 series el mismo día cuentan 1
  assert.equal(P.semanasEntrenadas(series), 2);   // la semana del 12 no entrenó
});

test('peso corporal: último valor y cambio', () => {
  const r = P.resumenPeso([{ fecha: '2026-10-08', kg: 69.2 }, { fecha: '2026-09-01', kg: 70.5 }, { fecha: '2026-10-15', kg: 68.9 }]);
  assert.equal(r.actual, 68.9);
  assert.equal(r.cambio, -1.6);
  assert.deepEqual(P.resumenPeso([]), { actual: null, cambio: null, puntos: [] });
});

test('el período "últimas N semanas" termina en la última fecha con datos', () => {
  const series = [s('2026-08-03', 'Sentadilla', 100, 5), s('2026-10-14', 'Sentadilla', 100, 5)];
  assert.equal(P.desdeUltimasSemanas(series, 4), '2026-09-21'); // 4 semanas contando la del 12 de octubre
  assert.equal(P.desdeUltimasSemanas(series, null), null);      // "todo": sin límite
  assert.equal(P.filtrar(series, '2026-09-21').length, 1);
});

test('el nombre del ejercicio se compara sin mayúsculas, tildes ni espacios de más', () => {
  const series = [{ fecha: '2026-01-05', ejercicio: 'Sentadilla  Búlgara C/M ', kg: 40, reps: 5 }];
  assert.strictEqual(P.recordPersonal(series, 'sentadilla bulgara c/m').kg, 40);
});
