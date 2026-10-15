import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://localhost:3000';
async function request(path, method = 'GET') {
  const start = performance.now();
  const res = await fetch(base + path, { method, signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return { ms: performance.now() - start, cache: data.cache };
}
await request('/health');
await request('/cache/productos/1', 'DELETE');
const rows = [];
const samples = [];
for (let i = 0; i < 20; i++) samples.push(await request('/productos/1?cache=0'));
const cold = await request('/productos/1?cache=1');
if (cold.cache !== 'MISS') throw new Error('Se esperaba MISS inicial');
const warm = [];
for (let i = 0; i < 20; i++) {
  const sample = await request('/productos/1?cache=1');
  if (sample.cache !== 'HIT') throw new Error('La caché expiró o Redis falló; repite el ensayo');
  warm.push(sample);
}
for (const [escenario, values] of [['Sin caché', samples], ['Caché fría', [cold]], ['Caché caliente', warm]]) {
  const sorted = values.map(v => v.ms).sort((a,b) => a-b);
  rows.push({ escenario, n: values.length, promedio_ms: +(sorted.reduce((a,b) => a+b,0)/sorted.length).toFixed(3),
    p95_ms: +sorted[Math.ceil(sorted.length * .95)-1].toFixed(3) });
}
console.table(rows);
const mejora = (1 - rows[2].promedio_ms / rows[0].promedio_ms) * 100;
console.log(`Reducción del promedio: ${mejora.toFixed(2)}%`);
await writeFile('results.json', JSON.stringify({ fecha: new Date().toISOString(), demora_simulada_ms: process.env.DB_DELAY_MS || 'ver configuración del servidor', rows, mejora_porcentaje: mejora, muestras: { sin_cache: samples, fria: cold, caliente: warm } }, null, 2));
