import { crearPool } from './db.js';
const pool = await crearPool();
let connection;
try {
  connection = await pool.getConnection();
  const existe = await connection.execute("SELECT COUNT(*) FROM user_tables WHERE table_name = 'PRODUCTOS_PRUEBA'");
  if (!existe.rows[0][0]) {
    await connection.execute(`CREATE TABLE productos_prueba AS
      SELECT LEVEL AS id, 'Producto ' || LEVEL AS nombre,
      MOD(LEVEL,10)+1 AS categoria,
      ROUND(DBMS_RANDOM.VALUE(10,5000),2) AS precio,
      TRUNC(DBMS_RANDOM.VALUE(1,100)) AS stock
      FROM dual CONNECT BY LEVEL <= 100000`);
    console.log('Tabla PRODUCTOS_PRUEBA creada con 100,000 registros sintéticos.');
  } else { console.log('PRODUCTOS_PRUEBA ya existe; no se modificaron sus datos.'); }
  console.log('Filas del reporte:', (await connection.execute('SELECT COUNT(*) FROM productos_prueba')).rows[0][0]);
} finally { if (connection) await connection.close(); await pool.close(0); }
