-- Ejecutar conectado como TALLER_REDIS en FREEPDB1.
-- Estas consultas solo leen información.
SELECT
  USER AS usuario,
  SYS_CONTEXT('USERENV', 'DB_NAME') AS base_datos,
  SYS_CONTEXT('USERENV', 'CON_NAME') AS contenedor,
  SYS_CONTEXT('USERENV', 'SERVICE_NAME') AS servicio
FROM dual;

SELECT product, version, status FROM product_component_version;

SELECT table_name FROM user_tables WHERE table_name = 'TALLER_PRODUCTOS';

SELECT id, nombre, precio FROM taller_productos ORDER BY id;

SELECT COUNT(*) AS total_productos FROM taller_productos;
