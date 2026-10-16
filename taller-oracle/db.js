import oracledb from 'oracledb';
import { loadEnvFile } from 'node:process';
try { loadEnvFile(new URL('./.env', import.meta.url)); } catch (err) { if (err.code !== 'ENOENT') throw err; }
export async function crearPool() {
  if (!process.env.ORACLE_USER || !process.env.ORACLE_PASSWORD || !process.env.ORACLE_CONNECT_STRING) {
    throw Error('Configura ORACLE_USER, ORACLE_PASSWORD y ORACLE_CONNECT_STRING en .env');
  }
  return oracledb.createPool({ user: process.env.ORACLE_USER, password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING, poolMin: 1, poolMax: 4, poolIncrement: 1 });
}
export async function obtenerProducto(pool, id) {
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute('SELECT id AS "id", nombre AS "nombre", precio AS "precio" FROM taller_productos WHERE id = :id', { id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows[0];
  } finally { await connection.close(); }
}
export async function listarProductos(pool) {
  const connection = await pool.getConnection();
  try {
    return (await connection.execute('SELECT id AS "id", nombre AS "nombre", precio AS "precio" FROM taller_productos ORDER BY id', {}, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows;
  } finally { await connection.close(); }
}
export async function obtenerReporte(pool) {
  const connection = await pool.getConnection();
  try {
    return (await connection.execute(`SELECT categoria AS "categoria",
      COUNT(*) AS "cantidad_productos", ROUND(AVG(precio),2) AS "precio_promedio",
      SUM(stock) AS "unidades", ROUND(SUM(precio * stock),2) AS "valor_inventario"
      FROM productos_prueba GROUP BY categoria ORDER BY categoria`, {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows;
  } finally { await connection.close(); }
}
export async function agregarProducto(pool, nombre, precio) {
  const connection = await pool.getConnection();
  try {
    await connection.execute('LOCK TABLE taller_productos IN EXCLUSIVE MODE');
    const id = (await connection.execute('SELECT NVL(MAX(id),0)+1 FROM taller_productos')).rows[0][0];
    await connection.execute('INSERT INTO taller_productos (id,nombre,precio) VALUES (:id,:nombre,:precio)', { id, nombre, precio });
    await connection.commit();
    return { id, nombre, precio };
  } catch (err) { await connection.rollback(); throw err; }
  finally { await connection.close(); }
}
