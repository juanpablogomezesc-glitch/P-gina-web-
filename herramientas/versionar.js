// Le agrega a cada hoja de estilos y script de las páginas un número de versión (?v=...) que cambia solo cuando el archivo cambia.
// Así, cuando se actualiza el sitio, los navegadores bajan los archivos nuevos en vez de usar copias viejas guardadas.
//
//   node herramientas/versionar.js              actualiza los números en las páginas
//   node herramientas/versionar.js --verificar  solo comprueba que estén al día (termina con error si no)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RAIZ = path.join(__dirname, '..');
const PAGINAS = ['index.html', 'turnos.html', 'progreso.html', ...fs.readdirSync(path.join(RAIZ, 'articulos')).filter(f => f.endsWith('.html')).map(f => path.join('articulos', f))];
const ENLACE = /(href|src)="((?:\.\.\/)?[\w\-/]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g;

const huella = archivo => crypto.createHash('sha1').update(fs.readFileSync(archivo)).digest('hex').slice(0, 8);

/** Devuelve el texto de la página con los números de versión al día. */
function versionar(pagina) {
  const ruta = path.join(RAIZ, pagina);
  const html = fs.readFileSync(ruta, 'utf8');
  return html.replace(ENLACE, (todo, atributo, destino) => {
    const archivo = path.join(path.dirname(ruta), destino);
    return fs.existsSync(archivo) ? `${atributo}="${destino}?v=${huella(archivo)}"` : todo;
  });
}

function ejecutar(soloVerificar) {
  const desactualizadas = [];
  for (const pagina of PAGINAS) {
    const actual = fs.readFileSync(path.join(RAIZ, pagina), 'utf8');
    const nueva = versionar(pagina);
    if (nueva !== actual) {
      desactualizadas.push(pagina);
      if (!soloVerificar) fs.writeFileSync(path.join(RAIZ, pagina), nueva);
    }
  }
  return desactualizadas;
}

if (require.main === module) {
  const verificar = process.argv.includes('--verificar');
  const cambiadas = ejecutar(verificar);
  if (verificar && cambiadas.length) { console.error('Versiones desactualizadas en: ' + cambiadas.join(', ') + '. Ejecutá: node herramientas/versionar.js'); process.exit(1); }
  console.log(cambiadas.length ? `Actualizadas: ${cambiadas.join(', ')}` : 'Todo al día.');
}

module.exports = { versionar, ejecutar, huella, PAGINAS };
