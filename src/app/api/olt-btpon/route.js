// src/app/api/olt-btpon/route.js
//
// Consulta el estado de las ONUs de la OLT BTPON (SEL1884) en 190.11.80.142
// y lo expone como un endpoint propio para que el CRM haga polling sobre ESTE
// endpoint (nunca directo a la OLT desde el navegador del cliente).
//
// Esta OLT es independiente de la carpeta src/app/api/olt (V-Sol, por SSH)
// y de src/app/api/olt-elalto (Ubiquiti) — no las toca ni depende de ellas.
//
// Variables de entorno necesarias en Vercel (y en .env.local para probar local):
//   OLT_BTPON_HOST=190.11.80.142
//   OLT_BTPON_USER=xxxxx
//   OLT_BTPON_PASSWORD_HASH=xxxxx

import { NextResponse } from "next/server";

const OLT_HOST = process.env.OLT_BTPON_HOST;
const OLT_USER = process.env.OLT_BTPON_USER;
const OLT_PASSWORD_HASH = process.env.OLT_BTPON_PASSWORD_HASH;

// La OLT tiene 8 puertos PON (confirmado en el dropdown "Port ID": PON01-PON08).
const PORT_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

// --- Cache simple en memoria para no saturar la OLT con múltiples usuarios
// haciendo polling al mismo tiempo.
let cache = null;
const CACHE_TTL_MS = 3000; // 3 segundos

// --- Sesión reutilizable (X-Token) mientras la función esté caliente
let sessionToken = null;

async function login() {
  const res = await fetch(`http://${OLT_HOST}/userlogin?form=login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "set",
      param: { name: OLT_USER, key: OLT_PASSWORD_HASH },
    }),
  });

  if (!res.ok) {
    throw new Error(`Login a la OLT falló: ${res.status}`);
  }

  // La sesión viaja por el header X-Token (confirmado en DevTools).
  const token = res.headers.get("x-token");
  if (token) return token;

  throw new Error("No se encontró el header X-Token en la respuesta de login");
}

async function fetchOnuListForPort(portId, token) {
  const res = await fetch(`http://${OLT_HOST}/onu_allow_list?port_id=${portId}`, {
    method: "GET",
    headers: {
      "X-Token": token,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    // Puede que este puerto no exista en la OLT; no rompemos todo por eso.
    return [];
  }

  const json = await res.json();
  if (json.code !== 1) return [];
  // Si el puerto no tiene ONUs registradas, la OLT devuelve data: null
  // en vez de un array vacío — normalizamos para que no rompa el .flat().
  return Array.isArray(json.data) ? json.data : [];
}

async function fetchAllOnus() {
  if (!sessionToken) {
    sessionToken = await login();
  }

  try {
    const results = await Promise.all(
      PORT_IDS.map((portId) => fetchOnuListForPort(portId, sessionToken))
    );
    return results.flat();
  } catch (err) {
    if (err.message === "SESSION_EXPIRED") {
      // Reintenta una vez con una sesión nueva
      sessionToken = await login();
      const results = await Promise.all(
        PORT_IDS.map((portId) => fetchOnuListForPort(portId, sessionToken))
      );
      return results.flat();
    }
    throw err;
  }
}

export async function GET() {
  try {
    // Sirve desde caché si está fresca (comparten la consulta varios usuarios)
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, data: cache.data, cached: true });
    }

    const data = await fetchAllOnus();
    cache = { data, timestamp: Date.now() };

    return NextResponse.json({ ok: true, data, cached: false });
  } catch (err) {
    console.error("Error consultando OLT BTPON:", err);
    return NextResponse.json(
      { ok: false, error: "No se pudo consultar el estado de la OLT" },
      { status: 502 }
    );
  }
}
