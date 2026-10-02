# Blog de entrenamiento · Juan Pablo Gómez

Base de conocimiento para alumnos: artículos que profundizan lo que se publica
en Instagram y en el grupo de WhatsApp. HTML y CSS, sin dependencias.

## Estructura

- `index.html`: portada con la lista de artículos.
- `articulos/`: un archivo por artículo (por ejemplo `peso-muerto.html`).
- `articulos/_plantilla.html`: base para escribir un artículo nuevo.
- `styles.css`: diseño y colores.
- `turnos.html` y `turnos.js`: página para reservar y cancelar turnos.
- `sistema-turnos/`: el código que guarda los turnos en una planilla de Google,
  con las instrucciones para ponerlo en marcha (`sistema-turnos/INSTRUCCIONES.md`)
  y sus pruebas (`node --test sistema-turnos/pruebas/pruebas.test.js`).

## Cómo sumar un artículo

1. Copiá `articulos/_plantilla.html` con un nombre nuevo, sin espacios ni tildes
   (por ejemplo `articulos/descanso.html`).
2. Reemplazá los textos en mayúsculas y escribí el contenido.
3. En `index.html`, dentro de la sección "Artículos", copiá una tarjeta y
   apuntala al archivo nuevo.

## Publicarlo gratis con GitHub Pages

1. En GitHub, andá a **Settings → Pages**.
2. En *Source* elegí la rama `main` y la carpeta `/ (root)`.
3. En unos minutos el sitio queda en
   `https://juanpablogomezesc-glitch.github.io/P-gina-web-/` y cada artículo en
   `.../articulos/nombre.html`, listo para compartir por WhatsApp o Instagram.
