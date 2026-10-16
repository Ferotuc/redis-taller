import { crearPool } from './db.js';
const pool = await crearPool();
const connection = await pool.getConnection();
try {
  try {
    await connection.execute('CREATE TABLE taller_productos (id NUMBER PRIMARY KEY, nombre VARCHAR2(100) NOT NULL, precio NUMBER(10,2) NOT NULL)');
  } catch (err) { if (err.errorNum !== 955) throw err; }
  for (const [id, nombre, precio] of [[1,'Laptop',5500],[2,'Mouse',125],[3,'Teclado',250],
    [4,'Monitor',1500],[5,'Impresora',1850],[6,'Audífonos',275],[7,'Cámara web',350],
    [8,'Micrófono',450],[9,'Disco SSD 1 TB',650],[10,'Memoria USB 64 GB',85],
    [11,'Router Wi-Fi',425],[12,'Bocinas',300],[13,'Base para laptop',175]]) {
    await connection.execute(`MERGE INTO taller_productos p USING (SELECT :id id, :nombre nombre, :precio precio FROM dual) s
      ON (p.id = s.id) WHEN NOT MATCHED THEN INSERT (id, nombre, precio) VALUES (s.id, s.nombre, s.precio)`, {id,nombre,precio});
  }
  await connection.commit();
  console.log('Tabla taller_productos preparada en Oracle. Los productos existentes se conservan.');
} finally { await connection.close(); await pool.close(0); }
