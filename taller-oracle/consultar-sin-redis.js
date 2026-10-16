import { performance } from 'node:perf_hooks';
import { crearPool, obtenerProducto } from './db.js';

// Ejemplo: node consultar-sin-redis.js 4
const id = Number(process.argv[2] ?? 1);
if (!Number.isSafeInteger(id) || id < 1 || process.argv.length > 3) {
  console.error('Uso: node consultar-sin-redis.js ID_POSITIVO');
  process.exit(1);
}

let pool;
try {
  const inicio = performance.now();
  // Esta consulta no utiliza Redis ni la API web.
  pool = await crearPool();
  const producto = await obtenerProducto(pool, id);
  const tiempo = performance.now() - inicio;
  if (!producto) {
    console.log(`El producto ${id} no existe en Oracle.`);
    process.exitCode = 1;
  } else {
    console.table([producto]);
    console.log('Origen: ORACLE SIN REDIS');
  }
  console.log(`Tiempo total de consulta: ${tiempo.toFixed(3)} ms (incluye abrir la conexión a Oracle).`);
} catch (err) {
  console.error('No se pudo consultar Oracle:', err.message);
  process.exitCode = 1;
} finally { if (pool) await pool.close(0); }
