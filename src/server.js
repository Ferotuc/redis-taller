import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { productService } from './products.js';

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379',
  disableOfflineQueue: true, socket: { connectTimeout: 1500, reconnectStrategy: false } });
redis.on('error', e => console.error('Redis:', e.message));
await redis.connect();
const getProduct = productService(redis, {
  ttl: Number(process.env.CACHE_TTL || 10), delay: Number(process.env.DB_DELAY_MS || 200)
});
const server = http.createServer(async (req, res) => {
  const start = performance.now();
  const url = new URL(req.url, 'http://localhost');
  const send = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ...data, tiempo_ms: +(performance.now() - start).toFixed(3) }));
  };
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      await redis.ping(); return send(200, { estado: 'ok' });
    }
    const match = url.pathname.match(/^\/productos\/(\d+)$/);
    if (req.method === 'GET' && match) {
      const result = await getProduct(Number(match[1]), url.searchParams.get('cache') === '1');
      return send(result ? 200 : 404, result || { error: 'Producto no encontrado' });
    }
    if (req.method === 'DELETE' && /^\/cache\/productos\/[1-3]$/.test(url.pathname)) {
      await redis.del(`taller:producto:${url.pathname.split('/').pop()}`);
      return send(200, { estado: 'Caché eliminada' });
    }
    if (req.method === 'POST' && url.pathname === '/sesiones') {
      const id = randomUUID();
      await redis.set(`taller:sesion:${id}`, JSON.stringify({ usuario: 'estudiante-demo' }), { EX: 60 });
      return send(201, { id, ttl_segundos: 60 });
    }
    if (req.method === 'GET' && /^\/sesiones\/[a-f0-9-]{36}$/.test(url.pathname)) {
      const key = `taller:sesion:${url.pathname.split('/').pop()}`;
      const value = await redis.get(key);
      return send(value ? 200 : 404, value ? { sesion: JSON.parse(value), ttl_segundos: await redis.ttl(key) } : { error: 'Sesión inexistente o expirada' });
    }
    if (req.method === 'POST' && url.pathname === '/eventos') {
      const receptores = await redis.publish('taller:eventos', JSON.stringify({ evento: 'producto.consultado', producto: 1 }));
      return send(200, { receptores });
    }
    send(404, { error: 'Ruta no encontrada' });
  } catch (e) { console.error(e.message); send(503, { error: 'Servicio temporalmente no disponible' }); }
});
server.listen(3000, '0.0.0.0', () => console.log('Taller: http://localhost:3000/health'));
process.on('SIGTERM', () => server.close(async () => { if (redis.isOpen) await redis.quit(); process.exit(0); }));
