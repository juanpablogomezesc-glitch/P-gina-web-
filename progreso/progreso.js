(function () {
  const P = window.Progreso;
  const NS = 'http://www.w3.org/2000/svg';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fmtFecha = iso => { const [a, m, d] = iso.split('-'); return `${+d} ${MESES[+m - 1]} ${a}`; };
  const fmtCorta = iso => { const [, m, d] = iso.split('-'); return `${+d} ${MESES[+m - 1]}`; };
  const fmtNum = n => (Math.round(n * 10) / 10).toString().replace('.', ',');

  // ---- Datos de ejemplo (deterministas) ----
  function demo() {
    let sem = 7; const azar = () => (sem = (sem * 9301 + 49297) % 233280) / 233280;
    const base = { 'Sentadilla C/B': 70, 'Press plano C/B': 50, 'Despegue C/B': 90, 'Hip Trust C/B': 80 };
    const series = [], pesos = [];
    for (let w = 0; w < 36; w++) {
      const lunes = new Date(Date.UTC(2025, 9, 6) + w * 7 * 864e5);
      if (azar() < 0.12) continue; // semana sin entrenar
      [0, 2, 4].forEach((d, i) => {
        if (azar() < 0.15) return;
        const fecha = new Date(lunes.getTime() + d * 864e5).toISOString().slice(0, 10);
        const ej = Object.keys(base);
        [ej[i % 4], ej[(i + 1) % 4]].forEach(nombre => {
          const reps = [5, 6, 8, 3, 10][Math.floor(azar() * 5)];
          const kg = Math.round((base[nombre] + w * 0.9 + azar() * 4) / 2.5) * 2.5;
          series.push({ fecha, ejercicio: nombre, kg, reps });
        });
      });
      if (w % 3 === 0) pesos.push({ fecha: lunes.toISOString().slice(0, 10), kg: Math.round((78 - w * 0.12 + azar()) * 10) / 10 });
    }
    return { series, pesos };
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

  function lineaGrafico(contenedor, puntos, etiquetaVal, titulo, unidad) {
    const W = 460, H = 200, m = { t: 14, r: 14, b: 26, l: 40 };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': titulo + ': ' + puntos.map(p => `${fmtCorta(p.fecha)} ${fmtNum(p.valor)} ${unidad}`).join(', ') });
    const t0 = new Date(puntos[0].fecha).getTime(), t1 = new Date(puntos[puntos.length - 1].fecha).getTime();
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
      const tx = el('text', { x: x(new Date(p.fecha).getTime()), y: H - 6, 'text-anchor': i ? 'end' : 'start', fill: '#a3a3a3', 'font-size': 11 }, svg); tx.textContent = fmtCorta(p.fecha);
    });
    const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(new Date(p.fecha).getTime()).toFixed(1)},${y(p.valor).toFixed(1)}`).join('');
    el('path', { d, fill: 'none', stroke: '#ff6b1a', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    const ult = puntos[puntos.length - 1];
    el('circle', { cx: x(new Date(ult.fecha).getTime()), cy: y(ult.valor), r: 4.5, fill: '#ff6b1a', stroke: '#1a1a1a', 'stroke-width': 2 }, svg);
    const guia = el('line', { y1: m.t, y2: H - m.b, stroke: '#a3a3a3', 'stroke-dasharray': '3 3', visibility: 'hidden' }, svg);
    const foco = el('circle', { r: 5, fill: '#ff6b1a', stroke: '#1a1a1a', 'stroke-width': 2, visibility: 'hidden' }, svg);
    const area = el('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }, svg);
    function mover(ev) {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * W;
      let mejor = puntos[0], dist = Infinity;
      puntos.forEach(p => { const dd = Math.abs(x(new Date(p.fecha).getTime()) - px); if (dd < dist) { dist = dd; mejor = p; } });
      const cx = x(new Date(mejor.fecha).getTime());
      guia.setAttribute('x1', cx); guia.setAttribute('x2', cx); guia.setAttribute('visibility', 'visible');
      foco.setAttribute('cx', cx); foco.setAttribute('cy', y(mejor.valor)); foco.setAttribute('visibility', 'visible');
      mostrarTip(`<b>${fmtNum(mejor.valor)} ${unidad}</b><span>${fmtCorta(mejor.fecha)}${mejor.extra ? ' · ' + mejor.extra : ''}</span>`, r.left + cx / W * r.width, r.top + y(mejor.valor) / H * r.height);
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
  function render() {
    const desde = P.desdeUltimasSemanas(datos.series, semanasFiltro);
    const series = P.filtrar(datos.series, desde, null);
    const pesos = datos.pesos.filter(p => !desde || p.fecha >= desde);
    const res = document.getElementById('pr-resumen'); res.innerHTML = '';
    const peso = P.resumenPeso(pesos);
    const sinDatos = document.createElement('div');
    const dato = (rot, val, delta, sube) => { const d = document.createElement('div'); d.className = 'dato'; d.innerHTML = `<div class="rotulo">${rot}</div><div class="valor">${val}</div>${delta ? `<div class="delta${sube ? ' sube' : ''}">${delta}</div>` : ''}`; res.appendChild(d); };
    dato('Semanas entrenadas', P.semanasEntrenadas(series));
    dato('Días completados', P.diasCompletados(series));
    dato('Peso corporal', peso.actual === null ? '—' : `${fmtNum(peso.actual)} <small>kg</small>`, peso.cambio === null ? '' : `${peso.cambio > 0 ? '+' : ''}${fmtNum(peso.cambio)} kg en el período`);

    const gr = document.getElementById('pr-graficos'); gr.innerHTML = '';
    const tabla = document.getElementById('tabla-records');
    let filas = '';
    P.EJERCICIOS.forEach(ej => {
      const r = P.resumenEjercicio(series, ej);
      const nombre = ej;
      const t = tarjeta(nombre, r.actual === null ? '—' : `${fmtNum(r.actual)} <small>kg</small>`);
      if (r.semanas.length < 2) {
        const v = document.createElement('p'); v.className = 'vacio'; v.textContent = r.semanas.length ? 'Falta una semana más para ver la evolución.' : 'Sin datos en este período.'; t.appendChild(v);
      } else {
        lineaGrafico(t, r.semanas.map(s => ({ fecha: s.semana, valor: s.valor })), fmtNum, nombre + ' 1RM estimado', 'kg');
      }
      if (r.cambio !== null) { const h = t.querySelector('h3'); h.insertAdjacentHTML('afterend', ''); }
      gr.appendChild(t);
      const m = P.mejoresPorReps(series, ej, [1, 3, 5, 8]);
      const c = x => x ? `${fmtNum(x.kg)}<small>${fmtCorta(x.fecha)}</small>` : '—';
      filas += `<tr><td>${nombre}</td><td>${r.record ? `${fmtNum(r.record.kg)} × ${r.record.reps}<small>${fmtFecha(r.record.fecha)}</small>` : '—'}</td><td>${c(m[1])}</td><td>${c(m[3])}</td><td>${c(m[5])}</td><td>${c(m[8])}</td></tr>`;
    });
    tabla.innerHTML = '<caption class="sr-only" style="position:absolute;left:-9999px">Récord personal y mejor peso con al menos 1, 3, 5 y 8 repeticiones</caption><thead><tr><th>Ejercicio</th><th>Récord</th><th>1 rep</th><th>3 reps</th><th>5 reps</th><th>8 reps</th></tr></thead><tbody>' + filas + '</tbody>';

    const gp = document.getElementById('grafico-peso'); gp.innerHTML = '';
    const tp = tarjeta('Peso corporal', peso.actual === null ? '—' : `${fmtNum(peso.actual)} <small>kg</small>`);
    if (peso.puntos.length < 2) { const v = document.createElement('p'); v.className = 'vacio'; v.textContent = 'Cargá tu peso al menos dos veces para ver el gráfico.'; tp.appendChild(v); }
    else lineaGrafico(tp, peso.puntos.map(p => ({ fecha: p.fecha, valor: p.kg })), fmtNum, 'Peso corporal', 'kg');
    gp.appendChild(tp);
  }

  document.querySelectorAll('.filtros button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.filtros button').forEach(o => o.setAttribute('aria-pressed', o === b ? 'true' : 'false'));
    semanasFiltro = +b.dataset.semanas; ocultarTip(); render();
  }));
  render();
})();
