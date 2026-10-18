(function () {
  const P = window.Progreso;
  const NS = 'http://www.w3.org/2000/svg';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fmtRel = n => (Math.round(n * 100) / 100).toString().replace('.', ',');
  const fmtNum = n => (Math.round(n * 10) / 10).toString().replace('.', ',');

  // ---- Datos de ejemplo (deterministas) ----
  // series: una por serie realizada, con el número de semana de la pestaña. asistencia: fechas tildadas en el calendario.
  function demo() {
    let sem = 7; const azar = () => (sem = (sem * 9301 + 49297) % 233280) / 233280;
    const base = { 'Sentadilla C/B': 70, 'Press plano C/B': 50, 'Despegue C/B': 90, 'Hip Trust C/B': 80, 'Prensa 45º': 120, 'Press Inclinado C/M': 24, 'Remo Polea Baja Neutra': 45 };
    const categorias = { 'Sentadilla C/B': 'Tren inferior', 'Prensa 45º': 'Tren inferior', 'Press plano C/B': 'Tren superior', 'Press Inclinado C/M': 'Tren superior',
      'Despegue C/B': 'Tren inferior', 'Hip Trust C/B': 'Tren inferior', 'Remo Polea Baja Neutra': 'Tren superior' };
    const series = [], asistencia = [];
    for (let w = 0; w < 36; w++) {
      const lunes = new Date(Date.UTC(2025, 9, 6) + w * 7 * 864e5);
      if (azar() < 0.12) continue; // semana sin entrenar
      [0, 2, 4].forEach((d, i) => {
        if (azar() < 0.15) return;
        asistencia.push(new Date(lunes.getTime() + d * 864e5).toISOString().slice(0, 10));
        const ej = Object.keys(base);
        [ej[(i * 2) % ej.length], ej[(i * 2 + 1) % ej.length], ej[(i * 2 + 2) % ej.length]].forEach(nombre => {
          const reps = [5, 6, 8, 3, 10][Math.floor(azar() * 5)];
          const kg = Math.round((base[nombre] + w * 0.9 + azar() * 4) / 2.5) * 2.5;
          series.push({ semana: 67 + w, ejercicio: nombre, kg, reps });
        });
      });
    }
    return { series, asistencia, categorias };
  }
  // Dirección del script central (se completa al publicarlo). Con ?c=CLAVE se muestran los datos reales de esa persona.
  const API_URL = 'https://script.google.com/macros/s/AKfycbxJOD38AnzlNTIYBdZjqZF20HhrCT2H53XL_7IuNtCS2oyCZfjfr1VK7PQX-1YgsEyfDQ/exec';
  // La clave viene en el link; se recuerda en este navegador por si el acceso directo la pierde
  const clave = (() => {
    let c = new URLSearchParams(location.search).get('c');
    try {
      if (c && /^[A-Za-z0-9]{24}$/.test(c)) localStorage.setItem('pr-clave', c);
      else if (!c) c = localStorage.getItem('pr-clave');
    } catch (e) {}
    return c || null;
  })();
  let datos = clave ? { series: [], asistencia: [] } : demo();
  let objetivos = {};
  let actualizadoIso = '';
  let semanasFiltro = 0;

  // ---- Utilidades de dibujo ----
  const el = (tag, attrs, padre) => { const e = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v)); if (padre) padre.appendChild(e); return e; };
  const tooltip = document.getElementById('tooltip');
  function mostrarTip(html, x, y) {
    tooltip.innerHTML = html; tooltip.hidden = false;
    const r = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.min(Math.max(8, x - r.width / 2), innerWidth - r.width - 8) + 'px';
    tooltip.style.top = Math.max(8, y - r.height - 14) + 'px';
  }
  const ocultarTip = () => { tooltip.hidden = true; };

  function lineaGrafico(contenedor, puntos, titulo, unidad) {
    const W = 460, H = 200, m = { t: 14, r: 14, b: 26, l: 40 };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': titulo + ': ' + puntos.map(p => `semana ${p.semana} ${fmtNum(p.valor)} ${unidad}`).join(', ') });
    const t0 = puntos[0].semana, t1 = puntos[puntos.length - 1].semana;
    const vals = puntos.map(p => p.valor);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = Math.max((hi - lo) * 0.2, 2); lo = Math.floor((lo - pad) / 5) * 5; hi = Math.ceil((hi + pad) / 5) * 5;
    const x = t => m.l + (t1 === t0 ? (W - m.l - m.r) / 2 : (t - t0) / (t1 - t0) * (W - m.l - m.r));
    const y = v => m.t + (hi - v) / (hi - lo) * (H - m.t - m.b);
    for (let i = 0; i <= 3; i++) {
      const v = lo + (hi - lo) * i / 3;
      el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: '#2e2e2e', 'stroke-width': 1 }, svg);
      const tx = el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end', fill: '#a3a3a3', 'font-size': 11 }, svg); tx.textContent = Math.round(v);
    }
    [puntos[0], puntos[puntos.length - 1]].forEach((p, i) => {
      const tx = el('text', { x: x(p.semana), y: H - 6, 'text-anchor': i ? 'end' : 'start', fill: '#a3a3a3', 'font-size': 11 }, svg); tx.textContent = 'Semana ' + p.semana;
    });
    const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(p.semana).toFixed(1)},${y(p.valor).toFixed(1)}`).join('');
    el('path', { d, fill: 'none', stroke: '#ff6b1a', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    const ult = puntos[puntos.length - 1];
    el('circle', { cx: x(ult.semana), cy: y(ult.valor), r: 4.5, fill: '#ff6b1a', stroke: '#1a1a1a', 'stroke-width': 2 }, svg);
    const guia = el('line', { y1: m.t, y2: H - m.b, stroke: '#a3a3a3', 'stroke-dasharray': '3 3', visibility: 'hidden' }, svg);
    const foco = el('circle', { r: 5, fill: '#ff6b1a', stroke: '#1a1a1a', 'stroke-width': 2, visibility: 'hidden' }, svg);
    const area = el('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }, svg);
    function mover(ev) {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * W;
      let mejor = puntos[0], dist = Infinity;
      puntos.forEach(p => { const dd = Math.abs(x(p.semana) - px); if (dd < dist) { dist = dd; mejor = p; } });
      const cx = x(mejor.semana);
      guia.setAttribute('x1', cx); guia.setAttribute('x2', cx); guia.setAttribute('visibility', 'visible');
      foco.setAttribute('cx', cx); foco.setAttribute('cy', y(mejor.valor)); foco.setAttribute('visibility', 'visible');
      mostrarTip(`<b>${fmtNum(mejor.valor)} ${unidad}</b><span>Semana ${mejor.semana}</span>`, r.left + cx / W * r.width, r.top + y(mejor.valor) / H * r.height);
    }
    area.addEventListener('pointermove', mover); area.addEventListener('pointerdown', mover);
    area.addEventListener('pointerleave', () => { guia.setAttribute('visibility', 'hidden'); foco.setAttribute('visibility', 'hidden'); ocultarTip(); });
    contenedor.appendChild(svg);
  }

  function tarjeta(titulo, actual) {
    const a = document.createElement('article'); a.className = 'grafico';
    a.innerHTML = `<header><h3>${esc(titulo)}</h3><span class="actual">${actual}</span></header>`;
    return a;
  }

  // ---- Selección de ejercicio: por grupo y por ejercicio ----
  let gruposActuales = [];
  const selGrupo = document.getElementById('sel-grupo');
  const selEjercicio = document.getElementById('sel-ejercicio');
  function elegir(nombre) {
    ejercicio = nombre;
    try { localStorage.setItem('pr-ejercicio', nombre); } catch (e) {}
    ocultarTip(); render();
  }
  function opcion(texto, valor, elegida) { const o = document.createElement('option'); o.textContent = texto; o.value = valor; o.selected = elegida; return o; }
  function pintarSelectores(grupos) {
    gruposActuales = grupos;
    document.getElementById('selector-ejercicio').hidden = !grupos.length;
    const grupoActual = grupos.find(g => g.ejercicios.includes(ejercicio)) || grupos[0];
    selGrupo.replaceChildren(...grupos.map(g => opcion(g.grupo, g.grupo, g === grupoActual)));
    selEjercicio.replaceChildren(...(grupoActual ? grupoActual.ejercicios : []).map(n => opcion(n, n, n === ejercicio)));
  }
  selGrupo.addEventListener('change', () => { const g = gruposActuales.find(x => x.grupo === selGrupo.value); if (g) elegir(g.ejercicios[0]); });
  selEjercicio.addEventListener('change', () => elegir(selEjercicio.value));

  // ---- Render ----
  let ejercicio = null; // el ejercicio elegido; si todavía no eligió, se abre con el principal que tenga datos
  try { ejercicio = localStorage.getItem('pr-ejercicio') || null; } catch (e) {}
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let peso = null;
  try { const g = parseFloat(localStorage.getItem('pr-peso')); if (g >= 30 && g <= 300) peso = g; } catch (e) {}

  const dos = n => String(n).padStart(2, '0');
  /** 'AAAA-MM-DD' de hoy. En la vista de ejemplo se usa el último día con datos, para que se vea como una persona activa. */
  function hoyIso() {
    if (!clave) return [...datos.asistencia].sort().pop() || '2026-01-01';
    const d = new Date();
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  }

  const OBJETIVO_MENSUAL = 12; // si la planilla no trae objetivo para un mes
  const NOMBRE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function dibujarDias() {
    const cont = document.getElementById('dias-entrenados'); cont.innerHTML = '';
    const mesHoy = hoyIso().slice(0, 7);
    const conDatos = P.diasPorMes(datos.asistencia);
    const meses = (conDatos.some(x => x.mes === mesHoy) ? conDatos : [...conDatos.filter(x => x.mes < mesHoy), { mes: mesHoy, cantidad: 0 }]).slice(-6);
    const actual = meses.find(x => x.mes === mesHoy);
    const objetivoDe = mes => objetivos[mes] || OBJETIVO_MENSUAL;
    const OBJ = objetivoDe(actual.mes);
    const pct = Math.min(100, Math.round(actual.cantidad / OBJ * 100));
    const nombre = m => NOMBRE_MES[+m.slice(5) - 1];
    const barra = document.createElement('div'); barra.className = 'dato barra-mes';
    barra.innerHTML = `<div class="rotulo">${nombre(actual.mes)}</div><div class="valor">${actual.cantidad} <small>de ${OBJ} días</small></div>
      <div class="progreso-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${OBJ}" aria-valuenow="${Math.min(actual.cantidad, OBJ)}" aria-label="Días entrenados en ${nombre(actual.mes)}"><span style="width:${pct}%"></span></div>
      <div class="delta">${actual.cantidad >= OBJ ? '¡Objetivo del mes cumplido!' : `Te faltan ${OBJ - actual.cantidad} para el objetivo`}</div>`;
    cont.appendChild(barra);
    if (!conDatos.length) return; // sin días registrados todavía: solo la barra del mes

    const t = tarjeta('Por mes', `${meses.reduce((a, m) => a + m.cantidad, 0)} <small>días</small>`);
    const W = 460, H = 180, m = { t: 14, r: 10, b: 26, l: 28 }, tope = Math.max(OBJ + 2, ...meses.map(x => x.cantidad));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Días entrenados por mes: ' + meses.map(x => `${nombre(x.mes)} ${x.cantidad}`).join(', ') + `. Objetivo ${OBJ}.` });
    const y = v => m.t + (1 - v / tope) * (H - m.t - m.b), paso = (W - m.l - m.r) / meses.length, ancho = Math.min(36, paso * 0.55);
    el('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: '#2e2e2e' }, svg);
    meses.forEach((x, i) => {
      const cx = m.l + paso * (i + 0.5), alto = y(0) - y(x.cantidad);
      const r = el('rect', { x: cx - ancho / 2, y: y(x.cantidad), width: ancho, height: Math.max(alto, 0), rx: 4, fill: '#ff6b1a' }, svg);
      el('rect', { x: cx - ancho / 2, y: y(0) - 4, width: ancho, height: 4, fill: '#ff6b1a' }, svg); // base recta
      const v = el('text', { x: cx, y: y(x.cantidad) - 5, 'text-anchor': 'middle', fill: '#f2f2f2', 'font-size': 11, 'font-weight': 600 }, svg); v.textContent = x.cantidad;
      const l = el('text', { x: cx, y: H - 8, 'text-anchor': 'middle', fill: '#a3a3a3', 'font-size': 11 }, svg); l.textContent = nombre(x.mes).slice(0, 3);
      const zona = el('rect', { x: cx - paso / 2, y: 0, width: paso, height: H, fill: 'transparent' }, svg);
      const mostrar = () => { const b = r.getBoundingClientRect(); mostrarTip(`<b>${x.cantidad} días</b><span>${nombre(x.mes)} · objetivo ${objetivoDe(x.mes)}</span>`, b.left + b.width / 2, b.top); };
      zona.addEventListener('pointerenter', mostrar); zona.addEventListener('pointerdown', mostrar); zona.addEventListener('pointerleave', ocultarTip);
    });
    el('line', { x1: m.l, x2: W - m.r, y1: y(OBJ), y2: y(OBJ), stroke: '#a3a3a3', 'stroke-dasharray': '4 4' }, svg);
    const o = el('text', { x: m.l - 4, y: y(OBJ) + 4, 'text-anchor': 'end', fill: '#a3a3a3', 'font-size': 10 }, svg); o.textContent = OBJ;
    t.appendChild(svg); cont.appendChild(t);
  }

  /** El mensaje de arriba y, si los hay, los récords nuevos de las últimas semanas. */
  function pintarMensaje(rachaInfo, hoy) {
    const caja = document.getElementById('pr-mensaje');
    const recientes = P.recordsRecientes(datos.series);
    const mesHoy = hoy.slice(0, 7);
    const hechosMes = (P.diasPorMes(datos.asistencia).find(x => x.mes === mesHoy) || { cantidad: 0 }).cantidad;
    const hayDatos = datos.series.length > 0 || datos.asistencia.length > 0;
    const texto = P.mensajeMotivacional({
      racha: rachaInfo.racha, diasSemanaActual: rachaInfo.diasSemanaActual, faltan: rachaInfo.faltan,
      objetivoCumplido: hechosMes > 0 && hechosMes >= (objetivos[mesHoy] || OBJETIVO_MENSUAL),
      record: recientes[0] || null, hayDatos,
    });
    caja.innerHTML = '';
    const p = document.createElement('p'); p.className = 'mensaje-texto'; p.textContent = texto; caja.appendChild(p);
    if (recientes.length) {
      const ul = document.createElement('ul'); ul.className = 'mensaje-records';
      recientes.forEach(r => {
        const li = document.createElement('li');
        li.textContent = `★ ${r.ejercicio.replace(/ C\/B$/, '')}: ${fmtNum(r.kg)} kg × ${r.reps} (antes ${fmtNum(r.anterior)} kg)`;
        ul.appendChild(li);
      });
      caja.appendChild(ul);
    }
    caja.hidden = false;
  }

  function render() {
    dibujarDias();
    const desde = P.desdeUltimasSemanas(datos.series, semanasFiltro);
    const series = P.desdeSemana(datos.series, desde);
    const ultimaAsistencia = [...datos.asistencia].sort().pop();
    const asistencia = desde && ultimaAsistencia ? datos.asistencia.filter(f => f >= P.lunes(new Date(new Date(ultimaAsistencia + 'T00:00:00Z').getTime() - (semanasFiltro - 1) * 7 * 864e5).toISOString().slice(0, 10))) : datos.asistencia;

    const res = document.getElementById('pr-resumen'); res.innerHTML = '';
    const dato = (rot, val, delta) => { const d = document.createElement('div'); d.className = 'dato'; d.innerHTML = `<div class="rotulo">${rot}</div><div class="valor">${val}</div>${delta ? `<div class="delta">${delta}</div>` : ''}`; res.appendChild(d); };
    dato('Semanas completadas', P.semanasCompletas(asistencia), `con ${P.DIAS_PARA_SEMANA_COMPLETA} días o más${desde ? ' · período elegido' : ''}`);
    dato('Días entrenados', P.diasEntrenados(asistencia));
    const hoy = hoyIso();
    const rachaInfo = P.rachaSemanas(datos.asistencia, hoy);
    dato('Racha', `${rachaInfo.racha} <small>${rachaInfo.racha === 1 ? 'semana' : 'semanas'}</small>`, 'completas seguidas');
    const total = P.semanasEntrenadas(datos.series, datos.asistencia);
    dato('Semanas entrenando', `${total} <small>${total === 1 ? 'semana' : 'semanas'}</small>`, 'desde que empezaste');
    pintarMensaje(rachaInfo, hoy);

    const grupos = P.agruparEjercicios(datos.series, datos.categorias);
    if (!grupos.some(g => g.ejercicios.includes(ejercicio))) ejercicio = P.ejercicioInicial(datos.series, datos.categorias);
    pintarSelectores(grupos);

    const r = P.resumenEjercicio(series, ejercicio);
    const fuerza = (kg) => (kg && peso ? fmtNum(kg / peso) + ' × tu peso' : '—');
    const det = document.getElementById('detalle'); det.innerHTML = '';
    const caja = document.createElement('div'); caja.className = 'pr-resumen';
    const mini = (rot, val, nota, clase) => { const d = document.createElement('div'); d.className = 'dato'; d.innerHTML = `<div class="rotulo">${rot}</div><div class="valor">${val}</div>${nota ? `<div class="delta${clase ? ' ' + clase : ''}">${nota}</div>` : ''}`; caja.appendChild(d); };
    const cs = P.cambioSemanal(datos.series, ejercicio);
    const signo = n => (n > 0 ? '+' : n < 0 ? '−' : '');
    const notaRm = [
      cs ? `${cs.diferencia > 0 ? '▲' : cs.diferencia < 0 ? '▼' : '='} ${signo(cs.diferencia)}${fmtNum(Math.abs(cs.diferencia))} kg vs semana ${cs.anteriorSemana}` : '',
      r.cambio === null ? '' : `${signo(r.cambio)}${fmtNum(Math.abs(r.cambio))} kg en el período`,
    ].filter(Boolean).join('<br>');
    mini('1RM estimado', r.actual === null ? '—' : `${fmtNum(r.actual)} <small>kg</small>`, notaRm, cs && cs.diferencia > 0 ? 'sube' : '');
    const nr = P.recordsRecientes(datos.series).find(x => x.ejercicio === ejercicio);
    mini('Récord personal', r.record ? `${fmtNum(r.record.kg)} <small>kg × ${r.record.reps}</small>` : '—',
      nr ? `★ Nuevo récord · semana ${nr.semana} (antes ${fmtNum(nr.anterior)} kg)` : (r.record ? 'Semana ' + r.record.semana : ''), nr ? 'record' : '');
    mini('Fuerza relativa', r.actual && peso ? `${fmtRel(r.actual / peso)} <small>× peso</small>` : '—', peso ? '1RM estimado ÷ tu peso' : 'Cargá tu peso arriba');
    det.appendChild(caja);

    const t = tarjeta(ejercicio + ' · 1RM estimado', r.actual === null ? '—' : `${fmtNum(r.actual)} <small>kg</small>`);
    t.style.marginTop = '12px';
    if (r.semanas.length < 2) {
      const v = document.createElement('p'); v.className = 'vacio'; v.textContent = r.semanas.length ? 'Falta una semana más para ver la evolución.' : 'Sin datos en este período.'; t.appendChild(v);
    } else lineaGrafico(t, r.semanas, ejercicio + ' 1RM estimado', 'kg');
    det.appendChild(t);

    const m = P.mejoresPorReps(series, ejercicio, [1, 3, 5, 8]);
    const c = x => x ? `${fmtNum(x.kg)}<small>${peso ? fmtRel(x.kg / peso) + ' × peso' : 'Semana ' + x.semana}</small>` : '—';
    const h = document.createElement('h2'); h.textContent = 'Mejores marcas'; det.appendChild(h);
    const caja2 = document.createElement('div'); caja2.className = 'tabla-caja';
    caja2.innerHTML = `<table><caption style="position:absolute;left:-9999px">Mejor peso de ${esc(ejercicio)} con al menos 1, 3, 5 y 8 repeticiones</caption><thead><tr><th>Reps</th><th>Mejor peso</th><th>Semana</th></tr></thead><tbody>${[1, 3, 5, 8].map(n => `<tr><td>${n}+</td><td>${m[n] ? fmtNum(m[n].kg) + (peso ? `<small>${fmtRel(m[n].kg / peso)} × tu peso</small>` : '') : '—'}</td><td>${m[n] ? m[n].semana : '—'}</td></tr>`).join('')}</tbody></table>`;
    det.appendChild(caja2);
  }

  const campo = document.getElementById('peso');
  if (peso) campo.value = String(peso).replace('.', ',');
  campo.addEventListener('input', () => {
    const v = parseFloat(campo.value.replace(',', '.'));
    peso = v >= 30 && v <= 300 ? v : null;
    try { peso ? localStorage.setItem('pr-peso', peso) : localStorage.removeItem('pr-peso'); } catch (e) {}
    render();
  });
  document.querySelectorAll('.filtros button[data-semanas]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.filtros button[data-semanas]').forEach(o => o.setAttribute('aria-pressed', o === b ? 'true' : 'false'));
    semanasFiltro = +b.dataset.semanas; ocultarTip(); render();
  }));

  const cajaEstado = document.getElementById('pr-estado');
  const txtActualizado = document.getElementById('actualizado');
  const btnActualizar = document.getElementById('btn-actualizar');
  let hayCargado = false;
  let refrescando = false;
  const pintarActualizado = () => {
    if (!actualizadoIso) return;
    txtActualizado.textContent = 'Actualizado ' + P.haceCuanto(actualizadoIso, Date.now()) + (refrescando ? ' · actualizando…' : '');
  };

  // La última respuesta queda guardada en este dispositivo: la próxima vez se ve al instante y se actualiza de fondo.
  const hashCorto = t => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const llaveGuardado = clave ? 'pr-datos-' + hashCorto(clave) : '';
  function leerGuardado() {
    try {
      const g = JSON.parse(localStorage.getItem(llaveGuardado));
      const limpio = g && typeof g === 'object' ? P.limpiarRespuesta(g) : null;
      return limpio && (limpio.series.length || limpio.asistencia.length || limpio.rutina) ? limpio : null;
    } catch (e) { return null; }
  }
  function guardar(limpio) { try { localStorage.setItem(llaveGuardado, JSON.stringify(limpio)); } catch (e) {} }

  function aplicar(limpio) {
    datos = { series: limpio.series, asistencia: limpio.asistencia, categorias: limpio.categorias }; objetivos = limpio.objetivos;
    actualizadoIso = limpio.actualizado || new Date().toISOString();
    if (limpio.nombre) document.getElementById('titulo').textContent = 'Hola, ' + limpio.nombre;
    const btn = document.getElementById('btn-rutina');
    if (limpio.rutina) {
      btn.href = limpio.rutina;
      btn.title = limpio.rutinaSemana ? `Abre tu planilla en la semana ${limpio.rutinaSemana}` : 'Abre tu planilla';
      btn.hidden = false;
    } else btn.hidden = true;
    hayCargado = true; document.getElementById('estado-carga').hidden = true; cajaEstado.hidden = false;
    render(); pintarActualizado();
  }

  function cargar(fresco) {
    const estado = document.getElementById('estado-carga');
    btnActualizar.disabled = true; btnActualizar.textContent = 'Actualizando…';
    refrescando = true; pintarActualizado();
    // referrerPolicy y credentials: la clave va en la dirección, así que no se manda a ningún otro lado
    return fetch(`${API_URL}?accion=progreso&clave=${encodeURIComponent(clave)}${fresco ? '&fresco=1' : ''}`, { referrerPolicy: 'no-referrer', credentials: 'omit' })
      .then(r => r.json())
      .then(r => {
        if (!r || r.ok !== true) {
          const msg = (r && typeof r.error === 'string' && r.error.slice(0, 200)) || 'No se pudo cargar.';
          if (hayCargado) txtActualizado.textContent = 'No pudimos actualizar. ' + msg; else estado.textContent = msg;
          return;
        }
        const limpio = P.limpiarRespuesta(r);
        guardar(limpio); aplicar(limpio);
      })
      .catch(() => {
        if (hayCargado) txtActualizado.textContent = 'No pudimos actualizar. Mostrando lo último que se guardó. Revisá tu conexión.';
        else estado.textContent = 'No pudimos cargar tus datos. Revisá tu conexión e intentá de nuevo.';
      })
      .finally(() => { refrescando = false; btnActualizar.disabled = false; btnActualizar.textContent = 'Actualizar'; if (!/^No pudimos/.test(txtActualizado.textContent)) pintarActualizado(); });
  }

  function arrancar() {
    if (!clave) { render(); return; }
    const estado = document.getElementById('estado-carga');
    document.getElementById('aviso-demo').hidden = true;
    if (!API_URL) { estado.hidden = false; estado.textContent = 'El dashboard todavía no está conectado.'; return; }
    btnActualizar.addEventListener('click', () => cargar(true));
    setInterval(pintarActualizado, 30000);
    const guardado = leerGuardado();
    if (guardado) aplicar(guardado); else { estado.hidden = false; estado.textContent = 'Cargando tu progreso…'; }
    cargar(false);
  }
  arrancar();
})();
