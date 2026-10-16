# Redis — Caché y procesamiento rápido

Taller con Node.js para demostrar almacenamiento en memoria, caché, TTL, sesiones y Pub/Sub, comparando consultas sin Redis y con caché.

## Versión actual: Oracle, página web y login

El proyecto completo está en **[taller-oracle](taller-oracle)**. Incluye:

- Productos persistidos en Oracle y caché de 20 segundos en Redis.
- Página web para comparar consultas directas, MISS y HIT.
- Generación de un reporte sobre 100,000 productos de prueba, sin demora artificial.
- Login con usuario guardado en Oracle y contraseña protegida mediante hash.
- Sesiones en Redis con cierre tras 60 segundos sin actividad.
- Creación de productos y avisos en dos ventanas mediante Redis Pub/Sub y SSE.

### Requisitos

Node.js 22 o posterior, Git, Docker con Compose y una instancia propia de Oracle (por ejemplo Free 23ai/26ai o XE 21c). Oracle se instala por separado; Docker Compose inicia Redis. SQL Developer o SQL*Plus permite preparar el usuario de Oracle.

### Instalación

```bash
git clone https://github.com/Ferotuc/redis-taller.git
cd redis-taller/taller-oracle
npm ci
```

Después sigue **[las instrucciones completas de instalación](taller-oracle/README.md)**: crear el usuario de Oracle, copiar `.env.example` a `.env` y configurar tus propias credenciales. Una vez configurado:

```bash
docker compose up -d
npm run preparar
npm run verificar:oracle
npm start
```

Abre [http://localhost:3005](http://localhost:3005). Cuenta web de demostración: **demo / TallerRedis2026!**. Es distinta de la contraseña de Oracle.

El enlace de GitHub permite descargar el código; no es una aplicación desplegada. Cada persona debe ejecutar Oracle, Redis y Node.js en su equipo. No publiques `.env`, que contiene tus credenciales locales.

### Pruebas

Con el servidor funcionando, desde `taller-oracle` en otra terminal:

```bash
npm run comparar
npm run probar:reporte
npm run probar:sesiones
```

La última prueba tarda más de un minuto y agrega un producto identificado como `Prueba PubSub` en la base local. Consulta el **[guion de sesiones y notificaciones](taller-oracle/GUIA-SESIONES-PUBSUB.md)** para la exposición.

## Versión introductoria anterior

Se conserva la API de la raíz con un catálogo simulado y 200 ms de demora artificial, sin Oracle ni interfaz. Sus comandos y pruebas están en **[GUIA-DEMO-SIMULADA.md](GUIA-DEMO-SIMULADA.md)**. Si ejecutas Docker Compose desde la raíz, inicias esa versión en el puerto 3000; para la versión actual debes entrar a **taller-oracle** y usar el puerto **3005**.

## Validación en GitHub Actions

El workflow conserva las pruebas de integración de la demo simulada y añade instalación y revisión de sintaxis para la versión Oracle. La integración real con Oracle se ejecuta localmente con los comandos anteriores; el workflow no configura una base Oracle ni verifica esa integración.
