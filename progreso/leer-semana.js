// Convierte una pestaña "Semana N" (formato nuevo, desde la semana 97) en series sueltas.
// Recibe la hoja como matriz de filas (lo que devuelve getValues()) y devuelve
// [{ dia, ejercicio, kg, reps, porLado }], una por cada serie realizada.
// Columnas: D ejercicio · G series · H repeticiones · I:K kilos (uno por serie, o uno solo para todas).
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.LeerSemana = fabrica();
})(this, function () {
  const COL = { ejercicio: 3, series: 6, reps: 7, kg0: 8, kgN: 10 };

  const limpiarNombre = t => String(t).replace(/\s+/g, ' ').trim();
  const numero = v => (typeof v === 'number' && isFinite(v) ? v : null);

  /** "5" → 5 · "5   C/L" → 5 (por lado) · '30"' / "1`" (tiempo) → null. */
  function leerReps(v) {
    if (numero(v) !== null) return { reps: v, porLado: false };
    const m = /^\s*(\d+)\s*(C\/L)?\s*$/i.exec(String(v == null ? '' : v));
    return m ? { reps: +m[1], porLado: !!m[2] } : null;
  }

  function leerSemana(filas) {
    const series = [];
    let dia = 0;
    filas.forEach((fila, i) => {
      if (i === 0) return; // encabezado
      const nombre = fila[COL.ejercicio];
      if (nombre === '' || nombre == null) return;
      if (/^D[ÍI]A\s*\d+/i.test(String(nombre).trim())) { dia = +/\d+/.exec(nombre)[0]; return; }
      const n = numero(fila[COL.series]);
      const r = leerReps(fila[COL.reps]);
      if (!dia || !n || !r) return; // títulos de bloque, tiempos y filas sin datos
      const kgs = [];
      for (let c = COL.kg0; c <= COL.kgN; c++) { const k = numero(fila[c]); if (k !== null) kgs.push(k); }
      if (!kgs.length) return; // "-" = peso corporal: no entra en las marcas de fuerza
      for (let s = 0; s < n; s++) {
        series.push({ dia, ejercicio: limpiarNombre(nombre), kg: kgs[Math.min(s, kgs.length - 1)], reps: r.reps, porLado: r.porLado });
      }
    });
    return series;
  }

  return { leerSemana, leerReps };
});
