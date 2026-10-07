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
const EJERCICIOS_DASHBOARD = ['Sentadilla C/B', 'Press plano C/B', 'Despegue C/B', 'Hip Trust C/B'];
const SEMANAS_MAXIMO = 200;          // tope de pestañas "Semana N" que se leen por alumno
const SEGUNDOS_EN_MEMORIA = 300;     // una consulta repetida en 5 minutos no vuelve a leer la planilla
const FALLOS_MAXIMOS_10_MIN = 30;    // si se prueban demasiadas claves inventadas, se frena todo un rato
// ======================

const HOJA_ALUMNOS = 'Alumnos';
const COLUMNAS_ALUMNOS = ['Nombre', 'Email', 'Planilla (link o ID)', 'Clave', 'Link del dashboard'];
const LETRAS_CLAVE = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO_CLAVE = 24;

// ---------- Lectura de las pestañas (funciones puras, probadas aparte) ----------

const COL_ = { ejercicio: 3, series: 6, reps: 7, kg0: 8, kgN: 10 };

const limpiarNombre_ = t => String(t).replace(/\s+/g, ' ').trim();
const numero_ = v => (typeof v === 'number' && isFinite(v) ? v : null);
const claveNombre_ = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Las pestañas viejas tienen otro orden de columnas: solo se leen las del formato actual. */
function esFormatoNuevo_(filas) {
  const f = filas[0] || [];
  return /ejercicio/i.test(String(f[3])) && /^\s*ser/i.test(String(f[6])) && /^\s*rep/i.test(String(f[7])) && /^\s*(kg|kilo)/i.test(String(f[8]));
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

/** Fechas tildadas ('AAAA-MM-DD') de una pestaña "Asistencia AAAA": cada casillero está debajo de su fecha. */
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

/** Objetivo de cada mes: {'2026-10': 12}. El título "OCTUBRE 2026" tiene debajo, en la columna I, el objetivo. */
function objetivosMensuales_(valores) {
  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const objetivos = {};
  valores.forEach((fila, i) => {
    const m = /^([A-ZÁÉÍÓÚ]+)\s+(\d{4})$/.exec(String(fila[0]).trim());
    const mes = m ? MESES.indexOf(m[1]) : -1;
    const meta = valores[i + 1] && numero_(valores[i + 1][8]);
    if (mes >= 0 && meta > 0) objetivos[`${m[2]}-${String(mes + 1).padStart(2, '0')}`] = meta;
  });
  return objetivos;
}

// ---------- Lectura de la planilla de un alumno ----------

/** Devuelve { series, asistencia, objetivos } de una planilla abierta. Solo los ejercicios del dashboard. */
function leerPlanilla_(ss) {
  const hojas = ss.getSheets();
  const semanas = [], asistencias = [];
  hojas.forEach(h => {
    const nombre = h.getName();
    let m = /^Semana\s+(\d+)\s*$/i.exec(nombre);
    if (m) semanas.push({ n: +m[1], hoja: h });
    else if ((m = /^Asistencia\s+(\d{4})\s*$/i.exec(nombre))) asistencias.push(h);
  });
  semanas.sort((a, b) => b.n - a.n); // de la más nueva a la más vieja

  const quiero = new Map(EJERCICIOS_DASHBOARD.map(e => [claveNombre_(e), e]));
  const series = [];
  for (const s of semanas.slice(0, SEMANAS_MAXIMO)) {
    const filas = s.hoja.getRange(1, 1, Math.min(s.hoja.getMaxRows(), 80), 12).getValues();
    if (!esFormatoNuevo_(filas)) break; // desde acá para atrás son pestañas con el formato viejo
    leerSemana_(filas).forEach(x => {
      const canonico = quiero.get(claveNombre_(x.ejercicio));
      if (canonico) series.push({ semana: s.n, ejercicio: canonico, kg: x.kg, reps: x.reps });
    });
  }
  series.sort((a, b) => a.semana - b.semana);

  let asistencia = [], objetivos = {};
  asistencias.forEach(h => {
    const valores = h.getRange(1, 1, h.getMaxRows(), 9).getValues();
    asistencia = asistencia.concat(fechasMarcadas_(valores));
    Object.assign(objetivos, objetivosMensuales_(valores));
  });
  return { series, asistencia: asistencia.sort(), objetivos };
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

/** Les pone clave y link a los alumnos que todavía no tienen. Se ejecuta cada vez que sumás a alguien. */
function generarClaves() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_ALUMNOS);
  if (!hoja) throw new Error('Primero ejecutá configurar.');
  const ultima = hoja.getLastRow();
  if (ultima < 2) return;
  const datos = hoja.getRange(2, 1, ultima - 1, COLUMNAS_ALUMNOS.length).getValues();
  const usadas = new Set(datos.map(f => String(f[3])).filter(Boolean));
  let nuevas = 0;
  datos.forEach((f, i) => {
    if (!String(f[0]).trim() || !idDePlanilla_(f[2])) return;       // falta nombre o planilla
    if (String(f[3]).trim()) return;                                 // ya tiene clave
    let c; do { c = claveNueva_(); } while (usadas.has(c));
    usadas.add(c);
    hoja.getRange(i + 2, 4, 1, 2).setValues([[c, `${PAGINA}?c=${c}`]]);
    nuevas++;
  });
  SpreadsheetApp.getActiveSpreadsheet().toast(`${nuevas} alumno(s) con link nuevo.`, 'Progreso', 6);
}

function buscarAlumno_(clave) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_ALUMNOS);
  if (!hoja || hoja.getLastRow() < 2) return null;
  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, COLUMNAS_ALUMNOS.length).getValues();
  const fila = datos.find(f => String(f[3]) === clave);
  return fila ? { nombre: String(fila[0]).trim(), planilla: idDePlanilla_(fila[2]) } : null;
}

// ---------- Web app ----------

const respuesta_ = obj => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.accion !== 'progreso') return respuesta_({ ok: false, error: 'Acción desconocida.' });

  const memoria = CacheService.getScriptCache();
  const fallos = +(memoria.get('fallos') || 0);
  if (fallos >= FALLOS_MAXIMOS_10_MIN) return respuesta_({ ok: false, error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });

  const clave = String(p.clave || '');
  const alumno = /^[a-zA-Z0-9]{24}$/.test(clave) ? buscarAlumno_(clave) : null;
  if (!alumno || !alumno.planilla) {
    memoria.put('fallos', String(fallos + 1), 600);
    return respuesta_({ ok: false, error: 'El link no es válido. Pedile uno nuevo a tu entrenador.' });
  }

  const guardado = memoria.get('p_' + clave);
  if (guardado) return ContentService.createTextOutput(guardado).setMimeType(ContentService.MimeType.JSON);

  let datos;
  try {
    datos = leerPlanilla_(SpreadsheetApp.openById(alumno.planilla));
  } catch (err) {
    return respuesta_({ ok: false, error: 'No pude leer tu planilla. Avisale a tu entrenador.' });
  }
  const texto = JSON.stringify({ ok: true, nombre: alumno.nombre, ...datos });
  try { memoria.put('p_' + clave, texto, SEGUNDOS_EN_MEMORIA); } catch (err) { /* si es muy grande, simplemente no se guarda */ }
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
}

/** Para comprobar con una planilla: pegá su link o ID abajo y ejecutá. El resultado queda en Ver > Registros de ejecución. */
function probarLectura() {
  const LINK_O_ID = ''; // <- pegá acá el link de la planilla a probar
  const id = idDePlanilla_(LINK_O_ID);
  if (!id) throw new Error('Pegá el link de una planilla en LINK_O_ID, dentro de probarLectura.');
  const d = leerPlanilla_(SpreadsheetApp.openById(id));
  const porEj = {};
  d.series.forEach(s => { porEj[s.ejercicio] = (porEj[s.ejercicio] || 0) + 1; });
  Logger.log(`Series por ejercicio: ${JSON.stringify(porEj)}`);
  Logger.log(`Semanas leídas: ${[...new Set(d.series.map(s => s.semana))].join(', ')}`);
  Logger.log(`Días tildados: ${d.asistencia.length} · Objetivos: ${JSON.stringify(d.objetivos)}`);
}
