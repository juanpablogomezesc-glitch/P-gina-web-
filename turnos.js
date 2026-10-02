// Página de turnos. Habla con la planilla de Google a través de la app web de Apps Script.
// Pegá entre las comillas la URL que te da Google al implementar (termina en /exec).
// Mientras esté vacía, la página funciona en modo de prueba con horarios de ejemplo.
const API_URL = '';

(() => {
  const url = window.TURNOS_API_URL || API_URL;
  const api = url ? apiReal(url) : apiDePrueba();
  const $ = id => document.getElementById(id);

  $('anio').textContent = new Date().getFullYear();
  if (!url) $('aviso-prueba').hidden = false;

  const params = new URLSearchParams(location.search);
  if (params.get('cancelar')) iniciarCancelacion(params.get('cancelar'), params.get('t') || '');
  else cargarHorarios();

  /* ─────────── Reservar ─────────── */

  let elegido = null;
  let maxLugares = 4;

  async function cargarHorarios() {
    mostrar('estado', 'Cargando horarios…');
    $('dias').replaceChildren();
    let r;
    try {
      r = await api.horarios();
    } catch (_) {
      return mostrar('estado', 'No pudimos cargar los horarios. Revisá tu conexión y recargá la página.', true);
    }
    if (!r.ok) return mostrar('estado', r.error, true);

    maxLugares = r.reglas.maxLugares;
    $('reglas').textContent =
      `Elegí el día y el horario. Podés reservar hasta ${horas(r.reglas.horasReservar)} antes de la clase ` +
      `y cancelar hasta ${horas(r.reglas.horasCancelar)} antes. Te llega la confirmación por mail.`;

    if (!r.dias.length) return mostrar('estado', 'No hay horarios disponibles por ahora. Volvé a fijarte más tarde.');
    $('estado').hidden = true;

    r.dias.forEach(dia => {
      const bloque = document.createElement('div');
      bloque.className = 'dia';
      const titulo = document.createElement('h2');
      titulo.textContent = dia.etiqueta;
      const lista = document.createElement('div');
      lista.className = 'horarios';
      dia.turnos.forEach(t => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'horario';
        const hora = document.createElement('strong');
        hora.textContent = t.hora;
        const libres = document.createElement('span');
        libres.textContent = t.libres === 1 ? 'Queda 1 lugar' : `Quedan ${t.libres} lugares`;
        b.append(hora, libres);
        b.addEventListener('click', () => elegir(dia, t));
        lista.append(b);
      });
      bloque.append(titulo, lista);
      $('dias').append(bloque);
    });
  }

  function elegir(dia, turno) {
    elegido = { fecha: dia.fecha, hora: turno.hora, etiqueta: dia.etiqueta };
    $('turno-elegido').textContent = `${dia.etiqueta} · ${turno.hora}`;
    const max = Math.min(maxLugares, turno.libres);
    $('lugares').replaceChildren(...Array.from({ length: max }, (_, i) => new Option(i === 0 ? '1 lugar' : `${i + 1} lugares`, i + 1)));
    $('error-formulario').hidden = true;
    $('dias').hidden = true;
    $('formulario').hidden = false;
    $('formulario').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('nombre').focus({ preventScroll: true });
  }

  $('volver').addEventListener('click', () => {
    $('formulario').hidden = true;
    $('dias').hidden = false;
  });

  $('formulario').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const datos = {
      accion: 'reservar',
      fecha: elegido.fecha,
      hora: elegido.hora,
      lugares: Number(f.lugares.value),
      nombre: f.nombre.value.trim(),
      apellido: f.apellido.value.trim(),
      email: f.email.value.trim(),
      sitio: f.sitio.value,
    };
    if (!datos.nombre || !datos.apellido) return errorFormulario('Completá tu nombre y apellido.');
    if (!f.email.checkValidity() || !datos.email) return errorFormulario('Revisá tu email: parece que no está bien escrito.');

    $('confirmar').disabled = true;
    $('confirmar').textContent = 'Reservando…';
    let r;
    try {
      r = await api.reservar(datos);
    } catch (_) {
      r = { ok: false, error: 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.' };
    }
    $('confirmar').disabled = false;
    $('confirmar').textContent = 'Confirmar reserva';
    if (!r.ok) return errorFormulario(r.error);

    $('formulario').hidden = true;
    $('exito-detalle').textContent =
      `${elegido.etiqueta} · ${elegido.hora} · ${datos.lugares === 1 ? '1 lugar' : `${datos.lugares} lugares`}. ` +
      `Te mandamos la confirmación a ${datos.email}. Si no la ves, revisá la carpeta de spam.`;
    $('exito').hidden = false;
    $('exito').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('otro-turno').addEventListener('click', () => {
    $('exito').hidden = true;
    $('dias').hidden = false;
    cargarHorarios();
  });

  function errorFormulario(texto) {
    $('error-formulario').textContent = texto;
    $('error-formulario').hidden = false;
  }

  /* ─────────── Cancelar ─────────── */

  async function iniciarCancelacion(id, token) {
    $('vista-reservar').hidden = true;
    $('vista-cancelar').hidden = false;
    let r;
    try {
      r = await api.reserva(id, token);
    } catch (_) {
      return mostrar('estado-cancelar', 'No pudimos conectarnos. Revisá tu conexión y recargá la página.', true);
    }
    if (!r.ok) return mostrar('estado-cancelar', r.error, true);

    const res = r.reserva;
    const turno = `${res.etiqueta} · ${res.hora} (${res.lugares === 1 ? '1 lugar' : `${res.lugares} lugares`})`;
    if (res.estado === 'Cancelada') return mostrar('estado-cancelar', `Tu turno del ${turno} ya estaba cancelado.`);
    if (!res.sePuedeCancelar) {
      return mostrar('estado-cancelar',
        `Tu turno del ${turno} ya no se puede cancelar desde acá: el plazo es hasta ` +
        `${horas(r.reglas.horasCancelar)} antes de la clase. Si no podés ir, avisale a tu entrenador.`, true);
    }

    $('estado-cancelar').hidden = true;
    $('texto-cancelar').textContent = `Hola ${res.nombre}, ¿querés cancelar tu turno del ${turno}?`;
    $('detalle-cancelar').hidden = false;

    $('confirmar-cancelar').addEventListener('click', async () => {
      $('confirmar-cancelar').disabled = true;
      let c;
      try {
        c = await api.cancelar(id, token);
      } catch (_) {
        c = { ok: false, error: 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.' };
      }
      if (!c.ok) {
        $('confirmar-cancelar').disabled = false;
        $('error-cancelar').textContent = c.error;
        $('error-cancelar').hidden = false;
        return;
      }
      $('detalle-cancelar').hidden = true;
      mostrar('estado-cancelar', `Listo, cancelamos tu turno del ${turno}. Te llega un mail de confirmación.`);
    });
  }

  /* ─────────── Utilidades ─────────── */

  function mostrar(id, texto, esError = false) {
    const el = $(id);
    el.textContent = texto;
    el.classList.toggle('error', esError);
    el.hidden = false;
  }

  function horas(n) {
    return n === 1 ? '1 hora' : `${n} horas`;
  }

  function apiReal(base) {
    const pedir = async (promesa) => (await promesa).json();
    return {
      horarios: () => pedir(fetch(`${base}?accion=horarios`)),
      reserva: (id, token) => pedir(fetch(`${base}?accion=reserva&id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`)),
      // Se manda como texto plano para que Google acepte el pedido desde otra página.
      reservar: datos => pedir(fetch(base, { method: 'POST', body: JSON.stringify(datos) })),
      cancelar: (id, token) => pedir(fetch(base, { method: 'POST', body: JSON.stringify({ accion: 'cancelar', id, token }) })),
    };
  }

  // Horarios de ejemplo para ver la página sin la planilla conectada.
  function apiDePrueba() {
    const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const plantilla = { 1: ['08:00', '18:00', '19:00'], 3: ['08:00', '18:00', '19:00'], 5: ['08:00', '18:00'] };
    const libres = {};
    const dias = [];
    const hoy = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
      const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const turnos = (plantilla[d.getDay()] || [])
        .filter(h => new Date(`${fecha}T${h}:00`) - hoy >= 2 * 3600 * 1000)
        .map((h, j) => ({ hora: h, cupo: 4, libres: libres[`${fecha} ${h}`] = [4, 2, 1, 3][(i + j) % 4] }));
      if (turnos.length) dias.push({ fecha, etiqueta: `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`, turnos });
    }
    const espera = () => new Promise(r => setTimeout(r, 400));
    return {
      horarios: async () => {
        await espera();
        dias.forEach(d => d.turnos.forEach(t => { t.libres = libres[`${d.fecha} ${t.hora}`]; }));
        dias.forEach(d => { d.turnos = d.turnos.filter(t => t.libres > 0); });
        return { ok: true, dias: dias.filter(d => d.turnos.length), reglas: { maxLugares: 4, horasReservar: 2, horasCancelar: 1 } };
      },
      reservar: async d => {
        await espera();
        const k = `${d.fecha} ${d.hora}`;
        if (d.lugares > libres[k]) return { ok: false, error: `En ese horario quedan ${libres[k]} lugares.` };
        libres[k] -= d.lugares;
        return { ok: true };
      },
      reserva: async () => ({ ok: false, error: 'En modo de prueba no hay reservas para cancelar.' }),
      cancelar: async () => ({ ok: false, error: 'En modo de prueba no hay reservas para cancelar.' }),
    };
  }
})();
