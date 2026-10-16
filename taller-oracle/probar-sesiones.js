import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
const base = process.env.BASE_URL ?? 'http://localhost:3005';
async function request(path, { cookie, method = 'GET', body, origin } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(origin ? { Origin: origin } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  return { response, data };
}
async function login() {
  const result = await request('/api/login', { method: 'POST', body: { usuario: 'demo', password: process.env.DEMO_PASSWORD ?? 'TallerRedis2026!' } });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.ttlSegundos,60);
  const cookie = result.response.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly/); assert.match(cookie,/SameSite=Strict/);
  return cookie.split(';')[0];
}
async function listen(cookie) {
  const controller = new AbortController();
  const response = await fetch(base+'/api/eventos',{headers:{Cookie:cookie},signal:controller.signal});
  assert.equal(response.status,200);
  const stream = { text: '', stop: () => controller.abort() };
  stream.done = (async () => {
    try { for await (const chunk of response.body) stream.text += new TextDecoder().decode(chunk); }
    catch(err) { if (err.name !== 'AbortError') throw err; }
  })();
  return stream;
}
let a, b, s1, s2;
try {
  assert.equal((await request('/api/productos')).response.status,401);
  assert.equal((await request('/api/reporte')).response.status,401);
  assert.equal((await request('/api/eventos')).response.status,401);
  assert.equal((await request('/api/productos',{method:'POST',body:{nombre:'No autorizado',precio:1}})).response.status,401);
  assert.equal((await request('/api/login',{method:'POST',body:{usuario:'demo',password:'incorrecta'}})).response.status,401);
  a = await login(); b = await login(); assert.notEqual(a,b);
  assert.equal((await request('/api/actividad',{cookie:a,method:'POST',origin:'https://otro.example'})).response.status,403);
  assert.equal((await request('/api/productos',{cookie:a,method:'POST',body:{nombre:'',precio:-1}})).response.status,400);
  s1 = await listen(a); s2 = await listen(b);
  const nombre = `Prueba PubSub ${Date.now()}`;
  const created = await request('/api/productos',{cookie:a,method:'POST',body:{nombre,precio:99.50}});
  assert.equal(created.response.status,201,JSON.stringify(created.data));
  assert.equal(created.data.notificacionEnviada,true);
  for(let i=0;i<30 && (!s1.text.includes(nombre)||!s2.text.includes(nombre));i++) await sleep(100);
  assert.ok(s1.text.includes(nombre),'Primer cliente recibe el evento');
  assert.ok(s2.text.includes(nombre),'Segundo cliente recibe el evento');
  assert.ok((await request('/api/productos',{cookie:a})).data.productos.some(p=>p.id===created.data.producto.id));
  console.log(`OK: acceso protegido, contraseña incorrecta, cookie, sesiones independientes, validación y Pub/Sub en dos clientes. Producto de prueba guardado: ${nombre}.`);
  await sleep(2100);
  const antes = await request('/api/sesion',{cookie:a});
  assert.ok(antes.data.ttlSegundos<60,'Consultar sesión no renueva');
  const renewed = await request('/api/actividad',{cookie:a,method:'POST'});
  assert.equal(renewed.data.ttlSegundos,60);
  console.log('OK: el TTL disminuye y la actividad lo renueva a 60 s. Esperando caducidad real; SSE permanece abierto.');
  for(let i=0;i<3;i++) {
    await sleep(21000);
    assert.equal((await request('/api/actividad',{cookie:a,method:'POST'})).response.status,200);
    console.log(`Sesión activa renovada (${(i+1)*21} s de prueba).`);
  }
  assert.equal((await request('/api/productos',{cookie:b})).response.status,401);
  assert.equal((await request('/api/actividad',{cookie:b,method:'POST'})).response.status,401,'No se revive una sesión caducada');
  assert.ok(s2.text.includes('sesion-vencida'),'SSE avisa del cierre sin renovar sesión');
  assert.equal((await request('/api/productos',{cookie:a})).response.status,200);
  await request('/api/logout',{cookie:a,method:'POST'});
  assert.equal((await request('/api/productos',{cookie:a})).response.status,401);
  console.log('OK: sesión inactiva vencida, sesión activa conservada y logout revocado en servidor. Todas las pruebas pasaron.');
} finally {
  s1?.stop(); s2?.stop();
  if (a) await request('/api/logout',{cookie:a,method:'POST'});
  if (b) await request('/api/logout',{cookie:b,method:'POST'});
}
