// src/app/api/olt-btpon/route.js
//
// Lista completa de ONUs de todos los puertos PON de la OLT BTPON (SEL1884).
// Usado por la página general src/app/olt-btpon/page.js.

import { NextResponse } from "next/server";
import { obtenerTodasLasOnus } from "@/lib/oltBtpon";

const PORT_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

// Cache simple en memoria (3s) para no saturar la OLT con varios usuarios
// haciendo polling al mismo tiempo.
let cache = null;
const CACHE_TTL_MS = 3000;

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, data: cache.data, cached: true });
    }

    const data = await obtenerTodasLasOnus(PORT_IDS);
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
