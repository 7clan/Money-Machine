const http = require('http');
const fs = require('fs');
const path = require('path');

const USERS = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineer', email: 'ada@example.com' },
  { id: 2, name: 'Alan Turing', role: 'Computer Scientist', email: 'alan@example.com' },
  { id: 3, name: 'Grace Hopper', role: 'Admiral', email: 'grace@example.com' },
  { id: 4, name: 'Dennis Ritchie', role: 'Engineer', email: 'dennis@example.com' },
  { id: 5, name: 'Linus Torvalds', role: 'Engineer', email: 'linus@example.com' },
  { id: 6, name: 'Margaret Hamilton', role: 'Software Engineer', email: 'margaret@example.com' },
];

const server = http.createServer((req, res) => {
  // API endpoint
  if (req.url === '/api/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(USERS));
    return;
  }
  
  // Serve static files
  let filePath = req.url === '/' ? 'index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  
  const ext = path.extname(filePath);
  const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(9875, () => {
  console.log('DevTools demo server running on http://localhost:9875');
  console.log('API endpoint: http://localhost:9875/api/users');
});
