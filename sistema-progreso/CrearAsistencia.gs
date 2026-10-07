/**
 * Crea en una planilla el calendario de asistencia ("Asistencia 2026").
 *
 * Cada mes tiene, debajo de cada número de día, un casillero para tildar cuando se entrenó.
 * Los números son fechas reales, así que después se puede saber qué día fue cada tilde.
 * El día de hoy se ve resaltado. Al costado de cada mes van el objetivo, los días realizados
 * y una barra de progreso.
 *
 * Se usa una sola vez, en la planilla modelo. Pegalo en Extensiones > Apps Script de esa planilla.
 * @OnlyCurrentDoc
 */

// ====== OPCIONES (cambiá solo esto) ======
const ANIO = 2026;               // año del calendario
const OBJETIVO_POR_DEFECTO = 12; // días de entrenamiento por mes; después se cambia mes a mes en la planilla
// =========================================

const MESES_ = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const DIAS_ = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const COLUMNAS_ = 11; // A:G calendario · H en blanco · I:K resumen

/** Arma, sin tocar ninguna planilla, qué va en cada celda. Las filas y columnas empiezan en 1. */
function armarCalendario_(anio, objetivo, sep) {
  sep = sep || ','; // separador de argumentos de las fórmulas: depende del idioma de la planilla
  const filas = [];
  const casilleros = [];  // { fila, desde, hasta }: dónde van los tildes
  const bloques = [];     // { titulo, fila, ultima }
  let fila = 1;
  for (let mes = 0; mes < 12; mes++) {
    const dias = new Date(anio, mes + 1, 0).getDate();
    const desfase = (new Date(anio, mes, 1).getDay() + 6) % 7; // 0 = el día 1 cae lunes
    const semanas = Math.ceil((desfase + dias) / 7);
    const inicio = fila;
    const poner = (f, c, v) => { while (filas.length < f) filas.push(new Array(COLUMNAS_).fill('')); filas[f - 1][c - 1] = v; };

    poner(fila, 1, `${MESES_[mes]} ${anio}`);
    poner(fila, 9, 'Objetivo'); poner(fila, 10, 'Realizados'); poner(fila, 11, 'Progreso');
    DIAS_.forEach((d, i) => poner(fila + 1, i + 1, d));
    poner(fila + 1, 9, objetivo);

    const primeraFecha = fila + 2;
    const ultima = fila + 1 + semanas * 2;
    for (let s = 0; s < semanas; s++) {
      const filaFechas = primeraFecha + s * 2;
      let primero = 0, ultimo = 0;
      for (let c = 0; c < 7; c++) {
        const dia = s * 7 + c - desfase + 1;
        if (dia < 1 || dia > dias) continue;
        poner(filaFechas, c + 1, new Date(anio, mes, dia));
        if (!primero) primero = c + 1;
        ultimo = c + 1;
      }
      casilleros.push({ fila: filaFechas + 1, desde: primero, hasta: ultimo });
    }
    const J = `J${fila + 1}`, I = `I${fila + 1}`;
    const llenos = `MIN(10${sep}ROUND(${J}/${I}*10${sep}0))`;
    poner(fila + 1, 10, `=COUNTIF(A${primeraFecha}:G${ultima}${sep}TRUE())`);
    // Barra de progreso con caracteres (sin SPARKLINE, que necesita listas con separadores distintos según el idioma)
    poner(fila + 1, 11, `=IFERROR(REPT("█"${sep}${llenos})&REPT("░"${sep}10-${llenos})&" "&ROUND(${J}/${I}*100${sep}0)&"%"${sep}"")`);
    bloques.push({ titulo: fila, encabezado: fila + 1, primeraFecha, ultima });
    fila = ultima + 2; // una fila en blanco entre meses
  }
  while (filas.length < fila - 1) filas.push(new Array(COLUMNAS_).fill('')); // que lleguen hasta el último casillero
  return { filas, casilleros, bloques, total: fila - 1 };
}

/** Recibe lo que devuelve getValues() de la pestaña y devuelve las fechas tildadas ('AAAA-MM-DD'), en orden. */
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
 * Averigua con qué separa los argumentos la planilla: "," (inglés) o ";" (español y otros).
 * Escribe SUM(1,2) en una celda de prueba: si da 3, la coma sirve; si no, se usa ";".
 */
function detectarSeparador_(hoja) {
  const celda = hoja.getRange(1, 1);
  celda.setFormula('=SUM(1,2)');
  SpreadsheetApp.flush();
  const coma = celda.getValue() === 3;
  celda.clear();
  return coma ? ',' : ';';
}

function crearAsistencia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombre = `Asistencia ${ANIO}`;
  if (ss.getSheetByName(nombre)) {
    throw new Error(`Ya existe la pestaña "${nombre}". Si querés rehacerla, borrala primero (o cambiá ANIO).`);
  }
  const hoja = ss.insertSheet(nombre);
  const m = armarCalendario_(ANIO, OBJETIVO_POR_DEFECTO, detectarSeparador_(hoja));
  const todas = hoja.getRange(1, 1, m.filas.length, COLUMNAS_);
  // Las fórmulas se escriben aparte con setFormula, que siempre usa la sintaxis en inglés (sin depender del idioma de la planilla).
  const formulas = [];
  todas.setValues(m.filas.map((f, i) => f.map((v, c) => {
    if (typeof v === 'string' && v.charAt(0) === '=') { formulas.push([i + 1, c + 1, v]); return ''; }
    return v;
  })));
  formulas.forEach(([f, c, texto]) => hoja.getRange(f, c).setFormula(texto));
  todas.setFontFamily('Arial').setVerticalAlignment('middle');
  hoja.setHiddenGridlines(true);
  hoja.setColumnWidths(1, 7, 58);
  hoja.setColumnWidth(8, 24);
  hoja.setColumnWidths(9, 2, 90);
  hoja.setColumnWidth(11, 170);

  m.bloques.forEach(b => {
    hoja.getRange(b.titulo, 1, 1, 7).merge().setFontSize(14).setFontWeight('bold').setHorizontalAlignment('left');
    hoja.getRange(b.encabezado, 1, 1, 7).setFontWeight('bold').setFontColor('#666666').setHorizontalAlignment('center').setBackground('#f3f3f3');
    hoja.getRange(b.titulo, 9, 1, 3).setFontWeight('bold').setFontColor('#666666');
    hoja.getRange(b.encabezado, 9, 1, 3).setFontSize(12).setHorizontalAlignment('center');
    hoja.getRange(b.primeraFecha, 1, b.ultima - b.primeraFecha + 1, 7).setHorizontalAlignment('center');
  });
  m.filas.forEach((f, i) => { if (f.slice(0, 7).some(v => v instanceof Date)) hoja.getRange(i + 1, 1, 1, 7).setNumberFormat('d').setFontColor('#444444').setFontSize(10); });
  m.casilleros.forEach(c => hoja.getRange(c.fila, c.desde, 1, c.hasta - c.desde + 1).insertCheckboxes());

  // El día de hoy y su casillero se pintan de naranja.
  const regla = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=OR(AND(ISNUMBER(A3),INT(A3)=TODAY()),AND(ISNUMBER(A2),INT(A2)=TODAY()))')
    .setBackground('#ffb380')
    .setRanges([hoja.getRange(3, 1, m.total - 2, 7)])
    .build();
  hoja.setConditionalFormatRules([regla]);
  hoja.setFrozenRows(0);
  ss.setActiveSheet(hoja);
  ss.toast('Listo: calendario creado.', 'Asistencia', 5);
}

/** Para comprobar que se lee bien: mirá el resultado en Ver > Registros de ejecución. */
function probarLectura() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Asistencia ${ANIO}`);
  if (!hoja) throw new Error('Primero ejecutá crearAsistencia.');
  const fechas = fechasMarcadas_(hoja.getRange(1, 1, hoja.getLastRow(), 7).getValues());
  Logger.log(`${fechas.length} días tildados: ${fechas.join(', ')}`);
}
