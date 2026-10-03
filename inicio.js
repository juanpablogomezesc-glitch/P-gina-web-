// Portada: aparición de secciones al hacer scroll y flechas de la galería.
(() => {
  const marcar = el => el.classList.add('visto');
  const items = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const ojo = new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        if (!e.isIntersecting) return;
        marcar(e.target);
        ojo.unobserve(e.target); // cada elemento aparece una sola vez
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(el => ojo.observe(el));
  } else {
    items.forEach(marcar);
  }

  // Flechas de la galería (en el celular se desliza con el dedo)
  const carrusel = document.querySelector('.carrusel');
  document.querySelectorAll('.flecha').forEach(boton => {
    boton.addEventListener('click', () => {
      const paso = (carrusel.querySelector('figure')?.getBoundingClientRect().width || 280) + 16;
      carrusel.scrollBy({ left: Number(boton.dataset.dir) * paso, behavior: 'smooth' });
    });
  });

  window.__inicioListo = true;
})();
