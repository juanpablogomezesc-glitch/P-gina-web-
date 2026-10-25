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
  const MAX_SERIES = 20000;  // tope de filas aceptadas del script central
  const MAX_DIAS = 400;      // tope de tildes de día aceptados (se conservan los más nuevos)
  const MAX_NOMBRE = 60;     // largo máximo del nombre de un ejercicio
  const DIA_MS = 24 * 60 * 60 * 1000;

  /** Para comparar nombres sin importar mayúsculas, tildes ni espacios de más. */
  // COPIA de claveNombre_ en Central.gs: tienen que dar siempre lo mismo (lo comprueba una prueba).
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

  /** Cuántos días distintos se entrenaron en cada semana (lunes a domingo): Map(lunes → cantidad). */
  function diasPorSemana(fechas) {
    const porSemana = new Map();
    [...new Set(fechas)].forEach(f => { const l = lunes(f); porSemana.set(l, (porSemana.get(l) || 0) + 1); });
    return porSemana;
  }

  /** Semanas (lunes a domingo) con al menos `minimo` días entrenados. */
  function semanasCompletas(fechas, minimo = DIAS_PARA_SEMANA_COMPLETA) {
    return [...diasPorSemana(fechas).values()].filter(n => n >= minimo).length;
  }

  /**
   * Días que necesita ESTA persona para completar la semana: los días de su rutina (los "DÍA n" de sus últimas semanas),
   * con tope en DIAS_PARA_SEMANA_COMPLETA. Quien entrena 2 días completa con 2; quien entrena 3, 4 o 5 completa con 3.
   * Sin datos de la rutina, vale el general.
   */
  function minimoSemana(dias) {
    const porSemana = new Map();
    (dias || []).forEach(d => porSemana.set(d.semana, Math.max(porSemana.get(d.semana) || 0, d.dia)));
    const ultimas = [...porSemana.keys()].sort((a, b) => a - b).slice(-3).map(n => porSemana.get(n));
    if (!ultimas.length) return DIAS_PARA_SEMANA_COMPLETA;
    const veces = new Map();
    ultimas.forEach(n => veces.set(n, (veces.get(n) || 0) + 1));
    let mejor = ultimas[ultimas.length - 1];   // si empatan, manda la semana más reciente
    veces.forEach((v, n) => { if (v > veces.get(mejor)) mejor = n; });
    return Math.max(1, Math.min(DIAS_PARA_SEMANA_COMPLETA, mejor));
  }

  // ---- Récords, cambio semanal, racha y mensajes ----

  /**
   * El último récord de peso del ejercicio: la semana más reciente en la que se levantó más que en todas las anteriores.
   * No tiene que ser la última semana con datos: una semana nueva que copia los mismos kilos de la anterior no supera nada,
   * y no por eso el récord de la semana pasada deja de ser reciente (de eso se ocupa recordsRecientes).
   * Con un solo dato no hay con qué comparar, así que no cuenta. Devuelve { kg, reps, semana, anterior } o null.
   */
  function nuevoRecord(series, ejercicio) {
    const mejorDeSemana = new Map();
    series.filter(s => es(s, ejercicio) && s.kg > 0 && s.reps >= 1).forEach(s => {
      const m = mejorDeSemana.get(s.semana);
      if (!m || s.kg > m.kg || (s.kg === m.kg && s.reps > m.reps)) mejorDeSemana.set(s.semana, s);
    });
    let tope = null, ultimo = null;
    [...mejorDeSemana.keys()].sort((a, b) => a - b).forEach(semana => {
      const m = mejorDeSemana.get(semana);
      if (tope !== null && m.kg > tope) ultimo = { kg: m.kg, reps: m.reps, semana, anterior: tope };
      if (tope === null || m.kg > tope) tope = m.kg;
    });
    return ultimo;
  }

  /** Nombres de los ejercicios de las series (sin repetir aunque estén escritos distinto), con el primero que aparece como nombre. */
  function nombresDeEjercicios(series) {
    const nombres = new Map();
    series.forEach(s => { if (!nombres.has(clave(s.ejercicio))) nombres.set(clave(s.ejercicio), s.ejercicio); });
    return [...nombres.values()];
  }

  /** Récords de todos los ejercicios que ocurrieron en la última semana con datos (o la anterior): [{ ejercicio, kg, reps, semana, anterior }]. */
  function recordsRecientes(series) {
    if (!series.length) return [];
    const ultima = Math.max(...series.map(s => s.semana));
    return nombresDeEjercicios(series).map(ejercicio => ({ ejercicio, ...nuevoRecord(series, ejercicio) }))
      .filter(r => r.kg && r.semana >= ultima - 1);
  }

  const SIN_GRUPO = 'Otros';
  const ORDEN_GRUPOS = ['Tren superior', 'Tren inferior', 'Core']; // siempre en este orden; cualquier otro grupo va después y "Otros" al final

  /**
   * Ordena los ejercicios del alumno por grupo para los selectores: [{ grupo, ejercicios: [nombre] }].
   * Los grupos van en el orden de ORDEN_GRUPOS y los ejercicios con más semanas de datos primero; lo que no tiene categoría va a "Otros", al final.
   */
  function agruparEjercicios(series, categorias) {
    const cat = new Map(Object.keys(categorias || {}).map(k => [clave(k), categorias[k]]));
    const semanas = new Map(); // ejercicio (clave) → semanas con datos
    series.forEach(s => { const k = clave(s.ejercicio); if (!semanas.has(k)) semanas.set(k, new Set()); semanas.get(k).add(s.semana); });
    const grupos = new Map();
    nombresDeEjercicios(series).forEach(nombre => {
      const g = cat.get(clave(nombre)) || SIN_GRUPO;
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(nombre);
    });
    const peso = g => g.ejercicios.reduce((a, n) => a + semanas.get(clave(n)).size, 0);
    const lista = [...grupos.entries()].map(([grupo, ejercicios]) => ({
      grupo,
      ejercicios: ejercicios.sort((a, b) => semanas.get(clave(b)).size - semanas.get(clave(a)).size || a.localeCompare(b, 'es')),
    }));
    const lugar = g => (g === SIN_GRUPO ? 99 : ORDEN_GRUPOS.indexOf(g) >= 0 ? ORDEN_GRUPOS.indexOf(g) : 50);
    return lista.sort((a, b) => lugar(a.grupo) - lugar(b.grupo) || peso(b) - peso(a) || a.grupo.localeCompare(b.grupo, 'es'));
  }

  /** Con qué ejercicio abrir: el primero de los 4 principales que tenga datos; si no, el que más semanas tenga. */
  function ejercicioInicial(series, categorias) {
    const grupos = agruparEjercicios(series, categorias);
    const todos = grupos.flatMap(g => g.ejercicios);
    const principal = EJERCICIOS.find(e => todos.some(n => clave(n) === clave(e)));
    return principal ? todos.find(n => clave(n) === clave(principal)) : (todos[0] || EJERCICIOS[0]);
  }

  /** Cambio del 1RM estimado entre las dos últimas semanas con datos del ejercicio, o null si hay menos de dos. */
  function cambioSemanal(series, ejercicio) {
    const sem = rmPorSemana(series, ejercicio);
    if (sem.length < 2) return null;
    const a = sem[sem.length - 1], b = sem[sem.length - 2];
    return { semana: a.semana, anteriorSemana: b.semana, actual: a.valor, anterior: b.valor, diferencia: Math.round((a.valor - b.valor) * 2) / 2 };
  }

  const restarSemana = iso => aIso(new Date(aFecha(iso).getTime() - 7 * DIA_MS));

  /**
   * Semanas completas seguidas. La semana en curso no corta la racha mientras no termine: si todavía no llegó a los días
   * necesarios, se cuenta desde la anterior. Devuelve { racha, diasSemanaActual, faltan }. `hoy` es 'AAAA-MM-DD'.
   */
  function rachaSemanas(fechas, hoy, minimo = DIAS_PARA_SEMANA_COMPLETA) {
    const porSemana = diasPorSemana(fechas);
    const actual = lunes(hoy);
    const diasSemanaActual = porSemana.get(actual) || 0;
    let cursor = diasSemanaActual >= minimo ? actual : restarSemana(actual);
    let racha = 0;
    while ((porSemana.get(cursor) || 0) >= minimo) { racha++; cursor = restarSemana(cursor); }
    return { racha, diasSemanaActual, minimo, faltan: Math.max(0, minimo - diasSemanaActual) };
  }

  /**
   * Total de semanas que la persona entrena desde que empezó: semanas con peso cargado en la planilla o con al menos un día
   * tildado en el calendario (lo que dé más, por si una de las dos fuentes está incompleta).
   */
  function semanasEntrenadas(series, fechas) {
    const conPesos = new Set(series.map(s => s.semana)).size;
    const conAsistencia = diasPorSemana(fechas).size;
    return Math.max(conPesos, conAsistencia);
  }

  const DIAS_AVISO_MEMBRESIA = 5; // con 5 días o menos, el aviso pasa a "por vencer"

  /**
   * Estado de la membresía a partir de su fecha de vencimiento ('AAAA-MM-DD') y de hoy. El día del vencimiento todavía vale.
   * → { estado: 'aldia' | 'porvencer' | 'vencida', dias, titulo, detalle } o null si no hay fecha.
   */
  function estadoMembresia(vence, hoy) {
    if (!fechaValida(vence) || !fechaValida(hoy)) return null;
    const dias = Math.round((aFecha(vence) - aFecha(hoy)) / DIA_MS);
    const plural = (n, u) => `${n} ${u}${n === 1 ? '' : 's'}`;
    if (dias < 0) return { estado: 'vencida', dias, titulo: 'Tu membresía está vencida', detalle: `Venció hace ${plural(-dias, 'día')}` };
    if (dias <= DIAS_AVISO_MEMBRESIA) {
      return { estado: 'porvencer', dias, titulo: 'Tu membresía está por vencer', detalle: dias === 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Te quedan ${plural(dias, 'día')}` };
    }
    return { estado: 'aldia', dias, titulo: 'Tu membresía está al día', detalle: `Te quedan ${plural(dias, 'día')}` };
  }

  /** Un mensaje corto según cómo viene la persona. Sin promesas ni comparaciones con otros. */
  function mensajeMotivacional({ racha = 0, diasSemanaActual = 0, faltan = DIAS_PARA_SEMANA_COMPLETA, minimo = DIAS_PARA_SEMANA_COMPLETA, objetivoCumplido = false, hayDatos = true } = {}) {
    if (!hayDatos) return 'Cuando empieces a entrenar, vas a ver acá tu progreso.';
    if (objetivoCumplido) return 'Cumpliste el objetivo del mes. Eso es constancia.';
    if (diasSemanaActual >= minimo) {
      return racha >= 4 ? `${racha} semanas seguidas entrenando. La fuerza se construye con constancia.`
        : racha >= 2 ? `${racha} semanas seguidas. Seguí con este ritmo.` : 'Semana completa. Buen trabajo.';
    }
    if (racha >= 2) return `Llevás ${racha} semanas completas seguidas. ${faltan === 1 ? 'Te falta 1 día' : `Te faltan ${faltan} días`} para sumar esta.`;
    if (diasSemanaActual > 0) return `Llevás ${diasSemanaActual} ${diasSemanaActual === 1 ? 'día' : 'días'} esta semana. Con ${faltan} más la completás.`;
    return 'Cada semana es una nueva oportunidad. Te esperamos en el próximo entrenamiento.';
  }

  // ---- Días de la rutina (tildes "DÍA n" de cada semana) ----

  const MIN_SEMANAS_PATRON = 3;   // semanas cerradas necesarias para hablar de un patrón: con menos, es casualidad
  const MAX_SEMANAS_PATRON = 6;   // se miran las últimas 6 semanas cerradas
  const MAX_SEMANAS_TIRA = 8;     // semanas que se dibujan

  const tasa = (h, p) => (p ? h / p : 0);

  /**
   * Recibe [{ semana, dia, hecho }] y devuelve null (sin datos) o
   * { tira: [{ semana, enCurso, dias: [{ dia, hecho }] }], porDia: [{ dia, hechos, planificados }], mensaje, semanasAnalizadas }.
   * `diasEstaSemana` = días tildados en el calendario esta semana (undefined si no hay calendario).
   * La semana en curso no cuenta como falta lo que todavía no hizo. El patrón se calcula con las anteriores
   * y solo si hay al menos MIN_SEMANAS_PATRON; si no, mensaje = null. Los tildes los marca la persona: es lo que ella declara.
   */
  function analizarDias(dias, { diasEstaSemana } = {}) {
    const porSemana = new Map();
    (Array.isArray(dias) ? dias : []).forEach(d => {
      if (!porSemana.has(d.semana)) porSemana.set(d.semana, new Map());
      const m = porSemana.get(d.semana);
      m.set(d.dia, m.get(d.dia) === true || d.hecho === true);
    });
    const semanas = [...porSemana.keys()].sort((a, b) => a - b);
    if (!semanas.length) return null;
    // La semana "en curso" es la última con algún día tildado, o la siguiente si todavía no se tildó nada esta semana (calendario).
    // Las semanas más nuevas que esa (la rutina creada por adelantado, todavía sin tildar) se ignoran: no son faltas.
    const conTilde = semanas.filter(n => [...porSemana.get(n).values()].some(Boolean));
    let ultima = semanas[semanas.length - 1];
    if (conTilde.length) {
      const act = conTilde[conTilde.length - 1];
      const siguiente = semanas.find(n => n > act);
      const empezoEstaSemana = diasEstaSemana !== undefined && diasEstaSemana >= 1;
      ultima = siguiente !== undefined && !empezoEstaSemana ? siguiente : act;
    }
    semanas.splice(semanas.indexOf(ultima) + 1);
    const lista = n => [...porSemana.get(n).entries()].sort((a, b) => a[0] - b[0]).map(([dia, hecho]) => ({ dia, hecho }));
    const tira = semanas.slice(-MAX_SEMANAS_TIRA).map(n => ({ semana: n, enCurso: n === ultima, dias: lista(n) }));

    const cerradas = semanas.slice(0, -1).slice(-MAX_SEMANAS_PATRON).map(n => ({ semana: n, dias: lista(n) }));
    const conteo = new Map();
    cerradas.forEach(s => s.dias.forEach(d => {
      const c = conteo.get(d.dia) || { dia: d.dia, hechos: 0, planificados: 0 };
      c.planificados++; if (d.hecho) c.hechos++;
      conteo.set(d.dia, c);
    }));
    const porDia = [...conteo.values()].sort((a, b) => a.dia - b.dia);
    const out = { tira, porDia, mensaje: null, semanasAnalizadas: cerradas.length };
    if (cerradas.length < MIN_SEMANAS_PATRON) return out;

    const hechos = porDia.reduce((a, c) => a + c.hechos, 0), planificados = porDia.reduce((a, c) => a + c.planificados, 0);
    const global = tasa(hechos, planificados);
    const N = cerradas.length;

    // Semanas en las que solo se hizo el Día 1
    const soloDia1 = cerradas.filter(s => s.dias.length > 1 && s.dias.every(d => d.hecho === (d.dia === 1))).length;
    // Primera mitad de la rutina contra la segunda (solo si hay 3 días o más)
    const k = porDia.length;
    const mitad = Math.ceil(k / 2);
    const grupo = pred => porDia.filter(pred).reduce((a, c) => ({ h: a.h + c.hechos, p: a.p + c.planificados }), { h: 0, p: 0 });
    const ini = grupo(c => porDia.indexOf(c) < mitad), fin = grupo(c => porDia.indexOf(c) >= mitad);
    const tIni = tasa(ini.h, ini.p), tFin = tasa(fin.h, fin.p);
    // El día que más se escapa
    const orden = [...porDia].sort((a, b) => tasa(a.hechos, a.planificados) - tasa(b.hechos, b.planificados) || b.dia - a.dia);
    const peor = orden[0], mejor = orden[orden.length - 1];
    const tPeor = tasa(peor.hechos, peor.planificados);
    // Un solo día que se escapa mientras el resto se hace bien (no es "cerrar flojo": puede ser cualquier día)
    const aislado = k >= 3 && tPeor <= 0.5 && tasa(orden[1].hechos, orden[1].planificados) >= 0.7;
    const mensajeDia = `El Día ${peor.dia} es el que más se te escapa. Si querés, lo vemos para que te quede cómodo.`;

    if (global === 1) out.mensaje = `Completaste todos los días de tus últimas ${N} semanas. Eso es constancia.`;
    else if (global >= 0.85) out.mensaje = 'Venís completando casi todos los días de tu rutina. Muy bien.';
    else if (soloDia1 >= Math.ceil(N / 2)) out.mensaje = 'En varias semanas hiciste solo el Día 1. Si algo te complica el resto de la semana, contáselo a tu entrenador y lo ajustamos.';
    else if (aislado) out.mensaje = mensajeDia;
    else if (k >= 3 && tIni >= 0.7 && tIni - tFin >= 0.3) out.mensaje = 'Arrancás la semana con todo, pero te cuesta cerrarla: los últimos días son los que más se te escapan.';
    else if (k >= 2 && tPeor <= 0.5 && tasa(mejor.hechos, mejor.planificados) - tPeor >= 0.3) out.mensaje = mensajeDia;
    else out.mensaje = `En tus últimas ${N} semanas hiciste ${hechos} de ${planificados} días de la rutina.`;
    return out;
  }

  /** "hace 5 min", "hace 2 h", "hace 3 días". Devuelve '' si la fecha no sirve. */
  function haceCuanto(iso, ahoraMs) {
    const t = Date.parse(iso);
    if (!isFinite(t)) return '';
    const seg = Math.max(0, Math.round((ahoraMs - t) / 1000));
    if (seg < 60) return 'hace un momento';
    const min = Math.round(seg / 60);
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  }

  // ---- Validación de lo que llega del script central (nunca se confía en el formato) ----

  const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  function fechaValida(t) {
    const m = typeof t === 'string' && FECHA_ISO.exec(t);
    if (!m) return false;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }

  /** Deja solo datos con la forma esperada: lo demás se descarta en silencio. Devuelve { nombre, series, categorias, asistencia, objetivos, actualizado, rutina, rutinaSemana }. */
  function limpiarRespuesta(r) {
    const x = r && typeof r === 'object' ? r : {};
    const lista = v => (Array.isArray(v) ? v : []);
    // Cualquier ejercicio: lo único que se exige es que sea un texto corto y razonable (se muestra como texto, nunca como HTML).
    const limpiarTexto = (t, largo) => (typeof t === 'string' ? t.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, largo) : ''); // eslint-disable-line no-control-regex
    const nombres = new Map(); // nombre comparable → primer nombre válido (así "despegue c/b" y "Despegue C/B" son el mismo)
    const series = lista(x.series).slice(-MAX_SERIES).map(s => {
      const ej = s && limpiarTexto(s.ejercicio, MAX_NOMBRE);
      if (!ej) return null;
      if (!nombres.has(clave(ej))) nombres.set(clave(ej), ej);
      return Number.isInteger(s.semana) && s.semana > 0 && s.semana < 10000 && typeof s.kg === 'number' && s.kg > 0 && s.kg <= 1000 &&
        Number.isInteger(s.reps) && s.reps >= 1 && s.reps <= 100 ? { semana: s.semana, ejercicio: nombres.get(clave(ej)), kg: s.kg, reps: s.reps } : null;
    }).filter(Boolean);
    const categorias = {};
    if (x.categorias && typeof x.categorias === 'object' && !Array.isArray(x.categorias)) {
      Object.keys(x.categorias).slice(0, 1000).forEach(k => {
        const nombre = nombres.get(clave(limpiarTexto(k, MAX_NOMBRE)));
        const g = limpiarTexto(x.categorias[k], 60);
        if (nombre && g) categorias[nombre] = g;
      });
    }
    const asistencia = [...new Set(lista(x.asistencia).filter(fechaValida))].sort();
    const dias = lista(x.dias).slice(-MAX_DIAS).map(d => d && Number.isInteger(d.semana) && d.semana > 0 && d.semana < 10000 &&
      Number.isInteger(d.dia) && d.dia >= 1 && d.dia <= 9 && typeof d.hecho === 'boolean' ? { semana: d.semana, dia: d.dia, hecho: d.hecho } : null).filter(Boolean);
    const objetivos = {};
    if (x.objetivos && typeof x.objetivos === 'object') {
      Object.keys(x.objetivos).forEach(k => {
        const v = x.objetivos[k];
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(k) && typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 31) objetivos[k] = v;
      });
    }
    // eslint-disable-next-line no-control-regex
    const nombre = typeof x.nombre === 'string' ? x.nombre.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().split(/\s+/)[0].slice(0, 30) : '';
    const t = typeof x.actualizado === 'string' ? Date.parse(x.actualizado) : NaN;
    const actualizado = isFinite(t) && t > Date.UTC(2020, 0, 1) ? new Date(t).toISOString() : '';
    // Solo se acepta una dirección de planilla de Google Docs: nunca otro sitio ni "javascript:".
    const RUTINA = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]{20,}\/edit(#gid=\d{1,12})?$/;
    const rutina = typeof x.rutina === 'string' && RUTINA.test(x.rutina) ? x.rutina : '';
    const rutinaSemana = rutina && Number.isInteger(x.rutinaSemana) && x.rutinaSemana > 0 && x.rutinaSemana < 10000 ? x.rutinaSemana : null;
    // Solo se acepta una fecha de vencimiento real; cualquier otra cosa (o nada) significa que no hay nada que mostrar.
    const vence = x.membresia && typeof x.membresia === 'object' && fechaValida(x.membresia.vence) ? x.membresia.vence : null;
    const membresia = vence ? { vence } : null;
    return { nombre, series, categorias, asistencia, objetivos, dias, actualizado, rutina, rutinaSemana, membresia };
  }

  return {
    // constantes
    EJERCICIOS, MIN_SEMANAS_PATRON, MAX_REPS_ESTIMABLES, DIAS_PARA_SEMANA_COMPLETA,
    // ejercicios
    epley, rmPorSemana, recordPersonal, mejoresPorReps, resumenEjercicio, desdeSemana, desdeUltimasSemanas,
    nuevoRecord, recordsRecientes, cambioSemanal, nombresDeEjercicios, agruparEjercicios, ejercicioInicial,
    // días entrenados, semanas y racha
    lunes, diasEntrenados, diasPorMes, diasPorSemana, semanasCompletas, semanasEntrenadas, minimoSemana, rachaSemanas, analizarDias,
    // textos y validación
    mensajeMotivacional, haceCuanto, limpiarRespuesta, estadoMembresia,
  };
});
