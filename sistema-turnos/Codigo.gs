/**
 * @OnlyCurrentDoc
 *   (limita el permiso a ESTA planilla: el script no puede ver tus otras planillas ni tu Drive)
 *
 * Sistema de turnos · Juan Pablo Gómez · Entrenamiento
 *
 * Este código va dentro de una planilla de Google (Extensiones → Apps Script).
 * La planilla tiene cuatro pestañas que se crean solas al ejecutar `configurar`:
 *   - Horarios:        los turnos que se repiten cada semana (día, hora y cupo).
 *   - Días sin clases: fechas (o fecha + hora) en las que no hay clase.
 *   - Reservas:        se completa sola con cada reserva y cancelación.
 *   - Configuración:   reglas como cuántas horas antes se puede reservar o cancelar.
 *
 * Paso a paso en INSTRUCCIONES.md.
 */

const HOJAS = {
  HORARIOS: 'Horarios',
  SIN_CLASES: 'Días sin clases',
  RESERVAS: 'Reservas',
  CONFIG: 'Configuración',
};

const COLUMNAS_RESERVAS = ['ID', 'Fecha', 'Hora', 'Lugares', 'Nombre', 'Apellido', 'Email', 'Estado', 'Creada', 'Token'];
const COL = { ID: 0, FECHA: 1, HORA: 2, LUGARES: 3, NOMBRE: 4, APELLIDO: 5, EMAIL: 6, ESTADO: 7, CREADA: 8, TOKEN: 9 };

const CONFIRMADA = 'Confirmada';
const CANCELADA = 'Cancelada';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_MOSTRAR = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const OPCIONES = [
  // [clave interna, texto en la planilla, valor inicial, explicación]
  ['dias', 'Días para adelante', 7, 'Cuántos días se muestran para reservar (7 = hoy y los 6 siguientes).'],
  ['horasReservar', 'Horas mínimas para reservar', 2, 'Hasta cuántas horas antes de la clase se puede reservar.'],
  ['horasCancelar', 'Horas mínimas para cancelar', 1, 'Hasta cuántas horas antes de la clase se puede cancelar.'],
  ['maxLugares', 'Máximo de lugares por persona', 4, 'Cuántos lugares puede reservar una misma persona en un horario.'],
  ['nombre', 'Nombre que firma los mails', 'Juan Pablo Gómez · Entrenamiento', ''],
  ['urlPagina', 'Página de turnos (URL)', '', 'La dirección de la página de turnos. Se usa para el enlace de cancelación.'],
  ['avisarme', 'Avisarme cada reserva (Sí/No)', 'No', 'Si es Sí, te llega un mail con cada reserva y cancelación.'],
  ['miEmail', 'Mi email', '', 'Donde te llegan los avisos. Los alumnos también responden a esta dirección.'],
];

// Límites contra abuso (la dirección del sistema es pública: cualquiera puede intentar reservar).
const LIMITE_RESERVAS_POR_HORA = 40;       // entre todas las personas
const LIMITE_RESERVAS_POR_EMAIL_HORA = 5;  // una misma persona, en una hora
const LIMITE_RESERVAS_FUTURAS_POR_EMAIL = 12; // una misma persona, clases todavía pendientes
const MAILS_RESERVADOS_PARA_VOS = 10;      // si queda menos cuota diaria de mails, no se mandan confirmaciones

const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
const HORA_MS = 60 * 60 * 1000;

/* ───────────────────────── Puesta en marcha ───────────────────────── */

/** Ejecutar una sola vez: crea las pestañas con ejemplos y deja los formatos listos. No borra ni pisa nada que ya exista. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(ZONA_HORARIA);

  crearHoja_(ss, HOJAS.HORARIOS, ['Día', 'Hora', 'Cupo'], [
    ['Lunes', '08:00', 4], ['Lunes', '18:00', 4], ['Lunes', '19:00', 4],
    ['Miércoles', '08:00', 4], ['Miércoles', '18:00', 4], ['Miércoles', '19:00', 4],
    ['Viernes', '08:00', 4], ['Viernes', '18:00', 4],
  ], [1, 2]);

  crearHoja_(ss, HOJAS.SIN_CLASES, ['Fecha (AAAA-MM-DD)', 'Hora (vacío = todo el día)', 'Motivo'], [
    ['2026-12-25', '', 'Navidad'],
  ], [1, 2]);

  crearHoja_(ss, HOJAS.RESERVAS, COLUMNAS_RESERVAS, [], [2, 3]);

  const email = Session.getEffectiveUser().getEmail();
  crearHoja_(ss, HOJAS.CONFIG, ['Opción', 'Valor', 'Para qué sirve'],
    OPCIONES.map(([clave, texto, valor, ayuda]) => [texto, clave === 'miEmail' ? email : valor, ayuda]), [2]);
}

function crearHoja_(ss, nombre, encabezados, filas, columnasTexto) {
  let hoja = ss.getSheetByName(nombre);
  const nueva = !hoja;
  if (nueva) hoja = ss.insertSheet(nombre);
  // Columnas de texto plano, para que "18:00" o "2026-10-05" no se conviertan en fechas.
  // Se aplica también a pestañas que ya existían, así repara una planilla armada a mano.
  columnasTexto.forEach(c => hoja.getRange(1, c, hoja.getMaxRows(), 1).setNumberFormat('@'));
  if (!nueva) return;
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold');
  if (filas.length) hoja.getRange(2, 1, filas.length, encabezados.length).setValues(filas);
  hoja.setFrozenRows(1);
}

/* ───────────────────────── Entrada web ───────────────────────── */

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.accion === 'horarios') return json_(obtenerHorarios_());
    if (p.accion === 'reserva') return json_(consultarReserva_(p.id, p.token));
    return json_({ ok: true, mensaje: 'Sistema de turnos funcionando.' });
  } catch (err) {
    return json_(respuestaError_(err));
  }
}

function doPost(e) {
  let datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (_) {
    return json_({ ok: false, error: 'Pedido inválido.' });
  }
  try {
    if (datos.accion === 'reservar') return json_(reservar_(datos));
    if (datos.accion === 'cancelar') return json_(cancelar_(datos.id, datos.token));
    return json_({ ok: false, error: 'Acción desconocida.' });
  } catch (err) {
    return json_(respuestaError_(err));
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Errores pensados para mostrarle al alumno. */
function errorUsuario_(mensaje) {
  const err = new Error(mensaje);
  err.usuario = true;
  return err;
}

function respuestaError_(err) {
  if (err && err.usuario) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: 'Ocurrió un error. Probá de nuevo en unos minutos.' };
}

/* ───────────────────────── Consultar horarios ───────────────────────── */

function obtenerHorarios_() {
  const cfg = leerConfig_();
  const ahora = ahora_();
  const plantilla = leerHorarios_();
  const sinClases = leerSinClases_();
  const ocupados = lugaresOcupados_(leerReservas_());
  const hoy = formatear_(ahora, 'yyyy-MM-dd');

  const dias = [];
  for (let i = 0; i < cfg.dias; i++) {
    const fecha = sumarDias_(hoy, i);
    const indiceDia = diaDeLaSemana_(fecha);
    const turnos = plantilla
      .filter(h => h.dia === indiceDia)
      .map(h => ({ hora: h.hora, cupo: h.cupo, libres: h.cupo - (ocupados[clave_(fecha, h.hora)] || 0) }))
      .filter(t => t.libres > 0)
      .filter(t => !sinClases.has(fecha) && !sinClases.has(clave_(fecha, t.hora)))
      .filter(t => inicioClase_(fecha, t.hora) - ahora >= cfg.horasReservar * HORA_MS)
      .sort((a, b) => a.hora.localeCompare(b.hora));
    if (turnos.length) dias.push({ fecha, etiqueta: etiquetaFecha_(fecha), turnos });
  }
  return {
    ok: true,
    dias,
    reglas: { maxLugares: cfg.maxLugares, horasReservar: cfg.horasReservar, horasCancelar: cfg.horasCancelar },
  };
}

/* ───────────────────────── Reservar ───────────────────────── */

function reservar_(d) {
  // Campo trampa: los robots lo completan, las personas no lo ven.
  if (d.sitio) return { ok: true };

  const cfg = leerConfig_();
  const nombre = limpiar_(d.nombre);
  const apellido = limpiar_(d.apellido);
  const email = String(d.email || '').trim().toLowerCase();
  const lugares = Number(d.lugares);
  const fecha = String(d.fecha || '');
  const hora = String(d.hora || '');

  if (!nombre || !apellido) throw errorUsuario_('Completá tu nombre y apellido.');
  if (nombre.length > 60 || apellido.length > 60) throw errorUsuario_('El nombre o el apellido son demasiado largos.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) throw errorUsuario_('Revisá tu email: parece que no está bien escrito.');
  if (!Number.isInteger(lugares) || lugares < 1 || lugares > cfg.maxLugares) {
    throw errorUsuario_(`Podés reservar entre 1 y ${cfg.maxLugares} lugares.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) throw errorUsuario_('Ese horario no existe.');

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (_) {
    throw errorUsuario_('Hay muchas reservas en este momento. Probá de nuevo en unos segundos.');
  }

  let reserva;
  try {
    const turno = buscarTurno_(fecha, hora, cfg);
    const reservas = leerReservas_();
    controlarAbuso_(reservas, email);
    const libres = turno.cupo - (lugaresOcupados_(reservas)[clave_(fecha, hora)] || 0);
    if (libres <= 0) throw errorUsuario_('Ese horario se acaba de llenar. Elegí otro.');
    if (lugares > libres) throw errorUsuario_(`En ese horario ${libres === 1 ? 'queda 1 lugar' : `quedan ${libres} lugares`}.`);

    const yaTiene = reservas
      .filter(r => r.estado === CONFIRMADA && r.email === email && r.fecha === fecha && r.hora === hora)
      .reduce((total, r) => total + r.lugares, 0);
    if (yaTiene + lugares > cfg.maxLugares) {
      throw errorUsuario_(`Ya tenés ${yaTiene} ${yaTiene === 1 ? 'lugar reservado' : 'lugares reservados'} en este horario. ` +
        `El máximo por persona es ${cfg.maxLugares}.`);
    }

    reserva = {
      id: Utilities.getUuid().slice(0, 8).toUpperCase(),
      token: Utilities.getUuid().replace(/-/g, ''),
      fecha, hora, lugares, nombre, apellido, email,
    };
    hoja_(HOJAS.RESERVAS).appendRow([
      reserva.id, fecha, hora, lugares, seguro_(nombre), seguro_(apellido), seguro_(email), CONFIRMADA, new Date(ahora_().getTime()), reserva.token,
    ]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  enviarConfirmacion_(reserva, cfg);
  if (cfg.avisarme && cfg.miEmail) {
    avisar_(cfg, `Nueva reserva: ${reserva.nombre} ${reserva.apellido}`,
      `${reserva.nombre} ${reserva.apellido} (${reserva.email}) reservó ${textoLugares_(lugares)} ` +
      `el ${etiquetaFecha_(fecha)} a las ${hora}.`);
  }

  return { ok: true, id: reserva.id, fecha, hora, lugares, etiqueta: etiquetaFecha_(fecha), email };
}

/** Frena el uso masivo: muchas reservas seguidas, de una persona o entre todas. */
function controlarAbuso_(reservas, email) {
  const ahoraMs = ahora_().getTime();
  const ultimaHora = reservas.filter(r => r.creada >= ahoraMs - HORA_MS);
  if (ultimaHora.length >= LIMITE_RESERVAS_POR_HORA) {
    throw errorUsuario_('Hay muchas reservas en este momento. Probá de nuevo en unos minutos.');
  }
  if (ultimaHora.filter(r => r.email === email).length >= LIMITE_RESERVAS_POR_EMAIL_HORA) {
    throw errorUsuario_('Hiciste varias reservas seguidas. Esperá un rato y probá de nuevo.');
  }
  const hoy = formatear_(ahora_(), 'yyyy-MM-dd');
  const pendientes = reservas.filter(r => r.estado === CONFIRMADA && r.email === email && r.fecha >= hoy).length;
  if (pendientes >= LIMITE_RESERVAS_FUTURAS_POR_EMAIL) {
    throw errorUsuario_('Ya tenés muchas reservas pendientes. Cancelá alguna o avisale a tu entrenador.');
  }
}

/** Verifica que el horario exista en la plantilla, no esté suspendido y esté dentro del plazo. */
function buscarTurno_(fecha, hora, cfg) {
  const ahora = ahora_();
  const hoy = formatear_(ahora, 'yyyy-MM-dd');
  const ultimoDia = sumarDias_(hoy, cfg.dias - 1);
  const turno = leerHorarios_().find(h => h.dia === diaDeLaSemana_(fecha) && h.hora === hora);
  const sinClases = leerSinClases_();

  if (!turno || fecha < hoy || fecha > ultimoDia || sinClases.has(fecha) || sinClases.has(clave_(fecha, hora))) {
    throw errorUsuario_('Ese horario ya no está disponible. Elegí otro.');
  }
  if (inicioClase_(fecha, hora) - ahora < cfg.horasReservar * HORA_MS) {
    throw errorUsuario_(`Se puede reservar hasta ${textoHoras_(cfg.horasReservar)} antes de la clase.`);
  }
  return turno;
}

/* ───────────────────────── Cancelar ───────────────────────── */

function consultarReserva_(id, token) {
  const cfg = leerConfig_();
  const r = leerReservas_().find(x => x.id === String(id || '').toUpperCase() && x.token === String(token || ''));
  if (!r) throw errorUsuario_('No encontramos esa reserva. Revisá el enlace del mail.');
  return {
    ok: true,
    reserva: {
      id: r.id, fecha: r.fecha, hora: r.hora, lugares: r.lugares, nombre: r.nombre,
      etiqueta: etiquetaFecha_(r.fecha), estado: r.estado,
      sePuedeCancelar: r.estado === CONFIRMADA && inicioClase_(r.fecha, r.hora) - ahora_() >= cfg.horasCancelar * HORA_MS,
    },
    reglas: { horasCancelar: cfg.horasCancelar },
  };
}

function cancelar_(id, token) {
  const cfg = leerConfig_();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (_) {
    throw errorUsuario_('Hay muchas reservas en este momento. Probá de nuevo en unos segundos.');
  }

  let r;
  try {
    r = leerReservas_().find(x => x.id === String(id || '').toUpperCase() && x.token === String(token || ''));
    if (!r) throw errorUsuario_('No encontramos esa reserva. Revisá el enlace del mail.');
    if (r.estado === CANCELADA) return { ok: true, yaCancelada: true };
    if (inicioClase_(r.fecha, r.hora) - ahora_() < cfg.horasCancelar * HORA_MS) {
      throw errorUsuario_(`Solo se puede cancelar hasta ${textoHoras_(cfg.horasCancelar)} antes de la clase. ` +
        'Si no podés ir, avisale a tu entrenador.');
    }
    hoja_(HOJAS.RESERVAS).getRange(r.fila, COL.ESTADO + 1).setValue(CANCELADA);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  enviarCancelacion_(r, cfg);
  if (cfg.avisarme && cfg.miEmail) {
    avisar_(cfg, `Cancelación: ${r.nombre} ${r.apellido}`,
      `${r.nombre} ${r.apellido} canceló ${textoLugares_(r.lugares)} del ${etiquetaFecha_(r.fecha)} a las ${r.hora}.`);
  }
  return { ok: true };
}

/* ───────────────────────── Mails ───────────────────────── */

function enviarConfirmacion_(r, cfg) {
  const enlace = cfg.urlPagina ? `${cfg.urlPagina}?cancelar=${r.id}&t=${r.token}` : '';
  const cancelar = enlace
    ? `<p>Si no podés ir, cancelá desde este enlace (hasta ${textoHoras_(cfg.horasCancelar)} antes):<br>` +
      `<a href="${enlace}" style="color:#ff6b1a">Cancelar mi turno</a></p>`
    : `<p>Si no podés ir, respondé este mail hasta ${textoHoras_(cfg.horasCancelar)} antes de la clase.</p>`;
  enviar_(cfg, r.email, `Turno confirmado: ${etiquetaFecha_(r.fecha)} · ${r.hora}`,
    `<p>¡Hola ${escapar_(r.nombre)}!</p>` +
    `<p>Tu turno quedó confirmado:</p>` +
    `<p style="font-size:18px"><strong>${etiquetaFecha_(r.fecha)} · ${r.hora}</strong><br>${textoLugares_(r.lugares)}</p>` +
    cancelar +
    `<p>¡Te espero!<br>${escapar_(cfg.nombre)}</p>` +
    `<p style="color:#888;font-size:12px">Código de reserva: ${r.id}</p>`);
}

function enviarCancelacion_(r, cfg) {
  enviar_(cfg, r.email, `Turno cancelado: ${etiquetaFecha_(r.fecha)} · ${r.hora}`,
    `<p>Hola ${escapar_(r.nombre)}:</p>` +
    `<p>Cancelamos tu turno del <strong>${etiquetaFecha_(r.fecha)} a las ${r.hora}</strong>.</p>` +
    (cfg.urlPagina ? `<p>Cuando quieras, reservá otro en <a href="${cfg.urlPagina}" style="color:#ff6b1a">la página de turnos</a>.</p>` : '') +
    `<p>${escapar_(cfg.nombre)}</p>`);
}

function avisar_(cfg, asunto, texto) {
  enviar_(cfg, cfg.miEmail, asunto, `<p>${escapar_(texto)}</p>`);
}

function enviar_(cfg, para, asunto, html) {
  try {
    // Gmail limita los mails por día. Si casi se agotó, se guarda la reserva pero no se manda el mail,
    // para que nadie pueda dejarte sin cupo de envíos y los avisos importantes sigan saliendo.
    const esAviso = cfg.miEmail && para === cfg.miEmail;
    if (!esAviso && MailApp.getRemainingDailyQuota() <= MAILS_RESERVADOS_PARA_VOS) {
      console.error('Cuota diaria de mails casi agotada: no se envió el mail a ' + para);
      return;
    }
    const opciones = { to: para, subject: asunto, htmlBody: html, name: cfg.nombre };
    if (cfg.miEmail && para !== cfg.miEmail) opciones.replyTo = cfg.miEmail;
    MailApp.sendEmail(opciones);
  } catch (err) {
    // La reserva ya quedó guardada; un mail que falla no la deshace.
    console.error('No se pudo enviar el mail a ' + para, err);
  }
}

/* ───────────────────────── Lectura de la planilla ───────────────────────── */

function hoja_(nombre) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!hoja) throw new Error(`Falta la pestaña "${nombre}". Ejecutá la función configurar.`);
  return hoja;
}

function filas_(nombre) {
  return hoja_(nombre).getDataRange().getValues().slice(1);
}

function leerConfig_() {
  const valores = {};
  filas_(HOJAS.CONFIG).forEach(([texto, valor]) => { valores[String(texto).trim()] = valor; });
  const cfg = {};
  OPCIONES.forEach(([clave, texto, inicial]) => {
    const v = valores[texto];
    cfg[clave] = v === undefined || v === '' ? inicial : v;
  });
  ['dias', 'horasReservar', 'horasCancelar', 'maxLugares'].forEach(c => { cfg[c] = Number(cfg[c]); });
  cfg.avisarme = /^s[ií]/i.test(String(cfg.avisarme));
  cfg.urlPagina = String(cfg.urlPagina || '').trim();
  cfg.miEmail = String(cfg.miEmail || '').trim();
  return cfg;
}

function leerHorarios_() {
  return filas_(HOJAS.HORARIOS)
    .map(([dia, hora, cupo]) => ({ dia: indiceDia_(dia), hora: textoHora_(hora), cupo: Number(cupo) }))
    .filter(h => h.dia >= 0 && h.hora && h.cupo > 0);
}

function leerSinClases_() {
  const conjunto = new Set();
  filas_(HOJAS.SIN_CLASES).forEach(([fecha, hora]) => {
    const f = textoFecha_(fecha);
    if (!f) return;
    const h = textoHora_(hora);
    conjunto.add(h ? clave_(f, h) : f);
  });
  return conjunto;
}

function leerReservas_() {
  return filas_(HOJAS.RESERVAS).map((fila, i) => ({
    fila: i + 2,
    id: String(fila[COL.ID]),
    fecha: textoFecha_(fila[COL.FECHA]),
    hora: textoHora_(fila[COL.HORA]),
    lugares: Number(fila[COL.LUGARES]) || 0,
    nombre: sinApostrofe_(fila[COL.NOMBRE]),
    apellido: sinApostrofe_(fila[COL.APELLIDO]),
    email: sinApostrofe_(fila[COL.EMAIL]).toLowerCase(),
    estado: String(fila[COL.ESTADO]).trim(),
    token: String(fila[COL.TOKEN]),
    creada: fila[COL.CREADA] instanceof Date ? fila[COL.CREADA].getTime() : 0,
  })).filter(r => r.id);
}

function lugaresOcupados_(reservas) {
  const ocupados = {};
  reservas.filter(r => r.estado === CONFIRMADA).forEach(r => {
    const k = clave_(r.fecha, r.hora);
    ocupados[k] = (ocupados[k] || 0) + r.lugares;
  });
  return ocupados;
}

/* ───────────────────────── Fechas y textos ───────────────────────── */

function ahora_() {
  return new Date();
}

function formatear_(fecha, patron) {
  return Utilities.formatDate(fecha, ZONA_HORARIA, patron);
}

function inicioClase_(fecha, hora) {
  return Utilities.parseDate(`${fecha} ${hora}`, ZONA_HORARIA, 'yyyy-MM-dd HH:mm').getTime();
}

function sumarDias_(fecha, dias) {
  // Se parte del mediodía para no tener problemas con cambios de hora.
  const base = Utilities.parseDate(`${fecha} 12:00`, ZONA_HORARIA, 'yyyy-MM-dd HH:mm');
  return formatear_(new Date(base.getTime() + dias * 24 * HORA_MS), 'yyyy-MM-dd');
}

/** 0 = lunes … 6 = domingo */
function diaDeLaSemana_(fecha) {
  const base = Utilities.parseDate(`${fecha} 12:00`, ZONA_HORARIA, 'yyyy-MM-dd HH:mm');
  return Number(formatear_(base, 'u')) - 1;
}

function etiquetaFecha_(fecha) {
  const [, mes, dia] = fecha.split('-').map(Number);
  return `${DIAS_MOSTRAR[diaDeLaSemana_(fecha)]} ${dia} de ${MESES[mes - 1]}`;
}

function indiceDia_(texto) {
  const normal = String(texto).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return DIAS.indexOf(normal);
}

function textoHora_(valor) {
  if (valor instanceof Date) return formatear_(valor, 'HH:mm');
  const m = String(valor).trim().match(/^(\d{1,2})[:.](\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

function textoFecha_(valor) {
  if (valor instanceof Date) return formatear_(valor, 'yyyy-MM-dd');
  const t = String(valor).trim();
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const local = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // 25/12/2026
  if (local) return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
  return '';
}

function clave_(fecha, hora) {
  return `${fecha} ${hora}`;
}

function textoLugares_(n) {
  return n === 1 ? '1 lugar' : `${n} lugares`;
}

function textoHoras_(n) {
  return n === 1 ? '1 hora' : `${n} horas`;
}

function limpiar_(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

/** Evita que un texto que empieza con = + - @ se interprete como fórmula en la planilla. */
function seguro_(texto) {
  return /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
}

function sinApostrofe_(valor) {
  return String(valor).replace(/^'/, '').trim();
}

function escapar_(texto) {
  return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
