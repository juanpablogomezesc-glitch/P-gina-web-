/**
 * Progreso · JP Entrenamiento — script central
 *
 * Lee la planilla de cada alumno (pestañas "Semana N" y calendario "Asistencia AAAA") y le entrega a la página
 * del dashboard solo los datos de ese alumno. Se instala UNA vez; las planillas de los alumnos no llevan código.
 *
 * Cómo se identifica cada alumno: en la pestaña "Alumnos" de esta planilla cada uno tiene una clave secreta
 * (un link personal). Quien no tiene el link no ve nada. No hay datos de nadie en el código.
 *
 * Pegalo en Extensiones > Apps Script de la planilla "Progreso · JP Entrenamiento".
 */

// ====== OPCIONES ======
const PAGINA = 'https://juanpablogomezesc-glitch.github.io/P-gina-web-/progreso.html'; // dónde está el dashboard
// Planilla con todos los ejercicios agrupados por categoría ("A Dashboard Excercise", en Online > Planillas). Solo se lee, nunca se modifica.
// Si queda vacío o no se puede abrir, el dashboard igual funciona: los ejercicios aparecen sin grupo ("Otros").
const CATALOGO_ID = '1s3DHYKr7bAW3KNeRgbyS14mpGr83Hf3ynBZL7cTuszg';
const SEGUNDOS_CATALOGO = 21600;     // el catálogo se vuelve a leer cada 6 horas
const SEGUNDOS_HISTORIAL = 21600;    // las semanas viejas de cada alumno (que ya no cambian) se guardan 6 horas: así "Actualizar" solo relee las últimas semanas
const SEMANAS_RECIENTES = 3;         // estas semanas más nuevas se leen siempre de la planilla (son las que el alumno va completando)
const SEMANAS_MAXIMO = 200;          // tope de pestañas "Semana N" que se leen por alumno
const SEGUNDOS_EN_MEMORIA = 300;     // una consulta repetida en 5 minutos no vuelve a leer la planilla
const SEGUNDOS_MINIMOS_ENTRE_LECTURAS = 30; // el botón "Actualizar" de la página no lee la planilla más de una vez cada 30 segundos
const SEGUNDOS_LISTA_ALUMNOS = 60;   // la lista de alumnos se lee de la planilla a lo sumo una vez por minuto (también es lo que tarda en valer una clave borrada)
// ======================

const HOJA_ALUMNOS = 'Alumnos';
const COLUMNAS_ALUMNOS = ['Nombre', 'Email', 'Planilla (link o ID)', 'Clave', 'Link del dashboard'];
const LETRAS_CLAVE = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO_CLAVE = 24;

// ---------- Lectura de las pestañas (funciones puras, probadas aparte) ----------

const COL_ = { tilde: 2, ejercicio: 3, series: 6, reps: 7, kg0: 8, kgN: 10 };

const limpiarNombre_ = t => String(t).replace(/\s+/g, ' ').trim();
const numero_ = v => (typeof v === 'number' && isFinite(v) ? v : null);
const claveNombre_ = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Las columnas del catálogo se agrupan en solo tres grupos para el dashboard: "Tren superior", "Tren inferior" y "Core".
 * Se decide por el título de la columna: *_Tren_Superior → superior; Core_*, Dead_Bug, TGU y Med Ball → core;
 * Piernas_*, Iso_Push, Derivados_OLY, Activadores y PLYO_* → inferior. Una columna nueva que no encaje queda en "Otros".
 */
function grupoDeCategoria_(titulo) {
  const t = titulo == null ? '' : claveNombre_(titulo).replace(/\s+/g, '_');
  if (!t) return '';
  if (/tren_superior/.test(t)) return 'Tren superior';
  if (/^core|^dead_bug|^tgu|^med_ball/.test(t)) return 'Core';
  if (/^piernas|^iso_push|^derivados_oly|^activadores|^plyo/.test(t)) return 'Tren inferior';
  return 'Otros';
}

/** La hoja del catálogo (una categoría por columna, sus ejercicios hacia abajo) → [{ nombre, categoria }] en el orden de la hoja (la categoría es uno de los grupos de grupoDeCategoria_). */
function armarCatalogo_(valores) {
  const lista = [];
  const titulos = valores[0] || [];
  titulos.forEach((titulo, c) => {
    const categoria = grupoDeCategoria_(titulo);
    if (!categoria) return;
    for (let f = 1; f < valores.length; f++) {
      const nombre = limpiarNombre_(valores[f][c] == null ? '' : valores[f][c]);
      if (nombre) lista.push({ nombre, categoria });
    }
  });
  return lista;
}

/**
 * Las pestañas viejas tienen otro orden de columnas: solo se leen las del formato actual.
 * Formato actual = "Ejercicio" en D y "Ser" en G. Los títulos de REP y KG pueden faltar o estar vacíos (hay planillas así:
 * los datos igual están en su lugar). Formato viejo = tiene "Kilogramos" o "KG" en la columna N (los pesos van en una sola columna al final).
 */
function esFormatoNuevo_(filas) {
  const f = filas[0] || [];
  const viejo = /^\s*(kilo|kg)/i.test(String(f[13] == null ? '' : f[13]));
  return /ejercicio/i.test(String(f[3])) && /^\s*ser/i.test(String(f[6])) && !viejo;
}

/** "5" → 5 · "5   C/L" → 5 (por lado) · '30"' / "1`" (tiempo) → null. */
function leerReps_(v) {
  if (numero_(v) !== null) return { reps: v, porLado: false };
  const m = /^\s*(\d+)\s*(C\/L)?\s*$/i.exec(String(v == null ? '' : v));
  return m ? { reps: +m[1], porLado: !!m[2] } : null;
}

/** Una pestaña "Semana N" → una fila por serie realizada: [{ dia, ejercicio, kg, reps }]. */
function leerSemana_(filas) {
  const series = [];
  let dia = 0;
  filas.forEach((fila, i) => {
    if (i === 0) return;
    const nombre = fila[COL_.ejercicio];
    if (nombre === '' || nombre == null) return;
    if (/^D[ÍI]A\s*\d+/i.test(String(nombre).trim())) { dia = +/\d+/.exec(nombre)[0]; return; }
    const n = numero_(fila[COL_.series]);
    const r = leerReps_(fila[COL_.reps]);
    if (!dia || !n || !r) return;
    const kgs = [];
    for (let c = COL_.kg0; c <= COL_.kgN; c++) { const k = numero_(fila[c]); if (k !== null) kgs.push(k); }
    if (!kgs.length) return; // "-" = peso corporal
    for (let s = 0; s < n; s++) series.push({ dia, ejercicio: limpiarNombre_(nombre), kg: kgs[Math.min(s, kgs.length - 1)], reps: r.reps });
  });
  return series;
}

/**
 * Los tildes de día de una pestaña "Semana N": una casilla en la columna C, a la izquierda de cada título "DÍA n".
 * → [{ dia, hecho }]. Solo cuentan los "DÍA n" que tienen casilla: en las semanas anteriores a los tildes nunca se pudo
 * marcar nada, así que no deben figurar como "faltó".
 */
function leerDiasTildados_(filas) {
  const porDia = new Map();
  filas.forEach((fila, i) => {
    if (i === 0) return;
    const m = /^D[ÍI]A\s*(\d+)/i.exec(String(fila[COL_.ejercicio] == null ? '' : fila[COL_.ejercicio]).trim());
    const casilla = fila[COL_.tilde];
    if (!m || (casilla !== true && casilla !== false)) return;
    const dia = +m[1];
    porDia.set(dia, porDia.get(dia) === true || casilla === true);
  });
  return [...porDia.entries()].sort((a, b) => a[0] - b[0]).map(([dia, hecho]) => ({ dia, hecho }));
}

/** Fechas tildadas ('AAAA-MM-DD') de la pestaña del calendario: cada casillero está justo debajo de su fecha. */
function fechasMarcadas_(valores) {
  const fechas = [];
  for (let f = 0; f + 1 < valores.length; f++) {
    for (let c = 0; c < 7; c++) {
      const v = valores[f][c];
      if (v instanceof Date && valores[f + 1][c] === true) {
        fechas.push(`${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`);
      }
    }
  }
  return fechas.sort();
}

/**
 * Objetivo de cada mes: {'2026-10': 12}. Cada mes empieza con un título y, en la fila de abajo, el objetivo en la columna I.
 * El título puede ser un texto ("OCTUBRE 2026") o una fecha mostrada como mes (así quedó en "Control Mensual").
 */
function objetivosMensuales_(valores) {
  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const dos = n => String(n).padStart(2, '0');
  const objetivos = {};
  valores.forEach((fila, i) => {
    const titulo = fila[0];
    let mes = null;
    if (titulo instanceof Date) mes = `${titulo.getFullYear()}-${dos(titulo.getMonth() + 1)}`;
    else {
      const m = /^([A-ZÁÉÍÓÚ]+)\s+(\d{4})$/.exec(String(titulo).trim());
      if (m && MESES.indexOf(m[1]) >= 0) mes = `${m[2]}-${dos(MESES.indexOf(m[1]) + 1)}`;
    }
    const meta = valores[i + 1] && numero_(valores[i + 1][8]);
    if (mes && meta > 0) objetivos[mes] = meta;
  });
  return objetivos;
}

// ---------- Lectura de la planilla de un alumno ----------

/** Las pestañas con el calendario de tildes: "Control Mensual" (la que usan los alumnos) o "Asistencia AAAA". No cuenta "Control Mensual (anterior)". */
const esHojaAsistencia_ = nombre => /^\s*(Control Mensual|Asistencia\s+\d{4})\s*$/i.test(String(nombre));

/**
 * Devuelve { series, categorias, asistencia, objetivos, dias, semanaActual, historia } de una planilla abierta. dias = tildes de día por semana. `catalogo` es la lista de armarCatalogo_.
 * `previo` (opcional) es la `historia` de una lectura anterior: { hasta, series, dias }. Las semanas hasta ese número no se vuelven a leer de la planilla.
 * Los pesos de un "DÍA n" solo cuentan cuando la casilla de ese día está tildada; los días sin casilla (semanas viejas) cuentan siempre.
 */
function leerPlanilla_(ss, catalogo, previo) {
  const hojas = ss.getSheets();
  const semanas = [], asistencias = [];
  hojas.forEach(h => {
    const nombre = h.getName();
    const m = /^Semana\s+(\d+)\s*$/i.exec(nombre);
    if (m) semanas.push({ n: +m[1], hoja: h });
    else if (esHojaAsistencia_(nombre)) asistencias.push(h);
  });
  semanas.sort((a, b) => b.n - a.n); // de la más nueva a la más vieja
  const semanaActual = semanas.length ? { n: semanas[0].n, gid: gidVisible_(semanas[0].hoja) } : null;

  // Todos los ejercicios con peso. Si está en el catálogo se usa su nombre y su categoría; si no, queda tal cual lo escribiste en la planilla.
  const porClave = new Map();
  (catalogo || []).forEach(x => { if (!porClave.has(claveNombre_(x.nombre))) porClave.set(claveNombre_(x.nombre), x); });
  const hasta = semanas.length ? Math.max(0, semanas[0].n - SEMANAS_RECIENTES) : 0; // hasta acá las semanas ya están cerradas
  const usable = previo && Number.isInteger(previo.hasta) && previo.hasta > 0 && previo.hasta <= hasta && Array.isArray(previo.series) && Array.isArray(previo.dias); // una historia guardada antes de los tildes no sirve: se relee
  const corte = usable ? previo.hasta : 0; // lo que ya está en `previo` no se lee de nuevo
  const series = usable ? previo.series.slice() : [], vistas = new Set();
  const dias = usable ? previo.dias.slice() : [];
  for (const s of semanas.slice(0, SEMANAS_MAXIMO)) {
    if (s.n <= corte) break; // las semanas más viejas ya vienen guardadas
    const filas = s.hoja.getRange(1, 1, Math.min(s.hoja.getMaxRows(), 80), 14).getValues();
    if (!esFormatoNuevo_(filas)) break; // desde acá para atrás son pestañas con el formato viejo
    const tildes = leerDiasTildados_(filas);
    tildes.forEach(x => dias.push({ semana: s.n, dia: x.dia, hecho: x.hecho }));
    const hecho = new Map(tildes.map(x => [x.dia, x.hecho]));
    leerSemana_(filas).forEach(x => {
      if (hecho.get(x.dia) === false) return; // el día tiene casilla y todavía no está tildado: lo que se cargó ahí no cuenta (ni como récord)
      const k = claveNombre_(x.ejercicio);
      const enCatalogo = porClave.get(k);
      const nombre = enCatalogo ? enCatalogo.nombre : x.ejercicio;
      const marca = `${s.n}|${k}|${x.kg}|${x.reps}`;
      if (vistas.has(marca)) return; // series repetidas (3 × 5 con 80 kg) valen una sola vez: para los gráficos da igual y pesa menos
      vistas.add(marca);
      series.push({ semana: s.n, ejercicio: nombre, kg: x.kg, reps: x.reps });
    });
  }
  const categorias = {};
  series.forEach(x => { const c = porClave.get(claveNombre_(x.ejercicio)); if (c) categorias[x.ejercicio] = c.categoria; });
  series.sort((a, b) => a.semana - b.semana);
  dias.sort((a, b) => a.semana - b.semana || a.dia - b.dia);

  let asistencia = [], objetivos = {};
  asistencias.forEach(h => {
    const valores = h.getRange(1, 1, h.getMaxRows(), 9).getValues();
    asistencia = asistencia.concat(fechasMarcadas_(valores));
    Object.assign(objetivos, objetivosMensuales_(valores));
  });
  const historia = { hasta, series: series.filter(x => x.semana <= hasta), dias: dias.filter(x => x.semana <= hasta) };
  return { series, categorias, asistencia: asistencia.sort(), objetivos, dias, semanaActual, historia };
}

/** Número de pestaña (gid) para abrir directo en ella; si la pestaña está oculta, Google no la muestra, así que no se usa. */
function gidVisible_(hoja) {
  try { return hoja.isSheetHidden() ? null : hoja.getSheetId(); } catch (err) { return null; }
}

/** Dirección de la planilla del alumno, directo en la pestaña de la semana actual. Solo se arma con IDs que pasaron idDePlanilla_. */
function urlRutina_(idPlanilla, gid) {
  return `https://docs.google.com/spreadsheets/d/${idPlanilla}/edit` + (Number.isInteger(gid) && gid >= 0 ? `#gid=${gid}` : '');
}

/** El catálogo de ejercicios, de la planilla CATALOGO_ID. Se guarda 6 horas en memoria; si falla, devuelve [] y todo sigue andando. */
function leerCatalogo_() {
  if (!CATALOGO_ID) return [];
  const memoria = CacheService.getScriptCache();
  try {
    const guardado = memoria.get('catalogo');
    if (guardado) return JSON.parse(guardado);
    const hoja = SpreadsheetApp.openById(CATALOGO_ID).getSheets()[0];
    const lista = armarCatalogo_(hoja.getDataRange().getValues());
    try { memoria.put('catalogo', JSON.stringify(lista), SEGUNDOS_CATALOGO); } catch (err) { /* sin memoria: se lee cada vez */ }
    return lista;
  } catch (err) {
    Logger.log(`No se pudo leer el catálogo de ejercicios: ${err}`);
    try { memoria.put('catalogo', '[]', 300); } catch (e) { /* sin memoria: se reintenta */ } // si falla, no insiste en cada consulta
    return [];
  }
}

// ---------- Alumnos, claves y seguridad ----------

const idDePlanilla_ = texto => {
  const t = String(texto || '').trim();
  const m = /\/d\/([a-zA-Z0-9_-]{20,})/.exec(t);
  return m ? m[1] : (/^[a-zA-Z0-9_-]{20,}$/.test(t) ? t : '');
};

function claveNueva_() {
  let c = '';
  for (let i = 0; i < LARGO_CLAVE; i++) c += LETRAS_CLAVE.charAt(Math.floor(Math.random() * LETRAS_CLAVE.length));
  return c;
}

/** Crea la pestaña "Alumnos". Se ejecuta una vez. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_ALUMNOS);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_ALUMNOS);
    hoja.getRange(1, 1, 1, COLUMNAS_ALUMNOS.length).setValues([COLUMNAS_ALUMNOS]).setFontWeight('bold').setBackground('#f3f3f3');
    hoja.setColumnWidths(1, 2, 180); hoja.setColumnWidth(3, 320); hoja.setColumnWidth(4, 220); hoja.setColumnWidth(5, 420);
    hoja.setFrozenRows(1);
  }
  ss.toast('Pestaña "Alumnos" lista. Cargá nombre, email y link de la planilla; después ejecutá generarClaves.', 'Progreso', 8);
}

/** Las filas de "Alumnos" como objetos. La planilla puede estar escrita como texto o como link/ficha de Drive: se lee la dirección real. */
function leerAlumnos_(hoja) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return [];
  const rango = hoja.getRange(2, 1, ultima - 1, COLUMNAS_ALUMNOS.length);
  const datos = rango.getValues();
  const ricos = hoja.getRange(2, 3, ultima - 1, 1).getRichTextValues();
  return datos.map((f, i) => {
    const enlace = ricos[i][0] && ricos[i][0].getLinkUrl ? ricos[i][0].getLinkUrl() : null;
    return { fila: i + 2, nombre: String(f[0]).trim(), planilla: idDePlanilla_(enlace) || idDePlanilla_(f[2]), clave: String(f[3]).trim() };
  });
}

/** Les pone clave y link a los alumnos que todavía no tienen, y avisa por qué se salteó cada fila que no pudo. */
function generarClaves() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA_ALUMNOS);
  if (!hoja) throw new Error('Primero ejecutá configurar.');
  const alumnos = leerAlumnos_(hoja);
  const usadas = new Set(alumnos.map(a => a.clave).filter(Boolean));
  let nuevas = 0;
  const avisos = [];
  alumnos.forEach(a => {
    if (!a.nombre && !a.planilla && !a.clave) return;                                  // fila vacía
    if (!a.nombre) { avisos.push(`Fila ${a.fila}: falta el nombre.`); return; }
    if (!a.planilla) { avisos.push(`Fila ${a.fila} (${a.nombre}): no reconozco el link de la planilla.`); return; }
    if (a.clave) return;                                                               // ya tiene clave
    let c; do { c = claveNueva_(); } while (usadas.has(c));
    usadas.add(c);
    hoja.getRange(a.fila, 4, 1, 2).setValues([[c, `${PAGINA}?c=${c}`]]);
    nuevas++;
  });
  const resumen = `${nuevas} alumno(s) con link nuevo.` + (avisos.length ? ' ' + avisos.join(' ') : '');
  Logger.log(`${resumen} (${alumnos.length} fila(s) leída(s))`);
  ss.toast(resumen, 'Progreso', 15);
  if (!alumnos.length) ss.toast('No hay filas con datos debajo de los títulos de la pestaña "Alumnos".', 'Progreso', 15);
}

/** Alumnos con clave y planilla válidas. Se guarda un minuto en memoria: así probar claves inventadas casi no cuesta nada. */
function listaAlumnos_() {
  const memoria = CacheService.getScriptCache();
  const guardada = memoria.get('alumnos');
  if (guardada) return JSON.parse(guardada);
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_ALUMNOS);
  const lista = hoja ? leerAlumnos_(hoja).filter(a => a.clave && a.planilla).map(a => ({ clave: a.clave, nombre: a.nombre, planilla: a.planilla })) : [];
  try { memoria.put('alumnos', JSON.stringify(lista), SEGUNDOS_LISTA_ALUMNOS); } catch (err) { /* sin memoria: se lee cada vez */ }
  return lista;
}

function buscarAlumno_(clave) {
  const a = listaAlumnos_().find(x => x.clave === clave);
  return a ? { nombre: a.nombre, planilla: a.planilla } : null;
}

// ---------- Web app ----------

const respuesta_ = obj => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);

/** Cuántos segundos pasaron desde que se leyó la planilla de esa respuesta guardada (si no se puede saber, se considera vieja). */
function edadEnSegundos_(texto) {
  try {
    const t = Date.parse(JSON.parse(texto).actualizado);
    return isFinite(t) ? Math.max(0, (Date.now() - t) / 1000) : Infinity;
  } catch (err) { return Infinity; }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.accion !== 'progreso') return respuesta_({ ok: false, error: 'Acción desconocida.' });

  // La clave tiene 24 caracteres al azar (unos 2^138 combinaciones): no se puede adivinar, así que no hace falta
  // bloquear a nadie por probar claves (un bloqueo general lo podría usar cualquiera para dejar sin servicio a todos).
  const clave = String(p.clave || '');
  const alumno = /^[a-zA-Z0-9]{24}$/.test(clave) ? buscarAlumno_(clave) : null;
  if (!alumno) return respuesta_({ ok: false, error: 'El link no es válido. Pedile uno nuevo a tu entrenador.' });

  const memoria = CacheService.getScriptCache();
  const guardado = memoria.get('p_' + clave);
  if (guardado && !(p.fresco === '1' && edadEnSegundos_(guardado) >= SEGUNDOS_MINIMOS_ENTRE_LECTURAS)) {
    return ContentService.createTextOutput(guardado).setMimeType(ContentService.MimeType.JSON);
  }

  let datos;
  const llaveHistoria = `h_${clave}_${alumno.planilla}`;
  let previo = null;
  try { previo = JSON.parse(memoria.get(llaveHistoria)); } catch (err) { previo = null; }
  try {
    datos = leerPlanilla_(SpreadsheetApp.openById(alumno.planilla), leerCatalogo_(), previo);
  } catch (err) {
    Logger.log(`No se pudo leer la planilla de ${alumno.nombre}: ${err}`);
    return respuesta_({ ok: false, error: 'No pude leer tu planilla. Avisale a tu entrenador.' });
  }
  const { semanaActual, historia, ...resto } = datos;
  try { memoria.put(llaveHistoria, JSON.stringify(historia), SEGUNDOS_HISTORIAL); } catch (err) { /* si es muy grande, simplemente no se guarda */ }
  const texto = JSON.stringify({
    ok: true, nombre: alumno.nombre, actualizado: new Date().toISOString(), ...resto,
    rutina: urlRutina_(alumno.planilla, semanaActual && semanaActual.gid), // el botón "Mi rutina": la planilla de ESTE alumno, nada más
    rutinaSemana: semanaActual ? semanaActual.n : null,
  });
  try { memoria.put('p_' + clave, texto, SEGUNDOS_EN_MEMORIA); } catch (err) { /* si es muy grande, simplemente no se guarda */ }
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
}

/** Para comprobar con una planilla: pegá su link o ID abajo y ejecutá. El resultado queda en Ver > Registros de ejecución. */
function probarLectura() {
  const LINK_O_ID = ''; // <- pegá acá el link de la planilla a probar
  const id = idDePlanilla_(LINK_O_ID);
  if (!id) throw new Error('Pegá el link de una planilla en LINK_O_ID, dentro de probarLectura.');
  const d = leerPlanilla_(SpreadsheetApp.openById(id), leerCatalogo_());
  const porEj = {};
  d.series.forEach(s => { porEj[s.ejercicio] = (porEj[s.ejercicio] || 0) + 1; });
  Logger.log(`Series por ejercicio: ${JSON.stringify(porEj)}`);
  Logger.log(`Semanas leídas: ${[...new Set(d.series.map(s => s.semana))].join(', ')}`);
  Logger.log(`Días tildados: ${d.asistencia.length} · Objetivos: ${JSON.stringify(d.objetivos)}`);
}

/**
 * Mide cuánto tarda cada paso al leer una planilla (la tuya o la de un alumno), para saber dónde se va el tiempo.
 * Pegá el link entre las comillas de abajo, ejecutá medirTiempos y mirá Ver > Registros de ejecución.
 */
const LINK_PARA_MEDIR = '';

function medirTiempos(entrada) {
  const id = idDePlanilla_(entrada || LINK_PARA_MEDIR);
  if (!id) throw new Error('Pegá el link de una planilla en LINK_PARA_MEDIR, arriba de la función medirTiempos.');
  const lineas = [];
  const paso = (nombre, fn) => { const t = Date.now(); const r = fn(); lineas.push(`${nombre}: ${Date.now() - t} ms`); return r; };
  const inicio = Date.now();
  const ss = paso('Abrir la planilla', () => SpreadsheetApp.openById(id));
  const hojas = paso('Listar las pestañas', () => ss.getSheets());
  paso(`Leer el nombre de ${hojas.length} pestañas`, () => hojas.map(h => h.getName()));
  const datos = paso('Lectura completa (lo que hace el dashboard)', () => leerPlanilla_(ss, leerCatalogo_()));
  lineas.push(`Series leídas: ${datos.series.length} · días tildados: ${datos.asistencia.length}`);
  lineas.push(`TOTAL: ${Date.now() - inicio} ms`);
  Logger.log(lineas.join('\n'));
  return lineas;
}
