const base = process.env.BASE_URL ?? 'http://localhost:3005';
let cookie = '';
export async function iniciarSesionCLI() {
  const response = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: process.env.DEMO_USER ?? 'demo', password: process.env.DEMO_PASSWORD ?? 'TallerRedis2026!' }) });
  const data = await response.json();
  if (!response.ok) throw Error(data.error);
  cookie = response.headers.get('set-cookie').split(';')[0];
}
export function fetchAPI(path, options = {}) {
  return fetch(base + path, { ...options, headers: { ...options.headers, Cookie: cookie } });
}
