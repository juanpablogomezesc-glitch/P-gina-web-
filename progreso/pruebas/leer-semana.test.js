const test = require('node:test');
const assert = require('node:assert');
const { leerSemana, leerReps } = require('../leer-semana.js');

const fila = (nombre, ser, rep, ...kg) => ['', '', '', nombre, '', '', ser, rep, ...kg];
const base = [['', '', '', 'Ejercicios'], ['', '', '', 'DÍA 1 '], ['', '', '', 'SENTADILLA']];

test('un kilo para todas las series se repite en cada una', () => {
  const r = leerSemana([...base, fila('Sentadilla C/B', 3, 1, 120)]);
  assert.deepStrictEqual(r.map(s => [s.kg, s.reps, s.dia]), [[120, 1, 1], [120, 1, 1], [120, 1, 1]]);
});
test('un kilo por serie', () => {
  const r = leerSemana([...base, fila('Dominadas Supinas', 3, 3, 10, 12.5, 15)]);
  assert.deepStrictEqual(r.map(s => s.kg), [10, 12.5, 15]);
});
test('espacios de más en el nombre y el día cambia con cada "DÍA"', () => {
  const r = leerSemana([...base, fila('Press  Plano C/B ', 1, 3, 80), ['', '', '', 'DÍA 2'], fila('Despegue C/B', 1, 1, 150)]);
  assert.deepStrictEqual(r.map(s => [s.ejercicio, s.dia]), [['Press Plano C/B', 1], ['Despegue C/B', 2]]);
});
test('"5   C/L" son 5 repeticiones por lado; tiempos y "-" se ignoran', () => {
  assert.deepStrictEqual(leerReps('5   C/L'), { reps: 5, porLado: true });
  assert.strictEqual(leerReps('30"'), null);
  const r = leerSemana([...base, fila('Plancha', 3, '30"', 10), fila('Remo en TRX', 3, 12, '-'), fila('Remo', 3, '8 C/L', 35)]);
  assert.strictEqual(r.length, 3);
  assert.strictEqual(r[0].porLado, true);
});
test('los títulos de bloque y las filas vacías no generan series', () => {
  assert.deepStrictEqual(leerSemana([...base, ['', '', '', ''], fila('Sentadilla C/B', '', '', '')]), []);
});
