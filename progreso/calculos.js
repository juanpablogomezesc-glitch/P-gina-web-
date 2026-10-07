// Cálculos del dashboard de progreso. Funciones puras: reciben las series cargadas y devuelven números.
// Una "serie" es una fila de la planilla: { semana: 101, ejercicio: 'Sentadilla C/B', kg: 100, reps: 5 }.
// La semana es el número de la pestaña ("Semana 101"): el progreso de los ejercicios no necesita fechas.
// Las fechas reales vienen solo de la asistencia: ['2026-10-05', ...] (el calendario de tildes).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Progreso = fabrica();
})(this, function () {
  const EJERCICIOS = ['Sentadilla C/B', 'Press plano C/B', 'Despegue C/B', 'Hip Trust C/B'];
  const MAX_REPS_ESTIMABLES = 10; // más de 10 repeticiones: la fórmula pierde precisión, no se usa
  const DIAS_PARA_SEMANA_COMPLETA = 3;
  const DIA_MS = 24 * 60 * 60 * 1000;

  /** Para comparar nombres sin importar mayúsculas, tildes ni espacios de más. */
  const clave = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const es = (s, ejercicio) => clave(s.ejercicio) === clave(ejercicio);

  const aFecha = iso => new Date(iso + 'T00:00:00Z');
  const aIso = d => d.toISOString().slice(0, 10);

  /** 1RM estimado con la fórmula de Epley: kg × (1 + reps/30). Con 1 repetición es el mismo peso. */
  function epley(kg, reps) {
    if (!(kg > 0) || !(reps >= 1)) return null;
    if (reps === 1) return kg;
    if (reps > MAX_REPS_ESTIMABLES) return null;
    return Math.round(kg * (1 + reps / 30) * 2) / 2; // redondeado a 0,5 kg
  }

  /** Lunes de la semana de una fecha (las semanas del calendario van de lunes a domingo). */
  function lunes(iso) {
    const d = aFecha(iso);
    const dia = (d.getUTCDay() + 6) % 7; // 0 = lunes
    return aIso(new Date(d.getTime() - dia * DIA_MS));
  }

  /** Series desde la semana `desde` en adelante (null = todas). */
  const desdeSemana = (series, desde) => (desde ? series.filter(s => s.semana >= desde) : series);

  /** Mejor 1RM estimado de cada semana, para un ejercicio. Devuelve [{ semana, valor }] en orden. */
  function rmPorSemana(series, ejercicio) {
    const porSemana = new Map();
    series.filter(s => es(s, ejercicio)).forEach(s => {
      const rm = epley(s.kg, s.reps);
      if (rm === null) return;
      if (!porSemana.has(s.semana) || rm > porSemana.get(s.semana)) porSemana.set(s.semana, rm);
    });
    return [...porSemana.entries()].sort((a, b) => a[0] - b[0]).map(([semana, valor]) => ({ semana, valor }));
  }

  /** Récord personal: el mayor peso levantado (a igualdad, el de más repeticiones; a igualdad, el más reciente). */
  function recordPersonal(series, ejercicio) {
    let mejor = null;
    series.filter(s => es(s, ejercicio) && s.kg > 0 && s.reps >= 1).forEach(s => {
      if (!mejor || s.kg > mejor.kg || (s.kg === mejor.kg && (s.reps > mejor.reps || (s.reps === mejor.reps && s.semana > mejor.semana)))) mejor = s;
    });
    return mejor && { kg: mejor.kg, reps: mejor.reps, semana: mejor.semana };
  }

  /** Para cada cantidad de repeticiones, el mayor peso levantado con "al menos" esas repeticiones. */
  function mejoresPorReps(series, ejercicio, cantidades) {
    const resultado = {};
    cantidades.forEach(n => {
      let mejor = null;
      series.filter(s => es(s, ejercicio) && s.reps >= n && s.kg > 0).forEach(s => {
        if (!mejor || s.kg > mejor.kg || (s.kg === mejor.kg && s.semana > mejor.semana)) mejor = s;
      });
      resultado[n] = mejor && { kg: mejor.kg, semana: mejor.semana };
    });
    return resultado;
  }

  /** Resumen de un ejercicio: 1RM de la última semana con datos y cuánto cambió desde la primera del período. */
  function resumenEjercicio(series, ejercicio) {
    const semanas = rmPorSemana(series, ejercicio);
    if (!semanas.length) return { semanas, actual: null, cambio: null, record: recordPersonal(series, ejercicio) };
    const actual = semanas[semanas.length - 1].valor;
    const cambio = semanas.length > 1 ? Math.round((actual - semanas[0].valor) * 2) / 2 : null;
    return { semanas, actual, cambio, record: recordPersonal(series, ejercicio) };
  }

  /** Primera semana de un período de las últimas N semanas (null = todo). Cuenta números de semana, no fechas. */
  function desdeUltimasSemanas(series, semanas) {
    if (!semanas || !series.length) return null;
    return Math.max(...series.map(s => s.semana)) - semanas + 1;
  }

  // ---- Asistencia (fechas 'AAAA-MM-DD' tildadas en el calendario) ----

  const diasEntrenados = fechas => new Set(fechas).size;

  /** Días entrenados por mes: → [{ mes: '2026-09', cantidad }] en orden (los repetidos cuentan una vez). */
  function diasPorMes(fechas) {
    const cuenta = new Map();
    [...new Set(fechas)].forEach(f => cuenta.set(f.slice(0, 7), (cuenta.get(f.slice(0, 7)) || 0) + 1));
    return [...cuenta.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, cantidad]) => ({ mes, cantidad }));
  }

  /** Semanas (lunes a domingo) con al menos `minimo` días entrenados. */
  function semanasCompletas(fechas, minimo = DIAS_PARA_SEMANA_COMPLETA) {
    const porSemana = new Map();
    [...new Set(fechas)].forEach(f => { const l = lunes(f); porSemana.set(l, (porSemana.get(l) || 0) + 1); });
    return [...porSemana.values()].filter(n => n >= minimo).length;
  }

  return { EJERCICIOS, MAX_REPS_ESTIMABLES, DIAS_PARA_SEMANA_COMPLETA, epley, lunes, desdeSemana, rmPorSemana, recordPersonal,
    mejoresPorReps, resumenEjercicio, desdeUltimasSemanas, diasEntrenados, diasPorMes, semanasCompletas };
});
