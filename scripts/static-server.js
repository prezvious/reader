const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || process.argv[2] || 41731);
const root = path.resolve(__dirname, '..');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const requestPath = req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\/+/, '');
  const resolvedPath = path.join(root, requestPath);

  if (!resolvedPath.startsWith(root)) {
    send(res, 403, 'Forbidden', { 'content-type': 'text/plain; charset=utf-8' });
    return;
  }

  fs.stat(resolvedPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(res, 404, 'Not found', { 'content-type': 'text/plain; charset=utf-8' });
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(resolvedPath, (readError, data) => {
      if (readError) {
        send(res, 500, 'Failed to read file', { 'content-type': 'text/plain; charset=utf-8' });
        return;
      }
      send(res, 200, data, { 'content-type': contentType });
    });
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log('Static server listening on http://127.0.0.1:' + port);
});
