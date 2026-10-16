import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import oracledb from 'oracledb';

export const SESSION_SECONDS = 60;
export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}
export async function verificarUsuario(pool, usuario, password) {
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute('SELECT usuario, password_hash FROM taller_usuarios WHERE usuario = :usuario',
      { usuario }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const row = result.rows[0];
    // Realizar el mismo trabajo criptográfico aunque el usuario no exista.
    const valid = checkPassword(password, row?.PASSWORD_HASH ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`);
    return row && valid ? row.USUARIO : null;
  } finally { await connection.close(); }
}
export function sessionKey(token) {
  return `taller:sesion:${createHash('sha256').update(token).digest('hex')}`;
}
export function tokenFrom(req) {
  const token = (req.headers.cookie ?? '').split(';').map(x => x.trim()).find(x => x.startsWith('taller_sid='))?.slice(11);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function cookie(token) {
  return `taller_sid=${token}; HttpOnly; SameSite=Strict; Path=/`;
}
export function clearCookie() { return 'taller_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'; }
export function newToken() { return randomBytes(32).toString('hex'); }

export async function leerJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(Error('Se requiere JSON'), { status: 415 });
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 8192) throw Object.assign(Error('Solicitud demasiado grande'), { status: 413 });
  }
  try { return JSON.parse(body); } catch { throw Object.assign(Error('JSON inválido'), { status: 400 }); }
}
