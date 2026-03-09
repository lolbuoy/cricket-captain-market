// ============================================
// server.js — Local dev server
// Serves static files + proxies API routes to
// the Vercel-style /api/ functions.
// In production, Vercel handles this natively.
//
// Usage: node server.js
// Opens on http://localhost:8080
// ============================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const STATIC_DIR = __dirname;

// Load .env
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  }
} catch (e) { /* ignore */ }

// MIME types
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.sql': 'text/plain',
};

// Route API requests to Vercel-style handler functions
async function routeAPI(pathname, req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Map URL to Vercel-style handler file
  let handlerPath = null;
  const query = {};

  if (pathname === '/api/config') {
    handlerPath = './api/config.js';
  } else if (pathname === '/api/scrape/find') {
    handlerPath = './api/scrape/find.js';
  } else if (pathname === '/api/scrape/live') {
    handlerPath = './api/scrape/live.js';
  } else {
    // Dynamic routes: /api/scrape/match/:id
    const matchRoute = pathname.match(/^\/api\/scrape\/match\/(\d+)$/);
    if (matchRoute) {
      handlerPath = './api/scrape/match/[id].js';
      query.id = matchRoute[1];
    }
  }

  if (!handlerPath) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'API route not found' }));
    return;
  }

  try {
    // Clear require cache for hot reload during dev
    const fullPath = path.resolve(__dirname, handlerPath);
    delete require.cache[fullPath];
    const handler = require(fullPath);

    // Create mock req/res objects compatible with Vercel
    const mockReq = {
      ...req,
      query,
      body: null,
    };

    // Parse body for POST
    if (req.method === 'POST') {
      const body = await new Promise(resolve => {
        let data = '';
        req.on('data', c => data += c);
        req.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        });
      });
      mockReq.body = body;
    }

    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { res.setHeader(k, v); },
      writeHead(code, headers) { res.writeHead(code, headers); },
      status(code) { this.statusCode = code; return this; },
      json(data) {
        res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      },
      send(data) {
        res.writeHead(this.statusCode);
        res.end(typeof data === 'string' ? data : JSON.stringify(data));
      },
      end(data) { res.end(data); },
    };

    await handler(mockReq, mockRes);
  } catch (err) {
    console.error(`API Error [${pathname}]:`, err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

// Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // API routes
  if (pathname.startsWith('/api/')) {
    return routeAPI(pathname, req, res);
  }

  // Static files
  let filePath = path.join(STATIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  } catch (err) {
    res.writeHead(500);
    res.end('Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`\n  🏏 Cricket Captain × Market`);
  console.log(`  ──────────────────────────────`);
  console.log(`  Server:     http://localhost:${PORT}`);
  console.log(`  Scraper:    http://localhost:${PORT}/api/scrape/find`);
  console.log(`  Supabase:   ${process.env.SUPABASE_URL ? '✅ Configured' : '⚠️ Add to .env'}`);
  console.log(`  ──────────────────────────────`);
  console.log(`  Ready! Open http://localhost:${PORT}\n`);
});
