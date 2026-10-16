import { iniciarSesionCLI, fetchAPI } from './cliente-api.js';
await iniciarSesionCLI();
async function request(path, options) {
  const response = await fetchAPI(path, options);
  const data = await response.json();
  if (!response.ok) throw Error(JSON.stringify(data));
  return data;
}
await request('/api/productos/1', { method: 'DELETE' });
const rows = [];
for (let i = 0; i < 5; i++) rows.push(await request('/api/productos/1?cache=0'));
rows.push(await request('/api/productos/1?cache=1'));
for (let i = 0; i < 5; i++) rows.push(await request('/api/productos/1?cache=1'));
console.table(rows.map(({ origen, tiempoServidorMs, ttlSegundos }) => ({ origen, tiempoServidorMs, ttlSegundos })));
const mean = a => a.reduce((s, x) => s + x.tiempoServidorMs, 0) / a.length;
const hits = rows.slice(6);
if (hits.some(x => !x.origen.includes('HIT'))) throw Error('Se esperaba caché caliente');
console.log(`Promedio sin caché: ${mean(rows.slice(0,5)).toFixed(3)} ms; HIT: ${mean(hits).toFixed(3)} ms`);
