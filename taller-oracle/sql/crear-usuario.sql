-- Oracle Free: ejecutar como administrador conectado al servicio FREEPDB1.
-- No ejecutar como TALLER_REDIS. Sustituye la contraseña antes de ejecutar.
-- Para XE normalmente se usa el servicio XEPDB1; para otra instalación usa su PDB.
CREATE USER TALLER_REDIS IDENTIFIED BY "CAMBIA_ESTA_CLAVE_LOCAL"
  DEFAULT TABLESPACE USERS QUOTA 100M ON USERS;
GRANT CREATE SESSION, CREATE TABLE TO TALLER_REDIS;
