// Simula las partes de Google Apps Script que usa Codigo.gs, para probarlo sin una cuenta de Google.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const OFFSET = '-03:00'; // Argentina no tiene horario de verano

function crearHoja(nombre) {
  const datos = [];
  const asegurar = (f, c) => {
    while (datos.length < f) datos.push([]);
    const fila = datos[f - 1];
    while (fila.length < c) fila.push('');
  };
  const rango = (f, c, nf, nc) => {
    const r = {
      setNumberFormat: () => r,
      setFontWeight: () => r,
      setValues(vals) {
        vals.forEach((fila, i) => fila.forEach((v, j) => { asegurar(f + i, c + j); datos[f + i - 1][c + j - 1] = v; }));
        return r;
      },
      setValue(v) { asegurar(f, c); datos[f - 1][c - 1] = v; return r; },
      getValues() {
        const out = [];
        for (let i = 0; i < nf; i++) { asegurar(f + i, c + nc - 1); out.push(datos[f + i - 1].slice(c - 1, c - 1 + nc)); }
        return out;
      },
    };
    return r;
  };
  return {
    nombre, datos,
    getRange: (f, c, nf = 1, nc = 1) => rango(f, c, nf, nc),
    getDataRange: () => ({
      getValues: () => {
        const ancho = Math.max(0, ...datos.map(f => f.length));
        return datos.filter(f => f.some(v => v !== '')).map(f => [...f, ...Array(ancho - f.length).fill('')]);
      },
    }),
    appendRow(fila) { datos.push([...fila]); },
    getMaxRows: () => 1000,
    setFrozenRows() {},
  };
}

function cargar({ ahora }) {
  const hojas = {};
  const mails = [];
  let cuota = 100;
  let fallaMail = false;
  let fallaCalendario = false;
  const calendarios = [];
  const crearCalendario = (nombre) => {
    const eventos = [];
    const cal = {
      nombre, eventos,
      getName: () => nombre,
      createEvent(titulo, inicio, fin) {
        if (fallaCalendario) throw new Error('Sin permiso para usar el calendario');
        const ev = { titulo, desc: '', inicio, fin, tags: {}, borrado: false,
          setTitle(x) { ev.titulo = x; }, setDescription(x) { ev.desc = x; },
          setTag(k, v) { ev.tags[k] = v; }, getTag: k => ev.tags[k] || null,
          deleteEvent() { ev.borrado = true; eventos.splice(eventos.indexOf(ev), 1); } };
        eventos.push(ev); return ev;
      },
      getEvents(desde, hasta) {
        if (fallaCalendario) throw new Error('Sin permiso para usar el calendario');
        return eventos.filter(e => e.inicio < hasta && e.fin > desde);
      },
    };
    return cal;
  };
  const ss = {
    setSpreadsheetTimeZone() {},
    getSheetByName: n => hojas[n] || null,
    insertSheet: n => (hojas[n] = crearHoja(n)),
  };
  const contexto = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CalendarApp: {
      getCalendarsByName: n => { if (fallaCalendario) throw new Error('Sin permiso para usar el calendario'); return calendarios.filter(c => c.nombre === n); },
      createCalendar: (n) => { if (fallaCalendario) throw new Error('Sin permiso para usar el calendario'); const c = crearCalendario(n); calendarios.push(c); return c; },
    },
    MailApp: { sendEmail: m => { if (fallaMail) throw new Error('Sin permiso para enviar mails'); mails.push(m); }, getRemainingDailyQuota: () => cuota },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'juanpablo@ejemplo.com' }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: texto => ({ texto, setMimeType() { return this; } }),
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      parseDate: (s, _tz, _p) => new Date(s.replace(' ', 'T') + ':00' + OFFSET),
      formatDate: (d, _tz, patron) => {
        const local = new Date(d.getTime() - 3 * 3600 * 1000); // pasar a hora argentina
        const p = n => String(n).padStart(2, '0');
        const v = {
          yyyy: local.getUTCFullYear(), MM: p(local.getUTCMonth() + 1), dd: p(local.getUTCDate()),
          HH: p(local.getUTCHours()), mm: p(local.getUTCMinutes()), u: ((local.getUTCDay() + 6) % 7) + 1,
        };
        return patron.replace(/yyyy|MM|dd|HH|mm|u/g, k => v[k]);
      },
    },
  };
  vm.createContext(contexto);
  const codigo = fs.readFileSync(path.join(__dirname, '..', 'Codigo.gs'), 'utf8');
  vm.runInContext(codigo + '\nthis.__api = { configurar, doGet, doPost, sincronizarTodo, setAhora: f => { ahora_ = f; } };', contexto);
  const api = contexto.__api;
  let reloj = new Date(ahora);
  api.setAhora(() => new Date(reloj.getTime()));

  return {
    hojas, mails, calendarios,
    setFallaCalendario: v => { fallaCalendario = v; },
    sincronizarTodo: api.sincronizarTodo,
    configurar: api.configurar,
    setCuota: n => { cuota = n; },
    setFallaMail: v => { fallaMail = v; },
    moverReloj: iso => { reloj = new Date(iso); },
    get: params => JSON.parse(api.doGet({ parameter: params }).texto),
    post: datos => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(datos) } }).texto),
  };
}

module.exports = { cargar };
