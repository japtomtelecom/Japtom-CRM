'use client';

import { supabase } from './supabaseClient';

// ============================================================
// Por qué existe este archivo
// ------------------------------------------------------------
// En el celular, cuando el navegador manda la pestaña "a dormir" en
// segundo plano (pantalla bloqueada, cambio de app, etc.), el refresco
// automático del token de sesión de Supabase no siempre llega a correr a
// tiempo. Al volver a abrir la app, la sesión sigue "viéndose" activa (no
// manda al login), pero el token (access_token) guardado ya venció, y el
// servidor lo rechaza con "Sesión inválida." — esto pasaba en CUALQUIER
// acción de administrador (Ver potencia óptica, Sincronizar plan, etc.),
// no solo en la OLT.
//
// En vez de repetir en cada botón el mismo "pedí el token y llamá al
// fetch", este helper centraliza dos capas de seguridad:
//   1. Antes de llamar, si el token guardado está por vencer (o ya venció),
//      se pide uno nuevo con refreshSession() en vez de confiar en que el
//      temporizador automático ya lo haya hecho solo.
//   2. Si aun así el servidor responde 401 ("Sesión inválida"), se hace UN
//      reintento forzando otro refreshSession() antes de rendirse. Esto
//      cubre el caso en que el token recién obtenido en el paso 1 ya
//      estaba vencido por el reloj del celular o por la demora de red.
// ============================================================

async function obtenerTokenFresco() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) return null;

  const vencePronto =
    !session.expires_at || session.expires_at * 1000 - Date.now() < 60_000;

  if (!vencePronto) return session.access_token;

  const { data: refrescada } = await supabase.auth.refreshSession();
  return refrescada?.session?.access_token || session.access_token;
}

async function intentarLlamada(endpoint, body, token) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

// endpoint: ruta completa, ej. "/api/olt/optical" o "/api/mikrotik/toggle"
export async function llamarApiAdmin(endpoint, body) {
  const token = await obtenerTokenFresco();
  let { res, json } = await intentarLlamada(endpoint, body, token);

  if (!res.ok && res.status === 401) {
    const { data: refrescada } = await supabase.auth.refreshSession();
    if (refrescada?.session?.access_token) {
      ({ res, json } = await intentarLlamada(endpoint, body, refrescada.session.access_token));
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Tu sesión expiró. Cerrá sesión (menú lateral) y volvé a iniciar sesión.');
    }
    throw new Error(json.error || 'Error desconocido.');
  }
  return json;
}
