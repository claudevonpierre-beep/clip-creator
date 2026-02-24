const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3334;
const DATA_FILE = path.join(__dirname, 'data', 'requests.json');

// Ensure data dir
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'data', 'uploads'), { recursive: true });

function loadRequests() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function saveRequests(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// MIME types for static files
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function serveStatic(req, res) {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  // Prevent directory traversal
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // === API Routes ===

  // GET /api/requests — list all requests
  if (url.pathname === '/api/requests' && req.method === 'GET') {
    return json(res, loadRequests());
  }

  // GET /api/requests/:id — single request
  if (url.pathname.match(/^\/api\/requests\/[\w-]+$/) && req.method === 'GET') {
    const id = url.pathname.split('/').pop();
    const requests = loadRequests();
    const found = requests.find(r => r.id === id);
    if (!found) return json(res, { error: 'Not found' }, 404);
    return json(res, found);
  }

  // POST /api/requests — create new thumbnail request
  if (url.pathname === '/api/requests' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString());
    const requests = loadRequests();
    const request = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: body.createdBy || 'Jr. Producer',
      show: body.show || '',
      episode: body.episode || '',
      deadline: body.deadline || '',
      status: 'pending', // pending → in-progress → completed
      concepts: body.concepts || [], // edited thumbnail concepts
      notes: body.notes || '',
      designerNotes: '',
      completedAt: null,
      uploadPath: null
    };
    requests.unshift(request);
    saveRequests(requests);
    return json(res, request, 201);
  }

  // PUT /api/requests/:id — update request (status, notes, etc.)
  if (url.pathname.match(/^\/api\/requests\/[\w-]+$/) && req.method === 'PUT') {
    const id = url.pathname.split('/').pop();
    const body = JSON.parse((await readBody(req)).toString());
    const requests = loadRequests();
    const idx = requests.findIndex(r => r.id === id);
    if (idx === -1) return json(res, { error: 'Not found' }, 404);
    Object.assign(requests[idx], body);
    if (body.status === 'completed' && !requests[idx].completedAt) {
      requests[idx].completedAt = new Date().toISOString();
    }
    saveRequests(requests);
    return json(res, requests[idx]);
  }

  // POST /api/requests/:id/upload — upload thumbnail file
  if (url.pathname.match(/^\/api\/requests\/[\w-]+\/upload$/) && req.method === 'POST') {
    const id = url.pathname.split('/')[3];
    const requests = loadRequests();
    const idx = requests.findIndex(r => r.id === id);
    if (idx === -1) return json(res, { error: 'Not found' }, 404);

    const buf = await readBody(req);
    // Get filename from header or generate one
    const ct = req.headers['content-type'] || 'image/png';
    const ext = ct.includes('jpeg') || ct.includes('jpg') ? '.jpg' : ct.includes('webp') ? '.webp' : '.png';
    const filename = `thumb-${id.slice(0,8)}${ext}`;
    const uploadPath = path.join('data', 'uploads', filename);
    fs.writeFileSync(path.join(__dirname, uploadPath), buf);

    requests[idx].uploadPath = '/' + uploadPath;
    requests[idx].status = 'completed';
    requests[idx].completedAt = new Date().toISOString();
    saveRequests(requests);
    return json(res, requests[idx]);
  }

  // DELETE /api/requests/:id
  if (url.pathname.match(/^\/api\/requests\/[\w-]+$/) && req.method === 'DELETE') {
    const id = url.pathname.split('/').pop();
    let requests = loadRequests();
    requests = requests.filter(r => r.id !== id);
    saveRequests(requests);
    return json(res, { ok: true });
  }

  // === Static files ===
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Clip Creator running at http://localhost:${PORT}`);
});
