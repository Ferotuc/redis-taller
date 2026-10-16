import { crearPool } from './db.js';
import { hashPassword } from './auth.js';
const pool = await crearPool();
let connection;
try {
  connection = await pool.getConnection();
  try {
    await connection.execute('CREATE TABLE taller_usuarios (usuario VARCHAR2(50) PRIMARY KEY, password_hash VARCHAR2(200) NOT NULL)');
  } catch (err) { if (err.errorNum !== 955) throw err; }
  const password = process.env.DEMO_PASSWORD ?? 'TallerRedis2026!';
  await connection.execute(`MERGE INTO taller_usuarios u USING (SELECT :usuario usuario, :hash password_hash FROM dual) s
    ON (u.usuario = s.usuario) WHEN NOT MATCHED THEN INSERT (usuario,password_hash) VALUES (s.usuario,s.password_hash)`,
    { usuario: 'demo', hash: hashPassword(password) });
  await connection.commit();
  console.log('Usuario demo preparado. La contraseña se almacena como hash scrypt. Usuarios existentes conservados.');
} finally { if (connection) await connection.close(); await pool.close(0); }
