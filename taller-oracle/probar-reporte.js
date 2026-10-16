import assert from 'node:assert/strict';
import { iniciarSesionCLI, fetchAPI } from './cliente-api.js';
await iniciarSesionCLI();
async function request(path, method = 'GET') {
  const response = await fetchAPI(path, { method });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
await request('/api/reporte','DELETE');
const sin = [];
for(let i=0;i<5;i++) sin.push(await request('/api/reporte?cache=0'));
const miss = await request('/api/reporte?cache=1');
assert.match(miss.origen,/MISS/);
const hits = [];
for(let i=0;i<5;i++) {
  const hit = await request('/api/reporte?cache=1');
  assert.match(hit.origen,/HIT/);
  assert.deepEqual(hit.reporte,sin[0].reporte);
  hits.push(hit);
}
assert.ok(sin[0].reporte.length > 0, 'Se esperan categorías');
const media = a => a.reduce((s,x)=>s+x.tiempoServidorMs,0)/a.length;
console.log('Categorías:',sin[0].reporte.length,'Productos:',sin[0].reporte.reduce((s,r)=>s+r.cantidad_productos,0));
console.table([...sin,miss,...hits].map(({origen,tiempoServidorMs,ttlSegundos})=>({origen,tiempoServidorMs,ttlSegundos})));
console.log(`Promedio Oracle: ${media(sin).toFixed(3)} ms; Redis HIT: ${media(hits).toFixed(3)} ms. Datos iguales verificados.`);
