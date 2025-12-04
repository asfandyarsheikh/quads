require('dotenv').config();
const http = require('http');
const url = require('url');
const RoutingDatabase = require('./database');

const db = new RoutingDatabase(process.env.DB_PATH || './routing.db');

/**
 * Caddy Proxy Resolver
 * This service receives requests from Caddy and returns the downstream URL
 * Caddy should be configured to query this service and proxy based on response
 */

const server = http.createServer(async (req, res) => {
  // Parse request URL
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }

  // Resolve routing
  if (pathname === '/resolve' && req.method === 'GET') {
    const query = parsedUrl.query;
    const { host, path: reqPath, ...queryParams } = query;

    if (!host) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Host is required' }));
      return;
    }

    try {
      // Parse host into domain and subdomain
      const hostParts = host.split('.');
      let domain, subdomain;

      if (hostParts.length >= 2) {
        domain = hostParts.slice(-2).join('.');
        subdomain = hostParts.length > 2 ? hostParts.slice(0, -2).join('.') : null;
      } else {
        domain = host;
        subdomain = null;
      }

      // Find matching rule
      const rule = db.findMatchingRule(domain, subdomain, reqPath || '/', queryParams);

      if (!rule) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No matching route found' }));
        return;
      }

      // Return downstream URL in a format Caddy can use
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Downstream-URL': rule.downstream_url,
        'X-Rule-ID': rule.rule_id
      });
      res.end(JSON.stringify({
        downstream_url: rule.downstream_url,
        rule_id: rule.rule_id,
        expires_at: rule.expires_at
      }));

    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // 404 for unknown endpoints
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.RESOLVER_PORT || 3001;
const HOST = process.env.RESOLVER_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Caddy Proxy Resolver running at http://${HOST}:${PORT}`);
  console.log('Endpoints:');
  console.log(`  GET /resolve?host=<host>&path=<path>&<queryParams>`);
  console.log(`  GET /health`);
});

// Graceful shutdown
const closeGracefully = (signal) => {
  console.log(`Received signal to terminate: ${signal}`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);
