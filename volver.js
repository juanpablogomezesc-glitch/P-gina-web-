// Botón "← Mi progreso" para los alumnos: aparece en las páginas a las que se llega desde el dashboard (portada, turnos, artículos).
// Usa la clave que el dashboard dejó guardada en este dispositivo; quien nunca abrió su dashboard no ve nada.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else fabrica().iniciar(raiz);
})(this, function () {
  const CLAVE = /^[A-Za-z0-9]{24}$/;

  /** Dirección del dashboard con la clave, o '' si la clave no sirve. `prefijo` es '../' dentro de la carpeta de artículos. */
  function enlace(clave, prefijo) {
    return typeof clave === 'string' && CLAVE.test(clave) ? `${prefijo}progreso.html?c=${clave}` : '';
  }

  function iniciar(ventana) {
    let clave = null;
    try { clave = ventana.localStorage.getItem('pr-clave'); } catch (e) { return; }
    const href = enlace(clave, /\/articulos\//.test(ventana.location.pathname) ? '../' : '');
    if (!href) return;
    const a = ventana.document.createElement('a');
    a.className = 'volver-progreso';
    a.href = href;
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Volver a mi progreso');
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg><span>Mi progreso</span>';
    ventana.document.body.appendChild(a);
    ventana.document.body.classList.add('con-volver-progreso');
  }

  return { enlace, iniciar };
});
