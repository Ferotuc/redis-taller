import { crearPool } from './db.js';
const nuevos = [
  ['Monitor',1500], ['Impresora',1850], ['Audífonos',275],
  ['Cámara web',350], ['Micrófono',450], ['Disco SSD 1 TB',650],
  ['Memoria USB 64 GB',85], ['Router Wi-Fi',425],
  ['Bocinas',300], ['Base para laptop',175]
];
const pool = await crearPool();
let connection;
try {
  connection = await pool.getConnection();
  await connection.execute('LOCK TABLE taller_productos IN EXCLUSIVE MODE');
  const result = await connection.execute('SELECT NVL(MAX(id),0) FROM taller_productos');
  let id = result.rows[0][0];
  const filas = nuevos.map(([nombre, precio]) => ({ id: ++id, nombre, precio }));
  await connection.executeMany('INSERT INTO taller_productos (id,nombre,precio) VALUES (:id,:nombre,:precio)', filas);
  await connection.commit();
  console.log('10 productos nuevos guardados en Oracle:');
  console.table(filas);
  console.log('Total de productos:', (await connection.execute('SELECT COUNT(*) FROM taller_productos')).rows[0][0]);
} catch (err) {
  if (connection) await connection.rollback();
  throw err;
} finally {
  if (connection) await connection.close();
  await pool.close(0);
}
