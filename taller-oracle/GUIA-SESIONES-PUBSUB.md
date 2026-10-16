# Demostración: inicio de sesión, TTL y Pub/Sub

## Ingresar
Abre http://localhost:3005 y actualiza la página si estaba abierta.

- Usuario: `demo`
- Contraseña de demostración: `TallerRedis2026!`

Esta cuenta es para el taller local. El servidor escucha solamente en 127.0.0.1. La contraseña de esta cuenta es diferente de la contraseña del usuario de Oracle en `.env`. No muestres `.env` al presentar.

Oracle guarda el usuario y un hash scrypt con sal aleatoria, no la contraseña en texto. La API verifica las credenciales y crea una sesión con token aleatorio en una cookie HttpOnly y SameSite=Strict. Redis guarda la sesión con TTL de 60 segundos.

## Probar la sesión
1. Inicia sesión. Arriba aparece `Sesión en Redis: 60 s`.
2. Interactúa con la página: mueve el puntero sobre ella, haz clic, escribe o desplázate. Los avisos de actividad, limitados a aproximadamente uno por segundo, renuevan la sesión en el servidor.
3. Deja de interactuar y observa el contador. Leer la pantalla sin interactuar cuenta como inactividad.
4. Después de aproximadamente 60 segundos, vuelve a aparecer el formulario de ingreso. El navegador también puede mostrar el cierre con una pequeña variación por el redondeo del contador.
5. Aunque se manipulara la pantalla, la API rechaza las peticiones si la clave de sesión ya no existe. La validación real está en el backend.
6. Vuelve a ingresar y prueba `Cerrar sesión`: elimina la sesión en Redis.

SSE, el contador y las notificaciones no renuevan la sesión. Una petición normal desde otro cliente de API tampoco la renueva por sí sola: debe enviar `POST /api/actividad`. Así las lecturas automáticas no mantienen sesiones abiertas.

Para demostrar dos sesiones independientes usa dos navegadores o una ventana normal y otra de incógnito. Dos pestañas del mismo perfil comparten la cookie: la actividad en una mantiene la sesión compartida y cerrar sesión afecta a ambas.

## Probar Pub/Sub con dos ventanas
1. Abre http://localhost:3005 en ambas ventanas e inicia sesión.
2. En ambas, busca `Agregar producto y publicar un aviso`. Debe decir `Pub/Sub conectado`.
3. En la primera escribe un nombre y precio, por ejemplo `Cable HDMI`, `75`.
4. Pulsa `Guardar y publicar` una sola vez.
5. La API guarda el producto en `TALLER_PRODUCTOS` de Oracle y publica un evento en `taller:productos` de Redis.
6. El suscriptor del servidor recibe el mensaje y lo envía a las páginas conectadas mediante SSE.
7. Ambas muestran `Nuevo producto: Cable HDMI` y actualizan el selector sin recargar.

Cada envío crea un producto real del taller. Estos productos no se agregan a `PRODUCTOS_PRUEBA`, la tabla separada del reporte de 100,000 registros. Pub/Sub no conserva historial: una ventana desconectada no recibe eventos anteriores; al volver a entrar consulta el catálogo actualizado de Oracle.

Para escuchar el canal también desde la terminal:

```powershell
docker compose exec redis redis-cli SUBSCRIBE taller:productos
```

Ahora agrega otro producto en la página y verás el JSON en la terminal. Ctrl+C termina la suscripción.

## Mostrar Oracle en SQL Developer
Conectado como `TALLER_REDIS`:

```sql
SELECT usuario FROM taller_usuarios;
SELECT id, nombre, precio FROM taller_productos ORDER BY id DESC;
```

## Mostrar las claves temporales en Redis
```powershell
docker compose exec redis redis-cli --scan --pattern "taller:sesion:*"
```

Copia una clave completa de la salida y ejecuta `TTL` con ella. La clave se elimina al vencer o cerrar sesión. No confundas el TTL de sesión (60 s, renovable por actividad) con el TTL de la caché (20 s, no renovado por lectura).

## Archivos para explicar
- `auth.js`: hash de contraseña, comprobación de credenciales y token/cookie.
- `preparar-usuarios.js`: crea la tabla de usuarios y la cuenta demo una sola vez; conserva cuentas existentes.
- `server.js`: login, sesión, renovación, logout, PUBLISH, SUBSCRIBE y SSE. El suscriptor tiene una conexión Redis dedicada.
- `sesion.js`: formulario, contador, detección de actividad y recepción de notificaciones en el navegador.
- `db.js`: SELECT de usuarios/productos mediante los módulos correspondientes e INSERT de productos.

## Iniciar desde VS Code
```powershell
docker compose up -d
npm start
```

Si el servidor ya está iniciado, usa la página. Para reiniciar, detén la instancia anterior con Ctrl+C antes de ejecutar `npm start`.

## Pruebas automáticas
`node probar-sesiones.js` prueba acceso protegido, login incorrecto/correcto, cookies, origen, validación, dos suscriptores SSE, renovación y expiración real tras más de 60 segundos, y logout. Cada ejecución agrega un producto identificado como `Prueba PubSub` al catálogo para verificar todo el flujo.

`npm run comparar` y `node probar-reporte.js` ahora inician sesión con demo antes de consultar. Admiten `DEMO_PASSWORD` si se creó la cuenta con otra contraseña.

## Explicación para clase
“Oracle guarda los usuarios y productos. Redis almacena la sesión por 60 segundos de inactividad y la caché por 20 segundos. Cuando agrego un producto, Redis Pub/Sub distribuye el aviso al servidor suscrito, que lo envía a los navegadores mediante SSE. Recibir un aviso no cuenta como actividad del usuario.”

La demostración usa HTTP local. Un despliegue público requiere HTTPS, cookies Secure y una política de usuarios y permisos adecuada; las credenciales demo están destinadas al taller local.

Referencias: [Redis Pub/Sub con Node.js](https://redis.io/docs/latest/develop/use-cases/pub-sub/nodejs/), [API crypto de Node.js](https://nodejs.org/api/crypto.html).
