import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from 'redis';
const base = process.env.BASE_URL || 'http://localhost:3000';
async function api(path, method = 'GET', status = 200) {
  const res = await fetch(base + path, { method, signal: AbortSignal.timeout(10000) });
  assert.equal(res.status, status); return res.json();
}
await api('/health');
await api('/cache/productos/1', 'DELETE');
assert.equal((await api('/productos/1?cache=0')).cache, 'OFF');
assert.equal((await api('/productos/1?cache=1')).cache, 'MISS');
assert.equal((await api('/productos/1?cache=1')).cache, 'HIT');
await sleep(11000);
assert.equal((await api('/productos/1?cache=1')).cache, 'MISS');
await api('/productos/99', 'GET', 404);
const session = await api('/sesiones', 'POST', 201);
assert.equal((await api('/sesiones/' + session.id)).sesion.usuario, 'estudiante-demo');
await sleep(61000);
await api('/sesiones/' + session.id, 'GET', 404);
const subscriber = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
subscriber.on('error', console.error);
await subscriber.connect();
try {
  let receive;
  const message = new Promise(resolve => { receive = resolve; });
  await subscriber.subscribe('taller:eventos', receive);
  assert.ok((await api('/eventos', 'POST')).receptores >= 1);
  let timer;
  try {
    const event = await Promise.race([message, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Pub/Sub timeout')), 5000); })]);
    assert.equal(JSON.parse(event).evento, 'producto.consultado');
  } finally { clearTimeout(timer); }
} finally { await subscriber.quit(); }
console.log('OK: OFF, MISS, HIT, TTL de producto, 404, sesión, expiración de sesión y Pub/Sub.');
