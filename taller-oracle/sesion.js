const el = id => document.getElementById(id);
let usuarioActual = null;
let eventos = null;
let vence = 0;
let ultimoAviso = 0;
let renovando = null;
let pendiente = null;
let generacion = 0;

function mostrarLogin(mensaje = '') {
  generacion++;
  usuarioActual = null;
  eventos?.close(); eventos = null;
  clearTimeout(pendiente); pendiente = null;
  el('app').hidden = true;
  el('acceso').hidden = false;
  el('barra-sesion').hidden = true;
  el('mensaje-login').textContent = mensaje;
  el('password').value = '';
  el('notificaciones').replaceChildren();
  // Borrar los resultados privados de la vista anterior.
  el('filas').replaceChildren(); el('detalle').textContent = '';
  el('resumen').textContent = ''; el('tabla-reporte').replaceChildren();
}
function actualizarTiempo(data) { vence = Date.now() + data.ttlSegundos * 1000; }
async function activarSesion(data) {
  generacion++;
  usuarioActual = data.usuario;
  ultimoAviso = 0;
  actualizarTiempo(data);
  el('acceso').hidden = true;
  el('app').hidden = false;
  el('barra-sesion').hidden = false;
  el('usuario-actual').textContent = data.usuario;
  await window.onSesionIniciada();
  if (!usuarioActual) return;
  conectarEventos();
}
function conectarEventos() {
  eventos?.close();
  eventos = new EventSource('/api/eventos');
  eventos.addEventListener('conectado', () => { el('estado-eventos').textContent = 'Pub/Sub conectado: esperando productos nuevos.'; });
  eventos.addEventListener('sesion', e => actualizarTiempo(JSON.parse(e.data)));
  eventos.addEventListener('sesion-vencida', () => mostrarLogin('Sesión cerrada después de 60 segundos sin actividad.'));
  eventos.addEventListener('producto', async e => {
    const data = JSON.parse(e.data);
    const li = document.createElement('li');
    li.textContent = `${new Date(data.fecha).toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala' })} · Nuevo producto: ${data.producto.nombre} — Q ${data.producto.precio} · Canal: taller:productos`;
    el('notificaciones').prepend(li);
    while(el('notificaciones').children.length > 10) el('notificaciones').lastChild.remove();
    // Esta lectura automática NO renueva la sesión.
    await window.onProductosActualizados();
  });
  eventos.onerror = () => { el('estado-eventos').textContent = 'Conexión interrumpida; intentando reconectar. No se conserva historial de eventos.'; };
}
async function avisarActividad() {
  if (!usuarioActual) return;
  if (renovando) return renovando;
  const actual = generacion;
  ultimoAviso = Date.now();
  renovando = (async () => {
    try {
      const response = await fetch('/api/actividad', { method: 'POST' });
      const data = await response.json();
      if (actual !== generacion) return;
      if (response.status === 401) { mostrarLogin(data.error); return; }
      if (!response.ok) throw Error(data.error);
      actualizarTiempo(data);
    } catch { if (actual === generacion) el('estado-eventos').textContent = 'No se pudo renovar la sesión. Revisa la conexión.'; }
  })().finally(() => { renovando = null; });
  return renovando;
}
function actividad(event) {
  if (!usuarioActual || !event.isTrusted || document.hidden) return;
  clearTimeout(pendiente);
  const espera = Math.max(0, 1000 - (Date.now()-ultimoAviso));
  if (!espera) void avisarActividad();
  else pendiente = setTimeout(() => { pendiente = null; void avisarActividad(); }, espera);
}
// Solo la interacción produce renovaciones; ni el contador ni SSE envían actividad.
for(const name of ['pointermove','pointerdown','keydown','scroll','touchstart']) document.addEventListener(name, actividad, { passive: true, capture: true });

window.apiFetch = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (response.status === 401) {
    mostrarLogin('Tu sesión venció. Inicia sesión nuevamente.');
    throw Error('Sesión vencida');
  }
  return response;
};

document.addEventListener('DOMContentLoaded', () => {
  el('form-login').onsubmit = async event => {
    event.preventDefault();
    el('entrar').disabled = true;
    el('mensaje-login').textContent = 'Verificando en Oracle…';
    try {
      const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: el('usuario').value.trim(), password: el('password').value }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      el('password').value = '';
      await activarSesion(data);
    } catch(e) { el('mensaje-login').textContent = e.message; }
    finally { el('entrar').disabled = false; }
  };
  el('salir').onclick = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      mostrarLogin('Sesión cerrada.');
    } catch { el('estado-eventos').textContent = 'No se pudo cerrar la sesión. Reintenta.'; }
  };
  el('form-producto').onsubmit = async event => {
    event.preventDefault();
    el('guardar-producto').disabled = true;
    try {
      await avisarActividad();
      const response = await window.apiFetch('/api/productos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: el('nuevo-nombre').value.trim(), precio: Number(el('nuevo-precio').value) }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      el('resultado-producto').textContent = data.notificacionEnviada ? `Producto ${data.producto.id} guardado en Oracle y evento publicado en Redis.` : 'Producto guardado en Oracle; no se pudo publicar el aviso. Actualiza la página para verlo.';
      el('form-producto').reset();
      await window.onProductosActualizados();
    } catch(e) { el('resultado-producto').textContent = e.message; }
    finally { el('guardar-producto').disabled = false; }
  };
  setInterval(() => {
    if (!usuarioActual) return;
    const segundos = Math.max(0, Math.ceil((vence-Date.now())/1000));
    el('tiempo-sesion').textContent = `${segundos} s`;
    if (segundos === 0 && !renovando) mostrarLogin('Sesión cerrada por inactividad. Vuelve a ingresar.');
  }, 250);
  fetch('/api/sesion').then(async response => {
    if (response.ok) await activarSesion(await response.json());
    else if (response.status !== 401) mostrarLogin('No se pudo verificar la sesión. Revisa el servidor.');
  }).catch(() => mostrarLogin('No se pudo conectar al servidor.'));
});
