// src/lib/oltBtpon.js
//
// Lógica de conexión a la OLT BTPON (SEL1884) en 190.11.80.142.
// Login vía POST /userlogin?form=login (sesión por header X-Token),
// consulta de ONUs vía GET /onu_allow_list?port_id=N, y potencia óptica
// vía GET /onumgmt?form=optical-diagnose&port_id=N&onu_id=M.
//
// Variables de entorno necesarias (Vercel y .env.local):
//   OLT_BTPON_HOST=190.11.80.142
//   OLT_BTPON_USER=xxxxx
//   OLT_BTPON_PASSWORD_HASH=xxxxx

const OLT_HOST = process.env.OLT_BTPON_HOST;
const OLT_USER = process.env.OLT_BTPON_USER;
const OLT_PASSWORD_HASH = process.env.OLT_BTPON_PASSWORD_HASH;

// Sesión reutilizable (X-Token) mientras la función serverless esté caliente.
let sessionToken = null;

async function login() {
  const res = await fetch(`http://${OLT_HOST}/userlogin?form=login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Connection": "close" },
    body: JSON.stringify({
      method: "set",
      param: { name: OLT_USER, key: OLT_PASSWORD_HASH },
    }),
  });

  if (!res.ok) {
    throw new Error(`Login a la OLT BTPON falló: ${res.status}`);
  }

  const token = res.headers.get("x-token");
  if (token) return token;

  throw new Error("No se encontró el header X-Token en la respuesta de login");
}

async function peticionConToken(url) {
  if (!sessionToken) {
    sessionToken = await login();
  }

  let res = await fetch(url, {
    method: "GET",
    headers: { "X-Token": sessionToken, "Connection": "close" },
  });

  if (res.status === 401 || res.status === 403) {
    sessionToken = await login();
    res = await fetch(url, {
      method: "GET",
      headers: { "X-Token": sessionToken, "Connection": "close" },
    });
  }

  return res;
}

async function fetchOnuListForPort(portId) {
  const res = await peticionConToken(`http://${OLT_HOST}/onu_allow_list?port_id=${portId}`);
  if (!res.ok) return [];

  const json = await res.json();
  if (json.code !== 1) return [];
  return Array.isArray(json.data) ? json.data : [];
}

// Devuelve la lista de ONUs de un puerto PON específico.
export async function obtenerOnusDePuerto(portId) {
  return fetchOnuListForPort(portId);
}

// Busca una ONU puntual (para la ficha de un cliente) dentro de su puerto.
export async function obtenerEstadoOnu(portId, onuId) {
  const lista = await obtenerOnusDePuerto(portId);
  return lista.find((o) => o.onu_id === Number(onuId)) || null;
}

// Convierte un texto tipo "1.6599 dBm" / " 23 °C" / "3.32 V" a número.
function aNumero(texto) {
  if (texto == null) return null;
  const n = parseFloat(String(texto).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

// Trae la potencia óptica (Rx/Tx/temperatura/voltaje) de una ONU puntual.
export async function obtenerOpticaOnu(portId, onuId) {
  const res = await peticionConToken(
    `http://${OLT_HOST}/onumgmt?form=optical-diagnose&port_id=${portId}&onu_id=${onuId}`
  );
  if (!res.ok) return null;

  const json = await res.json();
  if (json.code !== 1 || !json.data) return null;

  return {
    temperaturaC: aNumero(json.data.work_temprature),
    voltajeV: aNumero(json.data.work_voltage),
    biasMa: aNumero(json.data.transmit_bias),
    txDbm: aNumero(json.data.transmit_power),
    rxDbm: aNumero(json.data.receive_power),
  };
}

// Trae todas las ONUs de todos los puertos (para el listado general).
export async function obtenerTodasLasOnus(portIds) {
  const results = await Promise.all(portIds.map((p) => obtenerOnusDePuerto(p)));
  return results.flat();
}
