import https from 'https';

// Hace una petición HTTPS a la OLT Ubiquiti y devuelve { status, headers, json, texto }.
// rejectUnauthorized:false porque la OLT usa un certificado autofirmado (normal en
// equipos de red sin dominio público) — confiamos en él porque accedemos por su
// IP directa, no a través de un dominio de terceros.
function peticionOlt(metodo, ruta, { token, body } = {}) {
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
    req.setTimeout(10000, () => req.destroy(new Error('Tiempo de espera agotado al conectar con la OLT.')));
    if (datos) req.write(datos);
    req.end();
  });
}

// Inicia sesión con OLT_ELALTO_USER / OLT_ELALTO_PASSWORD y devuelve el token
// (viene en el header "x-auth-token" de la respuesta del login, no en el cuerpo).
export async function loginOltUbiquiti() {
  const usuario = process.env.OLT_ELALTO_USER;
  const password = process.env.OLT_ELALTO_PASSWORD;
  if (!usuario || !password) {
    throw new Error('Faltan las variables de entorno OLT_ELALTO_USER / OLT_ELALTO_PASSWORD.');
  }
  const res = await peticionOlt('POST', '/api/v1.0/user/login', {
    body: { username: usuario, password },
  });
  const token = res.headers['x-auth-token'];
  if (res.status !== 200 || !token) {
    throw new Error(`La OLT no devolvió sesión válida al iniciar sesión (status ${res.status}).`);
  }
  return token;
}

// Trae la lista completa de ONUs de la OLT (todas, de todos los puertos PON).
export async function obtenerOnusUbiquiti() {
  const token = await loginOltUbiquiti();
  const res = await peticionOlt('GET', '/api/v1.0/gpon/onus', { token });
  if (res.status !== 200 || !Array.isArray(res.json)) {
    throw new Error(`No se pudo obtener la lista de ONUs de la OLT (status ${res.status}).`);
  }
  return res.json;
}

// Busca, dentro de la lista de ONUs, la que tiene la misma IP asignada que el
// cliente en el CRM. El campo de la OLT es "router.wanAddress" con formato
// "10.1.20.6/32" — se compara solo la parte de la IP, ignorando el "/32".
export function buscarOnuPorIp(onus, ipAsignada) {
  if (!ipAsignada) return null;
  const ipLimpia = ipAsignada.split('/')[0].trim();
  return onus.find((onu) => (onu.router?.wanAddress || '').split('/')[0].trim() === ipLimpia) || null;
}
