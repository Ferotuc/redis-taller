import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productService } from '../src/products.js';
test('OFF no consulta Redis; MISS escribe TTL; HIT recupera producto', async () => {
  let value = null; let writes = 0;
  const get = productService({ get: async () => value, set: async (key, v, opts) => {
    assert.equal(key, 'taller:producto:1'); assert.equal(opts.EX, 10); value = v; writes++;
  } }, { delay: 0 });
  assert.equal((await get(1, false)).cache, 'OFF');
  assert.equal((await get(1, true)).cache, 'MISS');
  assert.equal((await get(1, true)).cache, 'HIT');
  assert.equal(writes, 1);
  assert.equal(await get(99, true), null);
});
test('Un fallo de caché permite consultar la fuente', async () => {
  const get = productService({ get: async () => { throw new Error('offline'); } }, { delay: 0 });
  const result = await get(1, true);
  assert.equal(result.cache, 'BYPASS'); assert.equal(result.producto.id, 1);
});
