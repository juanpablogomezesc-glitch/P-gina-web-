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
    const base = { 'Sentadilla C/B': 70, 'Press plano C/B': 50, 'Despegue C/B': 90, 'Hip Trust C/B': 80 };
    const series = [], asistencia = [];
    for (let w = 0; w < 36; w++) {
      const lunes = new Date(Date.UTC(2025, 9, 6) + w * 7 * 864e5);
      if (azar() < 0.12) continue; // semana sin entrenar
      [0, 2, 4].forEach((d, i) => {
        if (azar() < 0.15) return;
        asistencia.push(new Date(lunes.getTime() + d * 864e5).toISOString().slice(0, 10));
        const ej = Object.keys(base);
        [ej[i % 4], ej[(i + 1) % 4]].forEach(nombre => {
          const reps = [5, 6, 8, 3, 10][Math.floor(azar() * 5)];
          const kg = Math.round((base[nombre] + w * 0.9 + azar() * 4) / 2.5) * 2.5;
          series.push({ semana: 67 + w, ejercicio: nombre, kg, reps });
        });
      });
    }
    return { series, asistencia };
  }
  const datos = demo();
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
    a.innerHTML = `<header><h3>${titulo}</h3><span class="actual">${actual}</span></header>`;
    return a;
  }

  // ---- Render ----
  let ejercicio = P.EJERCICIOS[0];
  let peso = null;
  try { const g = parseFloat(localStorage.getItem('pr-peso')); if (g >= 30 && g <= 300) peso = g; } catch (e) {}

  const OBJETIVO_MENSUAL = 12; // en la planilla real sale de la columna "Objetivo" de Control Mensual
  const NOMBRE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function dibujarDias() {
    const cont = document.getElementById('dias-entrenados'); cont.innerHTML = '';
    const meses = P.diasPorMes(datos.asistencia).slice(-6);
    if (!meses.length) { cont.innerHTML = '<p class="vacio">Todavía no hay días registrados.</p>'; return; }
    const actual = meses[meses.length - 1];
    const pct = Math.min(100, Math.round(actual.cantidad / OBJETIVO_MENSUAL * 100));
    const nombre = m => NOMBRE_MES[+m.slice(5) - 1];
    const barra = document.createElement('div'); barra.className = 'dato barra-mes';
    barra.innerHTML = `<div class="rotulo">${nombre(actual.mes)}</div><div class="valor">${actual.cantidad} <small>de ${OBJETIVO_MENSUAL} días</small></div>
      <div class="progreso-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${OBJETIVO_MENSUAL}" aria-valuenow="${Math.min(actual.cantidad, OBJETIVO_MENSUAL)}" aria-label="Días entrenados en ${nombre(actual.mes)}"><span style="width:${pct}%"></span></div>
      <div class="delta">${actual.cantidad >= OBJETIVO_MENSUAL ? '¡Objetivo del mes cumplido!' : `Te faltan ${OBJETIVO_MENSUAL - actual.cantidad} para el objetivo`}</div>`;
    cont.appendChild(barra);

    const t = tarjeta('Por mes', `${meses.reduce((a, m) => a + m.cantidad, 0)} <small>días</small>`);
    const W = 460, H = 180, m = { t: 14, r: 10, b: 26, l: 28 }, tope = Math.max(OBJETIVO_MENSUAL + 2, ...meses.map(x => x.cantidad));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Días entrenados por mes: ' + meses.map(x => `${nombre(x.mes)} ${x.cantidad}`).join(', ') + `. Objetivo ${OBJETIVO_MENSUAL}.` });
    const y = v => m.t + (1 - v / tope) * (H - m.t - m.b), paso = (W - m.l - m.r) / meses.length, ancho = Math.min(36, paso * 0.55);
    el('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: '#2e2e2e' }, svg);
    meses.forEach((x, i) => {
      const cx = m.l + paso * (i + 0.5), alto = y(0) - y(x.cantidad);
      const r = el('rect', { x: cx - ancho / 2, y: y(x.cantidad), width: ancho, height: Math.max(alto, 0), rx: 4, fill: '#ff6b1a' }, svg);
      el('rect', { x: cx - ancho / 2, y: y(0) - 4, width: ancho, height: 4, fill: '#ff6b1a' }, svg); // base recta
      const v = el('text', { x: cx, y: y(x.cantidad) - 5, 'text-anchor': 'middle', fill: '#f2f2f2', 'font-size': 11, 'font-weight': 600 }, svg); v.textContent = x.cantidad;
      const l = el('text', { x: cx, y: H - 8, 'text-anchor': 'middle', fill: '#a3a3a3', 'font-size': 11 }, svg); l.textContent = nombre(x.mes).slice(0, 3);
      const zona = el('rect', { x: cx - paso / 2, y: 0, width: paso, height: H, fill: 'transparent' }, svg);
      const mostrar = () => { const b = r.getBoundingClientRect(); mostrarTip(`<b>${x.cantidad} días</b><span>${nombre(x.mes)} · objetivo ${OBJETIVO_MENSUAL}</span>`, b.left + b.width / 2, b.top); };
      zona.addEventListener('pointerenter', mostrar); zona.addEventListener('pointerdown', mostrar); zona.addEventListener('pointerleave', ocultarTip);
    });
    el('line', { x1: m.l, x2: W - m.r, y1: y(OBJETIVO_MENSUAL), y2: y(OBJETIVO_MENSUAL), stroke: '#a3a3a3', 'stroke-dasharray': '4 4' }, svg);
    const o = el('text', { x: m.l - 4, y: y(OBJETIVO_MENSUAL) + 4, 'text-anchor': 'end', fill: '#a3a3a3', 'font-size': 10 }, svg); o.textContent = OBJETIVO_MENSUAL;
    t.appendChild(svg); cont.appendChild(t);
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

    const sel = document.getElementById('selector-ejercicio');
    if (!sel.children.length) P.EJERCICIOS.forEach(ej => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = ej.replace(/ C\/B$/, '');
      b.dataset.ej = ej; b.addEventListener('click', () => { ejercicio = ej; ocultarTip(); render(); });
      sel.appendChild(b);
    });
    [...sel.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.ej === ejercicio ? 'true' : 'false'));

    const r = P.resumenEjercicio(series, ejercicio);
    const fuerza = (kg) => (kg && peso ? fmtNum(kg / peso) + ' × tu peso' : '—');
    const det = document.getElementById('detalle'); det.innerHTML = '';
    const caja = document.createElement('div'); caja.className = 'pr-resumen';
    const mini = (rot, val, nota) => { const d = document.createElement('div'); d.className = 'dato'; d.innerHTML = `<div class="rotulo">${rot}</div><div class="valor">${val}</div>${nota ? `<div class="delta">${nota}</div>` : ''}`; caja.appendChild(d); };
    mini('1RM estimado', r.actual === null ? '—' : `${fmtNum(r.actual)} <small>kg</small>`, r.cambio === null ? '' : `${r.cambio > 0 ? '+' : ''}${fmtNum(r.cambio)} kg en el período`);
    mini('Récord personal', r.record ? `${fmtNum(r.record.kg)} <small>kg × ${r.record.reps}</small>` : '—', r.record ? 'Semana ' + r.record.semana : '');
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
    caja2.innerHTML = `<table><caption style="position:absolute;left:-9999px">Mejor peso de ${ejercicio} con al menos 1, 3, 5 y 8 repeticiones</caption><thead><tr><th>Repeticiones</th><th>Mejor peso (kg)</th><th>Semana</th></tr></thead><tbody>${[1, 3, 5, 8].map(n => `<tr><td>${n} o más</td><td>${m[n] ? fmtNum(m[n].kg) + (peso ? `<small>${fmtRel(m[n].kg / peso)} × tu peso</small>` : '') : '—'}</td><td>${m[n] ? m[n].semana : '—'}</td></tr>`).join('')}</tbody></table>`;
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
  render();
})();
