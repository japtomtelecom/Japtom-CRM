// src/app/api/olt-btpon/reset/route.js
//
// Botón especial para la OLT BTPON: fuerza varios ciclos de login+logout
// para liberar sesiones colgadas (esta OLT solo acepta 4 simultáneas).
// Requiere admin (mismo patrón que estado/route.js).

import { verificarAdmin } from "@/lib/verificarAdmin";
import { forzarLiberarSesionesBtpon } from "@/lib/oltBtpon";

export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const resultado = await forzarLiberarSesionesBtpon();
    return Response.json({
      ok: true,
      mensaje: `Sesiones de la OLT BTPON liberadas (${resultado.intentos} intentos).`,
    });
  } catch (e) {
    console.error("Error liberando sesiones OLT BTPON:", e);
    return Response.json(
      { error: "No se pudo liberar la sesión: " + e.message },
      { status: 502 }
    );
  }
}