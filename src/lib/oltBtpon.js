// src/lib/oltBtpon.js
//
// Lógica de conexión a la OLT BTPON (SEL1884) en 190.11.80.142.
// Login vía POST /userlogin?form=login (sesión por header X-Token),
// logout vía POST /userlogin?form=logout (mismo X-Token),
// consulta de ONUs vía GET /onu_allow_list?port_id=N, y potencia óptica
// vía GET /onumgmt?form=optical-diagnose&port_id=N&onu_id=M.
//
// IMPORTANTE: esta OLT solo acepta 4 sesiones simultáneas. Por eso cada
// función abre su propia sesión y SIEMPRE la cierra (try/finally) al
// terminar, sin reutilizar tokens entre invocaciones.

const OLT_HOST = process.env.OLT_BTPON_HOST;
const OLT_USER = process.env.OLT_BTPON_USER;
const OLT_PASSWORD_HASH = process.env.OLT_BTPON_PASSWORD_HASH;

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

async function logout(token) {
  if (!token) return;
  try {
    await fetch(`http://${OLT_HOST}/userlogin?form=logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Token": token,
        "Connection": "close",
      },
      body: JSON.stringify({ method: "set", param: { name: OLT_USER } }),
    });
  } catch {
    // Si el logout falla no queremos tumbar la respuesta principal;
    // en el peor caso esa sesión quedará colgada hasta expirar sola.
  }
}

// Ejecuta login -> operación -> logout SIEMPRE (incluso si fn lanza error).
async function conSesion(fn) {
  const token = await login();
  try {
    return await fn(token);
  } finally {
    await logout(token);
  }
}

async function peticionConToken(url, token) {
  return fetch(url, {
    method: "GET",
    headers: { "X-Token": token, "Connection": "close" },
  });
}

async function fetchOnuListForPort(portId) {
  return conSesion(async (token) => {
    const res = await peticionConToken(`http://${OLT_HOST}/onu_allow_list?port_id=${portId}`, token);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.code !== 1) return [];
    return Array.isArray(json.data) ? json.data : [];
  });
}

export async function obtenerOnusDePuerto(portId) {
  return fetchOnuListForPort(portId);
}

export async function obtenerEstadoOnu(portId, onuId) {
  const lista = await obtenerOnusDePuerto(portId);
  return lista.find((o) => o.onu_id === Number(onuId)) || null;
}

function aNumero(texto) {
  if (texto == null) return null;
  const n = parseFloat(String(texto).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export async function obtenerOpticaOnu(portId, onuId) {
  return conSesion(async (token) => {
    const res = await peticionConToken(
      `http://${OLT_HOST}/onumgmt?form=optical-diagnose&port_id=${portId}&onu_id=${onuId}`,
      token
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
  });
}

export async function obtenerTodasLasOnus(portIds) {
  const results = await Promise.all(portIds.map((p) => obtenerOnusDePuerto(p)));
  return results.flat();
}

// Botón especial: intenta liberar sesiones colgadas de logins anteriores
// haciendo varios ciclos login+logout (cubre el límite de 4 sesiones).
export async function forzarLiberarSesionesBtpon(intentos = 5) {
  for (let i = 0; i < intentos; i++) {
    const token = await login();
    await logout(token);
  }
  return { ok: true, intentos };
}

// Reinicia una ONU en la OLT BTPON. Es el mismo pedido que hace la web de la
// OLT al pulsar "Reboot ONU": POST /onumgmt?form=config con flags:1 (reinicio)
// y fec_mode:1 (valor fijo que la propia web manda desde la lista de ONUs).
// La OLT confirma con { code: 1 }. Usa conSesion para cerrar siempre la sesión.
export async function reiniciarOnuBtpon(portId, onuId) {
  return conSesion(async (token) => {
    const res = await fetch(`http://${OLT_HOST}/onumgmt?form=config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Token": token,
        "Connection": "close",
      },
      body: JSON.stringify({
        method: "set",
        param: {
          port_id: Number(portId),
          onu_id: Number(onuId),
          flags: 1,
          fec_mode: 1,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`La OLT BTPON rechazó el reinicio (HTTP ${res.status}).`);
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
      // respuesta sin JSON: se trata como error abajo
    }
    if (!json || json.code !== 1) {
      throw new Error(`La OLT BTPON no confirmó el reinicio (código ${json?.code ?? "desconocido"}).`);
    }
    return true;
  });
}
