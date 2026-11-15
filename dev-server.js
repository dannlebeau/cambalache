// Servidor de desarrollo LOCAL: solo sirve los archivos estáticos. A diferencia de
// mercadoeficiente/new-essency/crosheep, Cambalache no tiene backend propio: las cartas se
// consultan directo desde el navegador a las APIs públicas de YGOPRODeck y Pokémon TCG API,
// así que no hace falta ninguna función serverless.
//
// Sirve sobre todo para no abrir los .html como file://, donde algunos navegadores son más
// estrictos con fetch() a otros dominios.
//
// Uso: node dev-server.js, luego abrir http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end('Ruta inválida');
  }
  const filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Solo se sirven archivos dentro de la carpeta del proyecto.
  if (!filePath.startsWith(__dirname + path.sep)) {
    res.writeHead(404);
    return res.end('No encontrado');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('No encontrado');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => console.log(`🌐 Servidor local en http://localhost:${PORT}`));
