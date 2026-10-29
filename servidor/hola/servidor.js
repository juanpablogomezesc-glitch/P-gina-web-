// Primer servidor: muestra una página "Hola" a quien entre.
// Se pone en marcha con:  node servidor.js
// Se frena con:           Ctrl + C

// "http" viene incluido con Node. Sabe recibir pedidos de un navegador y responderlos.
const http = require('http');

// El puerto es la "puerta" de la notebook por la que entran los pedidos.
// Usamos la 3000; la dirección queda así: http://IP-DE-LA-NOTEBOOK:3000
const PUERTO = 3000;

// Contamos las visitas para ver que el servidor está vivo y responde.
// Ojo: se guarda en la memoria, así que vuelve a 0 cada vez que lo reiniciás.
// En la etapa 6 aprendemos a guardar datos en una base de datos para que no se pierdan.
let visitas = 0;

// Esta función se ejecuta cada vez que alguien abre la página.
// "pedido" es lo que manda el navegador y "respuesta" es lo que le devolvemos.
function atender(pedido, respuesta) {
  // El navegador también pide el ícono de la pestaña; ese pedido no lo contamos.
  if (pedido.url === '/favicon.ico') {
    respuesta.writeHead(204); // 204 = "no tengo nada para mandarte"
    respuesta.end();
    return;
  }

  visitas = visitas + 1;
  const hora = new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  // Esto queda escrito en la pantalla de la notebook: es el "registro" del servidor.
  console.log(`Visita número ${visitas} a las ${hora}, desde ${pedido.socket.remoteAddress}`);

  // 200 = "todo bien". Avisamos que devolvemos una página web (HTML) con tildes (utf-8).
  respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

  // La página en sí. Usa los mismos colores que el sitio.
  respuesta.end(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Servidor JP</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
           background: #0d0d0d; color: #f2f2f2; padding: 16px;
           font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; text-align: center; }
    h1 { color: #ff6b1a; text-transform: uppercase; font-family: "Arial Narrow", sans-serif; }
    p { color: #a3a3a3; }
  </style>
</head>
<body>
  <main>
    <h1>¡Hola! Este es mi servidor</h1>
    <p>Esta página la está mandando la notebook Bangho desde tu casa.</p>
    <p>Visitas desde que se prendió: ${visitas} · Hora del servidor: ${hora}</p>
  </main>
</body>
</html>`);
}

// Creamos el servidor con la función de arriba y lo ponemos a escuchar en el puerto.
// "0.0.0.0" significa "aceptá pedidos de cualquier aparato de la red" (tu celu, tu otra compu).
const servidor = http.createServer(atender);
servidor.listen(PUERTO, '0.0.0.0', () => {
  console.log(`Servidor prendido. Abrí http://IP-DE-LA-NOTEBOOK:${PUERTO} en el navegador.`);
});
