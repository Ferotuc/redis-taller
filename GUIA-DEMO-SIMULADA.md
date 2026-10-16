# Redis — Caché y procesamiento rápido

Taller ejecutable para comparar consultas de productos sin caché, con caché fría y con caché caliente. Incluye TTL, sesiones y Pub/Sub. Nivel introductorio; duración sugerida: 45–60 minutos.

## Objetivo

Comprender cuándo Redis reduce lecturas repetidas de una fuente lenta y medir su efecto. La fuente es un catálogo de tres productos en memoria con **200 ms de demora artificial por consulta**. No se usa una base de datos real. Los resultados describen esta simulación y no representan el rendimiento de producción.

## Conceptos

- **Almacenamiento en memoria:** Redis guarda datos en RAM. Puede configurarse con persistencia; este taller la desactiva, por lo que reiniciar Redis pierde sus datos.
- **Caché:** copia temporal de datos. Usamos cache-aside: buscar en Redis; ante MISS, consultar la fuente y guardar el resultado; ante HIT, devolver la copia.
- **TTL:** tiempo de vida. Los productos expiran a los 10 segundos desde que se guardan. Leer un producto no renueva su TTL. Una clave también puede ser expulsada antes por presión de memoria.
- **Sesiones:** un identificador aleatorio permite recuperar datos temporales, aquí por 60 segundos. Es una demostración, sin autenticación real.
- **Pub/Sub:** publica eventos para suscriptores conectados. No conserva historial ni garantiza recibir mensajes durante una desconexión. No sustituye una cola durable.

## Requisitos e inicio

Instalar Git y Docker Desktop con contenedores Linux, abrir Docker Desktop y esperar a que esté listo. En Linux, instalar Docker Engine y el complemento Compose. La primera ejecución requiere Internet para descargar imágenes y dependencias. Puerto 3000 disponible.

```sh
git clone https://github.com/Ferotuc/redis-taller.git
cd redis-taller
docker compose up --build -d --wait
```

Si recibes el proyecto como ZIP, extráelo y abre una terminal dentro de la carpeta que contiene compose.yaml; ejecuta el último comando. Abre http://localhost:3000/health: debe mostrar estado `ok`. La aplicación es una API JSON, sin pantalla de inicio.

## Actividad 1: consultas y comparación

Abre estas direcciones en el navegador:

1. http://localhost:3000/productos/1?cache=0 — siempre OFF, consulta la fuente cada vez.
2. http://localhost:3000/productos/1?cache=1 — primera vez MISS, guarda en Redis.
3. Repite inmediatamente la segunda dirección — HIT, evita la demora de la fuente.
4. Espera 11 segundos y repite — MISS por expiración del TTL.
5. http://localhost:3000/productos/99?cache=1 — devuelve 404.

El campo `tiempo_ms` mide el trabajo del servidor. Ejecuta ahora la comparación automatizada:

```sh
docker compose exec app npm run benchmark
docker compose cp app:/app/results.json ./results.json
```

El script borra solo la clave del producto 1. Ejecuta 20 solicitudes sin caché, una con caché fría y 20 con caché caliente, secuencialmente. Comprueba MISS/HIT y reporta promedio y percentil 95 del tiempo HTTP completo desde el cliente. Guarda también las muestras. Ejecuta sin otros usuarios para que no cambien la caché durante el ensayo.

| Escenario | Solicitudes | Promedio ms | p95 ms |
|---|---:|---:|---:|
| Sin caché | 20 | Completar | Completar |
| Caché fría | 1 | Completar | Completar |
| Caché caliente | 20 | Completar | Completar |

Reducción (%) = (1 − promedio caliente / promedio sin caché) × 100. No hay resultados prefabricados. Una sola muestra fría no permite interpretar su p95 estadísticamente; aparece únicamente para comparar el primer acceso.

## Actividad 2: inspeccionar TTL

Consulta primero el producto con caché y ejecuta:

```sh
docker compose exec redis redis-cli GET taller:producto:1
docker compose exec redis redis-cli TTL taller:producto:1
```

TTL positivo: segundos restantes. `-2`: clave inexistente o expirada. `-1`: clave sin expiración (no es lo esperado para estos productos). Para invalidar manualmente:

```sh
docker compose exec redis redis-cli DEL taller:producto:1
```

## Actividad 3: sesiones

En PowerShell:

```powershell
$sesion = Invoke-RestMethod -Method Post http://localhost:3000/sesiones
Invoke-RestMethod "http://localhost:3000/sesiones/$($sesion.id)"
```

En Bash/macOS/Linux:

```sh
curl -X POST http://localhost:3000/sesiones
curl http://localhost:3000/sesiones/REEMPLAZAR_CON_ID_DEVUELTO
```

Espera 61 segundos y repite la consulta: devuelve 404. Estas sesiones son didácticas; un sistema real necesita autenticación, cookies seguras y gestión de permisos.

## Actividad 4: Pub/Sub

En una terminal deja el suscriptor abierto:

```sh
docker compose exec redis redis-cli SUBSCRIBE taller:eventos
```

En otra terminal PowerShell publica:

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/eventos
```

En Bash usa `curl -X POST http://localhost:3000/eventos`. El suscriptor muestra el mensaje; la API devuelve el número de receptores. Cierra el suscriptor con Ctrl+C, publica y vuelve a suscribirte: el mensaje anterior no se reproduce.

## Pruebas reproducibles

```sh
docker compose exec app npm test
docker compose exec app node tests/integration.js
```

Las pruebas unitarias verifican la lógica con un doble de caché. La integración usa Redis real y tarda unos 75 segundos porque comprueba expiración de productos y sesiones, además de HIT/MISS, 404 y Pub/Sub. El workflow de GitHub Actions ejecuta ambas y el benchmark al subir cambios, si Actions está habilitado. Consulta los resultados en la pestaña Actions del repositorio.

## Entrega académica

Adjunta el enlace del repositorio, captura de la tabla del benchmark, `results.json`, evidencia MISS/HIT/MISS después del TTL, sesión expirada y mensaje Pub/Sub. Responde:

1. ¿Por qué el primer acceso con caché no es más rápido?
2. ¿Qué ocurre si el producto cambia antes del TTL? Se podría servir una copia desactualizada; una actualización real debe invalidar la clave.
3. ¿Qué evita un TTL y qué no garantiza?
4. ¿Qué pasa con una sesión al reiniciar este Redis?
5. ¿Por qué Pub/Sub no asegura procesar un mensaje si el receptor está desconectado?

Conclusión a completar: “En esta simulación, la caché caliente redujo el promedio de ___ ms a ___ ms (___%). El primer acceso consultó la fuente y el TTL permitió volver a cargar el producto después de expirar”.

## Detener y resolver problemas

```sh
docker compose logs app
docker compose down
```

Si Docker no conecta, verifica que Docker Desktop esté iniciado y en modo Linux. Si 3000 está ocupado, cambia el primer 3000 en compose.yaml y adapta las URL; para scripts define BASE_URL dentro del contenedor con `docker compose exec -e BASE_URL=http://localhost:3000 app npm run benchmark` (internamente la API sigue en 3000). Si falla una descarga, verifica tu conexión y repite la construcción.

Redis no publica su puerto al equipo anfitrión y la API se expone solo en localhost. Es un laboratorio local: no lo expongas directamente a Internet. El fallback BYPASS permite leer productos si una operación de caché falla; el arranque requiere Redis y no hay reconexión automática después de una caída: reinicia app para reconectar.

## Fuentes

- [Redis: cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/)
- [Redis: Pub/Sub y entrega de mensajes](https://redis.io/docs/latest/develop/pubsub/)
- [Redis: comando TTL](https://redis.io/docs/latest/commands/ttl/)

## Alcance de la medición

La demora artificial domina el caso sin caché. El benchmark es secuencial y pequeño; no mide concurrencia, saturación, red remota ni una base de datos real. No confundir sus resultados con una garantía de rendimiento de Redis.
