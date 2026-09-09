import https from 'https';

// Hace una petición HTTPS a la OLT Ubiquiti y devuelve { status, headers, json, texto }.
// rejectUnauthorized:false porque la OLT usa un certificado autofirmado (normal en
// equipos de red sin dominio público) — confiamos en él porque accedemos por su
// IP directa, no a través de un dominio de terceros.
function peticionOlt(metodo, ruta, { token, body, timeoutMs = 18000 } = {}) {
  return new Promise((resolve, reject) => {
    const datos = body ? JSON.stringify(body) : null;
    const opciones = {
      hostname: process.env.OLT_ELALTO_HOST,
      port: 443,
      path: ruta,
      method: metodo,
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-auth-token': token } : {}),
        ...(datos ? { 'Content-Length': Buffer.byteLength(datos) } : {}),
      },
    };

    const req = https.request(opciones, (res) => {
      let cuerpo = '';
      res.on('data', (chunk) => (cuerpo += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = cuerpo ? JSON.parse(cuerpo) : null;
        } catch {
          // la respuesta no era JSON, se deja json en null y se usa "texto"
        }
        resolve({ status: res.statusCode, headers: res.headers, json, texto: cuerpo });
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Tiempo de espera agotado al conectar con la OLT.')));
    if (datos) req.write(datos);
    req.end();
  });
}

// Inicia sesión con OLT_ELALTO_USER / OLT_ELALTO_PASSWORD y devuelve el token
// (viene en el header "x-auth-token" de la respuesta del login, no en el cuerpo).
async function loginOltUbiquiti() {
  const usuario = process.env.OLT_ELALTO_USER;
  const password = process.env.OLT_ELALTO_PASSWORD;
  if (!usuario || !password) {
    throw new Error('Faltan las variables de entorno OLT_ELALTO_USER / OLT_ELALTO_PASSWORD.');
  }
  const t0 = Date.now();
  console.log('[oltUbiquiti] Iniciando login a', process.env.OLT_ELALTO_HOST);
  const res = await peticionOlt('POST', '/api/v1.0/user/login', {
    body: { username: usuario, password },
  });
  console.log('[oltUbiquiti] Login respondió en', Date.now() - t0, 'ms, status', res.status);
  const token = res.headers['x-auth-token'];
  if (res.status !== 200 || !token) {
    throw new Error(`La OLT no devolvió sesión válida al iniciar sesión (status ${res.status}).`);
  }
  return token;
}

async function obtenerOnusUnaVez() {
  const token = await loginOltUbiquiti();
  const t0 = Date.now();
  console.log('[oltUbiquiti] Pidiendo lista de ONUs…');
  const res = await peticionOlt('GET', '/api/v1.0/gpon/onus', { token });
  console.log(
    '[oltUbiquiti] Lista de ONUs respondió en',
    Date.now() - t0,
    'ms, status',
    res.status,
    ', registros:',
    Array.isArray(res.json) ? res.json.length : 'n/a'
  );
  if (res.status !== 200 || !Array.isArray(res.json)) {
    throw new Error(`No se pudo obtener la lista de ONUs de la OLT (status ${res.status}).`);
  }
  return res.json;
}

// Trae la lista completa de ONUs de la OLT (todas, de todos los puertos PON).
export async function obtenerOnusUbiquiti() {
  return obtenerOnusUnaVez();
}

// Busca, dentro de la lista de ONUs, la que corresponde a un cliente.
// Primero por MAC (más confiable, no cambia nunca) y, si no hay MAC
// cargado o no hubo coincidencia, por la IP asignada como respaldo (campo
// "router.wanAddress" de la OLT, formato "10.1.20.6/32" — se compara solo
// la parte de la IP, ignorando el "/32").
export function buscarOnu(onus, { mac, ip } = {}) {
  if (mac) {
    const macLimpia = mac.replace(/[^0-9a-f]/gi, '').toLowerCase();
    const porMac = onus.find((onu) => (onu.mac || '').replace(/[^0-9a-f]/gi, '').toLowerCase() === macLimpia);
    if (porMac) return porMac;
  }
  if (ip) {
    const ipLimpia = ip.split('/')[0].trim();
    const porIp = onus.find((onu) => (onu.router?.wanAddress || '').split('/')[0].trim() === ipLimpia);
    if (porIp) return porIp;
  }
  return null;
}
