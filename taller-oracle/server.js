import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createClient } from 'redis';
import { crearPool, obtenerProducto, listarProductos, obtenerReporte, agregarProducto } from './db.js';
import { SESSION_SECONDS, verificarUsuario, sessionKey, tokenFrom, cookie, clearCookie, newToken, leerJson } from './auth.js';

const TTL = Number(process.env.TTL_SECONDS ?? 20);
const PORT = Number(process.env.PORT ?? 3005);
if (!Number.isInteger(TTL) || TTL < 1) throw new Error('TTL inválido');
const pool = await crearPool();
const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6385', socket: { reconnectStrategy: false, connectTimeout: 3000 } });
redis.on('error', err => console.error('Redis:', err.message));
await redis.connect();
const CHANNEL = 'taller:productos';
const streams = new Set();
const subscriber = redis.duplicate();
subscriber.on('error', err => console.error('Suscriptor Redis:', err.message));
await subscriber.connect();
await subscriber.subscribe(CHANNEL, async message => {
  let event;
  try {
    event = JSON.parse(message);
    if (event.tipo !== 'producto-creado' || !event.producto || typeof event.producto.nombre !== 'string' || !Number.isSafeInteger(event.producto.id)) return;
  } catch { return; }
  console.log(`[Pub/Sub] Recibido producto ${event.producto.id} por ${CHANNEL}`);
  for (const stream of streams) {
    try {
      if (await redis.exists(stream.key)) stream.res.write(`event: producto\ndata: ${JSON.stringify(event)}\n\n`);
    } catch { stream.res.end(); }
  }
});
const server = http.createServer(async (req, res) => {
  const inicio = performance.now();
  function json(status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) {
      return json(403, { error: 'Origen no permitido' });
    }
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(await readFile(new URL('./index.html', import.meta.url)));
    }
    if (req.method === 'GET' && url.pathname === '/sesion.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(await readFile(new URL('./sesion.js', import.meta.url)));
    }
    if (!url.pathname.startsWith('/api/')) return json(404, { error: 'Ruta no encontrada' });
    const token = tokenFrom(req);
    const keySession = token ? sessionKey(token) : null;
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const body = await leerJson(req);
      if (typeof body.usuario !== 'string' || !/^[a-zA-Z0-9_]{1,50}$/.test(body.usuario) || typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128) {
        return json(400, { error: 'Usuario o contraseña inválidos' });
      }
      const attempts = await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", { keys: [`taller:login:${req.socket.remoteAddress}`], arguments: [] });
      if (attempts > 15) return json(429, { error: 'Demasiados intentos. Espera un minuto.' });
      const usuario = await verificarUsuario(pool, body.usuario, body.password);
      if (!usuario) return json(401, { error: 'Usuario o contraseña incorrectos' });
      if (keySession) await redis.del(keySession);
      const newSession = newToken();
      await redis.set(sessionKey(newSession), JSON.stringify({ usuario }), { EX: SESSION_SECONDS });
      res.setHeader('Set-Cookie', cookie(newSession));
      return json(200, { usuario, ttlSegundos: SESSION_SECONDS });
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      if (keySession) await redis.del(keySession);
      res.setHeader('Set-Cookie', clearCookie());
      return json(200, { mensaje: 'Sesión cerrada' });
    }
    // Solo la actividad explícita renueva el TTL. SSE, notificaciones y lecturas no lo renuevan.
    const session = keySession ? (url.pathname === '/api/actividad' && req.method === 'POST'
      ? await redis.getEx(keySession, { EX: SESSION_SECONDS }) : await redis.get(keySession)) : null;
    if (!session) {
      res.setHeader('Set-Cookie', clearCookie());
      return json(401, { error: 'Sesión vencida. Inicia sesión nuevamente.' });
    }
    if ((req.method === 'GET' && url.pathname === '/api/sesion') || (req.method === 'POST' && url.pathname === '/api/actividad')) {
      const ttl = await redis.ttl(keySession);
      if (ttl < 0) return json(401, { error: 'Sesión vencida' });
      return json(200, { usuario: JSON.parse(session).usuario, ttlSegundos: ttl });
    }
    if (req.method === 'GET' && url.pathname === '/api/eventos') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('event: conectado\ndata: {}\n\n');
      const stream = { res, key: keySession };
      streams.add(stream);
      const timer = setInterval(async () => {
        try {
          const ttl = await redis.ttl(keySession);
          if (ttl < 0) {
            res.write('event: sesion-vencida\ndata: {}\n\n');
            res.end();
          } else { res.write(`event: sesion\ndata: ${JSON.stringify({ ttlSegundos: ttl })}\n\n`); }
        } catch { res.end(); }
      }, 1000);
      res.on('close', () => { clearInterval(timer); streams.delete(stream); });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/productos') {
      const body = await leerJson(req);
      if (typeof body.nombre !== 'string' || !body.nombre.trim() || body.nombre.trim().length > 80 || typeof body.precio !== 'number' || !Number.isFinite(body.precio) || body.precio < 0 || body.precio > 99999999.99 || Math.abs(body.precio * 100 - Math.round(body.precio * 100)) > 0.00001) {
        return json(400, { error: 'Nombre requerido (máximo 80 caracteres) y precio válido con hasta dos decimales.' });
      }
      const producto = await agregarProducto(pool, body.nombre.trim(), body.precio);
      let notificacionEnviada = true;
      try {
        await redis.publish(CHANNEL, JSON.stringify({ tipo: 'producto-creado', producto, usuario: JSON.parse(session).usuario, fecha: new Date().toISOString() }));
      } catch (err) { notificacionEnviada = false; console.error('Producto guardado, pero falló PUBLISH:', err.message); }
      return json(201, { producto, notificacionEnviada });
    }
    if (req.method === 'GET' && url.pathname === '/api/productos') {
      return json(200, { productos: await listarProductos(pool) });
    }
    if (url.pathname === '/api/reporte') {
      const key = 'taller:oracle:reporte:v1';
      if (req.method === 'DELETE') {
        await redis.del(key);
        return json(200, { mensaje: 'Caché del reporte eliminada' });
      }
      if (req.method !== 'GET') return json(405, { error: 'Método no permitido' });
      const cache = url.searchParams.get('cache') === '1';
      let reporte;
      let origen = 'ORACLE SIN CACHÉ';
      if (cache) {
        const valor = await redis.get(key);
        if (valor !== null) { reporte = JSON.parse(valor); origen = 'REDIS · HIT'; }
      }
      if (!reporte) {
        reporte = await obtenerReporte(pool);
        if (cache) {
          await redis.set(key, JSON.stringify(reporte), { EX: TTL });
          origen = 'ORACLE → REDIS · MISS';
        }
      }
      const ttl = cache ? await redis.ttl(key) : null;
      return json(200, { reporte, origen, tiempoServidorMs: Number((performance.now()-inicio).toFixed(3)), ttlSegundos: ttl, baseDatos: 'Oracle' });
    }
    const match = url.pathname.match(/^\/api\/productos\/([1-9]\d*)$/);
    if (!match) return json(404, { error: 'Ruta o producto no encontrado' });
    const id = Number(match[1]);
    if (!Number.isSafeInteger(id)) return json(400, { error: 'ID inválido' });
    const key = `taller:oracle:producto:${id}`;
    if (req.method === 'DELETE') {
      await redis.del(key);
      return json(200, { mensaje: 'Caché del producto eliminada' });
    }
    if (req.method !== 'GET') return json(405, { error: 'Método no permitido' });
    const cache = url.searchParams.get('cache') === '1';
    let producto;
    let origen = 'ORACLE SIN CACHÉ';
    if (cache) {
      const valor = await redis.get(key);
      if (valor !== null) {
        producto = JSON.parse(valor);
        origen = 'REDIS · HIT';
      }
    }
    if (!producto) {
      producto = await obtenerProducto(pool, id);
      if (!producto) return json(404, { error: 'Producto no encontrado en Oracle' });
      if (cache) {
        await redis.set(key, JSON.stringify(producto), { EX: TTL });
        origen = 'ORACLE → REDIS · MISS';
      }
    }
    const ttl = cache ? await redis.ttl(key) : null;
    json(200, { producto, origen, tiempoServidorMs: Number((performance.now() - inicio).toFixed(3)), ttlSegundos: ttl, baseDatos: 'Oracle' });
  } catch (err) {
    console.error(err);
    if (err.status) return json(err.status, { error: err.message });
    json(503, { error: 'No se pudo completar la consulta. Revisa Oracle, Redis y la consola.' });
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`Taller: http://localhost:${PORT} | TTL: ${TTL}s | Oracle real, sin demora artificial`));
server.on('error', async err => {
  console.error(err.code === 'EADDRINUSE' ? `El puerto ${PORT} está ocupado. El taller ya puede estar iniciado.` : err.message);
  subscriber.destroy(); redis.destroy(); await pool.close(0); process.exitCode = 1;
});
process.on('SIGINT', () => {
  for (const stream of streams) stream.res.end();
  server.close(async () => { subscriber.destroy(); redis.destroy(); await pool.close(0); });
});
