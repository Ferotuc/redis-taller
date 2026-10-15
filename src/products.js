import { setTimeout as sleep } from 'node:timers/promises';
const products = [{ id: 1, nombre: 'Teclado', precio: 150 }, { id: 2, nombre: 'Mouse', precio: 80 }, { id: 3, nombre: 'Monitor', precio: 1200 }];
export function productService(cache, { ttl = 10, delay = 200 } = {}) {
  return async function getProduct(id, cached) {
    const product = products.find(p => p.id === id);
    if (!product) return null;
    const key = `taller:producto:${id}`;
    let available = true;
    if (cached) {
      try { const value = await cache.get(key); if (value) return { producto: JSON.parse(value), cache: 'HIT' }; } catch { available = false; }
    }
    await sleep(delay);
    if (cached && available) {
      try { await cache.set(key, JSON.stringify(product), { EX: ttl }); } catch { available = false; }
    }
    return { producto: product, cache: cached ? (available ? 'MISS' : 'BYPASS') : 'OFF' };
  };
}
