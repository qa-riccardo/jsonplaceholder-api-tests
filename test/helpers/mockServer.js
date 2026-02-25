import http from 'node:http';
import { URL } from 'node:url';

/**
 * routes: { 'GET /path': async ({url, req, json, text, delay}) => void }
 */
export function createMockServer(routes) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const key = `${req.method} ${url.pathname}`;
    const handler = routes[key];

    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found', key }));
      return;
    }

    const ctx = {
      url,
      req,
      json: (status, body, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
        res.end(JSON.stringify(body));
      },
      text: (status, body, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'text/plain', ...headers });
        res.end(body);
      },
      delay: (ms) => new Promise((r) => setTimeout(r, ms)),
    };

    try {
      await handler(ctx);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'handler_error', message: e?.message ?? String(e) }));
    }
  });

  return {
    async listen() {
      await new Promise((resolve) => server.listen(0, resolve));
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      return { baseUrl: `http://127.0.0.1:${port}` };
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
