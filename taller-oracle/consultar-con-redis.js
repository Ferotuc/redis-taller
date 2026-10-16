import { performance } from 'node:perf_hooks';
import { createClient } from 'redis';
import { crearPool, obtenerProducto } from './db.js';

// Ejemplo: node consultar-con-redis.js 4 --vaciar
const id = Number(process.argv[2] ?? 1);
const opciones = process.argv.slice(3);
const ttl = Number(process.env.TTL_SECONDS ?? 20);
if (!Number.isSafeInteger(id) || id < 1 || opciones.some(x => x !== '--vaciar') || !Number.isInteger(ttl) || ttl < 1) {
  console.error('Uso: node consultar-con-redis.js ID_POSITIVO [--vaciar]. TTL_SECONDS debe ser un entero positivo.');
  process.exit(1);
}

const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6385', socket: { reconnectStrategy: false, connectTimeout: 3000 } });
redis.on('error', err => console.error('Redis:', err.message));
// Clave separada para no interferir con las pruebas de la página.
const clave = `taller:cli:producto:${id}`;
let pool;
try {
  const inicioConexion = performance.now();
  await redis.connect();
  const conexionMs = performance.now() - inicioConexion;
  if (opciones.includes('--vaciar')) {
    await redis.del(clave);
    console.log(`Se eliminó solo la caché del producto ${id}.`);
  }
  const inicio = performance.now();
  const guardado = await redis.get(clave);
  let producto;
  let origen;
  if (guardado !== null) {
    producto = JSON.parse(guardado);
    origen = 'REDIS · HIT (no se abrió una conexión a Oracle)';
  } else {
    pool = await crearPool();
    producto = await obtenerProducto(pool, id);
    if (producto) {
      await redis.set(clave, JSON.stringify(producto), { EX: ttl });
      origen = 'ORACLE → REDIS · MISS';
    }
  }
  const tiempo = conexionMs + performance.now() - inicio;
  if (!producto) {
    console.log(`El producto ${id} no existe en Oracle. No se guardó en caché.`);
    process.exitCode = 1;
  } else {
    console.table([producto]);
    console.log(`Origen: ${origen}`);
    console.log(`Clave: ${clave}`);
    console.log(`TTL restante: ${await redis.ttl(clave)} segundos`);
  }
  console.log(`Tiempo de consulta: ${tiempo.toFixed(3)} ms (incluye conectar Redis y, en MISS, Oracle; excluye vaciar la caché y consultar el TTL).`);
  console.log('Demostración de procesos separados; usa la comparación de la API para medir conexiones reutilizadas.');
} catch (err) {
  console.error('No se pudo completar la consulta:', err.message);
  process.exitCode = 1;
} finally {
  if (redis.isOpen) redis.destroy();
  if (pool) await pool.close(0);
}
