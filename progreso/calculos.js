// Cálculos del dashboard de progreso. Funciones puras: reciben las series cargadas y devuelven números.
// Una "serie" es una fila del registro: { fecha: 'AAAA-MM-DD', ejercicio: 'Sentadilla', kg: 100, reps: 5 }.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Progreso = fabrica();
})(this, function () {
  const EJERCICIOS = ['Sentadilla C/B', 'Press plano C/B', 'Despegue C/B', 'Hip Trust C/B'];
  const MAX_REPS_ESTIMABLES = 10; // más de 10 repeticiones: la fórmula pierde precisión, no se usa
  const DIA_MS = 24 * 60 * 60 * 1000;

  /** Para comparar nombres sin importar mayúsculas, tildes ni espacios de más. */
  const clave = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
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

  /** Lunes de la semana de una fecha (las semanas van de lunes a domingo). */
  function lunes(iso) {
    const d = aFecha(iso);
    const dia = (d.getUTCDay() + 6) % 7; // 0 = lunes
    return aIso(new Date(d.getTime() - dia * DIA_MS));
  }

  function filtrar(series, desde, hasta) {
    return series.filter(s => (!desde || s.fecha >= desde) && (!hasta || s.fecha <= hasta));
  }

  /** Mejor 1RM estimado de cada semana, para un ejercicio. Devuelve [{ semana, valor }] en orden. */
  function rmPorSemana(series, ejercicio) {
    const porSemana = new Map();
    series.filter(s => es(s, ejercicio)).forEach(s => {
      const rm = epley(s.kg, s.reps);
      if (rm === null) return;
      const semana = lunes(s.fecha);
      if (!porSemana.has(semana) || rm > porSemana.get(semana)) porSemana.set(semana, rm);
    });
    return [...porSemana.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([semana, valor]) => ({ semana, valor }));
  }

  /** Récord personal: el mayor peso levantado (a igualdad, el de más repeticiones; a igualdad, el más reciente). */
  function recordPersonal(series, ejercicio) {
    let mejor = null;
    series.filter(s => es(s, ejercicio) && s.kg > 0 && s.reps >= 1).forEach(s => {
      if (!mejor || s.kg > mejor.kg || (s.kg === mejor.kg && (s.reps > mejor.reps || (s.reps === mejor.reps && s.fecha > mejor.fecha)))) mejor = s;
    });
    return mejor && { kg: mejor.kg, reps: mejor.reps, fecha: mejor.fecha };
  }

  /** Para cada cantidad de repeticiones, el mayor peso levantado con "al menos" esas repeticiones. */
  function mejoresPorReps(series, ejercicio, cantidades) {
    const resultado = {};
    cantidades.forEach(n => {
      let mejor = null;
      series.filter(s => es(s, ejercicio) && s.reps >= n && s.kg > 0).forEach(s => {
        if (!mejor || s.kg > mejor.kg || (s.kg === mejor.kg && s.fecha > mejor.fecha)) mejor = s;
      });
      resultado[n] = mejor && { kg: mejor.kg, fecha: mejor.fecha };
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

  /** Días entrenados por mes: ['2026-09-01', ...] → [{ mes: '2026-09', cantidad }] en orden (los repetidos cuentan una vez). */
  function diasPorMes(fechas) {
    const cuenta = new Map();
    [...new Set(fechas)].forEach(f => cuenta.set(f.slice(0, 7), (cuenta.get(f.slice(0, 7)) || 0) + 1));
    return [...cuenta.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, cantidad]) => ({ mes, cantidad }));
  }

  const semanasEntrenadas = series => new Set(series.map(s => lunes(s.fecha))).size;
  const diasCompletados = series => new Set(series.map(s => s.fecha)).size;

  /** Peso corporal: [{ fecha, kg }] → último valor y cambio desde el primero. */
  function resumenPeso(pesos) {
    const orden = [...pesos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (!orden.length) return { actual: null, cambio: null, puntos: [] };
    const actual = orden[orden.length - 1].kg;
    return { actual, cambio: orden.length > 1 ? Math.round((actual - orden[0].kg) * 10) / 10 : null, puntos: orden };
  }

  /** Fecha de inicio de un período de N semanas que termina en la última fecha con datos. */
  function desdeUltimasSemanas(series, semanas) {
    if (!semanas) return null;
    const ultima = series.map(s => s.fecha).sort().pop();
    return ultima ? lunes(aIso(new Date(aFecha(ultima).getTime() - (semanas - 1) * 7 * DIA_MS))) : null;
  }

  return { EJERCICIOS, MAX_REPS_ESTIMABLES, epley, lunes, filtrar, rmPorSemana, recordPersonal, mejoresPorReps,
    resumenEjercicio, diasPorMes, semanasEntrenadas, diasCompletados, resumenPeso, desdeUltimasSemanas };
});
