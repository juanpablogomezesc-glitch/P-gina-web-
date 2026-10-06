// Ejecutar con: node --test sistema-turnos/pruebas
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./simulador-google');

// Lunes 5 de octubre de 2026, 7:00 en Argentina
const LUNES_7AM = '2026-10-05T07:00:00-03:00';

function nuevo(ahora = LUNES_7AM) {
  const g = cargar({ ahora });
  g.configurar();
  return g;
}

const alumno = (extra = {}) => ({
  accion: 'reservar', fecha: '2026-10-05', hora: '18:00', lugares: 1,
  nombre: 'Ana', apellido: 'Pérez', email: 'ana@ejemplo.com', ...extra,
});

const turno = (g, fecha, hora) => {
  const dia = g.get({ accion: 'horarios' }).dias.find(d => d.fecha === fecha);
  return dia && dia.turnos.find(t => t.hora === hora);
};

test('crea las cuatro pestañas', () => {
  const g = nuevo();
  assert.deepEqual(Object.keys(g.hojas).sort(), ['Configuración', 'Días sin clases', 'Horarios', 'Reservas']);
});

test('muestra horarios y oculta los que empiezan en menos de 2 horas', () => {
  const g = nuevo();
  const r = g.get({ accion: 'horarios' });
  assert.equal(r.ok, true);
  const lunes = r.dias.find(d => d.fecha === '2026-10-05');
  assert.equal(lunes.etiqueta, 'Lunes 5 de octubre');
  assert.deepEqual(lunes.turnos.map(t => t.hora), ['18:00', '19:00']); // 08:00 ya no se puede
  assert.equal(r.dias.find(d => d.fecha === '2026-10-07').etiqueta, 'Miércoles 7 de octubre');
  assert.ok(!r.dias.some(d => d.fecha > '2026-10-11'), 'solo 7 días para adelante');
});

test('reservar descuenta lugares y el horario desaparece cuando se llena', () => {
  const g = nuevo();
  assert.equal(g.post(alumno({ lugares: 3 })).ok, true);
  assert.equal(turno(g, '2026-10-05', '18:00').libres, 1);

  const demasiados = g.post(alumno({ email: 'beto@ejemplo.com', lugares: 2 }));
  assert.equal(demasiados.ok, false);
  assert.match(demasiados.error, /queda 1 lugar/);

  assert.equal(g.post(alumno({ email: 'beto@ejemplo.com' })).ok, true);
  assert.equal(turno(g, '2026-10-05', '18:00'), undefined);

  const lleno = g.post(alumno({ email: 'caro@ejemplo.com' }));
  assert.equal(lleno.ok, false);
  assert.match(lleno.error, /llen/);
});

test('una persona no puede pasar de 4 lugares en el mismo horario', () => {
  const g = nuevo();
  g.hojas['Horarios'].appendRow(['Martes', '20:00', 10]);
  assert.equal(g.post(alumno({ fecha: '2026-10-06', hora: '20:00', lugares: 3 })).ok, true);
  const r = g.post(alumno({ fecha: '2026-10-06', hora: '20:00', lugares: 2, email: 'ANA@ejemplo.com ' }));
  assert.equal(r.ok, false);
  assert.match(r.error, /máximo por persona es 4/);
  assert.equal(g.post(alumno({ lugares: 5 })).ok, false);
});

test('no deja reservar fuera de plazo, en días sin clases ni horarios inventados', () => {
  const g = nuevo();
  assert.match(g.post(alumno({ hora: '08:00' })).error, /hasta 2 horas antes/);
  assert.equal(g.post(alumno({ hora: '17:00' })).ok, false);
  assert.equal(g.post(alumno({ fecha: '2026-10-20' })).ok, false); // más allá de 7 días

  g.hojas['Días sin clases'].appendRow(['2026-10-07', '', 'Feriado']);
  g.hojas['Días sin clases'].appendRow(['2026-10-09', '18:00', 'Viaje']);
  const r = g.get({ accion: 'horarios' });
  assert.ok(!r.dias.some(d => d.fecha === '2026-10-07'));
  assert.deepEqual(r.dias.find(d => d.fecha === '2026-10-09').turnos.map(t => t.hora), ['08:00']);
  assert.equal(g.post(alumno({ fecha: '2026-10-07' })).ok, false);
});

test('valida los datos del alumno', () => {
  const g = nuevo();
  assert.match(g.post(alumno({ nombre: '  ' })).error, /nombre y apellido/);
  assert.match(g.post(alumno({ email: 'ana@' })).error, /email/);
  assert.equal(g.post({ accion: 'nada' }).ok, false);
});

test('manda el mail de confirmación con enlace para cancelar', () => {
  const g = nuevo();
  g.hojas['Configuración'].datos.find(f => f[0] === 'Página de turnos (URL)')[1] = 'https://ejemplo.com/turnos.html';
  const r = g.post(alumno({ lugares: 2 }));
  assert.equal(g.mails.length, 1);
  const m = g.mails[0];
  assert.equal(m.to, 'ana@ejemplo.com');
  assert.equal(m.subject, 'Turno confirmado: Lunes 5 de octubre · 18:00');
  assert.match(m.htmlBody, /2 lugares/);
  assert.match(m.htmlBody, new RegExp(`turnos\\.html\\?cancelar=${r.id}&t=`));
  assert.equal(m.replyTo, 'juanpablo@ejemplo.com');
});

test('cancelar libera los lugares, respeta el plazo y pide el token correcto', () => {
  const g = nuevo();
  const r = g.post(alumno({ lugares: 4 }));
  const fila = g.hojas['Reservas'].datos.find(f => f[0] === r.id);
  const token = fila[9];

  assert.equal(g.post({ accion: 'cancelar', id: r.id, token: 'otro' }).ok, false);

  const consulta = g.get({ accion: 'reserva', id: r.id, token });
  assert.equal(consulta.reserva.sePuedeCancelar, true);
  assert.equal(consulta.reserva.etiqueta, 'Lunes 5 de octubre');

  assert.equal(g.post({ accion: 'cancelar', id: r.id, token }).ok, true);
  assert.equal(fila[7], 'Cancelada');
  assert.equal(turno(g, '2026-10-05', '18:00').libres, 4);
  assert.equal(g.post({ accion: 'cancelar', id: r.id, token }).yaCancelada, true);
  assert.match(g.mails.at(-1).subject, /Turno cancelado/);

  const otra = g.post(alumno({ email: 'beto@ejemplo.com' }));
  const tokenOtra = g.hojas['Reservas'].datos.find(f => f[0] === otra.id)[9];
  g.moverReloj('2026-10-05T17:30:00-03:00'); // falta media hora
  assert.equal(g.get({ accion: 'reserva', id: otra.id, token: tokenOtra }).reserva.sePuedeCancelar, false);
  assert.match(g.post({ accion: 'cancelar', id: otra.id, token: tokenOtra }).error, /hasta 1 hora antes/);
});

test('evita que un nombre se interprete como fórmula en la planilla', () => {
  const g = nuevo();
  const r = g.post(alumno({ nombre: '=HYPERLINK("x")' }));
  assert.equal(r.ok, true);
  assert.equal(g.hojas['Reservas'].datos.find(f => f[0] === r.id)[4], `'=HYPERLINK("x")`);
});

test('el campo trampa no guarda nada', () => {
  const g = nuevo();
  assert.equal(g.post(alumno({ sitio: 'spam' })).ok, true);
  assert.equal(g.hojas['Reservas'].datos.length, 1);
  assert.equal(g.mails.length, 0);
});

test('avisa al entrenador si está activado', () => {
  const g = nuevo();
  g.hojas['Configuración'].datos.find(f => f[0] === 'Avisarme cada reserva (Sí/No)')[1] = 'Sí';
  g.post(alumno());
  assert.equal(g.mails.length, 2);
  assert.equal(g.mails[1].to, 'juanpablo@ejemplo.com');
  assert.match(g.mails[1].subject, /Nueva reserva: Ana Pérez/);
});

test('configurar no pisa una planilla existente y deja sus datos', () => {
  const g = nuevo();
  g.hojas['Horarios'].datos.push(['Jueves', '20:00', 3]);
  g.configurar(); // segunda vez
  assert.equal(g.hojas['Horarios'].datos.length, 10); // 1 encabezado + 8 ejemplos + 1 propio
  assert.deepEqual(g.hojas['Horarios'].datos.at(-1), ['Jueves', '20:00', 3]);
});

test('frena a una persona que reserva muchas veces seguidas', () => {
  const g = nuevo();
  ['19:00', '20:00', '21:00', '22:00', '23:00'].forEach(h => g.hojas['Horarios'].appendRow(['Martes', h, 100]));
  ['19:00', '20:00', '21:00', '22:00', '23:00'].forEach(h => assert.equal(g.post(alumno({ fecha: '2026-10-06', hora: h })).ok, true));
  const r = g.post(alumno({ fecha: '2026-10-06', hora: '19:00', lugares: 1 }));
  assert.equal(r.ok, false);
  assert.match(r.error, /varias reservas seguidas/);
  // otra persona sigue pudiendo reservar
  assert.equal(g.post(alumno({ fecha: '2026-10-06', hora: '20:00', email: 'otra@ejemplo.com' })).ok, true);
  // una hora después, la misma persona puede volver a reservar
  g.moverReloj('2026-10-05T08:30:00-03:00');
  assert.equal(g.post(alumno({ fecha: '2026-10-06', hora: '20:00' })).ok, true);
});

test('frena el uso masivo entre todas las personas', () => {
  const g = nuevo();
  g.hojas['Horarios'].appendRow(['Martes', '20:00', 500]);
  for (let i = 0; i < 40; i++) assert.equal(g.post(alumno({ fecha: '2026-10-06', hora: '20:00', email: `a${i}@ejemplo.com` })).ok, true);
  const r = g.post(alumno({ fecha: '2026-10-06', hora: '20:00', email: 'nuevo@ejemplo.com' }));
  assert.equal(r.ok, false);
  assert.match(r.error, /muchas reservas en este momento/);
});

test('limita las reservas pendientes de una misma persona', () => {
  const g = nuevo();
  g.hojas['Horarios'].appendRow(['Martes', '20:00', 100]);
  g.hojas['Horarios'].appendRow(['Jueves', '20:00', 100]);
  // se simulan 12 reservas viejas (de hace días) todavía pendientes
  for (let i = 0; i < 12; i++) g.hojas['Reservas'].appendRow([`X${i}`, '2026-10-08', '20:00', 1, 'Ana', 'Pérez', 'ana@ejemplo.com', 'Confirmada', new Date('2026-10-01T10:00:00Z'), `t${i}`]);
  const r = g.post(alumno({ fecha: '2026-10-06', hora: '20:00' }));
  assert.equal(r.ok, false);
  assert.match(r.error, /muchas reservas pendientes/);
});

test('si queda poca cuota de mails, guarda la reserva pero no manda confirmaciones', () => {
  const g = nuevo();
  g.setCuota(5);
  const r = g.post(alumno());
  assert.equal(r.ok, true); // la reserva queda guardada de todos modos
  assert.equal(g.mails.length, 0); // pero no se gastó cuota en mails
  assert.equal(g.hojas['Reservas'].datos.length, 2);
});
