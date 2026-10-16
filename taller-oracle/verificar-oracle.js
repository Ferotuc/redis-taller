import oracledb from 'oracledb';
import { crearPool } from './db.js';
const pool = await crearPool();
let connection;
try {
  connection = await pool.getConnection();
  const options = { outFormat: oracledb.OUT_FORMAT_OBJECT };
  console.log('Conexión real a Oracle establecida (sin usar Redis).');
  console.table((await connection.execute(`SELECT USER AS usuario,
    SYS_CONTEXT('USERENV','DB_NAME') AS base_datos,
    SYS_CONTEXT('USERENV','CON_NAME') AS contenedor,
    SYS_CONTEXT('USERENV','SERVICE_NAME') AS servicio FROM dual`, {}, options)).rows);
  console.table((await connection.execute('SELECT product, version, status FROM product_component_version', {}, options)).rows);
  console.table((await connection.execute('SELECT id, nombre, precio FROM taller_productos ORDER BY id', {}, options)).rows);
  console.log('Verificación completada. No se modificaron datos.');
} finally {
  if (connection) await connection.close();
  await pool.close(0);
}
