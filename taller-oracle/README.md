# Taller Redis con Node.js y Oracle

Consulta productos sin Redis y con caché, compara tiempos y demuestra almacenamiento en memoria, TTL, sesiones y Pub/Sub. Incluye un reporte sobre 100,000 productos sintéticos, sin demoras artificiales.

## Requisitos

- Node.js 22 o posterior (recomendado 24 LTS) y npm.
- Git para clonar el proyecto.
- Oracle Database en ejecución, por ejemplo Oracle Free 23ai/26ai o XE 21c.
- Docker con Compose v2; en Windows, Docker Desktop con contenedores Linux.
- SQL Developer o SQL*Plus para crear el usuario y revisar tablas.

**Oracle se instala por separado.** El archivo compose.yaml inicia solamente Redis. Cada persona debe usar su propia instancia, usuario y contraseña de Oracle. El driver usa modo Thin, sin requerir Instant Client para las versiones indicadas. Puertos predeterminados: aplicación 3005, Redis 6385 y Oracle 1521.

## 1. Clonar e instalar

En GitHub pulsa **Code** y copia la URL HTTPS. Sustituye el marcador en este comando:

```bash
git clone https://github.com/Ferotuc/redis-taller.git
cd redis-taller/taller-oracle
npm ci
```

Ejecuta npm desde la carpeta que contiene package.json. Si el taller está dentro de una subcarpeta del repositorio, entra a esa subcarpeta antes de ejecutar npm.

## 2. Crear el usuario en Oracle

En SQL Developer abre una conexión administrativa a la **PDB**, por ejemplo FREEPDB1 en Oracle Free o XEPDB1 en XE. Abre [sql/crear-usuario.sql](sql/crear-usuario.sql), cambia la contraseña de ejemplo por una propia y ejecútalo una sola vez:

```sql
CREATE USER TALLER_REDIS IDENTIFIED BY "CAMBIA_ESTA_CLAVE_LOCAL"
  DEFAULT TABLESPACE USERS QUOTA 100M ON USERS;
GRANT CREATE SESSION, CREATE TABLE TO TALLER_REDIS;
```

El script no cambia de contenedor: conecta a la PDB correcta antes de ejecutarlo. No uses SYS o SYSTEM para la aplicación. Si el usuario ya existe, utiliza sus credenciales o elige otro nombre y configúralo en .env; no repitas CREATE USER.

## 3. Configurar la conexión

En PowerShell:

```powershell
Copy-Item .env.example .env
```

En macOS/Linux:

```bash
cp .env.example .env
```

Edita .env con los datos de **tu propia base**:

```dotenv
ORACLE_USER=TALLER_REDIS
ORACLE_PASSWORD="tu_clave_local"
ORACLE_CONNECT_STRING=localhost:1521/FREEPDB1
REDIS_URL=redis://127.0.0.1:6385
TTL_SECONDS=20
PORT=3005
```

Para XE, normalmente el servicio es XEPDB1. Cambia host, puerto y servicio según tu instalación. Pon la contraseña entre comillas si contiene # o espacios. .env está excluido de Git: no lo publiques. La contraseña de Oracle es diferente de la cuenta web demo.

**Alternativa opcional en Windows:** si SQL*Plus está en PATH y tu cuenta tiene administración local de Oracle, ejecuta `./crear-usuario.ps1`. Crea el usuario, genera una contraseña y escribe .env. Si eliges esta alternativa, no ejecutes previamente CREATE USER ni copies .env. Admite los parámetros `-SqlPlus "ruta/al/sqlplus.exe"`, `-Pdb FREEPDB1` y `-ConnectString localhost:1521/FREEPDB1`. Si .env ya existe, se detiene sin modificarlo.

## 4. Iniciar Redis y preparar las tablas

```bash
docker compose up -d
npm run preparar
npm run verificar:oracle
```

La preparación ejecuta:

- preparar-db.js: crea TALLER_PRODUCTOS e inserta los 13 productos iniciales si faltan sus IDs.
- preparar-usuarios.js: crea TALLER_USUARIOS y la cuenta demo, con contraseña protegida mediante hash scrypt y sal aleatoria.
- preparar-reporte.js: crea PRODUCTOS_PRUEBA con 100,000 filas sintéticas si la tabla no existe. Si existe, conserva sus datos y muestra la cantidad real.

Los datos existentes se conservan. Si un paso falla, corrige el error y repite la preparación. Cada tabla se crea por separado; no se eliminan tablas existentes. La cuota de 100 MB está destinada al taller. GitHub contiene código y generadores: **cada clon crea los datos en su propia base de Oracle**, no recibe los datos privados de otra computadora.

## 5. Iniciar la aplicación

```bash
npm start
```

Abre [http://localhost:3005](http://localhost:3005) y mantén esa terminal abierta.

| Acceso web de demostración | Valor |
|---|---|
| Usuario | demo |
| Contraseña | TallerRedis2026! |

La aplicación escucha en 127.0.0.1 y está pensada para un taller local. **Compartir el enlace de GitHub comparte el código, no una aplicación desplegada.** Cada persona debe instalar y ejecutar el proyecto. GitHub Pages no ejecuta este backend.

## Pruebas para presentar

### Caché y TTL

1. Selecciona Producto individual y un producto.
2. Pulsa Consultar sin Redis: cada solicitud consulta Oracle.
3. Pulsa Vaciar caché de la consulta y luego Consultar con Redis: aparece MISS y se guarda una copia por 20 segundos.
4. Repite antes de 20 segundos: aparece HIT.
5. Espera más de 20 segundos desde el MISS y repite: vuelve a aparecer MISS. Leer la copia no renueva su TTL.
6. Pulsa Comparar 5 consultas por modo: muestra cinco consultas directas, un MISS separado y cinco HIT.

### Reporte de 100,000 productos

Selecciona Reporte por categoría (productos_prueba) y repite las pruebas anteriores. Oracle calcula cantidad de productos, precio promedio, unidades y valor del inventario por categoría. Redis guarda el resultado completo: un HIT evita recalcularlo.

La tabla del reporte está separada del catálogo. Los productos agregados desde la página no aumentan los registros de PRODUCTOS_PRUEBA.

Servidor (ms) mide el procesamiento en Node.js, incluida la validación de sesión y, al usar caché, la consulta del TTL. HTTP (ms) mide desde el navegador hasta leer la respuesta. Los resultados varían: Oracle local puede responder más rápido que Redis al buscar un solo producto. El reporte muestra una situación donde reutilizar un resultado puede ahorrar más trabajo. No se promete que Redis gane siempre. Cinco muestras ilustran el taller; no son un benchmark de producción.

### Sesiones

La API verifica credenciales en Oracle y crea una sesión en Redis por **60 segundos**. La cookie es HttpOnly y SameSite=Strict. Clics, escritura, desplazamiento y movimientos del puntero sobre la página envían actividad, como máximo aproximadamente una vez por segundo, para renovar la sesión.

Deja de interactuar: el contador baja y vuelve al formulario. El contador, SSE y las notificaciones automáticas no renuevan la sesión. La API rechaza una sesión vencida aunque se manipule la página. Los clientes de API deben usar POST /api/actividad para renovar; las lecturas por sí solas no renuevan.

Dos pestañas del mismo perfil comparten cookie y sesión. Para sesiones independientes utiliza dos navegadores o una ventana normal y otra de incógnito.

### Pub/Sub y SSE

1. Abre dos ventanas e inicia sesión antes de crear un producto.
2. Confirma que indiquen Pub/Sub conectado.
3. Agrega nombre y precio en una y pulsa Guardar y publicar.
4. La API guarda el producto en Oracle y publica un evento en el canal taller:productos de Redis.
5. El suscriptor usa una conexión Redis dedicada; Node.js entrega el aviso a las páginas mediante SSE.
6. Ambas muestran la notificación y actualizan el catálogo sin recargar.

Pub/Sub no conserva historial para clientes desconectados. Al reconectar, se consulta el catálogo actual de Oracle. Cada envío del formulario crea un producto en la base del taller.

Para escuchar también desde la terminal antes de agregar un producto:

```bash
docker compose exec redis redis-cli SUBSCRIBE taller:productos
```

Sal con Ctrl+C. Consulta el guion ampliado en [GUIA-SESIONES-PUBSUB.md](GUIA-SESIONES-PUBSUB.md).

## Pruebas automáticas

Con el servidor iniciado, abre otra terminal en la misma carpeta:

```bash
npm run comparar
npm run probar:reporte
npm run probar:sesiones
```

Los scripts inician sesión con demo antes de consultar. probar:reporte verifica que Oracle y Redis devuelvan los mismos datos. probar:sesiones tarda más de un minuto y verifica login, acceso protegido, cookies, validación, dos suscriptores SSE, renovación, caducidad real y logout. **Cada ejecución agrega un producto llamado Prueba PubSub** al catálogo.

No ejecutes muchas pruebas simultáneas: el login limita intentos por dirección. Si preparaste la cuenta demo con otra contraseña, define DEMO_PASSWORD en el entorno de los scripts; cambiar esa variable no actualiza cuentas existentes. No uses credenciales personales como contraseña de la cuenta demo.

## Revisar Oracle en SQL Developer

Conecta con el mismo usuario, host, puerto y servicio de .env:

```sql
SELECT USER, SYS_CONTEXT('USERENV','CON_NAME') AS contenedor FROM dual;
SELECT * FROM taller_productos ORDER BY id;
SELECT usuario FROM taller_usuarios;
SELECT COUNT(*) AS total_reporte FROM productos_prueba;
```

También puedes ejecutar [verificar-oracle.sql](verificar-oracle.sql).

## Archivos principales

| Archivo | Función |
|---|---|
| server.js | API, caché, sesiones, PUBLISH/SUBSCRIBE y SSE |
| db.js | Pool y consultas parametrizadas de Oracle |
| auth.js | Verificación de contraseña y tokens/cookies |
| index.html y sesion.js | Interfaz, mediciones, actividad y notificaciones |
| preparar-*.js | Creación de tablas y datos iniciales |
| compose.yaml | Redis local en Docker |
| .env.example | Configuración de ejemplo sin credenciales reales |

## Problemas frecuentes

| Situación | Solución |
|---|---|
| EADDRINUSE en 3005 | Ya hay un servidor. Usa esa instancia o detenla con Ctrl+C antes de iniciar otra. |
| Redis no conecta | Inicia Docker y ejecuta docker compose up -d; revisa docker compose ps y docker compose logs redis. |
| ORA-01017 | Revisa usuario, contraseña y servicio en .env. |
| ORA-12514 o conexión fallida | Revisa listener, host, puerto y nombre del servicio Oracle. |
| ORA-00942 | Ejecuta npm run preparar en el usuario y servicio correctos. |
| ORA-01950 o cuota agotada | Un administrador debe asignar espacio al usuario en USERS. |
| ORA-65096 al crear usuario | Conecta a la PDB (por ejemplo FREEPDB1) para crear el usuario local. |
| 401 | La sesión pudo vencer; inicia sesión de nuevo. |
| 429 | Espera un minuto antes de intentar el login. |
| No llega un aviso | Conecta e inicia sesión antes de publicar; no se reproducen mensajes anteriores. |

## Detener y limitaciones

Detén Node.js con Ctrl+C y ejecuta:

```bash
docker compose stop
```

Redis no tiene volumen persistente: al recrear el contenedor pueden perderse sesiones y caché, que son temporales. Los productos permanecen en Oracle. Si modificas datos existentes debes invalidar su caché o esperar su TTL. Esta demo puede responder 503 si Redis falla y no incluye un fallback completo. Un despliegue público requiere HTTPS, cookies Secure y una política adecuada de usuarios/permisos.

## Referencias

- [Redis cache-aside con Node.js](https://redis.io/docs/latest/develop/use-cases/cache-aside/nodejs/)
- [Redis Pub/Sub con Node.js](https://redis.io/docs/latest/develop/use-cases/pub-sub/nodejs/)
- [Conexiones node-oracledb](https://node-oracledb.readthedocs.io/en/stable/user_guide/connection_handling.html)
